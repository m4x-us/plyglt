import { describe, it, expect, vi, afterEach } from "vitest";
import { registerPushToken, unregisterPushToken, type RegisterPushTokenParams } from "@/lib/pushTokenClient";

function makeParams(overrides: Partial<RegisterPushTokenParams> = {}): RegisterPushTokenParams {
  return {
    userId: "user-1",
    platform: "ios",
    deviceId: "device-1",
    token: "raw-token-abc",
    appEnv: "production",
    timezone: "Europe/Rome",
    registrationNonce: "nonce-abc",
    ...overrides,
  };
}

// unregisterPushToken's delete chain now has a variable number of .eq() calls (2 without
// an expectedNonce, 3 with) — real @supabase/postgrest-js query builders are themselves
// thenable, resolving whenever awaited regardless of how many .eq() calls preceded it, so
// this mock mirrors that: every .eq() call is recorded and returns the SAME self-referential
// builder, which is directly awaitable via its own `then`.
function makeMockClient(deleteResult: { error: null | { message: string } } = { error: null }) {
  const eqCalls: [string, unknown][] = [];
  const eqMock = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return builder;
  });
  const builder: { eq: typeof eqMock; then: (resolve: (v: unknown) => void) => void } = {
    eq: eqMock,
    then: (resolve) => resolve(deleteResult),
  };
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const deleteMock = vi.fn(() => builder);
  const fromMock = vi.fn(() => ({ upsert: upsertMock, delete: deleteMock }));
  return { from: fromMock, upsertMock, deleteMock, eqMock, eqCalls, fromMock };
}

const mockGetSupabaseClient = vi.fn<() => ReturnType<typeof makeMockClient> | null>();
vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("registerPushToken", () => {
  it("returns ok:false with 'Sync is not configured.' when getSupabaseClient returns null", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await registerPushToken(makeParams());
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("upserts with onConflict 'user_id,device_id' and returns ok:true on success", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await registerPushToken(makeParams());

    expect(mock.fromMock).toHaveBeenCalledWith("push_tokens");
    expect(mock.upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        platform: "ios",
        device_id: "device-1",
        token: "raw-token-abc",
        app_env: "production",
        timezone: "Europe/Rome",
        deactivated_at: null,
        registration_nonce: "nonce-abc",
      },
      { onConflict: "user_id,device_id" }
    );
    expect(result).toEqual({ ok: true });
  });

  // Round-18 audit finding: registration_nonce is the compare-and-swap identifier
  // unregisterPushToken's own DELETE conditions on (see that function's doc comment) —
  // it must be a fresh value per registration attempt, not derived from the token
  // itself, since device tokens are stable per install and can repeat across attempts.
  it("includes the caller-supplied registrationNonce verbatim in the upsert row", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    await registerPushToken(makeParams({ registrationNonce: "distinct-nonce-xyz" }));

    const [row] = mock.upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.registration_nonce).toBe("distinct-nonce-xyz");
  });

  // Round-15 audit finding (Red Agent R, DECAY lens): an upsert only SETs columns present
  // in the payload — if this row previously had deactivated_at set (a permanent APNs/FCM
  // delivery failure, e.g. the old token became invalid), omitting the field here would
  // leave that row excluded from all future dispatch FOREVER, even after the device
  // received a genuinely fresh, valid token. Deletion Test: removing `deactivated_at: null`
  // from toRow() makes this test fail (the key would be absent from the actual call).
  it("resets deactivated_at to null on every registration, clearing any prior permanent-failure flag", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    await registerPushToken(makeParams());

    const [row] = mock.upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.deactivated_at).toBe(null);
  });

  it("includes optional schedule fields in the upsert row only when explicitly provided", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    await registerPushToken(
      makeParams({ interruptIntervalMinutes: 60, wakingHoursStartLocal: 7, wakingHoursEndLocal: 22 })
    );

    expect(mock.upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        platform: "ios",
        device_id: "device-1",
        token: "raw-token-abc",
        app_env: "production",
        timezone: "Europe/Rome",
        deactivated_at: null,
        registration_nonce: "nonce-abc",
        interrupt_interval_minutes: 60,
        waking_hours_start_local: 7,
        waking_hours_end_local: 22,
      },
      { onConflict: "user_id,device_id" }
    );
  });

  it("logs [ERR-PUSHTOKEN-REGISTER-...] and returns ok:false with the Supabase error message on upsert failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mock = makeMockClient();
    mock.upsertMock.mockResolvedValue({ error: { message: "duplicate key violates unique constraint" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await registerPushToken(makeParams());

    expect(result).toEqual({ ok: false, error: "duplicate key violates unique constraint" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSHTOKEN-REGISTER-\d+\] registerPushToken failed:$/);
    consoleErrorSpy.mockRestore();
  });
});

describe("unregisterPushToken", () => {
  it("returns ok:false with 'Sync is not configured.' when getSupabaseClient returns null", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await unregisterPushToken("user-1", "device-1");
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("deletes the row scoped to both user_id and device_id, with no third filter, when no expectedNonce is supplied", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await unregisterPushToken("user-1", "device-1");

    expect(mock.fromMock).toHaveBeenCalledWith("push_tokens");
    expect(mock.deleteMock).toHaveBeenCalledTimes(1);
    expect(mock.eqCalls).toEqual([
      ["user_id", "user-1"],
      ["device_id", "device-1"],
    ]);
    expect(result).toEqual({ ok: true });
  });

  // Round-18 audit fix: closes the cross-instance Deactivate-then-Reactivate race
  // (.autocode/debt.md, Batch 23 round 16/17) — a stale, late-resolving DELETE from a
  // just-unmounted instance must not be able to wipe a newer instance's fresh
  // registration for the same (user_id, device_id). Deletion Test: removing the
  // `if (expectedNonce !== undefined)` branch (always querying unconditionally) makes
  // this test fail — the third eq() call for registration_nonce would never happen.
  it("adds a third eq('registration_nonce', ...) filter when an expectedNonce is supplied — the compare-and-swap delete", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await unregisterPushToken("user-1", "device-1", "nonce-xyz");

    expect(mock.eqCalls).toEqual([
      ["user_id", "user-1"],
      ["device_id", "device-1"],
      ["registration_nonce", "nonce-xyz"],
    ]);
    expect(result).toEqual({ ok: true });
  });

  it("logs [ERR-PUSHTOKEN-UNREGISTER-...] and returns ok:false with the Supabase error message on delete failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mock = makeMockClient({ error: { message: "permission denied" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await unregisterPushToken("user-1", "device-1");

    expect(result).toEqual({ ok: false, error: "permission denied" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSHTOKEN-UNREGISTER-\d+\] unregisterPushToken failed:$/);
    consoleErrorSpy.mockRestore();
  });
});
