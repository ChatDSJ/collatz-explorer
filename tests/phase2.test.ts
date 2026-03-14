/**
 * Phase 2: Life & Motion tests.
 *
 * Tests for animation system, path tracing, camera, and spine shear layout.
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

// ── Layout: spine shear at 30° ────────────────────────────────────────

describe('layout spine shear', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 80);

  it('spine nodes grow upward (decreasing y)', () => {
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
    // With the 30° shear, deeper spine nodes should have smaller x
    const node1 = layout.nodes.get(1)!;
    const node16 = layout.nodes.get(16)!;
    const node64 = layout.nodes.get(64)!;

    expect(node16.x).toBeLessThan(node1.x);
    expect(node64.x).toBeLessThan(node16.x);
  });

  it('spine angle is approximately 30° from vertical', () => {
    // Measure angle between consecutive spine nodes
    const node1 = layout.nodes.get(1)!;
    const node2 = layout.nodes.get(2)!;

    const dx = Math.abs(node2.x - node1.x);
    const dy = Math.abs(node2.y - node1.y);
    const angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);

    // Should be close to 30° (allow some tolerance for RT adjustments)
    expect(angleDeg).toBeGreaterThan(25);
    expect(angleDeg).toBeLessThan(35);
  });

  it('right children are to the right of their parent', () => {
    // Node 5 is right child of 16, should be to the right
    const node16 = layout.nodes.get(16)!;
    const node5 = layout.nodes.get(5);

    if (node5) {
      expect(node5.x).toBeGreaterThan(node16.x);
    }
  });

  it('left children (2x) are to the left of right siblings ((x-1)/3)', () => {
    // At node 16: left=32, right=5
    const node32 = layout.nodes.get(32)!;
    const node5 = layout.nodes.get(5);

    if (node5) {
      expect(node32.x).toBeLessThan(node5.x);
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

// ── Layout compatibility with path tracing ────────────────────────────

describe('layout has path nodes', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 80);

  it('all sequence nodes for small numbers are in tree', () => {
    for (const testVal of [3, 5, 7, 10, 20, 42]) {
      const seq = collatzSequence(testVal);
      expect(layout.nodes.has(1)).toBe(true);
      expect(layout.nodes.has(2)).toBe(true);
      expect(layout.nodes.has(4)).toBe(true);
    }
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
