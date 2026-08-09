import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signEs256Jwt, signRs256Jwt } from "../supabase/functions/send-interrupt-notifications/jwt.ts";

function decodeJwtHeader(token: string): { alg?: string; typ?: string; kid?: string } {
  const [headerPart] = token.split(".");
  const json = Buffer.from(headerPart!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json) as { alg?: string; typ?: string; kid?: string };
}

let ecPrivateKeyPem: string;
let rsaPrivateKeyPem: string;

beforeAll(() => {
  ecPrivateKeyPem = generateKeyPairSync("ec", {
    namedCurve: "prime256v1", // P-256, required for APNs' ES256
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey;

  rsaPrivateKeyPem = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey;
});

describe("signEs256Jwt", () => {
  it("produces a 3-part dot-separated token string", async () => {
    const token = await signEs256Jwt({ iss: "TEAM123" }, "KEY123", ecPrivateKeyPem);
    expect(token.split(".")).toHaveLength(3);
  });

  it("has header alg 'ES256' and kid equal to the provided keyId", async () => {
    const token = await signEs256Jwt({ iss: "TEAM123" }, "KEY123", ecPrivateKeyPem);
    expect(decodeJwtHeader(token)).toEqual({ alg: "ES256", typ: "JWT", kid: "KEY123" });
  });

  it("normalizes a PEM key stored with literal backslash-n line breaks (a common single-line .env encoding)", async () => {
    const escapedPem = ecPrivateKeyPem.replace(/\n/g, "\\n");
    const token = await signEs256Jwt({ iss: "TEAM123" }, "KEY123", escapedPem);
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("signRs256Jwt", () => {
  it("produces a 3-part dot-separated token string", async () => {
    const token = await signRs256Jwt({ iss: "service@project.iam.gserviceaccount.com" }, rsaPrivateKeyPem);
    expect(token.split(".")).toHaveLength(3);
  });

  it("has header alg 'RS256' and no kid field", async () => {
    const token = await signRs256Jwt({ iss: "service@project.iam.gserviceaccount.com" }, rsaPrivateKeyPem);
    expect(decodeJwtHeader(token)).toEqual({ alg: "RS256", typ: "JWT" });
  });
});
