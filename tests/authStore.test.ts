// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";

function makeMockClient() {
  const onAuthStateChangeCallbacks: Array<(event: string, session: unknown) => void> = [];
  const mockAuth = {
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
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

  it("signInWithApple calls signInWithOAuth with provider 'apple' and returns ok:true on success", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithApple();

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "apple" });
    expect(result).toEqual({ ok: true });
  });

  it("signInWithGoogle calls signInWithOAuth with provider 'google' and returns ok:true on success", async () => {
    vi.resetModules();
    const mock = makeMockClient();
    vi.doMock("@/lib/supabaseClient", () => ({ getSupabaseClient: () => mock }));
    const { useAuthStore } = await import("@/store/authStore");

    const result = await useAuthStore.getState().signInWithGoogle();

    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google" });
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
