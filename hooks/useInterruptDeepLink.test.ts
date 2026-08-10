// @vitest-environment jsdom
// ============================================================
// useInterruptDeepLink.test.ts — Tests for the plyglt://interrupt routing hook (Task #171)
// ============================================================
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { tauriState, mockPush } = vi.hoisted(() => ({
  tauriState: {
    isTauri: true as boolean,
    deepLinkHandler: null as ((urls: string[]) => void) | null,
    coldStartUrls: null as string[] | null,
  },
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/tauri", () => ({
  get isTauri() {
    return tauriState.isTauri;
  },
  onDeepLinkUrl: vi.fn((handler: (urls: string[]) => void) => {
    tauriState.deepLinkHandler = handler;
    return Promise.resolve(() => {
      tauriState.deepLinkHandler = null;
    });
  }),
  getCurrentDeepLinkUrls: vi.fn(() => Promise.resolve(tauriState.coldStartUrls)),
}));

import { useInterruptDeepLink, isInterruptDeepLink } from "@/hooks/useInterruptDeepLink";

beforeEach(() => {
  vi.clearAllMocks();
  tauriState.isTauri = true;
  tauriState.deepLinkHandler = null;
  tauriState.coldStartUrls = null;
});

describe("isInterruptDeepLink", () => {
  it("matches the exact plyglt://interrupt URL", () => {
    expect(isInterruptDeepLink("plyglt://interrupt")).toBe(true);
  });

  it("does not match a different plyglt:// host, e.g. the OAuth auth-callback URL", () => {
    expect(isInterruptDeepLink("plyglt://auth-callback?code=abc")).toBe(false);
  });

  it("does not match a URL outside this app's own scheme", () => {
    expect(isInterruptDeepLink("https://example.com/interrupt")).toBe(false);
  });

  it("does not match plyglt:// with an empty host (no throw, just no match)", () => {
    expect(isInterruptDeepLink("plyglt://")).toBe(false);
  });

  it("matches regardless of host casing — a custom URL scheme's host is opaque and NOT lowercased by the parser", () => {
    expect(isInterruptDeepLink("plyglt://INTERRUPT")).toBe(true);
    expect(isInterruptDeepLink("plyglt://Interrupt")).toBe(true);
  });

  it("does not throw for a genuinely unparseable URL — returns false and logs the error, matching store/authStore.ts's parse-error guard", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isInterruptDeepLink("plyglt://[invalid")).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("ERR-DEEPLINK-INTERRUPT-PARSE"),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});

describe("useInterruptDeepLink — cold start (getCurrentDeepLinkUrls)", () => {
  it("navigates to /study?mode=interrupt when the app launched via a plyglt://interrupt URL", async () => {
    tauriState.coldStartUrls = ["plyglt://interrupt"];
    renderHook(() => useInterruptDeepLink());
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt"));
  });

  it("does not navigate when the cold-start URL is unrelated (e.g. auth-callback)", async () => {
    tauriState.coldStartUrls = ["plyglt://auth-callback?code=abc"];
    renderHook(() => useInterruptDeepLink());
    // Let any pending microtasks from getCurrentDeepLinkUrls resolve before asserting.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate or throw when there is no cold-start URL", async () => {
    tauriState.coldStartUrls = null;
    renderHook(() => useInterruptDeepLink());
    await Promise.resolve();
    await Promise.resolve();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useInterruptDeepLink — warm start (onDeepLinkUrl)", () => {
  it("navigates to /study?mode=interrupt when a plyglt://interrupt URL arrives while the app is running", async () => {
    renderHook(() => useInterruptDeepLink());
    // Proves a handler was actually registered (a function), not merely that it isn't
    // null — matches components/InterruptHandler.test.tsx's identical idiom.
    await vi.waitFor(() => expect(typeof tauriState.deepLinkHandler).toBe("function"));

    tauriState.deepLinkHandler!(["plyglt://interrupt"]);

    expect(mockPush).toHaveBeenCalledWith("/study?mode=interrupt");
  });

  it("does not navigate when a warm-start URL is unrelated", async () => {
    renderHook(() => useInterruptDeepLink());
    // Proves a handler was actually registered (a function), not merely that it isn't
    // null — matches components/InterruptHandler.test.tsx's identical idiom.
    await vi.waitFor(() => expect(typeof tauriState.deepLinkHandler).toBe("function"));

    tauriState.deepLinkHandler!(["plyglt://auth-callback?code=abc"]);

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useInterruptDeepLink — web (isTauri false)", () => {
  it("does not subscribe to the deep-link gateway at all in a web build", async () => {
    tauriState.isTauri = false;
    renderHook(() => useInterruptDeepLink());
    await Promise.resolve();
    expect(tauriState.deepLinkHandler).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
