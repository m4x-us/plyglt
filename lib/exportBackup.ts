import { CURRENT_BACKUP_VERSION } from "@/lib/importBackup";
import type { BackupSrs, BackupEntitlement } from "@/lib/importBackup";

/**
 * Serializes SRS progress and entitlement state to a versioned JSON string.
 * DOM manipulation (Blob, <a> creation, URL.revokeObjectURL) belongs to the caller.
 */
export function exportBackup(
  srsState: BackupSrs,
  entitlementState: BackupEntitlement,
  langPair: string
): string {
  return JSON.stringify(
    {
      _version: CURRENT_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      langPair,
      srs: {
        cards: srsState.cards,
        streak: srsState.streak,
        lastStudiedDate: srsState.lastStudiedDate,
      },
      entitlement: {
        licenseKey: entitlementState.licenseKey,
        instanceId: entitlementState.instanceId,
        licenseType: entitlementState.licenseType,
        unlockedPacks: entitlementState.unlockedPacks,
        validUntil: entitlementState.validUntil,
      },
    },
    null,
    2
  );
}
