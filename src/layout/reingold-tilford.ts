/**
 * Reingold-Tilford tree layout algorithm with 30° spine shear.
 *
 * Assigns (x, y) positions to every node in the Collatz binary tree.
 * - y is determined by depth (deeper = higher on screen, root at bottom)
 * - x is computed by Reingold-Tilford to avoid overlaps
 * - The powers-of-2 spine is sheared to lean 30° from vertical (up-left)
 *
 * Binary tree structure:
 *   Left child  = 2x        (div2 — placed to the left)
 *   Right child = (x-1)/3   (3n+1 inverse — placed to the right)
 *
 * The 30° shear shifts every node's x by -depth * tan(30°), making the
 * spine lean left while right subtrees fan out to the right.
 *
 * Reference: Reingold & Tilford (1981), Buchheim et al. (2002)
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

// Internal node used during layout computation
interface RTNode {
  value: number;
  children: RTNode[];
  depth: number;
  x: number;
  mod: number;       // modifier for subtree shift
  thread: RTNode | null;
  ancestor: RTNode;
  prelim: number;
  change: number;
  shift: number;
  number: number;    // position among siblings (1-indexed)
  parent: RTNode | null;
}

const NODE_SPACING_X = 1.0;  // minimum horizontal spacing between nodes
const LEVEL_HEIGHT = 1.0;     // vertical distance between levels

/**
 * Spine shear: tan(30°) ≈ 0.5774
 * Applied per depth level to tilt the spine 30° from vertical.
 * Positive value = spine leans left (negative x direction).
 */
const SPINE_LEAN = Math.tan(Math.PI / 6); // tan(30°)

/**
 * Build internal RT tree structure from Collatz nodes.
 * Root is node 1 at the bottom; children grow upward.
 */
function buildRTTree(
  nodes: Map<number, CollatzNode>,
  value: number,
  depth: number,
  parent: RTNode | null
): RTNode {
  const collatzNode = nodes.get(value);
  if (!collatzNode) throw new Error(`Node ${value} not found`);

  const rtNode: RTNode = {
    value,
    children: [],
    depth,
    x: 0,
    mod: 0,
    thread: null,
    ancestor: null as unknown as RTNode,
    prelim: 0,
    change: 0,
    shift: 0,
    number: 0,
    parent,
  };
  rtNode.ancestor = rtNode; // self-reference initially

  // Sort children: div2 (left=2x) first, then 3np1 (right=(x-1)/3)
  const sortedChildren = [...collatzNode.children].sort((a, b) => {
    const nodeA = nodes.get(a)!;
    const nodeB = nodes.get(b)!;
    // div2 edges first (these form the spine), then 3np1
    if (nodeA.edgeType !== nodeB.edgeType) {
      return nodeA.edgeType === 'div2' ? -1 : 1;
    }
    return a - b;
  });

  rtNode.children = sortedChildren.map((childValue, i) => {
    const child = buildRTTree(nodes, childValue, depth + 1, rtNode);
    child.number = i + 1;
    return child;
  });

  return rtNode;
}

/**
 * First walk: bottom-up traversal assigning preliminary x-coordinates.
 */
function firstWalk(v: RTNode): void {
  if (v.children.length === 0) {
    // Leaf node
    if (v.number > 1 && v.parent) {
      const leftSibling = v.parent.children[v.number - 2];
      if (leftSibling) {
        v.prelim = leftSibling.prelim + NODE_SPACING_X;
      }
    }
    return;
  }

  // Process children first
  for (const child of v.children) {
    firstWalk(child);
  }

  // Default ancestor for apportion
  let defaultAncestor = v.children[0]!;

  for (const child of v.children) {
    defaultAncestor = apportion(child, defaultAncestor);
  }

  executeShifts(v);

  // Center parent over children
  const firstChild = v.children[0]!;
  const lastChild = v.children[v.children.length - 1]!;
  const midpoint = (firstChild.prelim + lastChild.prelim) / 2;

  if (v.number > 1 && v.parent) {
    const leftSibling = v.parent.children[v.number - 2];
    if (leftSibling) {
      v.prelim = leftSibling.prelim + NODE_SPACING_X;
      v.mod = v.prelim - midpoint;
    } else {
      v.prelim = midpoint;
    }
  } else {
    v.prelim = midpoint;
  }
}

