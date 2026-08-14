// ============================================================
// push.rs — iOS APNs push-notification native glue (Task #522)
// ============================================================
// Owns the two pieces of remote-notification support that no Tauri plugin
// provides (verified against tauri-plugin-notification 2.3.3's actual iOS
// Swift source, whose UNUserNotificationCenter delegate deliberately ignores
// anything with a UNPushNotificationTrigger, and which never calls
// registerForRemoteNotifications at all):
//
// 1. APNs device-token registration. `register_for_push_notifications`
//    dynamically adds application:didRegisterForRemoteNotificationsWithDeviceToken:
//    / didFailToRegisterForRemoteNotificationsWithError: to tao's runtime-declared
//    "AppDelegate" ObjC class (tao declares the class but no remote-notification
//    methods — see tao src/platform_impl/ios/view.rs), then calls
//    UIApplication.registerForRemoteNotifications on the main thread. The token
//    arrives as NSData, is hex-encoded, cached in PUSH_TOKEN, and emitted to the
//    webview as the "push:device-token" event. lib/tauriPush.ts forwards it to
//    lib/pushTokenClient.ts's registerPushToken() (the Supabase push_tokens row
//    the send-interrupt-notifications edge function dispatches to).
//
// 2. Push-notification tap handling. install() (called from lib.rs setup, iOS
//    only) wraps whatever UNUserNotificationCenter delegate is already installed
//    (tauri-plugin-notification's NotificationManager) in a proxy: push-triggered
//    taps set PENDING_TAP and emit "push:notification-tapped"; everything else is
//    forwarded verbatim to the original delegate so local-notification behavior
//    is untouched. PENDING_TAP covers the cold-start case where the tap arrives
//    before the webview has any JS listening — hooks/usePushInterruptTap.ts
//    drains it via take_pending_push_tap on mount, mirroring the
//    getCurrentDeepLinkUrls/onDeepLinkUrl two-path pattern from Task #171.
//
// The proxy must be retained in DELEGATE_PROXY: UNUserNotificationCenter holds
// its delegate weakly, so dropping the Retained would silently uninstall us.
// ============================================================
// DEPENDS ON: tauri (Emitter), objc2 family (iOS only)
// USED BY: lib.rs (module registration, setup hook, invoke handler)
// ============================================================

/// Event names shared with lib/tauriPush.ts — keep the two files in sync.
#[cfg(target_os = "ios")]
const EVENT_TOKEN: &str = "push:device-token";
#[cfg(target_os = "ios")]
const EVENT_TAP: &str = "push:notification-tapped";
#[cfg(target_os = "ios")]
const EVENT_FAILED: &str = "push:registration-failed";

// ---------------------------------------------------------------------------
// Commands. Single definitions with no-op non-iOS bodies (same pattern as
// lib.rs's update_tray_badge) so invoke_handler registration never needs its
// own cfg conditional.
// ---------------------------------------------------------------------------

/// Kicks off APNs registration. Returns true when registration was started
/// (iOS), false on every other platform — JS uses this as the platform gate
/// instead of user-agent sniffing.
#[tauri::command]
pub fn register_for_push_notifications(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "ios")]
    {
        ios::install_token_callbacks();
        // registerForRemoteNotifications must run on the main thread; a Tauri
        // command executes on a worker thread.
        let result = app.run_on_main_thread(|| ios::register_for_remote_notifications());
        if let Err(e) = result {
            eprintln!("[ERR-PUSH-MAINTHREAD-{}] run_on_main_thread failed: {e}", timestamp());
            return false;
        }
        true
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = app;
        false
    }
}

/// Returns the cached APNs token if the OS already delivered one this launch
/// (covers a webview that starts listening after the token event fired).
#[tauri::command]
pub fn get_push_token() -> Option<String> {
    #[cfg(target_os = "ios")]
    {
        ios::PUSH_TOKEN.lock().unwrap().clone()
    }
    #[cfg(not(target_os = "ios"))]
    {
        None
    }
}

/// Consumes the pending-tap flag (true exactly once per un-drained tap).
/// Cold-start path: the tap that launched the app fired before JS existed.
#[tauri::command]
pub fn take_pending_push_tap() -> bool {
    #[cfg(target_os = "ios")]
    {
        ios::PENDING_TAP.swap(false, std::sync::atomic::Ordering::SeqCst)
    }
    #[cfg(not(target_os = "ios"))]
    {
        false
    }
}

