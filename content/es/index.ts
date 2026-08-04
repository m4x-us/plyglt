import type { Unit } from "../types";
import a1Unit01Scaffold from "./cards/a1-unit-01-scaffold";

// Spanish (target-language) content module — see scripts/exportPack.ts's content-loading
// branch: every language other than Italian is expected at content/{langCode}/index.ts,
// exporting ALL_UNITS (or a default export), mirroring content/index.ts's shape.
//
// Currently just a scaffold unit proving the pipeline works end-to-end for a second
// language (see content/es/cards/a1-unit-01-scaffold.ts's own header comment) — the real
// Spanish A1-B2 curriculum is a separate, future content-authoring project following
// CURRICULUM.md's process, not part of this architecture-prep work.
//
// Card ID convention (content/index.ts:3-5): "{lang}-{level}u{unit}-t{tier}-{seq}",
// e.g. "es-a1u01-t1-001" — every language after Italian uses this namespaced format.
export const ALL_UNITS: Unit[] = [
  a1Unit01Scaffold,
];

export const UNIT_MAP: Record<string, Unit> = Object.fromEntries(
  ALL_UNITS.map((u) => [u.id, u])
);

export type { Unit };
