// ============================================================
// jwt.ts — ES256/RS256 JWT signing via Web Crypto (Task #170)
// ============================================================
// Shared by apnsClient.ts (ES256, Apple's APNs provider-auth-token spec) and
// fcmClient.ts (RS256, Google's OAuth2 service-account JWT spec). Uses only
// globalThis.crypto.subtle + atob/btoa/TextEncoder — no Node- or Deno-specific
// APIs — so this file runs identically under Vitest (Node 20+, where these
// are all global) and the deployed Deno Edge Function.
// ============================================================
// DEPENDS ON: nothing (Web Crypto only)
// USED BY: apnsClient.ts, fcmClient.ts
// ============================================================

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/**
 * PEM -> raw key bytes. Handles both real newlines and the literal two-char
 * "\n" sequence that a PEM key stored in a single-line .env value commonly
 * carries (the private key strings this reads are always PKCS8 —
 * "-----BEGIN PRIVATE KEY-----" — never PKCS1/SEC1 variants).
 */
function pemToBytes(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  key: CryptoKey,
  algorithm: AlgorithmIdentifier | EcdsaParams
): Promise<string> {
  const encodedHeader = base64UrlEncode(encodeJson(header));
  const encodedClaims = base64UrlEncode(encodeJson(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await crypto.subtle.sign(algorithm, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Signs an APNs provider-authentication token: ES256, header carries `kid`
 * (the .p8 key's key ID, per Apple's spec — not an RFC 7515 requirement in
 * general, but mandatory for APNs specifically).
 */
export async function signEs256Jwt(
  claims: Record<string, unknown>,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return signJwt({ alg: "ES256", typ: "JWT", kid: keyId }, claims, key, { name: "ECDSA", hash: "SHA-256" });
}

/**
 * Signs a Google service-account JWT: RS256, no `kid` header — Google
 * identifies the signing key by the `iss`/client_email claim, not a JWT
 * header field.
 */
export async function signRs256Jwt(claims: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return signJwt({ alg: "RS256", typ: "JWT" }, claims, key, "RSASSA-PKCS1-v1_5");
}
