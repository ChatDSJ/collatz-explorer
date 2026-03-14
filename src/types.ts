/**
 * Shared types for the Collatz Explorer.
 */

// Re-export animation types for convenience
export type { AnimationStyle } from './canvas/animation';

/** Visual theme configuration */
export interface Theme {
  name: string;
  background: number;
  nodeColor: number;
  nodeStroke: number;
  spineColor: number;
  div2ArrowColor: number;
  threenplusoneArrowColor: number;
  textColor: number;
  highlightColor: number;
  loopArrowColor: number;
}

/** Predefined themes */
export const THEMES: Record<string, Theme> = {
  midnight: {
    name: 'Midnight',
    background: 0x0a0a1a,
    nodeColor: 0x1a1a2e,
    nodeStroke: 0x4a4a6a,
    spineColor: 0xffd700,
    div2ArrowColor: 0x4ecdc4,  // teal
    threenplusoneArrowColor: 0xff6b6b,  // coral red
    textColor: 0xe0e0e0,
    highlightColor: 0xffd700,
    loopArrowColor: 0xff9f43,
  },
  paper: {
    name: 'Paper',
    background: 0xf5f0e8,
    nodeColor: 0xffffff,
    nodeStroke: 0x333333,
    spineColor: 0xd4a017,
    div2ArrowColor: 0x2980b9,  // blue
    threenplusoneArrowColor: 0xc0392b,  // red
    textColor: 0x222222,
    highlightColor: 0xe67e22,
    loopArrowColor: 0x8e44ad,
  },
  neon: {
    name: 'Neon',
    background: 0x000000,
    nodeColor: 0x0d0d0d,
    nodeStroke: 0x00ff88,
    spineColor: 0xff00ff,
    div2ArrowColor: 0x00ffff,  // cyan
    threenplusoneArrowColor: 0xff0088,  // hot pink
    textColor: 0x00ff88,
    highlightColor: 0xffff00,
    loopArrowColor: 0xff6600,
  },
};

/** Zoom level categories for LOD */
export type ZoomLevel = 'far' | 'medium' | 'close' | 'detail';

export function getZoomLevel(scale: number): ZoomLevel {
  if (scale < 0.15) return 'far';
  if (scale < 0.5) return 'medium';
  if (scale < 1.5) return 'close';
  return 'detail';
}
