// === tests/entitlementCrossTabSync.test.ts ===
// Tests for store/entitlementCrossTabSync.ts — the concurrency-safety logic (dedup,
// requeue, throw-recovery) behind cross-tab entitlement rehydration.
//
// Task #469: existing indirect coverage (tests/entitlement.test.ts's
// "_handleCrossTabStorageEvent" describe block, tests/entitlementStoreEventWiring.test.ts)
// only proves basic key-matching through store/entitlementStore.ts's wiring — a single
// storage event, a mocked rehydrate that always resolves immediately. Neither exercises
// this module's actual concurrency-safety guarantees: the in-flight dedup (Task #304),
// the requeue-after-settle path (Task #347), or the synchronous-throw recovery path
// (Task #363) — the exact things this module's own header comment claims to guarantee.
// This file calls createCrossTabSync directly with a fully-controllable fake rehydrate
// so those paths can be driven and asserted precisely, without duplicating the
// key-matching coverage already proven elsewhere.

import { describe, it, expect, vi } from "vitest";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createCrossTabSync } from "@/store/entitlementCrossTabSync";

const STORE_KEY = "test-store-v1";

// A rehydrate double whose returned Promise resolves/rejects only when the test tells it
// to — lets a test observe exactly what has (and hasn't) happened while a rehydrate is
// genuinely still "in flight", not just immediately-settled like a plain mockResolvedValue.
function createControllableRehydrate() {
  const calls: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  const rehydrate = vi.fn(() => {
    return new Promise<void>((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  });
  return { rehydrate, calls };
}

describe("createCrossTabSync", () => {
  describe("basic key matching (sanity only — full coverage lives in tests/entitlement.test.ts)", () => {
    it("calls rehydrate when the event key matches storeKey", () => {
      const rehydrate = vi.fn().mockResolvedValue(undefined);
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);
      handleStorageEvent({ key: STORE_KEY });
      expect(rehydrate).toHaveBeenCalledOnce();
    });

    it("does not call rehydrate when the event key does not match storeKey", () => {
      const rehydrate = vi.fn().mockResolvedValue(undefined);
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);
      handleStorageEvent({ key: "some-other-store" });
      expect(rehydrate).not.toHaveBeenCalled();
    });

    it("does not call rehydrate when the event key is null", () => {
      const rehydrate = vi.fn().mockResolvedValue(undefined);
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);
      handleStorageEvent({ key: null });
      expect(rehydrate).not.toHaveBeenCalled();
    });
  });

  describe("Task #304 — in-flight dedup", () => {
    it("does not start a second rehydrate while one is still in flight", () => {
      const { rehydrate, calls } = createControllableRehydrate();
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

      handleStorageEvent({ key: STORE_KEY }); // starts rehydrate #1 (still pending)
      expect(rehydrate).toHaveBeenCalledTimes(1);

      handleStorageEvent({ key: STORE_KEY }); // arrives while #1 is still in flight
      // Queued, not started immediately — deleting the dedup guard would make this 2.
      expect(rehydrate).toHaveBeenCalledTimes(1);

      calls[0]!.resolve();
    });
  });

  describe("Task #347 — requeue after the in-flight rehydrate settles", () => {
    it("re-triggers rehydrate exactly once after settling, when an event arrived during the in-flight window", async () => {
      const { rehydrate, calls } = createControllableRehydrate();
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

      handleStorageEvent({ key: STORE_KEY }); // #1 starts
      handleStorageEvent({ key: STORE_KEY }); // arrives mid-flight — must be queued, not dropped
      expect(rehydrate).toHaveBeenCalledTimes(1);

      calls[0]!.resolve(); // #1 settles
      await Promise.resolve();
      await Promise.resolve();

      // The queued event triggers a SECOND rehydrate call — deleting the requeue logic
      // (Task #347) would silently drop it and leave this at 1 forever.
      expect(rehydrate).toHaveBeenCalledTimes(2);

      calls[1]!.resolve();
    });

    it("does not re-trigger when no event arrived during the in-flight window", async () => {
      const { rehydrate, calls } = createControllableRehydrate();
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

      handleStorageEvent({ key: STORE_KEY }); // #1 starts
      expect(rehydrate).toHaveBeenCalledTimes(1);

      calls[0]!.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // No queued event — settling must not spuriously trigger another rehydrate.
      expect(rehydrate).toHaveBeenCalledTimes(1);
    });

    it("collapses multiple events that arrive during the same in-flight window into exactly one requeued rehydrate", async () => {
      const { rehydrate, calls } = createControllableRehydrate();
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

      handleStorageEvent({ key: STORE_KEY }); // #1 starts
      handleStorageEvent({ key: STORE_KEY }); // queued
      handleStorageEvent({ key: STORE_KEY }); // still queued — pendingRehydrate is a flag, not a counter
      handleStorageEvent({ key: STORE_KEY }); // still queued
      expect(rehydrate).toHaveBeenCalledTimes(1);

      calls[0]!.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Exactly one requeued call for the whole burst, not three.
      expect(rehydrate).toHaveBeenCalledTimes(2);

      calls[1]!.resolve();
    });

    it("chains a further requeue when a new event arrives during the requeued rehydrate's own in-flight window", async () => {
      const { rehydrate, calls } = createControllableRehydrate();
      const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

      handleStorageEvent({ key: STORE_KEY }); // #1
      handleStorageEvent({ key: STORE_KEY }); // queued -> becomes #2 once #1 settles
      calls[0]!.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(rehydrate).toHaveBeenCalledTimes(2);

      handleStorageEvent({ key: STORE_KEY }); // arrives while #2 is in flight
      expect(rehydrate).toHaveBeenCalledTimes(2); // queued, not immediate

      calls[1]!.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(rehydrate).toHaveBeenCalledTimes(3); // #3 triggered by the requeue

      calls[2]!.resolve();
    });
  });

  describe("Task #363 — synchronous-throw recovery", () => {
    it("resets in-flight state after rehydrate throws synchronously, so a subsequent event triggers a new rehydrate", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const rehydrate = vi.fn()
          .mockImplementationOnce(() => { throw new Error("boom"); })
          .mockImplementationOnce(() => undefined); // second call settles synchronously (non-Promise return)
        const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

        handleStorageEvent({ key: STORE_KEY }); // throws synchronously inside triggerRehydrate
        expect(rehydrate).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("ERR-REHYDRATE-SYNC-THROW"),
          expect.any(Error)
        );

        // The in-flight flag was reset by the catch block's done() call — a subsequent
        // event must trigger a genuinely NEW rehydrate, not be silently ignored (which is
        // what "locking permanently" would look like: this second call never happening).
        handleStorageEvent({ key: STORE_KEY });
        expect(rehydrate).toHaveBeenCalledTimes(2);
      } finally {
        errorSpy.mockRestore();
      }
    });

    it("a queued event during an in-flight rehydrate that later REJECTS still gets its requeue attempt, and the rejection is logged (Task #474)", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { rehydrate, calls } = createControllableRehydrate();
        const { handleStorageEvent } = createCrossTabSync(STORE_KEY, rehydrate);

        handleStorageEvent({ key: STORE_KEY }); // #1 starts (pending promise)
        handleStorageEvent({ key: STORE_KEY }); // queued
        expect(rehydrate).toHaveBeenCalledTimes(1);

        const rejectionReason = new Error("async rehydrate failure");
        calls[0]!.reject(rejectionReason);
        await Promise.resolve();
        await Promise.resolve();

        // The queued event still triggers a requeue even though #1 failed — the rejection
        // handler still calls done() (which checks pendingRehydrate), exactly as the old
        // result.then(done, done) did on rejection.
        expect(rehydrate).toHaveBeenCalledTimes(2);

        // Task #474: before this fix, the rejection handler was `done` itself — it reset
        // state and requeued but never logged, unlike the synchronous-throw sibling above.
        // Assert the actual ref ID AND the rejection reason, not just that rehydrate's call
        // count moved on — a passing call-count assertion alone is exactly what let the
        // swallow ship in the first place (this test previously set up errorSpy but never
        // asserted on it).
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("ERR-REHYDRATE-ASYNC-REJECT"),
          rejectionReason
        );

        calls[1]!.resolve();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  // Task #482 (F009 investigation): confirms — against the REAL zustand dependency, not a
  // mock — that persist.rehydrate() can never actually return a rejected Promise under
  // this app's real configuration, so the async-reject branch above is defensive-only,
  // not a live diagnostic path for real users today. This is a durable regression guard:
  // if a future zustand upgrade changes hydrate()'s internal error handling (e.g. starts
  // rethrowing when no onRehydrateStorage is registered), this test fails and the
  // async-reject branch's importance should be re-evaluated.
  describe("Task #482 — real zustand persist.rehydrate() never rejects under this app's configuration", () => {
    it("persist.rehydrate() resolves even when the underlying storage.getItem rejects, given no onRehydrateStorage callback (mirrors every real store in this app)", async () => {
      const rejectingStorage = {
        getItem: async (): Promise<string | null> => {
          throw new Error("storage read failed");
        },
        setItem: async (): Promise<void> => {},
        removeItem: async (): Promise<void> => {},
      };
      // No onRehydrateStorage option — exactly like store/entitlementStore.ts,
      // store/srsStore.ts, and store/settingsStore.ts (verified: none registers one).
      const useProbeStore = create(
        persist(() => ({ value: 0 }), {
          name: "test-rehydrate-reject-probe",
          storage: createJSONStorage(() => rejectingStorage),
        })
      );

      // If zustand's hydrate() ever started propagating this rejection, this assertion
      // would fail with a rejected promise instead of resolving.
      await expect(useProbeStore.persist.rehydrate()).resolves.toBeUndefined();
    });
  });

  describe("independent instances (closure-scoped state, not module-scope)", () => {
    it("two createCrossTabSync calls do not share in-flight dedup state", () => {
      const { rehydrate: rehydrateA, calls: callsA } = createControllableRehydrate();
      const { rehydrate: rehydrateB } = createControllableRehydrate();
      const syncA = createCrossTabSync("store-a", rehydrateA);
      const syncB = createCrossTabSync("store-b", rehydrateB);

      syncA.handleStorageEvent({ key: "store-a" }); // A's rehydrate now in flight
      expect(rehydrateA).toHaveBeenCalledTimes(1);

      // B is a fully independent instance — A's in-flight state must not block or dedup B's.
      syncB.handleStorageEvent({ key: "store-b" });
      expect(rehydrateB).toHaveBeenCalledTimes(1);

      callsA[0]!.resolve();
    });
  });
});
