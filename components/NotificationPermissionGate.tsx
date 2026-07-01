// ============================================================
// NotificationPermissionGate.tsx — Inline explainer for Review Reminders toggle
// Shown below the toggle; explains before the OS dialog fires (default)
// or surfaces the recovery path after a denial (denied).
// ============================================================

type PermissionState = "granted" | "denied" | "default" | "unsupported";

interface Props {
  permission: PermissionState;
}

export function NotificationPermissionGate({ permission }: Props) {
  if (permission === "denied") {
    return (
      <p className="text-xs text-yellow-600 mt-2">
        Enable notifications for plyglt in System Settings → Notifications.
      </p>
    );
  }
  if (permission === "default") {
    return (
      <p className="text-xs text-gray-500 mt-2">
        plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this.
      </p>
    );
  }
  return null;
}
