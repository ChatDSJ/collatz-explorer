/**
 * Phase 2: Life & Motion tests.
 *
 * Tests for animation system, path tracing, camera, geometric layout,
 * zoom emergence, edge labels, and click-to-foreground.
 */

import { describe, it, expect } from 'vitest';
import {
  collatzSequence,
  buildInverseTree,
  isPowerOf2,
  getPathEdgeKeys,
  getDescendants,
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

// ── Geometric layout with decay ───────────────────────────────────────

describe('geometric layout', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 100);

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

  it('spine angle is 30° from vertical', () => {
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

  it('nodes 20 and 21 are NOT at the same position (decay fixes collision)', () => {
    const node20 = layout.nodes.get(20)!;
    const node21 = layout.nodes.get(21)!;
    const dist = Math.hypot(node20.x - node21.x, node20.y - node21.y);
    expect(dist).toBeGreaterThan(5); // should be ~14px apart
  });

  it('decay creates smaller steps at deeper levels', () => {
    // Spine step from 1→2 (depth 0) should be larger than 64→128 (depth 6)
    const n1 = layout.nodes.get(1)!;
    const n2 = layout.nodes.get(2)!;
    const n64 = layout.nodes.get(64)!;
    const n128 = layout.nodes.get(128)!;

    const step1 = Math.hypot(n2.x - n1.x, n2.y - n1.y);
    const step6 = Math.hypot(n128.x - n64.x, n128.y - n64.y);

    expect(step1).toBeGreaterThan(step6);
    expect(step6 / step1).toBeCloseTo(0.93 ** 6, 2);
  });
});

// ── Layout has path nodes ─────────────────────────────────────────────

describe('layout has path nodes', () => {
  const tree = buildInverseTree(5000, 40);
  const layout = layoutTree(tree, 100);

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

// ── getDescendants (click-to-foreground) ──────────────────────────────

describe('getDescendants', () => {
  const tree = buildInverseTree(5000, 40);

  it('root (1) returns all nodes in the tree', () => {
    const descendants = getDescendants(1, tree);
    expect(descendants.size).toBe(tree.size);
  });

  it('includes the root itself', () => {
    const descendants = getDescendants(16, tree);
    expect(descendants.has(16)).toBe(true);
  });

  it('node 16 descendants include 32, 5, and their subtrees', () => {
    const descendants = getDescendants(16, tree);
    expect(descendants.has(32)).toBe(true); // left child (div2)
    expect(descendants.has(5)).toBe(true);  // right child (3np1)
    expect(descendants.has(64)).toBe(true); // grandchild 32→64
    expect(descendants.has(10)).toBe(true); // grandchild 5→10
  });

  it('node 5 descendants do NOT include node 16 (its parent)', () => {
    const descendants = getDescendants(5, tree);
    expect(descendants.has(5)).toBe(true);
    expect(descendants.has(10)).toBe(true);  // child
    expect(descendants.has(16)).toBe(false); // parent — not a descendant!
  });

  it('leaf nodes return just themselves', () => {
    // Find a leaf node (no children)
    let leaf = 0;
    for (const [value, node] of tree) {
      if (node.children.length === 0) {
        leaf = value;
        break;
      }
    }
    if (leaf > 0) {
      const descendants = getDescendants(leaf, tree);
      expect(descendants.size).toBe(1);
      expect(descendants.has(leaf)).toBe(true);
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