#[cfg(target_os = "ios")]
pub fn install(app: &tauri::AppHandle) {
    ios::install(app);
}

#[cfg(target_os = "ios")]
fn timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// iOS implementation
// ---------------------------------------------------------------------------
#[cfg(target_os = "ios")]
mod ios {
    use std::sync::atomic::AtomicBool;
    use std::sync::{Mutex, OnceLock};

    use block2::DynBlock;
    use objc2::rc::Retained;
    use objc2::runtime::{AnyClass, AnyObject, ProtocolObject, Sel};
    use objc2::{define_class, msg_send, sel, AllocAnyThread, ClassType, DefinedClass, MainThreadMarker};
    use objc2_foundation::{NSData, NSError, NSObject, NSObjectProtocol};
    use objc2_ui_kit::UIApplication;
    use objc2_user_notifications::{
        UNNotification, UNNotificationPresentationOptions, UNNotificationResponse,
        UNPushNotificationTrigger, UNUserNotificationCenter, UNUserNotificationCenterDelegate,
    };
    use tauri::Emitter;

    use super::{timestamp, EVENT_FAILED, EVENT_TAP, EVENT_TOKEN};

    pub(super) static PUSH_TOKEN: Mutex<Option<String>> = Mutex::new(None);
    pub(super) static PENDING_TAP: AtomicBool = AtomicBool::new(false);
    static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
    static TOKEN_CALLBACKS_INSTALLED: AtomicBool = AtomicBool::new(false);

    pub(super) fn install(app: &tauri::AppHandle) {
        let _ = APP_HANDLE.set(app.clone());
        install_delegate_proxy();
    }

    fn emit(event: &str, payload: String) {
        if let Some(app) = APP_HANDLE.get() {
            let _ = app.emit(event, payload);
        }
    }

    // -- APNs token registration ------------------------------------------------

    pub(super) fn register_for_remote_notifications() {
        let Some(mtm) = MainThreadMarker::new() else {
            eprintln!(
                "[ERR-PUSH-NOTMAIN-{}] register_for_remote_notifications reached off the main thread",
                timestamp()
            );
            return;
        };
        let app = UIApplication::sharedApplication(mtm);
        app.registerForRemoteNotifications();
    }

    extern "C-unwind" fn did_register_for_remote(
        _this: *mut AnyObject,
        _sel: Sel,
        _application: *mut AnyObject,
        device_token: *mut AnyObject,
    ) {
        let hex: String = unsafe {
            let data = &*(device_token as *const NSData);
            data.to_vec().iter().map(|b| format!("{b:02x}")).collect()
        };
        *PUSH_TOKEN.lock().unwrap() = Some(hex.clone());
        emit(EVENT_TOKEN, hex);
    }

    extern "C-unwind" fn did_fail_to_register(
        _this: *mut AnyObject,
        _sel: Sel,
        _application: *mut AnyObject,
        error: *mut AnyObject,
    ) {
        let description = unsafe {
            let error = &*(error as *const NSError);
            error.localizedDescription().to_string()
        };
        eprintln!(
            "[ERR-PUSH-REGISTER-{}] didFailToRegisterForRemoteNotifications: {description}",
            timestamp()
        );
        emit(EVENT_FAILED, description);
    }

