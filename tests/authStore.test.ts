// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";

const { tauriState, mockOpenExternalUrl, mockOnDeepLinkUrl, mockGetCurrentDeepLinkUrls, mockUnregisterPushToken } = vi.hoisted(() => ({
  tauriState: { isTauri: false as boolean },
  mockOpenExternalUrl: vi.fn().mockResolvedValue(undefined),
  mockOnDeepLinkUrl: vi.fn().mockResolvedValue(() => {}),
  mockGetCurrentDeepLinkUrls: vi.fn().mockResolvedValue(null),
  // Round-17 audit fix: authStore.ts's signOut() now unregisters the device's push
  // token BEFORE calling the real client.auth.signOut() (see the dedicated describe
  // block below) — mocked here so tests can assert it's called with the right args
  // and in the right order, without a real Supabase round-trip.
  mockUnregisterPushToken: vi.fn().mockResolvedValue({ ok: true }),
}));

// isTauri is a getter so it reflects tauriState.isTauri at read time, matching the
// pattern app/settings/page.test.tsx already uses for the same real module.
vi.mock("@/lib/tauri", () => ({
  get isTauri() { return tauriState.isTauri; },
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
  onDeepLinkUrl: (...args: unknown[]) => mockOnDeepLinkUrl(...args),
  getCurrentDeepLinkUrls: (...args: unknown[]) => mockGetCurrentDeepLinkUrls(...args),
}));

vi.mock("@/lib/pushTokenClient", () => ({
  unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
}));

function makeMockClient() {
  const onAuthStateChangeCallbacks: Array<(event: string, session: unknown) => void> = [];
  const mockAuth = {
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      onAuthStateChangeCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  };
  return { auth: mockAuth, onAuthStateChangeCallbacks };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/supabaseClient");
  tauriState.isTauri = false;
  mockOpenExternalUrl.mockClear();
  mockOnDeepLinkUrl.mockClear().mockResolvedValue(() => {});
  mockGetCurrentDeepLinkUrls.mockClear().mockResolvedValue(null);
  mockUnregisterPushToken.mockClear().mockResolvedValue({ ok: true });
  // useSyncStore persists deviceId to localStorage (lib/storage.ts's web-build path) —
  // unlike the JS module registry, localStorage survives vi.resetModules(), so a
  // deviceId set in one test would otherwise silently rehydrate into the next test's
  // freshly re-imported syncStore instance.
  localStorage.clear();
});

describe("authStore — not configured (getSupabaseClient returns null)", () => {
  it("resolves to signed-out immediately instead of staying stuck on loading", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => null }));
    const { useAuthStore } = await import("@/store/authStore");
    const state = useAuthStore.getState();
    expect(state.status).toBe("signed-out");
    expect(state.userId).toBe(null);
    expect(state.email).toBe(null);
  });

  it("signInWithApple returns ok:false with a clear error instead of throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => null }));
    const { useAuthStore } = await import("@/store/authStore");
    const result = await useAuthStore.getState().signInWithApple();
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("signInWithGoogle returns ok:false with a clear error instead of throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => null }));
    const { useAuthStore } = await import("@/store/authStore");
    const result = await useAuthStore.getState().signInWithGoogle();
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("signOut returns ok:false with a clear error instead of throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => null }));
    const { useAuthStore } = await import("@/store/authStore");
    const result = await useAuthStore.getState().signOut();
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });
});

