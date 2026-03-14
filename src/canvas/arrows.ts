/**
 * Arrow rendering for the Collatz tree.
 *
 * Two types of arrows:
 * - div2 arrows (teal): from even numbers to their half
 * - 3n+1 arrows (coral): from odd numbers to 3n+1
 *
 * All arrows point "downward" toward 1 (from child to parent in the inverse tree).
 * The special 1→4 loop arrow points upward.
 */

import { Container, Graphics } from 'pixi.js';
import type { CollatzEdge } from '../engine/collatz';
import type { LayoutNode } from '../layout/reingold-tilford';
import type { Theme } from '../types';
import type { ArrowData } from './animation';

const ARROW_HEAD_SIZE = 8;
const ARROW_WIDTH = 1.5;
const NODE_RADIUS = 16; // avoid overlapping the node circle

export interface ArrowRenderResult {
  container: Container;
  arrowData: ArrowData[];
}

/**
 * Render all arrows in the tree.
 * Returns both the visual container and arrow metadata for animation.
 */
export function renderArrows(
  edges: CollatzEdge[],
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
): ArrowRenderResult {
  const container = new Container();
  const arrowData: ArrowData[] = [];

  for (const edge of edges) {
    const fromNode = layoutNodes.get(edge.from);
    const toNode = layoutNodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    const arrow = new Graphics();
    const color = edge.type === 'div2' ? theme.div2ArrowColor : theme.threenplusoneArrowColor;

    drawArrow(
      arrow,
      fromNode.x, fromNode.y,
      toNode.x, toNode.y,
      color,
      ARROW_WIDTH,
      0.6, // alpha
    );

    container.addChild(arrow);

    // Store metadata for animation system
    arrowData.push({
      fromX: fromNode.x,
      fromY: fromNode.y,
      toX: toNode.x,
      toY: toNode.y,
      type: edge.type,
      fromValue: edge.from,
      toValue: edge.to,
    });
  }

  // Add the special 1→4 loop arrow
  const node1 = layoutNodes.get(1);
  const node4 = layoutNodes.get(4);
  if (node1 && node4) {
    const loopArrow = new Graphics();
    drawLoopArrow(
      loopArrow,
      node1.x, node1.y,
      node4.x, node4.y,
      theme.loopArrowColor,
    );
    container.addChild(loopArrow);
  }

  return { container, arrowData };
}

/**
 * Draw a straight arrow from (x1,y1) to (x2,y2) with an arrowhead.
 */
function drawArrow(
  g: Graphics,
  x1: number, y1: number,
  x2: number, y2: number,
  color: number,
  width: number,
  alpha: number,
): void {
  // Calculate direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const nx = dx / len; // normalized direction
  const ny = dy / len;

  // Shorten line to not overlap node circles
  const startX = x1 + nx * NODE_RADIUS;
  const startY = y1 + ny * NODE_RADIUS;
  const endX = x2 - nx * NODE_RADIUS;
  const endY = y2 - ny * NODE_RADIUS;

  // Draw line
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);
  g.stroke({ color, width, alpha });

  // Draw arrowhead
  const headX = endX;
  const headY = endY;
  const perpX = -ny;
  const perpY = nx;

  g.moveTo(headX, headY);
  g.lineTo(
    headX - nx * ARROW_HEAD_SIZE + perpX * ARROW_HEAD_SIZE * 0.4,
    headY - ny * ARROW_HEAD_SIZE + perpY * ARROW_HEAD_SIZE * 0.4,
  );
  g.moveTo(headX, headY);
  g.lineTo(
    headX - nx * ARROW_HEAD_SIZE - perpX * ARROW_HEAD_SIZE * 0.4,
    headY - ny * ARROW_HEAD_SIZE - perpY * ARROW_HEAD_SIZE * 0.4,
  );
  g.stroke({ color, width: width * 1.2, alpha });
}

/**
 * Draw the special 1→4 loop arrow (curved, pointing upward).
 * This represents the cycle: 1 → 4 → 2 → 1
 */
function drawLoopArrow(
  g: Graphics,
  x1: number, y1: number,
  x2: number, y2: number,
  color: number,
): void {
  // Draw a curved arrow from node 1 to node 4
  // Curve to the right side to avoid overlapping the spine
  const midX = Math.max(x1, x2) + 60;
  const midY = (y1 + y2) / 2;

  g.moveTo(x1 + NODE_RADIUS, y1);
  g.bezierCurveTo(
    midX, y1,
    midX, y2,
    x2 + NODE_RADIUS, y2,
  );
  g.stroke({ color, width: 2, alpha: 0.5 });

  // Small arrowhead at the end
  const angle = Math.atan2(y2 - midY, x2 + NODE_RADIUS - midX);
  const headSize = 6;
  g.moveTo(x2 + NODE_RADIUS, y2);
  g.lineTo(
    x2 + NODE_RADIUS - Math.cos(angle - 0.4) * headSize,
    y2 - Math.sin(angle - 0.4) * headSize,
  );
  g.moveTo(x2 + NODE_RADIUS, y2);
  g.lineTo(
    x2 + NODE_RADIUS - Math.cos(angle + 0.4) * headSize,
    y2 - Math.sin(angle + 0.4) * headSize,
  );
  g.stroke({ color, width: 2, alpha: 0.5 });
}
