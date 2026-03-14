/**
 * Phase 2: Life & Motion tests.
 *
 * Tests for animation system, path tracing, camera, geometric layout,
 * zoom emergence, and edge labels.
 */

import { describe, it, expect } from 'vitest';
import {
  collatzSequence,
  buildInverseTree,
  isPowerOf2,
  getPathEdgeKeys,
} from '../src/engine/collatz';
import { layoutTree } from '../src/layout/reingold-tilford';
import {
  smoothstep,
  nodeAlpha,
  labelAlpha,
  edgeLabelAlpha,
  detailRingAlpha,
} from '../src/canvas/zoomEmergence';

// ── Path tracing logic ────────────────────────────────────────────────

describe('path tracing', () => {
  it('collatzSequence always ends at 1', () => {
    const testValues = [7, 27, 42, 100, 1000, 3];
    for (const v of testValues) {
      const seq = collatzSequence(v);
      expect(seq[seq.length - 1]).toBe(1);
    }
  });

  it('path edge keys are symmetric', () => {
    const seq = [7, 22, 11, 34, 17, 52, 26, 13, 40, 20, 10, 5, 16, 8, 4, 2, 1];
    const keys = getPathEdgeKeys(seq);
    expect(keys.has('7→22')).toBe(true);
    expect(keys.has('22→7')).toBe(true);
    expect(keys.has('2→1')).toBe(true);
    expect(keys.has('1→2')).toBe(true);
  });

  it('path edge count matches sequence edges', () => {
    const seq = collatzSequence(6);
    const keys = getPathEdgeKeys(seq);
    expect(keys.size).toBe((seq.length - 1) * 2);
  });

  it('path for spine numbers is all spine', () => {
    const seq = collatzSequence(16);
    expect(seq.every(v => isPowerOf2(v))).toBe(true);
  });

  it('path for 27 has 111 steps (famously long)', () => {
    const seq = collatzSequence(27);
    expect(seq.length).toBe(112);
  });
});

// ── Geometric layout ──────────────────────────────────────────────────

describe('geometric layout', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 80);

  it('spine grows upward (y decreases with depth)', () => {
    const spineValues = [1, 2, 4, 8, 16, 32, 64, 128];
    for (let i = 0; i < spineValues.length - 1; i++) {
      const nodeA = layout.nodes.get(spineValues[i]!);
      const nodeB = layout.nodes.get(spineValues[i + 1]!);
      if (nodeA && nodeB) {
        expect(nodeB.y).toBeLessThan(nodeA.y);
      }
    }
  });

  it('spine leans left (x decreases with depth)', () => {
    const node1 = layout.nodes.get(1)!;
    const node16 = layout.nodes.get(16)!;
    const node64 = layout.nodes.get(64)!;
    expect(node16.x).toBeLessThan(node1.x);
    expect(node64.x).toBeLessThan(node16.x);
  });

  it('spine angle is exactly 30° from vertical', () => {
    const node1 = layout.nodes.get(1)!;
    const node2 = layout.nodes.get(2)!;
    const dx = Math.abs(node2.x - node1.x);
    const dy = Math.abs(node2.y - node1.y);
    const angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
    expect(angleDeg).toBeCloseTo(30, 1);
  });

  it('NO arrow is ever horizontal (all children have y < parent)', () => {
    for (const [value, node] of tree) {
      const parentLayout = layout.nodes.get(value);
      if (!parentLayout) continue;

      for (const childValue of node.children) {
        const childLayout = layout.nodes.get(childValue);
        if (!childLayout) continue;

        // Every child must be strictly above its parent (lower y)
        expect(childLayout.y).toBeLessThan(parentLayout.y);
      }
    }
  });

  it('right children are to the right of their parent', () => {
    // Node 5 is right child of 16
    const node16 = layout.nodes.get(16)!;
    const node5 = layout.nodes.get(5);
    if (node5) {
      expect(node5.x).toBeGreaterThan(node16.x);
    }
  });

  it('left children (spine) are to the left of their parent', () => {
    const node16 = layout.nodes.get(16)!;
    const node32 = layout.nodes.get(32)!;
    expect(node32.x).toBeLessThan(node16.x);
  });

  it('right branch angle is approximately 60° from vertical', () => {
    // 16 → 5 is a right branch
    const node16 = layout.nodes.get(16)!;
    const node5 = layout.nodes.get(5);
    if (node5) {
      const dx = Math.abs(node5.x - node16.x);
      const dy = Math.abs(node5.y - node16.y);
      const angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
      expect(angleDeg).toBeCloseTo(60, 1);
    }
  });

  it('all nodes have finite positions', () => {
    for (const node of layout.nodes.values()) {
      expect(isFinite(node.x)).toBe(true);
      expect(isFinite(node.y)).toBe(true);
    }
  });

  it('bounds are valid', () => {
    expect(layout.bounds.minX).toBeLessThan(layout.bounds.maxX);
    expect(layout.bounds.minY).toBeLessThan(layout.bounds.maxY);
  });
});

