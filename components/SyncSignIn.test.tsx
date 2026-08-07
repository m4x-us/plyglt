// ============================================================
// SyncSignIn.test.tsx — Tests for the Sync sign-in section (Task #516)
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
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

afterEach(() => {
  cleanup();
  mockState.status = "signed-out";
  mockState.email = null;
  mockState.signInWithApple = vi.fn().mockResolvedValue({ ok: true });
  mockState.signInWithGoogle = vi.fn().mockResolvedValue({ ok: true });
  mockState.signOut = vi.fn().mockResolvedValue({ ok: true });
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