    /// Adds the two token-delivery methods to tao's "AppDelegate" class.
    /// Idempotent — class_addMethod refuses duplicates, and the flag skips the
    /// runtime call entirely after the first success.
    pub(super) fn install_token_callbacks() {
        use std::sync::atomic::Ordering;
        if TOKEN_CALLBACKS_INSTALLED.swap(true, Ordering::SeqCst) {
            return;
        }
        let Some(cls) = AnyClass::get(c"AppDelegate") else {
            eprintln!(
                "[ERR-PUSH-NODELEGATE-{}] AppDelegate class not found; APNs callbacks not installed",
                timestamp()
            );
            return;
        };
        unsafe {
            // "v@:@@" — returns void, self, _cmd, two object arguments.
            objc2::ffi::class_addMethod(
                cls as *const AnyClass as *mut AnyClass,
                sel!(application:didRegisterForRemoteNotificationsWithDeviceToken:),
                std::mem::transmute::<
                    extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject, *mut AnyObject),
                    unsafe extern "C-unwind" fn(),
                >(did_register_for_remote),
                c"v@:@@".as_ptr(),
            );
            objc2::ffi::class_addMethod(
                cls as *const AnyClass as *mut AnyClass,
                sel!(application:didFailToRegisterForRemoteNotificationsWithError:),
                std::mem::transmute::<
                    extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject, *mut AnyObject),
                    unsafe extern "C-unwind" fn(),
                >(did_fail_to_register),
                c"v@:@@".as_ptr(),
            );
        }
    }

    // -- Notification-tap delegate proxy ----------------------------------------

    fn is_push_notification(notification: &UNNotification) -> bool {
        match notification.request().trigger() {
            Some(trigger) => trigger.isKindOfClass(UNPushNotificationTrigger::class()),
            None => false,
        }
    }

    pub(super) struct ProxyIvars {
        original: Option<Retained<ProtocolObject<dyn UNUserNotificationCenterDelegate>>>,
    }

    define_class!(
        #[unsafe(super(NSObject))]
        #[name = "PlygltPushDelegateProxy"]
        #[ivars = ProxyIvars]
        pub(super) struct PushDelegateProxy;

        unsafe impl NSObjectProtocol for PushDelegateProxy {}

        unsafe impl UNUserNotificationCenterDelegate for PushDelegateProxy {
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                center: &UNUserNotificationCenter,
                notification: &UNNotification,
                completion: &DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                if is_push_notification(notification) {
                    // Foregrounded app: the app itself is the interrupt surface,
                    // a system banner on top of it would be noise. Matches the
                    // iOS default of not presenting remote pushes in-foreground.
                    completion.call((UNNotificationPresentationOptions::empty(),));
                    return;
                }
                if let Some(original) = &self.ivars().original {
                    if original.respondsToSelector(sel!(
                        userNotificationCenter:willPresentNotification:withCompletionHandler:
                    )) {
                        unsafe {
                            let _: () = msg_send![
                                &**original,
                                userNotificationCenter: center,
                                willPresentNotification: notification,
                                withCompletionHandler: completion as *const DynBlock<dyn Fn(UNNotificationPresentationOptions)> as *mut AnyObject
                            ];
                        }
                        return;
                    }
                }
                completion.call((UNNotificationPresentationOptions::empty(),));
            }

            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                completion: &DynBlock<dyn Fn()>,
            ) {
                let notification = response.notification();
                if is_push_notification(&notification) {
                    // Cold start: JS isn't listening yet — flag survives until
                    // usePushInterruptTap drains it. Warm: the event routes now
                    // and the hook clears the flag right after.
                    PENDING_TAP.store(true, std::sync::atomic::Ordering::SeqCst);
                    emit(EVENT_TAP, String::new());
                    completion.call(());
                    return;
                }
                if let Some(original) = &self.ivars().original {
                    if original.respondsToSelector(sel!(
                        userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:
                    )) {
                        unsafe {
                            let _: () = msg_send![
                                &**original,
                                userNotificationCenter: center,
                                didReceiveNotificationResponse: response,
                                withCompletionHandler: completion as *const DynBlock<dyn Fn()> as *mut AnyObject
                            ];
                        }
                        return;
                    }
                }
                completion.call(());
            }
        }
    );

    impl PushDelegateProxy {
        fn new(
            original: Option<Retained<ProtocolObject<dyn UNUserNotificationCenterDelegate>>>,
        ) -> Retained<Self> {
            let this = Self::alloc().set_ivars(ProxyIvars { original });
            unsafe { msg_send![super(this), init] }
        }
    }

    fn install_delegate_proxy() {
        let center = UNUserNotificationCenter::currentNotificationCenter();
        let original = center.delegate();
        let proxy = PushDelegateProxy::new(original);
        center.setDelegate(Some(ProtocolObject::from_ref(&*proxy)));
        // The center holds its delegate weakly; the proxy must outlive the whole
        // app run. Deliberately leak the single app-lifetime instance instead of
        // parking the Retained in a static — the ivars hold a non-Send
        // ProtocolObject, so a static would need an unsafe Send/Sync wrapper for
        // an object only ObjC ever touches again.
        std::mem::forget(proxy);
    }
}