function apportion(v: RTNode, defaultAncestor: RTNode): RTNode {
  if (v.number <= 1 || !v.parent) return defaultAncestor;

  const w = v.parent.children[v.number - 2]; // left sibling
  if (!w) return defaultAncestor;

  let vInnerRight: RTNode | null = v;
  let vOuterRight: RTNode | null = v;
  let vInnerLeft: RTNode | null = w;
  let vOuterLeft: RTNode | null = v.parent.children[0] ?? null;

  let sInnerRight = v.mod;
  let sOuterRight = v.mod;
  let sInnerLeft = w.mod;
  let sOuterLeft = vOuterLeft ? vOuterLeft.mod : 0;

  while (nextRight(vInnerLeft) && nextLeft(vInnerRight)) {
    vInnerLeft = nextRight(vInnerLeft)!;
    vInnerRight = nextLeft(vInnerRight)!;
    vOuterLeft = nextLeft(vOuterLeft);
    vOuterRight = nextRight(vOuterRight);

    if (vOuterRight) {
      vOuterRight.ancestor = v;
    }

    const shift =
      (vInnerLeft.prelim + sInnerLeft) -
      (vInnerRight.prelim + sInnerRight) +
      NODE_SPACING_X;

    if (shift > 0) {
      const anc = ancestor(vInnerLeft, v, defaultAncestor);
      moveSubtree(anc, v, shift);
      sInnerRight += shift;
      sOuterRight += shift;
    }

    sInnerLeft += vInnerLeft.mod;
    sInnerRight += vInnerRight.mod;
    sOuterLeft += vOuterLeft ? vOuterLeft.mod : 0;
    sOuterRight += vOuterRight ? vOuterRight.mod : 0;
  }

  if (nextRight(vInnerLeft) && !nextRight(vOuterRight)) {
    if (vOuterRight) {
      vOuterRight.thread = nextRight(vInnerLeft);
      vOuterRight.mod += sInnerLeft - sOuterRight;
    }
  }

  if (nextLeft(vInnerRight) && !nextLeft(vOuterLeft)) {
    if (vOuterLeft) {
      vOuterLeft.thread = nextLeft(vInnerRight);
      vOuterLeft.mod += sInnerRight - sOuterLeft;
    }
    defaultAncestor = v;
  }

  return defaultAncestor;
}

function nextLeft(v: RTNode | null): RTNode | null {
  if (!v) return null;
  return v.children.length > 0 ? v.children[0]! : v.thread;
}

function nextRight(v: RTNode | null): RTNode | null {
  if (!v) return null;
  return v.children.length > 0 ? v.children[v.children.length - 1]! : v.thread;
}

function ancestor(vInnerLeft: RTNode, v: RTNode, defaultAncestor: RTNode): RTNode {
  if (vInnerLeft.ancestor.parent === v.parent) {
    return vInnerLeft.ancestor;
  }
  return defaultAncestor;
}

function moveSubtree(wMinus: RTNode, wPlus: RTNode, shift: number): void {
  const subtrees = wPlus.number - wMinus.number;
  if (subtrees > 0) {
    wPlus.change -= shift / subtrees;
    wPlus.shift += shift;
    wMinus.change += shift / subtrees;
    wPlus.prelim += shift;
    wPlus.mod += shift;
  }
}

function executeShifts(v: RTNode): void {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i]!;
    w.prelim += shift;
    w.mod += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

/**
 * Second walk: top-down traversal computing final positions.
 * Applies the 30° spine shear: x_final = x_RT - depth × tan(30°)
 */
function secondWalk(
  v: RTNode,
  modSum: number,
  result: Map<number, LayoutNode>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): void {
  // Standard RT x-position
  const xRT = v.prelim + modSum;

  // Apply spine shear: shift left by depth × tan(30°)
  const x = xRT - v.depth * SPINE_LEAN * LEVEL_HEIGHT;

  // y grows upward (negative) from root at y=0
  const y = -v.depth * LEVEL_HEIGHT;

  result.set(v.value, {
    value: v.value,
    x,
    y,
    depth: v.depth,
  });

  // Update bounds
  if (x < bounds.minX) bounds.minX = x;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (y > bounds.maxY) bounds.maxY = y;

  for (const child of v.children) {
    secondWalk(child, modSum + v.mod, result, bounds);
  }
}

/**
 * Layout the inverse Collatz binary tree.
 *
 * Uses Reingold-Tilford for overlap-free positioning, then applies
 * a 30° shear so the powers-of-2 spine leans up-left.
 *
 * @param nodes - The Collatz tree nodes from buildInverseTree()
 * @param scaleFactor - Multiplier for spacing (default 80px between nodes)
 */
export function layoutTree(
  nodes: Map<number, CollatzNode>,
  scaleFactor: number = 80
): LayoutResult {
  if (!nodes.has(1)) throw new Error('Tree must contain root node (1)');

  // Build internal RT tree
  const rtRoot = buildRTTree(nodes, 1, 0, null);

  // First walk: compute preliminary positions
  firstWalk(rtRoot);

  // Second walk: compute final positions with spine shear
  const layoutNodes = new Map<number, LayoutNode>();
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  secondWalk(rtRoot, 0, layoutNodes, bounds);

  // Apply scale factor
  for (const node of layoutNodes.values()) {
    node.x *= scaleFactor;
    node.y *= scaleFactor;
  }
  bounds.minX *= scaleFactor;
  bounds.maxX *= scaleFactor;
  bounds.minY *= scaleFactor;
  bounds.maxY *= scaleFactor;

  return { nodes: layoutNodes, bounds };
}