describe("authStore — configured", () => {
  it("starts in 'loading' status before onAuthStateChange has reported anything", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");
    expect(useAuthStore.getState().status).toBe("loading");
  });

  it("registers exactly one onAuthStateChange listener at module load", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    await import("@/store/authStore");
    expect(mock.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("reflects a signed-in session with the real user id and email once onAuthStateChange fires", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-abc-123", email: "max@example.com" } });

    const state = useAuthStore.getState();
    expect(state.status).toBe("signed-in");
    expect(state.userId).toBe("user-abc-123");
    expect(state.email).toBe("max@example.com");
  });

  it("falls back to null email when the provider doesn't return one", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-xyz" } });

    expect(useAuthStore.getState().email).toBe(null);
  });

  it("clears userId/email and reflects signed-out when onAuthStateChange reports session:null", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-abc", email: "a@b.com" } });
    mock.onAuthStateChangeCallbacks[0]!("SIGNED_OUT", null);

    const state = useAuthStore.getState();
    expect(state.status).toBe("signed-out");
    expect(state.userId).toBe(null);
    expect(state.email).toBe(null);
  });

  it("signInWithApple calls signInWithOAuth with provider 'apple' and a redirectTo back to /settings/, and returns ok:true on success", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithApple();

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: { redirectTo: "http://localhost:3000/settings/" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("signInWithGoogle calls signInWithOAuth with provider 'google' and a redirectTo back to /settings/, and returns ok:true on success", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithGoogle();

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/settings/" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("signInWithGoogle surfaces the real error message and does not throw when signInWithOAuth errors", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    mock.auth.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: "provider not enabled" } });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithGoogle();
    expect(result).toEqual({ ok: false, error: "provider not enabled" });
  });

  it("signOut calls the real signOut method and returns ok:true on success", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signOut();

    expect(mock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("signOut surfaces the real error message and does not throw when signOut errors", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    mock.auth.signOut.mockResolvedValueOnce({ error: { message: "network error" } });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signOut();
    expect(result).toEqual({ ok: false, error: "network error" });
  });

  it("signOut alone does not update store state — the SIGNED_OUT event via onAuthStateChange is the single source of that transition", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-abc", email: "a@b.com" } });
    await useAuthStore.getState().signOut();

    // signOut() resolving does not itself clear state — only a real SIGNED_OUT event does.
    expect(useAuthStore.getState().status).toBe("signed-in");
  });
});

