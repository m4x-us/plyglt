import { describe, it, expect, afterEach } from "vitest";
import { getFeatureFlags } from "@/lib/featureFlags";

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
});