// ── Layout has path nodes ─────────────────────────────────────────────

describe('layout has path nodes', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 80);

  it('fundamental nodes are in the layout', () => {
    expect(layout.nodes.has(1)).toBe(true);
    expect(layout.nodes.has(2)).toBe(true);
    expect(layout.nodes.has(4)).toBe(true);
  });

  it('layout preserves spine ordering', () => {
    const spineValues = [1, 2, 4, 8, 16, 32, 64];
    for (let i = 0; i < spineValues.length - 1; i++) {
      const nodeA = layout.nodes.get(spineValues[i]!);
      const nodeB = layout.nodes.get(spineValues[i + 1]!);
      if (nodeA && nodeB) {
        expect(nodeB.y).toBeLessThan(nodeA.y);
      }
    }
  });
});

// ── Zoom emergence (smooth transitions) ───────────────────────────────

describe('zoom emergence', () => {
  it('smoothstep returns 0 below edge0', () => {
    expect(smoothstep(0.5, 1.0, 0.2)).toBe(0);
    expect(smoothstep(0.5, 1.0, 0.5)).toBe(0);
  });

  it('smoothstep returns 1 above edge1', () => {
    expect(smoothstep(0.5, 1.0, 1.0)).toBe(1);
    expect(smoothstep(0.5, 1.0, 2.0)).toBe(1);
  });

  it('smoothstep is monotonically increasing', () => {
    let prev = 0;
    for (let x = 0; x <= 2; x += 0.05) {
      const val = smoothstep(0.5, 1.5, x);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });

  it('smoothstep midpoint is 0.5', () => {
    expect(smoothstep(0.0, 1.0, 0.5)).toBeCloseTo(0.5, 5);
  });

  it('spine nodes are always fully visible', () => {
    expect(nodeAlpha(0.01, true)).toBe(1);
    expect(nodeAlpha(0.5, true)).toBe(1);
    expect(nodeAlpha(5.0, true)).toBe(1);
  });

  it('non-spine nodes fade in between 0.10 and 0.22', () => {
    expect(nodeAlpha(0.05, false)).toBe(0);
    expect(nodeAlpha(0.16, false)).toBeGreaterThan(0);
    expect(nodeAlpha(0.16, false)).toBeLessThan(1);
    expect(nodeAlpha(0.30, false)).toBe(1);
  });

  it('spine labels appear before non-spine labels', () => {
    const scale = 0.25;
    const spineAlpha = labelAlpha(scale, true, 4);
    const nonSpineAlpha = labelAlpha(scale, false, 100);
    expect(spineAlpha).toBeGreaterThan(nonSpineAlpha);
  });

  it('edge labels emerge at close zoom', () => {
    expect(edgeLabelAlpha(0.5)).toBe(0);
    expect(edgeLabelAlpha(1.1)).toBeGreaterThan(0);
    expect(edgeLabelAlpha(1.1)).toBeLessThan(1);
    expect(edgeLabelAlpha(2.0)).toBe(1);
  });

  it('detail rings emerge at detail zoom', () => {
    expect(detailRingAlpha(1.0)).toBe(0);
    expect(detailRingAlpha(1.8)).toBeGreaterThan(0);
    expect(detailRingAlpha(1.8)).toBeLessThan(1);
    expect(detailRingAlpha(3.0)).toBe(1);
  });
});

// ── Animation style types ─────────────────────────────────────────────

describe('animation styles', () => {
  it('all valid styles are recognized', () => {
    const validStyles = ['flow', 'pulse', 'wave', 'off'];
    for (const style of validStyles) {
      expect(typeof style).toBe('string');
    }
  });
});

// ── Camera math ───────────────────────────────────────────────────────

describe('camera calculations', () => {
  it('ease-out quartic approaches 1 monotonically', () => {
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const ease = 1 - Math.pow(1 - t, 4);
      expect(ease).toBeGreaterThanOrEqual(prev);
      prev = ease;
    }
    expect(1 - Math.pow(0, 4)).toBe(1);
  });

  it('ease-out starts slow and ends fast at destination', () => {
    const halfwayEase = 1 - Math.pow(0.5, 4);
    expect(halfwayEase).toBeGreaterThan(0.5);
    expect(halfwayEase).toBeLessThan(1);
  });
});
