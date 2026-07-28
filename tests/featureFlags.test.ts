import { describe, it, expect, afterEach } from "vitest";
import { getFeatureFlags, isProEnabled, SUBSCRIPTION_GRACE_PERIOD_MS } from "@/lib/featureFlags";
import type { LicenseType } from "@/lib/licenseTypes";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_FLAGS_INTERRUPT_ENGINE;
  delete process.env.NEXT_PUBLIC_FLAGS_VACATION_MODE;
  delete process.env.NEXT_PUBLIC_FLAGS_ANALYTICS;
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
});
