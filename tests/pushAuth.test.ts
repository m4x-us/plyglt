import { describe, it, expect } from "vitest";
import { isAuthorizedCronRequest } from "../supabase/functions/send-interrupt-notifications/auth.ts";

describe("isAuthorizedCronRequest", () => {
  it("returns false when cronSecret is undefined (unconfigured function fails closed)", () => {
    expect(isAuthorizedCronRequest("Bearer anything", undefined)).toBe(false);
  });

  it("returns false when cronSecret is undefined even if authHeader is also missing", () => {
    expect(isAuthorizedCronRequest(null, undefined)).toBe(false);
  });

  it("returns true when the Authorization header exactly matches 'Bearer <cronSecret>'", () => {
    expect(isAuthorizedCronRequest("Bearer real-secret-123", "real-secret-123")).toBe(true);
  });

  it("returns false when authHeader is null", () => {
    expect(isAuthorizedCronRequest(null, "real-secret-123")).toBe(false);
  });

  it("returns false when the secret is present but wrong", () => {
    expect(isAuthorizedCronRequest("Bearer wrong-secret", "real-secret-123")).toBe(false);
  });

  it("returns false when the header is missing the 'Bearer ' prefix", () => {
    expect(isAuthorizedCronRequest("real-secret-123", "real-secret-123")).toBe(false);
  });

  it("returns false for a same-length but different-content header (exercises the constant-time compare, not just a length check)", () => {
    expect(isAuthorizedCronRequest("Bearer real-secret-124", "real-secret-123")).toBe(false);
  });
});
