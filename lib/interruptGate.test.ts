import { describe, it, expect, vi, afterEach } from "vitest";
import { readInterruptGateState, recordInterruptGateEvent, DEFAULT_GATE_READ_TIMEOUT_MS } from "@/lib/interruptGate";

function makeMockClient() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const abortSignalMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const limitMock = vi.fn(() => ({ abortSignal: abortSignalMock }));
  const orderMock = vi.fn(() => ({ limit: limitMock }));
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock, insert: insertMock }));
  return { from: fromMock, fromMock, selectMock, eqMock, orderMock, limitMock, abortSignalMock, insertMock };
}

const mockGetSupabaseClient = vi.fn<() => ReturnType<typeof makeMockClient> | null>();
vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("readInterruptGateState", () => {
  it("returns unknown/not_configured without touching the client when Supabase isn't configured", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "unknown", reason: "not_configured" });
  });

  it("queries interrupt_gate_events ordered by effective_until desc, limited to 1 row, filtered by user_id", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    await readInterruptGateState("user-1");

    expect(mock.fromMock).toHaveBeenCalledWith("interrupt_gate_events");
    expect(mock.selectMock).toHaveBeenCalledWith("effective_until");
    expect(mock.eqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(mock.orderMock).toHaveBeenCalledWith("effective_until", { ascending: false });
    expect(mock.limitMock).toHaveBeenCalledWith(1);
  });

  it("returns status:known with the most recent effective_until converted to unix ms", async () => {
    const mock = makeMockClient();
    mock.abortSignalMock.mockResolvedValue({
      data: [{ effective_until: new Date(1_700_000_000_000).toISOString() }],
      error: null,
    });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "known", effectiveUntil: 1_700_000_000_000 });
  });

  it("returns status:known with effectiveUntil:null when the user has no gate history yet", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "known", effectiveUntil: null });
  });

  it("returns status:unknown/reason:error with the real message when the query errors", async () => {
    const mock = makeMockClient();
    mock.abortSignalMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "unknown", reason: "error", error: "permission denied" });
  });

  it("returns status:unknown/reason:error when the query rejects (e.g. a real aborted fetch)", async () => {
    const mock = makeMockClient();
    mock.abortSignalMock.mockRejectedValue(new Error("AbortError"));
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "unknown", reason: "error", error: "AbortError" });
  });

  it("returns status:unknown/reason:error with a stringified message when the query rejects a non-Error value", async () => {
    const mock = makeMockClient();
    mock.abortSignalMock.mockRejectedValue("connection reset");
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await readInterruptGateState("user-1");
    expect(result).toEqual({ status: "unknown", reason: "error", error: "connection reset" });
  });

  it("returns status:unknown/reason:timeout without waiting for a slow client, honoring the configured timeoutMs", async () => {
    vi.useFakeTimers();
    const mock = makeMockClient();
    mock.abortSignalMock.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetSupabaseClient.mockReturnValue(mock);

    const resultPromise = readInterruptGateState("user-1", 500);
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result).toEqual({ status: "unknown", reason: "timeout" });
  });

  it("defaults to DEFAULT_GATE_READ_TIMEOUT_MS (750ms) when no timeoutMs is given", async () => {
    vi.useFakeTimers();
    const mock = makeMockClient();
    mock.abortSignalMock.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetSupabaseClient.mockReturnValue(mock);

    const resultPromise = readInterruptGateState("user-1");
    await vi.advanceTimersByTimeAsync(DEFAULT_GATE_READ_TIMEOUT_MS - 1);
    const stillPending = await Promise.race([resultPromise, Promise.resolve("pending")]);
    expect(stillPending).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    const result = await resultPromise;
    expect(result).toEqual({ status: "unknown", reason: "timeout" });
  });
});

describe("recordInterruptGateEvent", () => {
  it("returns ok:false with a clear error when Supabase isn't configured", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await recordInterruptGateEvent({
      userId: "user-1",
      deviceId: "device-1",
      eventType: "fired",
      occurredAt: 1_700_000_000_000,
      minutesUntilEligible: 90,
    });
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("computes effective_until as occurredAt + minutesUntilEligible for a 'fired' event (interval minutes)", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await recordInterruptGateEvent({
      userId: "user-1",
      deviceId: "device-1",
      eventType: "fired",
      occurredAt: 1_700_000_000_000,
      minutesUntilEligible: 90,
    });

    expect(mock.fromMock).toHaveBeenCalledWith("interrupt_gate_events");
    expect(mock.insertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "fired",
      occurred_at: new Date(1_700_000_000_000).toISOString(),
      effective_until: new Date(1_700_000_000_000 + 90 * 60_000).toISOString(),
      device_id: "device-1",
    });
    expect(result).toEqual({ ok: true });
  });

  it("computes effective_until as occurredAt + minutesUntilEligible for a 'snoozed' event (snooze minutes)", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await recordInterruptGateEvent({
      userId: "user-1",
      deviceId: "device-1",
      eventType: "snoozed",
      occurredAt: 1_700_000_000_000,
      minutesUntilEligible: 15,
    });

    expect(mock.insertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "snoozed",
      occurred_at: new Date(1_700_000_000_000).toISOString(),
      effective_until: new Date(1_700_000_000_000 + 15 * 60_000).toISOString(),
      device_id: "device-1",
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with the real error message when insert fails", async () => {
    const mock = makeMockClient();
    mock.insertMock.mockResolvedValue({ error: { message: "network error" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await recordInterruptGateEvent({
      userId: "user-1",
      deviceId: "device-1",
      eventType: "fired",
      occurredAt: 1_700_000_000_000,
      minutesUntilEligible: 90,
    });
    expect(result).toEqual({ ok: false, error: "network error" });
  });
});
