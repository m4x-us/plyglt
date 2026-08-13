// ============================================================
// useSnoozeAndExit.ts — Task #530: interrupt-session "Snooze" button handler
// ============================================================
// Extracted out of app/study/page.tsx to keep that route within CLAUDE.md's ~150-line
// route cap. Resolves the identity fields lib/tauriInterrupt.ts's snoozeInterrupt needs
// to also write the shared cross-device gate event (Task #528's lib/interruptGate.ts),
// then exits mandatory mode and navigates home — the same sequence the inline handler
// this replaces already performed, unchanged.
//
// userId/deviceId are read via each store's own .getState() rather than a reactive
// selector — this component only needs their value at the moment of the click, not a
// re-render whenever either changes, so a plain snapshot read is the correct tool here.
// ============================================================
// DEPENDS ON: @/store/authStore, @/store/syncStore, @/lib/tauriInterrupt
// USED BY: app/study/page.tsx (the interrupt-session "Snooze X min" button)
// ============================================================

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useSyncStore } from "@/store/syncStore";
import { snoozeInterrupt, exitMandatoryMode } from "@/lib/tauriInterrupt";

export function useSnoozeAndExit(snoozeMinutes: number): () => Promise<void> {
  const router = useRouter();

  return async function handleSnooze() {
    const { userId } = useAuthStore.getState();
    const { deviceId } = useSyncStore.getState();
    try {
      await snoozeInterrupt(snoozeMinutes, userId && deviceId ? { userId, deviceId } : undefined);
    } catch (err) {
      console.error(`[ERR-IPC-SNOOZE-${Date.now()}] Snooze failed:`, err);
    }
    try {
      await exitMandatoryMode();
    } catch (err) {
      console.error(`[ERR-IPC-EXIT-${Date.now()}] exitMandatoryMode failed:`, err);
    } finally {
      router.push("/learn");
    }
  };
}
