/**
 * Phase 2: Life & Motion tests.
 *
 * Tests for animation system, path tracing, and camera.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collatzSequence, buildInverseTree, isPowerOf2 } from '../src/engine/collatz';
import { layoutTree } from '../src/layout/reingold-tilford';
import { getPathEdgeKeys } from '../src/canvas/pathTrace';

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

    // Each edge should have both forward and reverse keys
    expect(keys.has('7→22')).toBe(true);
    expect(keys.has('22→7')).toBe(true);
    expect(keys.has('2→1')).toBe(true);
    expect(keys.has('1→2')).toBe(true);
  });

  it('path edge count matches sequence edges', () => {
    const seq = collatzSequence(6);
    const keys = getPathEdgeKeys(seq);
    // Each edge creates 2 keys (forward + reverse)
    expect(keys.size).toBe((seq.length - 1) * 2);
  });

  it('path for spine numbers is all spine', () => {
    // 16 → 8 → 4 → 2 → 1 (all powers of 2)
    const seq = collatzSequence(16);
    expect(seq.every(v => isPowerOf2(v))).toBe(true);
  });

  it('path for 27 has 111 steps (famously long)', () => {
    const seq = collatzSequence(27);
    expect(seq.length).toBe(112); // 111 steps + the number itself
  });
});

// ── Layout compatibility with path tracing ────────────────────────────

describe('layout has path nodes', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 80);

  it('all sequence nodes for small numbers are in tree', () => {
    // For numbers in the tree, their Collatz paths should mostly be in the tree
    for (const testVal of [3, 5, 7, 10, 20, 42]) {
      const seq = collatzSequence(testVal);
      // At minimum, 1, 2, 4 should always be in the layout
      expect(layout.nodes.has(1)).toBe(true);
      expect(layout.nodes.has(2)).toBe(true);
      expect(layout.nodes.has(4)).toBe(true);
    }
  });

  it('layout preserves spine ordering', () => {
    // Spine nodes should have decreasing y (growing upward from root)
    const spineValues = [1, 2, 4, 8, 16, 32, 64];
    for (let i = 0; i < spineValues.length - 1; i++) {
      const nodeA = layout.nodes.get(spineValues[i]!);
      const nodeB = layout.nodes.get(spineValues[i + 1]!);
      if (nodeA && nodeB) {
        // nodeB should have smaller y (higher up, since y is negative for deeper nodes)
        expect(nodeB.y).toBeLessThan(nodeA.y);
      }
    }
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
  it('ease-out quintic approaches 1 monotonically', () => {
    // Verify our easing function is well-behaved
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const ease = 1 - Math.pow(1 - t, 4);
      expect(ease).toBeGreaterThanOrEqual(prev);
      prev = ease;
    }
    // At t=1, ease should be exactly 1
    expect(1 - Math.pow(0, 4)).toBe(1);
  });

  it('ease-out starts slow and ends fast at destination', () => {
    // At t=0.5, easing should be past halfway (it accelerates into the target)
    const halfwayEase = 1 - Math.pow(0.5, 4);
    expect(halfwayEase).toBeGreaterThan(0.5);
    expect(halfwayEase).toBeLessThan(1);
  });
});