// Round-17 audit finding (Security Agent S), independently verified against the real
// @supabase/auth-js source (GoTrueClient's _removeSession() clears local session storage
// BEFORE notifying SIGNED_OUT subscribers) and push_tokens' RLS delete policy
// (auth.uid() = user_id): the reactive unregister that used to fire only from
// hooks/usePushRegistration.ts once userId went null always ran AFTER the session was
// already cleared, so its DELETE carried no authorization and silently matched zero rows
// — every ordinary sign-out left a Pro user's push token registered forever. Fixed by
// unregistering here, first, while the session is still valid.
describe("authStore — signOut unregisters the device's push token before clearing the session (round-17 audit fix)", () => {
  it("calls unregisterPushToken with the current userId/deviceId BEFORE client.auth.signOut(), while the session is still valid", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");
    // Must be the SAME module instance authStore.ts itself resolved @/store/syncStore
    // to after this test's vi.resetModules() call — a static top-of-file import would
    // be a stale pre-reset instance authStore.ts never reads from.
    const { useSyncStore } = await import("@/store/syncStore");
    useSyncStore.setState({ deviceId: "device-1" });

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-1", email: "a@b.com" } });

    const callOrder: string[] = [];
    mockUnregisterPushToken.mockImplementationOnce(async () => {
      callOrder.push("unregisterPushToken");
      return { ok: true };
    });
    mock.auth.signOut.mockImplementationOnce(async () => {
      callOrder.push("client.auth.signOut");
      return { error: null };
    });

    await useAuthStore.getState().signOut();

    expect(mockUnregisterPushToken).toHaveBeenCalledWith("user-1", "device-1");
    // Deletion Test: moving the unregisterPushToken call to fire AFTER (or reactively
    // from a userId->null transition following) client.auth.signOut() reproduces the
    // exact bug this fix closes — this ordering assertion is what catches that
    // regression; toHaveBeenCalledWith alone would not.
    expect(callOrder).toEqual(["unregisterPushToken", "client.auth.signOut"]);
  });

  it("does not call unregisterPushToken when signed out already (no userId to unregister)", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");
    const { useSyncStore } = await import("@/store/syncStore");
    useSyncStore.setState({ deviceId: "device-1" });

    await useAuthStore.getState().signOut();

    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
    expect(mock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("does not call unregisterPushToken when no local deviceId exists yet (nothing was ever registered on this device)", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");
    // useSyncStore.deviceId defaults to null — no enqueueReviewEvent call in this test.

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-1", email: "a@b.com" } });
    await useAuthStore.getState().signOut();

    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
    expect(mock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("logs the failure but still proceeds with the real sign-out when unregisterPushToken fails", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");
    const { useSyncStore } = await import("@/store/syncStore");
    useSyncStore.setState({ deviceId: "device-1" });
    mockUnregisterPushToken.mockResolvedValueOnce({ ok: false, error: "network error" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mock.onAuthStateChangeCallbacks[0]!("SIGNED_IN", { user: { id: "user-1", email: "a@b.com" } });
    const result = await useAuthStore.getState().signOut();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-AUTH-SIGNOUT-PUSH"));
    expect(mock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });

    errorSpy.mockRestore();
  });
});

describe("authStore — desktop OAuth path (Task #519, isTauri)", () => {
  it("signInWithApple calls signInWithOAuth with skipBrowserRedirect + the plyglt:// redirectTo, then opens the returned URL via openExternalUrl", async () => {
    vi.resetModules();
    tauriState.isTauri = true;
    const mock = makeMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://appleid.apple.com/authorize?x=1" }, error: null });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithApple();

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: { skipBrowserRedirect: true, redirectTo: "plyglt://auth-callback" },
    });
    expect(mockOpenExternalUrl).toHaveBeenCalledWith("https://appleid.apple.com/authorize?x=1");
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false and does not open a browser when signInWithOAuth returns no authorize URL", async () => {
    vi.resetModules();
    tauriState.isTauri = true;
    const mock = makeMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithGoogle();

    expect(result).toEqual({ ok: false, error: "No authorize URL returned." });
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  it("surfaces the real error and does not open a browser when signInWithOAuth errors", async () => {
    vi.resetModules();
    tauriState.isTauri = true;
    const mock = makeMockClient();
    mock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: "provider not enabled" } });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithApple();

    expect(result).toEqual({ ok: false, error: "provider not enabled" });
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  it("registers a deep-link URL listener and checks for a cold-start URL once at module load", async () => {
    vi.resetModules();
    tauriState.isTauri = true;
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    await import("@/store/authStore");

    expect(mockOnDeepLinkUrl).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentDeepLinkUrls).toHaveBeenCalledTimes(1);
  });

  it("in web mode, never registers a deep-link listener or checks for a cold-start URL", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    await import("@/store/authStore");

    expect(mockOnDeepLinkUrl).not.toHaveBeenCalled();
    expect(mockGetCurrentDeepLinkUrls).not.toHaveBeenCalled();
  });
});

describe("handleDeepLinkCallback", () => {
  it("ignores a URL that isn't this app's own plyglt:// scheme", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { handleDeepLinkCallback } = await import("@/store/authStore");

    await handleDeepLinkCallback("https://example.com/callback?code=abc");

    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("ignores a plyglt:// URL with no code param", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { handleDeepLinkCallback } = await import("@/store/authStore");

    await handleDeepLinkCallback("plyglt://auth-callback");

    expect(mock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("extracts the code from a real callback URL and calls exchangeCodeForSession with exactly that value", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { handleDeepLinkCallback } = await import("@/store/authStore");

    await handleDeepLinkCallback("plyglt://auth-callback?code=abc123&state=xyz");

    expect(mock.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it("does not throw when exchangeCodeForSession errors (e.g. a reused/expired code) — logs and resolves", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    mock.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { message: "invalid grant" } });
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { handleDeepLinkCallback } = await import("@/store/authStore");

    await expect(handleDeepLinkCallback("plyglt://auth-callback?code=abc123")).resolves.toBeUndefined();
  });

  it("no-ops when Supabase isn't configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => null }));
    const { handleDeepLinkCallback } = await import("@/store/authStore");

    await expect(handleDeepLinkCallback("plyglt://auth-callback?code=abc123")).resolves.toBeUndefined();
  });
});
