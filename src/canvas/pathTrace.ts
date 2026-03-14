/**
 * Path tracing system for the Collatz Explorer.
 *
 * When a user clicks a node, we compute its Collatz sequence to 1
 * and render a glowing highlighted path through the tree.
 *
 * The path trace visually shows the "journey" of a number down to 1.
 */

import { Container, Graphics } from 'pixi.js';
import { collatzSequence, isPowerOf2, getPathEdgeKeys } from '../engine/collatz';
import type { LayoutNode } from '../layout/reingold-tilford';
import type { Theme } from '../types';

const NODE_RADIUS = 16;
const SPINE_RADIUS = 20;
const TRACE_LINE_WIDTH = 3.5;
const TRACE_GLOW_WIDTH = 8;
const TRACE_NODE_RING_WIDTH = 3;

export interface PathTraceResult {
  /** The Collatz sequence from the clicked number to 1 */
  sequence: number[];
  /** Display container for the trace visuals */
  container: Container;
  /** Animate the trace (called each frame, t in seconds since trace started) */
  tick: (elapsed: number) => void;
  /** Remove and clean up */
  destroy: () => void;
}

/**
 * Create a path trace visualization from `startValue` to 1.
 *
 * Returns null if the start value isn't in the layout (not in tree).
 */
export function createPathTrace(
  startValue: number,
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
): PathTraceResult | null {
  // Compute the forward Collatz sequence
  const sequence = collatzSequence(startValue);

  // Filter to only nodes that exist in our tree layout
  const visibleSequence = sequence.filter(v => layoutNodes.has(v));
  if (visibleSequence.length < 2) return null;

  const container = new Container();
  container.zIndex = 100; // Above arrows, below interactive nodes

  // ── Glow layer (drawn first, behind everything) ─────────────────

  const glowLayer = new Graphics();
  container.addChild(glowLayer);

  // ── Main trace line layer ───────────────────────────────────────

  const lineLayer = new Graphics();
  container.addChild(lineLayer);

  // ── Node highlight rings ────────────────────────────────────────

  const ringLayer = new Graphics();
  container.addChild(ringLayer);

  // Draw static elements
  drawTraceLine(visibleSequence, layoutNodes, theme, lineLayer, glowLayer);
  drawNodeRings(visibleSequence, layoutNodes, theme, ringLayer);

  // Animation state
  let currentPhase = 0;

  function tick(elapsed: number): void {
    // Gentle pulsing glow
    currentPhase = elapsed;
    const pulseAlpha = 0.15 + 0.1 * Math.sin(elapsed * 2.5);
    glowLayer.alpha = pulseAlpha;

    // Subtle ring pulsing — staggered per node
    const children = ringLayer.children;
    for (let i = 0; i < children.length; i++) {
      const ring = children[i]!;
      const nodePhase = elapsed * 2 + i * 0.3;
      ring.alpha = 0.7 + 0.3 * Math.sin(nodePhase);
    }
  }

  function destroy(): void {
    container.removeChildren();
    container.destroy();
  }

  return {
    sequence: visibleSequence,
    container,
    tick,
    destroy,
  };
}

/**
 * Draw the trace line connecting all nodes in the path.
 */
function drawTraceLine(
  sequence: number[],
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
  lineG: Graphics,
  glowG: Graphics,
): void {
  const color = theme.highlightColor;

  for (let i = 0; i < sequence.length - 1; i++) {
    const fromNode = layoutNodes.get(sequence[i]!)!;
    const toNode = layoutNodes.get(sequence[i + 1]!)!;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;

    const nx = dx / len;
    const ny = dy / len;

    const fromRadius = isPowerOf2(sequence[i]!) ? SPINE_RADIUS : NODE_RADIUS;
    const toRadius = isPowerOf2(sequence[i + 1]!) ? SPINE_RADIUS : NODE_RADIUS;

    const startX = fromNode.x + nx * fromRadius;
    const startY = fromNode.y + ny * fromRadius;
    const endX = toNode.x - nx * toRadius;
    const endY = toNode.y - ny * toRadius;

    // Glow (wider, more transparent)
    glowG.moveTo(startX, startY);
    glowG.lineTo(endX, endY);
    glowG.stroke({ color, width: TRACE_GLOW_WIDTH, alpha: 0.25 });

    // Main line
    lineG.moveTo(startX, startY);
    lineG.lineTo(endX, endY);
    lineG.stroke({ color, width: TRACE_LINE_WIDTH, alpha: 0.8 });
  }
}

/**
 * Draw highlight rings around each node in the path.
 */
function drawNodeRings(
  sequence: number[],
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
  ringLayer: Graphics,
): void {
  const color = theme.highlightColor;

  for (let i = 0; i < sequence.length; i++) {
    const value = sequence[i]!;
    const node = layoutNodes.get(value);
    if (!node) continue;

    const isSpine = isPowerOf2(value);
    const radius = (isSpine ? SPINE_RADIUS : NODE_RADIUS) + 4;

    // Each ring is its own Graphics for individual animation
    const ring = new Graphics();
    ring.circle(node.x, node.y, radius);
    ring.stroke({ color, width: TRACE_NODE_RING_WIDTH, alpha: 0.8 });

    // Subtle fill glow
    ring.circle(node.x, node.y, radius - 1);
    ring.fill({ color, alpha: 0.08 });

    ringLayer.addChild(ring);
  }
}

// getPathEdgeKeys is re-exported from engine/collatz.ts (pure logic, no PixiJS)
export { getPathEdgeKeys } from '../engine/collatz';
