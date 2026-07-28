import { describe, it, expect, afterEach } from "vitest";
import { getFeatureFlags, isProEnabled, SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";
import type { LicenseType } from "@/lib/licenseTypes";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE;
  delete process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE;
  delete process.env.NEXT_PUBLIC_FLAGS_ANALYTICS;
  delete process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS;
});

describe("getFeatureFlags", () => {
  it("interruptEngine defaults to true when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE;
    expect(getFeatureFlags().interruptEngine).toBe(true);
  });

  it("interruptEngine is false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = "false";
    expect(getFeatureFlags().interruptEngine).toBe(false);
  });

  it("getFeatureFlags returns all required FeatureFlags fields as booleans", () => {
    const flags = getFeatureFlags();
    expect(typeof flags.interruptEngine).toBe("boolean");
    expect(typeof flags.vacationMode).toBe("boolean");
    expect(typeof flags.analytics).toBe("boolean");
    expect(typeof flags.specialtyPacks).toBe("boolean");
  });

  it("vacationMode defaults to true when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE;
    expect(getFeatureFlags().vacationMode).toBe(true);
  });

  it("analytics defaults to true when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_FLAGS_ANALYTICS;
    expect(getFeatureFlags().analytics).toBe(true);
  });

  it("vacationMode is false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE = "false";
    expect(getFeatureFlags().vacationMode).toBe(false);
  });

  it("analytics is false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_FLAGS_ANALYTICS = "false";
    expect(getFeatureFlags().analytics).toBe(false);
  });

  // Task #427 (F028): specialtyPacks gates an unfinished, dormant feature (BRAND.md
  // roadmap) — unlike the three shipped flags above, it must default OFF when unset,
  // not ON. Omitting the env var anywhere must never ship the feature live.
  it("specialtyPacks defaults to false when env var is absent", () => {
    delete process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS;
    expect(getFeatureFlags().specialtyPacks).toBe(false);
  });

  it("specialtyPacks is true when env var is explicitly set to a non-falsy value", () => {
    process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS = "true";
    expect(getFeatureFlags().specialtyPacks).toBe(true);
  });

  it("specialtyPacks is false when env var is 'false'", () => {
    process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS = "false";
    expect(getFeatureFlags().specialtyPacks).toBe(false);
  });

  // Task #448 (F009): an env var explicitly set to "" (e.g. an unfilled CI template
  // variable) must be treated the same as unset — falling through to defaultEnabled —
  // not silently enabling a flag whose safe default is off. Before this fix, "" skipped
  // the v===undefined check and fell through to !FALSY_FLAG_VALUES.includes("") === true.
  it("specialtyPacks is false when env var is an empty string (same as unset)", () => {
    process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS = "";
    expect(getFeatureFlags().specialtyPacks).toBe(false);
  });

  // Sibling proof the fix is generic (empty string → defaultEnabled), not a
  // specialtyPacks-only special case: a shipped flag whose default is true must stay
  // true when its env var is "", exactly as it would if the var were unset.
  it("interruptEngine is true when env var is an empty string (same as unset, defaultEnabled=true)", () => {
    process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = "";
    expect(getFeatureFlags().interruptEngine).toBe(true);
  });

  // #100 — isProEnabled combinator
  describe("isProEnabled", () => {
    it("returns true when flag=true, licenseType=subscription, and validUntil=null (no expiry)", () => {
      expect(isProEnabled(true, "subscription" as LicenseType, null)).toBe(true);
    });

    it("returns false when flag=true but licenseType=free", () => {
      expect(isProEnabled(true, "free" as LicenseType, null)).toBe(false);
    });

    it("returns false when flag=false even if licenseType=subscription", () => {
      expect(isProEnabled(false, "subscription" as LicenseType, null)).toBe(false);
    });

    // Task #420: expiry awareness, matching store/entitlementStore.ts's isPackUnlocked policy.
    it("returns true when validUntil is in the future", () => {
      expect(isProEnabled(true, "subscription" as LicenseType, Date.now() + 60_000)).toBe(true);
    });

    it("returns true when validUntil has passed but is still within the grace period", () => {
      const validUntil = Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS + 60_000;
      expect(isProEnabled(true, "subscription" as LicenseType, validUntil)).toBe(true);
    });

    it("returns false when validUntil is past validUntil + grace period", () => {
      const validUntil = Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1000;
      expect(isProEnabled(true, "subscription" as LicenseType, validUntil)).toBe(false);
    });

    it("returns false for an expired subscription even when flag=true (a lapsed subscriber must not stay Pro-gated-in indefinitely)", () => {
      const validUntil = Date.now() - SUBSCRIPTION_GRACE_PERIOD_MS - 1;
      expect(isProEnabled(true, "subscription" as LicenseType, validUntil)).toBe(false);
    });
  });

  // #099 — false-string variants: "0", "off", "no", and mixed-case must all disable a flag
  it.each(["0", "off", "False", "no", "NO"])(
    "interruptEngine is false when env var is %j",
    (value) => {
      process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = value;
      expect(getFeatureFlags().interruptEngine).toBe(false);
    }
  );

  // Task #462 (F8): a garbage-but-non-empty value (neither a recognized truthy nor falsy
  // signal) must fall through to defaultEnabled in BOTH directions — not silently resolve
  // to enabled=true regardless of default, which is what Task #448's fix left unaddressed
  // for any value other than undefined/"".
  it("falls through to defaultEnabled=false for a garbage-but-non-empty value (default-off flag)", () => {
    process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS = "tru";
    expect(getFeatureFlags().specialtyPacks).toBe(false);
  });

  it("falls through to defaultEnabled=true for a garbage-but-non-empty value (default-on flag)", () => {
    process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = "yes-please";
    expect(getFeatureFlags().interruptEngine).toBe(true);
  });

  // Task #471 (F05): Task #462 made TRUTHY_FLAG_VALUES = ["true", "1"], but no test ever
  // set an env var to "1" — only "true" was exercised. Deletion Test: removing "1" from
  // TRUTHY_FLAG_VALUES makes this test fail (specialtyPacks defaults OFF, so an explicit
  // "1" that fell through to defaultEnabled instead of matching the truthy branch would
  // resolve to false, not true) — verified by temporarily reverting the fix and confirming
  // failure, then restoring, before closing this task.
  it("'1' resolves to enabled=true on a default-OFF flag (specialtyPacks) — the discriminating case", () => {
    process.env.NEXT_PUBLIC_FLAGS_SPECIALTY_PACKS = "1";
    expect(getFeatureFlags().specialtyPacks).toBe(true);
  });

  // Symmetry with the default-off case above and with the falsy-value suite's coverage of
  // both default states (interruptEngine is exercised there too). Note this specific
  // assertion is NOT independently Deletion-Test-discriminating for "1" — interruptEngine's
  // default is already true, so a value that fell through to defaultEnabled would produce
  // the same true result. The default-OFF test above is what actually proves "1" is
  // recognized as an explicit truthy signal; this test guards against a DIFFERENT
  // regression (e.g. "1" incorrectly resolving to false via a reordered/broken truthy
  // check) on the default-on path.
  it("'1' resolves to enabled=true on a default-ON flag (interruptEngine) too", () => {
    process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE = "1";
    expect(getFeatureFlags().interruptEngine).toBe(true);
  });
});
