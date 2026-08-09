// ============================================================
// SyncSignIn.test.tsx — Tests for the Sync sign-in section (Task #516)
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SyncSignIn } from "./SyncSignIn";

const mockState: {
  status: "loading" | "signed-out" | "signed-in";
  email: string | null;
  signInWithApple: ReturnType<typeof vi.fn>;
  signInWithGoogle: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
} = {
  status: "signed-out",
  email: null,
  signInWithApple: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("@/store/authStore", () => ({
  useAuthStore: () => mockState,
}));

const mockSyncState: {
  pendingEvents: unknown[];
  lastSyncedAt: number | null;
  lastSyncError: string | null;
} = {
  pendingEvents: [],
  lastSyncedAt: null,
  lastSyncError: null,
};

vi.mock("@/store/syncStore", () => ({
  useSyncStore: () => mockSyncState,
}));

// Partial-mock lib/storage so tests can hold the hydration gate open (default) or
// closed (the one test below verifying the pre-hydration flash is suppressed) —
// same pattern as hooks/useLangPack.test.ts's #378 cycle-2 K2-003 fix.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, useIsHydrated: vi.fn(() => true) };
});

import { useIsHydrated } from "@/lib/storage";
const mockUseIsHydrated = vi.mocked(useIsHydrated);

afterEach(() => {
  cleanup();
  mockState.status = "signed-out";
  mockState.email = null;
  mockState.signInWithApple = vi.fn().mockResolvedValue({ ok: true });
  mockState.signInWithGoogle = vi.fn().mockResolvedValue({ ok: true });
  mockState.signOut = vi.fn().mockResolvedValue({ ok: true });
  mockSyncState.pendingEvents = [];
  mockSyncState.lastSyncedAt = null;
  mockSyncState.lastSyncError = null;
  mockUseIsHydrated.mockReturnValue(true);
});

describe("SyncSignIn — loading", () => {
  it("shows a checking-status message instead of either button set", () => {
    mockState.status = "loading";
    render(<SyncSignIn />);
    expect(screen.getByText("Checking sign-in status…")).toBeInTheDocument();
    expect(screen.queryByText("Sign in with Apple")).not.toBeInTheDocument();
  });
});

describe("SyncSignIn — signed out", () => {
  it("renders both provider buttons", () => {
    render(<SyncSignIn />);
    expect(screen.getByText("Sign in with Apple")).toBeInTheDocument();
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  it("calls signInWithApple when the Apple button is clicked", async () => {
    render(<SyncSignIn />);
    fireEvent.click(screen.getByText("Sign in with Apple"));
    await waitFor(() => expect(mockState.signInWithApple).toHaveBeenCalledTimes(1));
  });

  it("calls signInWithGoogle when the Google button is clicked", async () => {
    render(<SyncSignIn />);
    fireEvent.click(screen.getByText("Sign in with Google"));
    await waitFor(() => expect(mockState.signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it("shows the returned error message when sign-in fails", async () => {
    mockState.signInWithGoogle = vi.fn().mockResolvedValue({ ok: false, error: "provider not enabled" });
    render(<SyncSignIn />);
    fireEvent.click(screen.getByText("Sign in with Google"));
    expect(await screen.findByText("provider not enabled")).toBeInTheDocument();
  });
});

describe("SyncSignIn — signed in", () => {
  it("renders the user's email and a Sign out button, not the provider buttons", () => {
    mockState.status = "signed-in";
    mockState.email = "max@example.com";
    render(<SyncSignIn />);
    expect(screen.getByText("max@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Sign in with Apple")).not.toBeInTheDocument();
  });

  it("falls back to 'Account connected' when email is null", () => {
    mockState.status = "signed-in";
    mockState.email = null;
    render(<SyncSignIn />);
    expect(screen.getByText("Account connected")).toBeInTheDocument();
  });

  describe("sync status (Task #520)", () => {
    beforeEach(() => {
      mockState.status = "signed-in";
      mockState.email = "max@example.com";
    });

    it("shows 'Not yet synced' when lastSyncedAt is null and there is no error", () => {
      render(<SyncSignIn />);
      expect(screen.getByText("Not yet synced")).toBeInTheDocument();
    });

    it("shows a relative 'Last synced' time when lastSyncedAt is set and there is no error", () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);
      mockSyncState.lastSyncedAt = 1_700_000_000_000 - 3 * 60_000; // 3 minutes ago
      render(<SyncSignIn />);
      expect(screen.getByText("Last synced 3m ago")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("shows a curated error message distinctly, taking priority over a stale lastSyncedAt value", () => {
      mockSyncState.lastSyncedAt = 1_700_000_000_000;
      mockSyncState.lastSyncError = "permission denied";
      render(<SyncSignIn />);
      // Curated BRAND.md-voice copy, not the raw store error string — the raw
      // "permission denied" text must never reach the UI (Task #520 audit finding B).
      expect(screen.getByText("Couldn't sync. Try again.")).toBeInTheDocument();
      expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument();
    });

    it("suppresses the entire sync-status block until store hydration completes, to avoid a false 'Not yet synced' flash", () => {
      mockUseIsHydrated.mockReturnValue(false);
      mockSyncState.lastSyncedAt = 1_700_000_000_000; // real persisted value, not yet visible
      render(<SyncSignIn />);
      expect(screen.queryByText("Not yet synced")).not.toBeInTheDocument();
      expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument();
    });

    it("shows a pending-count line only when pendingEvents is non-empty", () => {
      mockSyncState.pendingEvents = [{ id: "e1" }, { id: "e2" }];
      render(<SyncSignIn />);
      expect(screen.getByText("2 changes pending")).toBeInTheDocument();
    });

    it("uses singular 'change' for exactly one pending event", () => {
      mockSyncState.pendingEvents = [{ id: "e1" }];
      render(<SyncSignIn />);
      expect(screen.getByText("1 change pending")).toBeInTheDocument();
    });

    it("shows no pending-count line when pendingEvents is empty", () => {
      render(<SyncSignIn />);
      expect(screen.queryByText(/pending$/)).not.toBeInTheDocument();
    });
  });

  it("calls signOut when the Sign out button is clicked", async () => {
    mockState.status = "signed-in";
    mockState.email = "max@example.com";
    render(<SyncSignIn />);
    fireEvent.click(screen.getByText("Sign out"));
    await waitFor(() => expect(mockState.signOut).toHaveBeenCalledTimes(1));
  });

  it("disables the Sign out button while a sign-out is in flight, preventing a double-submit", async () => {
    mockState.status = "signed-in";
    mockState.email = "max@example.com";
    let resolveSignOut: (v: { ok: boolean }) => void = () => {};
    mockState.signOut = vi.fn(() => new Promise((resolve) => { resolveSignOut = resolve; }));
    render(<SyncSignIn />);
    const button = screen.getByText("Sign out") as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(mockState.signOut).toHaveBeenCalledTimes(1);
    resolveSignOut({ ok: true });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("shows the returned error message when sign-out fails", async () => {
    mockState.status = "signed-in";
    mockState.email = "max@example.com";
    mockState.signOut = vi.fn().mockResolvedValue({ ok: false, error: "network error" });
    render(<SyncSignIn />);
    fireEvent.click(screen.getByText("Sign out"));
    expect(await screen.findByText("network error")).toBeInTheDocument();
  });
});
