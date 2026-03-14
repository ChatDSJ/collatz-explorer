/**
 * Geometric binary tree layout for the Collatz inverse tree.
 *
 * Every node's position is uniquely determined by its path from the root:
 *   Left child  (×2, spine) → 30° left of vertical (steep, dominant)
 *   Right child ((n-1)/3)   → 60° right of vertical (shallow, branching)
 *
 * A depth-dependent decay factor makes step sizes shrink at each level.
 * This breaks vector-sum commutativity, ensuring every node gets a unique
 * position (paths LLLLRLL and LLLLLLR now produce different coordinates).
 * It also creates a fractal quality: deeper subtrees are smaller.
 *
 * Design principles:
 * - All arrows point UPWARD from root — no horizontal arrows ever
 * - Subtree overlap is allowed and expected (the tree is compact)
 * - Z-ordering handles depth: spine nodes and closer-to-root nodes on top
 * - The powers-of-2 spine forms a clear 30° diagonal going up-left
 * - Right branches fan out to the upper-right at 60° from vertical
 */

import type { CollatzNode } from '../engine/collatz';

export interface LayoutNode {
  value: number;
  x: number;
  y: number;
  depth: number;
}

export interface LayoutResult {
  nodes: Map<number, LayoutNode>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// ── Direction vectors ─────────────────────────────────────────────────

/** Spine angle: 30° from vertical (going up-left) */
const SPINE_ANGLE = Math.PI / 6; // 30°

/** Branch angle: 60° from vertical (going up-right) */
const BRANCH_ANGLE = Math.PI / 3; // 60°

/**
 * Depth decay factor: step size at depth d = levelHeight × DECAY^d.
 *
 * This is critical for correctness. Without decay, vector addition is
 * commutative (paths with same L/R count land on the same pixel).
 * With DECAY < 1, each step has a unique magnitude → unique positions.
 *
 * 0.93 gives good separation (~14px between depth-7 siblings) while
 * keeping the tree compact and fractal-looking.
 */
const DECAY = 0.93;

// Unit direction vectors (will be scaled by levelHeight × DECAY^depth)
const SPINE_DX = -Math.sin(SPINE_ANGLE);   // -0.500
const SPINE_DY = -Math.cos(SPINE_ANGLE);   // -0.866
const BRANCH_DX = Math.sin(BRANCH_ANGLE);  //  0.866
const BRANCH_DY = -Math.cos(BRANCH_ANGLE); // -0.500

/**
 * Layout the inverse Collatz binary tree using fixed geometric angles
 * with depth-dependent decay.
 *
 * @param nodes       - The tree from buildInverseTree()
 * @param levelHeight - Base pixel distance per tree level (default 80)
 */
export function layoutTree(
  nodes: Map<number, CollatzNode>,
  levelHeight: number = 80,
): LayoutResult {
  if (!nodes.has(1)) throw new Error('Tree must contain root node (1)');

  const layoutNodes = new Map<number, LayoutNode>();
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  // BFS from root — each node's position = parent + direction × step(depth)
  const queue: Array<{ value: number; x: number; y: number; depth: number }> = [];
  queue.push({ value: 1, x: 0, y: 0, depth: 0 });

  while (queue.length > 0) {
    const { value, x, y, depth } = queue.shift()!;

    // Guard: skip if already placed (shouldn't happen in a tree, but safe)
    if (layoutNodes.has(value)) continue;

    layoutNodes.set(value, { value, x, y, depth });

    // Update bounds
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    // Place children with decay-scaled step
    const node = nodes.get(value);
    if (!node) continue;

    const step = levelHeight * Math.pow(DECAY, depth);

    for (const childValue of node.children) {
      if (layoutNodes.has(childValue)) continue;

      const childNode = nodes.get(childValue);
      if (!childNode) continue;

      if (childNode.edgeType === 'div2') {
        // Left child (spine direction): 30° up-left
        queue.push({
          value: childValue,
          x: x + SPINE_DX * step,
          y: y + SPINE_DY * step,
          depth: depth + 1,
        });
      } else {
        // Right child (branch direction): 60° up-right
        queue.push({
          value: childValue,
          x: x + BRANCH_DX * step,
          y: y + BRANCH_DY * step,
          depth: depth + 1,
        });
      }
    }
  }

  return {
    nodes: layoutNodes,
    bounds: { minX, maxX, minY, maxY },
  };
}
