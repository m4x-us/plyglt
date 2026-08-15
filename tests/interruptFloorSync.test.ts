// ============================================================
// interruptFloorSync.test.ts — mechanical sync guard (Task #535)
// ============================================================
// lib/queue.ts's INTERRUPT_SESSION_FLOOR/INTERRUPT_SESSION_CAP and
// supabase/functions/send-interrupt-notifications/dueEstimate.ts's copies of
// the same constants are two independent literals — the Deno server function
// cannot import from lib/, so a shared source of truth isn't possible. Only a
// code comment keeps them synced today. This test makes a silent drift
// mechanically impossible: it fails the moment either file's value changes
// without the other being updated to match.
import { describe, it, expect } from "vitest";
import { INTERRUPT_SESSION_FLOOR, INTERRUPT_SESSION_CAP } from "@/lib/queue";
import {
  INTERRUPT_SESSION_FLOOR as SERVER_INTERRUPT_SESSION_FLOOR,
  INTERRUPT_SESSION_CAP as SERVER_INTERRUPT_SESSION_CAP,
} from "../supabase/functions/send-interrupt-notifications/dueEstimate.ts";

describe("interrupt session floor/cap — client/server sync guard", () => {
  it("lib/queue.ts's INTERRUPT_SESSION_FLOOR matches dueEstimate.ts's copy", () => {
    expect(SERVER_INTERRUPT_SESSION_FLOOR).toBe(INTERRUPT_SESSION_FLOOR);
  });

  it("lib/queue.ts's INTERRUPT_SESSION_CAP matches dueEstimate.ts's copy", () => {
    expect(SERVER_INTERRUPT_SESSION_CAP).toBe(INTERRUPT_SESSION_CAP);
  });
});
