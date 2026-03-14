/**
 * Core Collatz conjecture math engine.
 *
 * The Collatz function:  c(n) = n/2 if n is even, 3n+1 if n is odd
 * The conjecture: every positive integer eventually reaches 1.
 *
 * We build the INVERSE tree: starting from 1, we find all numbers
 * that map TO each node. This gives us the tree structure where
 * 1 is the root and every natural number appears exactly once.
 */

/** The Collatz function: n → n/2 (even) or n → 3n+1 (odd) */
export function collatzNext(n: number): number {
  if (n <= 0) throw new Error(`collatzNext requires positive integer, got ${n}`);
  return n % 2 === 0 ? n / 2 : 3 * n + 1;
}

/** Is the step from n to collatzNext(n) a divide-by-2 step? */
export function isDivideStep(n: number): boolean {
  return n % 2 === 0;
}

/** Compute the full Collatz sequence from n down to 1 */
export function collatzSequence(n: number): number[] {
  if (n <= 0) throw new Error(`collatzSequence requires positive integer, got ${n}`);
  const seq = [n];
  let current = n;
  const maxSteps = 10_000; // safety limit
  let steps = 0;
  while (current !== 1 && steps < maxSteps) {
    current = collatzNext(current);
    seq.push(current);
    steps++;
  }
  return seq;
}

/** Number of steps to reach 1 (stopping time) */
export function stoppingTime(n: number): number {
  return collatzSequence(n).length - 1;
}

/**
 * Inverse Collatz predecessors of n.
 * These are numbers m where collatzNext(m) = n.
 *
 * Two possible predecessors:
 * 1. 2n (always valid — since 2n is even, (2n)/2 = n)
 * 2. (n-1)/3 (only if n ≡ 1 mod 3 AND (n-1)/3 is odd AND (n-1)/3 > 0)
 *    Because if m = (n-1)/3, then 3m+1 = n, and m must be odd for 3m+1 to apply
 *
 * Special case: we exclude the 1→4 back-edge from tree building
 * (it creates the loop 1→4→2→1, which is handled separately in visualization)
 */
export interface Predecessor {
  value: number;
  type: 'div2' | '3np1'; // div2 = this predecessor is even (2n); 3np1 = this predecessor is odd ((n-1)/3)
}

export function inversePredecessors(n: number, excludeLoop = true): Predecessor[] {
  const preds: Predecessor[] = [];

  // Always: 2n is a predecessor (2n is even, divides by 2 to get n)
  preds.push({ value: 2 * n, type: 'div2' });

  // Maybe: (n-1)/3 is a predecessor if it's a valid odd integer > 0
  if ((n - 1) % 3 === 0) {
    const m = (n - 1) / 3;
    if (m > 0 && m % 2 === 1) {
      // Exclude the 1→4 loop: m=1, n=4 (since 3(1)+1=4)
      if (!(excludeLoop && m === 1 && n === 4)) {
        preds.push({ value: m, type: '3np1' });
      }
    }
  }

  return preds;
}

/**
 * Edge in the Collatz tree.
 * Direction: from → to follows the Collatz function (toward 1).
 */
export interface CollatzEdge {
  from: number;
  to: number;
  type: 'div2' | '3np1';
}

/**
 * Node in the inverse Collatz tree.
 */
export interface CollatzNode {
  value: number;
  parent: number | null;     // null only for root (1)
  edgeType: 'div2' | '3np1' | null; // type of edge TO parent
  children: number[];        // values of child nodes (predecessors)
  depth: number;             // distance from root (1)
}

/**
 * Build the inverse Collatz tree via BFS from root (1).
 * Returns a map of value → CollatzNode.
 *
 * @param maxNodes - Maximum number of nodes to generate
 * @param maxDepth - Maximum tree depth from root
 */
export function buildInverseTree(
  maxNodes: number = 10000,
  maxDepth: number = 50
): Map<number, CollatzNode> {
  const nodes = new Map<number, CollatzNode>();
  const queue: number[] = [];

  // Root node: 1
  const root: CollatzNode = {
    value: 1,
    parent: null,
    edgeType: null,
    children: [],
    depth: 0,
  };
  nodes.set(1, root);
  queue.push(1);

  while (queue.length > 0 && nodes.size < maxNodes) {
    const current = queue.shift()!;
    const currentNode = nodes.get(current)!;

    if (currentNode.depth >= maxDepth) continue;

    const preds = inversePredecessors(current);
    for (const pred of preds) {
      if (nodes.has(pred.value)) continue; // already in tree
      if (nodes.size >= maxNodes) break;

      const childNode: CollatzNode = {
        value: pred.value,
        parent: current,
        edgeType: pred.type,
        children: [],
        depth: currentNode.depth + 1,
      };
      nodes.set(pred.value, childNode);
      currentNode.children.push(pred.value);
      queue.push(pred.value);
    }
  }

  return nodes;
}

/**
 * Get all edges in the tree (for rendering arrows).
 */
export function getEdges(nodes: Map<number, CollatzNode>): CollatzEdge[] {
  const edges: CollatzEdge[] = [];
  for (const [value, node] of nodes) {
    if (node.parent !== null && node.edgeType !== null) {
      edges.push({
        from: value,
        to: node.parent,
        type: node.edgeType,
      });
    }
  }
  return edges;
}

/**
 * Check if n is a power of 2 (part of the spine).
 */
export function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Get the spine: 1, 2, 4, 8, 16, 32, ... up to maxValue.
 */
export function getSpine(maxValue: number): number[] {
  const spine: number[] = [];
  let v = 1;
  while (v <= maxValue) {
    spine.push(v);
    v *= 2;
  }
  return spine;
}
