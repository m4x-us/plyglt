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
    ...overrides,
  };
}

function makeMockClient() {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const eqMock2 = vi.fn().mockResolvedValue({ error: null });
  const eqMock1 = vi.fn(() => ({ eq: eqMock2 }));
  const deleteMock = vi.fn(() => ({ eq: eqMock1 }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock, delete: deleteMock }));
  return { from: fromMock, upsertMock, deleteMock, eqMock1, eqMock2, fromMock };
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
      },
      { onConflict: "user_id,device_id" }
    );
    expect(result).toEqual({ ok: true });
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

  it("deletes the row scoped to both user_id and device_id, and returns ok:true", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await unregisterPushToken("user-1", "device-1");

    expect(mock.fromMock).toHaveBeenCalledWith("push_tokens");
    expect(mock.deleteMock).toHaveBeenCalledTimes(1);
    expect(mock.eqMock1).toHaveBeenCalledWith("user_id", "user-1");
    expect(mock.eqMock2).toHaveBeenCalledWith("device_id", "device-1");
    expect(result).toEqual({ ok: true });
  });

  it("logs [ERR-PUSHTOKEN-UNREGISTER-...] and returns ok:false with the Supabase error message on delete failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mock = makeMockClient();
    mock.eqMock2.mockResolvedValue({ error: { message: "permission denied" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await unregisterPushToken("user-1", "device-1");

    expect(result).toEqual({ ok: false, error: "permission denied" });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toMatch(/^\[ERR-PUSHTOKEN-UNREGISTER-\d+\] unregisterPushToken failed:$/);
    consoleErrorSpy.mockRestore();
  });
});
