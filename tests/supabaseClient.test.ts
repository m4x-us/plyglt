import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSupabaseClient, resetSupabaseClientForTesting } from "@/lib/supabaseClient";

const mockClientInstance = { auth: {}, from: vi.fn() };
const createClientMock =
  vi.fn<(url: string, anonKey: string, options: { auth: { storage: unknown } }) => typeof mockClientInstance>()
    .mockReturnValue(mockClientInstance);
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, anonKey: string, options: { auth: { storage: unknown } }) =>
    createClientMock(url, anonKey, options),
}));

const platformStorageInstance = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
const createPlatformStorageMock = vi.fn<(storeName: string) => typeof platformStorageInstance>()
  .mockReturnValue(platformStorageInstance);
vi.mock("@/lib/storage", () => ({
  createPlatformStorage: (storeName: string) => createPlatformStorageMock(storeName),
}));

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseClientForTesting();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterEach(() => {
  resetSupabaseClientForTesting();
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_KEY;
});

describe("getSupabaseClient — graceful degradation", () => {
  it("returns null when both env vars are absent", () => {
    expect(getSupabaseClient()).toBe(null);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns null when only the URL is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(getSupabaseClient()).toBe(null);
  });

  it("returns null when only the anon key is set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
    expect(getSupabaseClient()).toBe(null);
  });

  it("does not throw under any of the above absent-config conditions", () => {
    expect(() => getSupabaseClient()).not.toThrow();
  });
});

describe("getSupabaseClient — configured", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test123";
  });

  it("calls createClient with the exact URL and anon key from env vars", () => {
    getSupabaseClient();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example-project.supabase.co",
      "sb_publishable_test123",
      expect.objectContaining({ auth: expect.objectContaining({ storage: platformStorageInstance }) })
    );
  });

  it("wires auth.storage to createPlatformStorage's return value, not Supabase's default", () => {
    getSupabaseClient();
    expect(createPlatformStorageMock).toHaveBeenCalledWith("supabase-auth");
    const [, , options] = createClientMock.mock.calls[0]!;
    expect(options.auth.storage).toBe(platformStorageInstance);
  });

  it("sets flowType to pkce, not @supabase/auth-js's implicit default", () => {
    // Task #518's live test: a real desktop sign-in returned to the app but never
    // completed, because the implicit-flow default returns tokens in a URL
    // fragment (#access_token=...) while store/authStore.ts's deep-link handler
    // only ever parses a PKCE `?code=` query param via exchangeCodeForSession.
    getSupabaseClient();
    const [, , options] = createClientMock.mock.calls[0]! as unknown as [
      string,
      string,
      { auth: { flowType: string } },
    ];
    expect(options.auth.flowType).toBe("pkce");
  });

  it("returns the real client instance createClient produced", () => {
    expect(getSupabaseClient()).toBe(mockClientInstance);
  });

  it("caches the client — a second call does not re-invoke createClient", () => {
    getSupabaseClient();
    getSupabaseClient();
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});

describe("resetSupabaseClientForTesting", () => {
  it("forces the next getSupabaseClient() call to re-read env vars instead of returning a stale cached value", () => {
    // First call with no env vars: caches null.
    expect(getSupabaseClient()).toBe(null);

    // Without a reset, setting env vars afterward would still return the cached null —
    // this is the exact bug this test proves resetSupabaseClientForTesting fixes.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
    resetSupabaseClientForTesting();

    expect(getSupabaseClient()).toBe(mockClientInstance);
  });
});
