/**
 * Zoom Emergence System — "Continuous Emergence"
 *
 * Instead of discrete LOD levels with abrupt transitions, details
 * emerge smoothly and continuously as you zoom in:
 *
 * Scale  0.02 — 0.10  Constellation: only spine dots, no labels
 * Scale  0.10 — 0.20  Tree forms: non-spine nodes fade in
 * Scale  0.20 — 0.45  Recognition: labels emerge (spine first, then small, then all)
 * Scale  0.45 — 0.80  Full tree: everything readable, arrows sharpen
 * Scale  0.80 — 1.40  Operations: edge labels (÷2, 3n+1) emerge on arrows
 * Scale  1.40 — 2.50  Details: even/odd indicator rings, step-count badges
 * Scale  2.50+         Deep zoom: full detail, prep for Phase 3 inner mechanics
 */

/**
 * Attempt at GPU-friendly smoothstep. Maps x from [edge0, edge1] → [0, 1]
 * with Hermite interpolation (no derivative discontinuity at boundaries).
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Per-element alpha functions ───────────────────────────────────────

/** Non-spine node alpha: fades in between scale 0.10 and 0.22 */
export function nodeAlpha(scale: number, isSpine: boolean): number {
  if (isSpine) return 1; // spine always fully visible
  return smoothstep(0.10, 0.22, scale);
}

/** Label alpha — spine labels emerge first, then small values, then all */
export function labelAlpha(scale: number, isSpine: boolean, value: number): number {
  if (isSpine) return smoothstep(0.18, 0.30, scale);
  if (value <= 20) return smoothstep(0.28, 0.42, scale);
  if (value <= 100) return smoothstep(0.32, 0.48, scale);
  return smoothstep(0.38, 0.55, scale);
}

/** Node scale factor — slight growth at detail zoom for emphasis */
export function nodeScaleFactor(scale: number, isSpine: boolean): number {
  if (isSpine) return 1;
  // Non-spine nodes grow slightly at close zoom (1.0 → 1.12)
  return 1.0 + 0.12 * smoothstep(1.0, 2.0, scale);
}

/** Edge operation label alpha: "÷2" and "3n+1" on arrows */
export function edgeLabelAlpha(scale: number): number {
  return smoothstep(0.80, 1.40, scale);
}

/** Detail ring alpha: even/odd colored halos */
export function detailRingAlpha(scale: number): number {
  return smoothstep(1.4, 2.2, scale);
}

/** Step count badge alpha */
export function stepBadgeAlpha(scale: number): number {
  return smoothstep(2.0, 3.0, scale);
}

// ── Utility: should a layer be active at all? ─────────────────────────
// (Used to skip expensive updates when a layer is fully transparent)

export function isEdgeLabelActive(scale: number): boolean {
  return scale > 0.75;
}

export function isDetailActive(scale: number): boolean {
  return scale > 1.3;
}

export function isStepBadgeActive(scale: number): boolean {
  return scale > 1.8;
}
