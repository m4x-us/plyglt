import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadReviewEvents, downloadReviewEvents } from "@/lib/syncClient";
import type { ReviewEvent } from "@/lib/reviewEvent";

function makeEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: "event-1",
    cardId: "c1",
    reviewedAt: 1_700_000_000_000,
    rating: 3,
    stability: 12,
    difficulty: 4,
    dueDate: 1_700_500_000_000,
    deviceId: "device-1",
    ...overrides,
  };
}

function makeMockClient() {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const eqMock = vi.fn().mockResolvedValue({ data: [], error: null });
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock, select: selectMock }));
  return { from: fromMock, upsertMock, eqMock, selectMock, fromMock };
}

const mockGetSupabaseClient = vi.fn<() => ReturnType<typeof makeMockClient> | null>();
vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("uploadReviewEvents", () => {
  it("returns ok:true without touching the client when there are no events to upload", async () => {
    const result = await uploadReviewEvents("user-1", []);
    expect(result).toEqual({ ok: true });
    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns ok:false with a clear error when Supabase isn't configured", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await uploadReviewEvents("user-1", [makeEvent()]);
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("upserts rows converted to the wire format (ISO timestamps, user_id stamped, snake_case columns) with ignoreDuplicates to avoid the append-only table's missing UPDATE policy", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);
    const event = makeEvent({
      id: "event-1", cardId: "c1", reviewedAt: 1_700_000_000_000, rating: 3,
      stability: 12, difficulty: 4, dueDate: 1_700_500_000_000, deviceId: "device-1",
    });

    const result = await uploadReviewEvents("user-1", [event]);

    expect(mock.fromMock).toHaveBeenCalledWith("review_events");
    expect(mock.upsertMock).toHaveBeenCalledWith(
      [{
        id: "event-1",
        user_id: "user-1",
        card_id: "c1",
        reviewed_at: new Date(1_700_000_000_000).toISOString(),
        rating: 3,
        stability: 12,
        difficulty: 4,
        due_date: new Date(1_700_500_000_000).toISOString(),
        device_id: "device-1",
      }],
      { onConflict: "id", ignoreDuplicates: true }
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with the real error message when upsert fails, leaving the caller free to retry", async () => {
    const mock = makeMockClient();
    mock.upsertMock.mockResolvedValue({ error: { message: "network error" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await uploadReviewEvents("user-1", [makeEvent()]);
    expect(result).toEqual({ ok: false, error: "network error" });
  });
});

describe("downloadReviewEvents", () => {
  it("returns ok:false with a clear error when Supabase isn't configured", async () => {
    mockGetSupabaseClient.mockReturnValue(null);
    const result = await downloadReviewEvents("user-1");
    expect(result).toEqual({ ok: false, error: "Sync is not configured." });
  });

  it("selects from review_events filtered to the given user_id", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);
    await downloadReviewEvents("user-1");
    expect(mock.fromMock).toHaveBeenCalledWith("review_events");
    expect(mock.selectMock).toHaveBeenCalledWith("*");
    expect(mock.eqMock).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("maps returned rows back into ReviewEvent shape with unix-ms numbers reconstructed from ISO timestamps", async () => {
    const mock = makeMockClient();
    mock.eqMock.mockResolvedValue({
      data: [{
        id: "event-1", card_id: "c1",
        reviewed_at: new Date(1_700_000_000_000).toISOString(),
        rating: 3, stability: 12, difficulty: 4,
        due_date: new Date(1_700_500_000_000).toISOString(),
        device_id: "device-1",
      }],
      error: null,
    });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await downloadReviewEvents("user-1");
    expect(result).toEqual({
      ok: true,
      events: [{
        id: "event-1", cardId: "c1", reviewedAt: 1_700_000_000_000, rating: 3,
        stability: 12, difficulty: 4, dueDate: 1_700_500_000_000, deviceId: "device-1",
      }],
    });
  });

  it("returns ok:true with an empty array when the user has no remote events", async () => {
    const mock = makeMockClient();
    mockGetSupabaseClient.mockReturnValue(mock);
    const result = await downloadReviewEvents("user-1");
    expect(result).toEqual({ ok: true, events: [] });
  });

  it("returns ok:false with the real error message when the select fails", async () => {
    const mock = makeMockClient();
    mock.eqMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    mockGetSupabaseClient.mockReturnValue(mock);

    const result = await downloadReviewEvents("user-1");
    expect(result).toEqual({ ok: false, error: "permission denied" });
  });
});
