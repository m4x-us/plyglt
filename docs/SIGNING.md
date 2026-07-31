# Code Signing — plyglt

Plain-English reference for how each platform's release build gets signed, and
what a human has to set up by hand (accounts, certificates, secrets) versus
what's automated in CI. Read this before touching `.github/workflows/release.yml`
or the `bundle` section of `src-tauri/tauri.conf.json`.

---

## macOS (Task #122, #123 — live since 2026-07-29)

- **What:** Apple Developer ID Application certificate + notarization via `xcrun notarytool`.
- **Human setup (one-time):** Apple Developer Program membership, certificate generated
  in Xcode/Keychain Access, exported as a `.p12`.
- **CI secrets:** `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.
- **Where it runs:** `.github/workflows/release.yml`, `release` job, `macos-latest` runner.
  `tauri-apps/tauri-action` handles signing + notarization automatically once the
  certificate is imported into a temporary keychain (see the "Import Apple
  code-signing certificate" step).
- **Config:** `src-tauri/tauri.conf.json` → `bundle.macOS.signingIdentity`.

---

## Windows (Task #165 — decision made 2026-07-31, setup pending on Max)

**Decision:** Azure Trusted Signing — officially renamed **Azure Artifact Signing**
as of 2026 (same service, new name; the CLI tool is `artifact-signing-cli`).
Chosen over a traditional EV certificate because it's ~$10/month vs. $300–500/year,
requires no hardware USB token (which complicates CI signing), and integrates with
GitHub Actions via a service principal instead of a physical dongle.

### Why this exists

Without Windows code signing, the NSIS installer triggers "Windows protected your
PC" (SmartScreen). Most users stop there. Signing establishes reputation so the
warning doesn't appear (or clears quickly as install telemetry accumulates).

### What Max has to do in the Azure Portal (cannot be automated — needs a real account + identity check)

1. **Create an Azure account** if you don't have one (azure.microsoft.com — a
   subscription with billing enabled is required; this is a real Microsoft account
   tied to a credit card, not a free trial-only account).
2. **Confirm eligibility:** individual-developer identity validation is currently
   only available if you're located in the **United States or Canada**. If plyglt's
   legal/business identity is different from that, this needs a quick gut-check
   before going further — the EV-certificate fallback is still on the table if
   individual validation doesn't apply.
3. In the Azure Portal, search **"Trusted Signing"** (may show as **"Artifact
   Signing"** depending on portal rollout) and create a new account resource.
   **Region matters** — must be one of `East US`, `West US 2`, `North Europe`,
   `West Europe`. Whatever region you pick becomes part of the signing endpoint
   URL and can't be changed later without recreating the account.
4. Under **Access control (IAM)** on that resource, grant yourself the
   **Trusted Signing Certificate Profile Signer** and **Trusted Signing Identity
   Verifier** roles.
5. Run **Identity Validation** → switch the dropdown from "Organization" to
   **"Individual"** → submit. This pulls your legal name/address from your Azure
   billing account's "Individual" account type — billing info must match exactly.
   Approval isn't instant; budget a few business days.
6. Once validated, create a **Certificate Profile** (type: Public Trust) under the
   Trusted Signing account. Note its name — this becomes the `-c` value below.
7. Create an **App Registration** (Azure AD / Entra ID → App registrations → New
   registration). This is the service principal CI authenticates as. Note:
   - **Application (client) ID** → `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID`
   - Create a **client secret** under "Certificates & secrets" → `AZURE_CLIENT_SECRET`
   Grant this App Registration the same **Trusted Signing Certificate Profile
   Signer** role on the Trusted Signing account (IAM → Add role assignment).
8. Add all of the following as **GitHub repo secrets** (Settings → Secrets and
   variables → Actions):
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
   - `AZURE_SIGNING_ENDPOINT` — e.g. `https://wus2.codesigning.azure.net` (region-specific — see step 3)
   - `AZURE_SIGNING_ACCOUNT` — the Trusted Signing account name from step 3
   - `AZURE_SIGNING_PROFILE` — the certificate profile name from step 6

### What's already wired in code (this session)

- `src-tauri/tauri.conf.json` → `bundle.windows.signCommand` calls
  `artifact-signing-cli` with the account/endpoint/profile read from environment
  variables (`%AZURE_SIGNING_ENDPOINT%` etc. — Windows `cmd.exe` env-var syntax,
  since Tauri invokes `signCommand` via the Windows shell). **Not yet verified
  against a real Azure account** — the exact env-var-substitution syntax Tauri's
  bundler accepts should be confirmed with one real signed build once Max has
  real credentials, before trusting it for a public release.
- `.github/workflows/release.yml` adds a `windows-latest` job: installs
  `artifact-signing-cli` via `cargo install`, exports the 6 secrets above as env
  vars, then runs the same `tauri-apps/tauri-action` build step used for macOS.
- Auto-updater signing (`TAURI_SIGNING_PRIVATE_KEY`) is platform-agnostic and
  already covers Windows — no separate updater key needed.

### Until Max completes the Azure setup

The Windows release job will fail at the signing step (missing secrets) if
triggered today. This is expected — Task #165 is code-complete but
not verified end-to-end. Task #166 (Windows OS event hooks) does not depend on
signing and proceeds independently; only the *shippable, SmartScreen-clean*
release artifact depends on this setup being finished.

---

## Linux (Task #167)

No code signing exists for Linux `.AppImage` distribution in the mainstream
sense — AppImage does not use a platform-enforced signature/reputation gate the
way macOS Gatekeeper or Windows SmartScreen do. Optional GPG signing of the
AppImage is out of scope unless Max asks for it later.

`.github/workflows/release.yml`'s `ubuntu-22.04` matrix leg passes
`--bundles appimage` to scope the build to just AppImage, rather than Tauri's
`bundle.targets: "all"` default (which would also produce `.deb`/`.rpm` on
Linux) — narrower than the config default, matching what Task #167 actually
asked for and avoiding a dependency on `rpmbuild` existing on the CI runner
for a format nobody requested.
