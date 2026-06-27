// ===========================================
// LICENSE TYPES
// ===========================================
// Canonical LicenseType union for the entitlement system.
// Lives in lib/ so lib/entitlement.ts and lib/importBackup.ts
// can import it without creating an upward lib/→store/ dependency
// (Rule 3: Layers Down Only).
//
// Single source of truth: LICENSE_TYPES drives the union type AND the
// runtime allowlist in store/migrations.ts — no parallel definitions.
// ===========================================
// DEPENDS ON: nothing
// USED BY: lib/entitlement.ts, lib/importBackup.ts,
//          store/entitlementStore.ts, store/migrations.ts
// ===========================================

export const LICENSE_TYPES = ["free", "subscription"] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];
