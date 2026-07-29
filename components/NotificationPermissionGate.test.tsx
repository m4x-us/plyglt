// ============================================================
// NotificationPermissionGate.test.tsx — Tests for the Review Reminders permission explainer
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NotificationPermissionGate } from "./NotificationPermissionGate";

describe("NotificationPermissionGate", () => {
  afterEach(cleanup);

  it("shows the pre-dialog explanation when permission is 'default'", () => {
    render(<NotificationPermissionGate permission="default" />);
    expect(
      screen.getByText(
        "plyglt will send brief notifications during your workday — 3 to 5 cards per session, under a minute each. Allow notifications to enable this."
      )
    ).toBeInTheDocument();
  });

  it("shows the System Settings recovery instruction when permission is 'denied'", () => {
    render(<NotificationPermissionGate permission="denied" />);
    expect(
      screen.getByText("Enable notifications for plyglt in System Settings → Notifications.")
    ).toBeInTheDocument();
  });

  it("renders nothing when permission is 'granted'", () => {
    const { container } = render(<NotificationPermissionGate permission="granted" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when permission is 'unsupported'", () => {
    const { container } = render(<NotificationPermissionGate permission="unsupported" />);
    expect(container).toBeEmptyDOMElement();
  });
});
