/**
 * Edge operation labels for the Collatz tree.
 *
 * At close zoom, small labels appear on each arrow showing the
 * mathematical operation: "÷2" for even → parent, "3n+1" for odd → parent.
 *
 * Labels are created for all edges but only made visible when the
 * zoom crosses the emergence threshold (scale > ~0.8).
 *
 * Performance: the container is hidden entirely at low zoom to avoid
 * draw calls. Labels use monospace text with alpha-based emergence.
 */

import { Container, Text } from 'pixi.js';
import type { CollatzEdge } from '../engine/collatz';
import type { LayoutNode } from '../layout/reingold-tilford';
import type { Theme } from '../types';
import { edgeLabelAlpha, isEdgeLabelActive } from './zoomEmergence';

const NODE_RADIUS = 16;

export interface EdgeLabelSystem {
  /** Display container — add to world */
  container: Container;
  /** Update all label alphas for current zoom. Call on zoom change. */
  update(scale: number): void;
  /** Clean up */
  destroy(): void;
}

/**
 * Create edge operation labels for all tree edges.
 *
 * Labels are positioned at the midpoint of each edge, offset slightly
 * to avoid overlapping the arrow line.
 */
export function createEdgeLabels(
  edges: CollatzEdge[],
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
): EdgeLabelSystem {
  const container = new Container();
  container.visible = false; // start hidden
  container.zIndex = 5; // between arrows and nodes

  const labels: Text[] = [];

  for (const edge of edges) {
    const fromNode = layoutNodes.get(edge.from);
    const toNode = layoutNodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 30) continue; // skip very short edges

    // Normalized perpendicular for offset
    const nx = dx / len;
    const ny = dy / len;
    const perpX = -ny;
    const perpY = nx;

    // Position: 40% along the edge (closer to the child), offset perpendicular
    const t = 0.38;
    const midX = fromNode.x + dx * t + perpX * 10;
    const midY = fromNode.y + dy * t + perpY * 10;

    const labelText = edge.type === 'div2' ? '÷2' : '3n+1';
    const color = edge.type === 'div2' ? theme.div2ArrowColor : theme.threenplusoneArrowColor;

    const label = new Text({
      text: labelText,
      style: {
        fontFamily: 'monospace',
        fontSize: 9,
        fill: color,
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5, 0.5);
    label.x = midX;
    label.y = midY;

    // Rotate label to align with edge direction
    const angle = Math.atan2(dy, dx);
    // Keep text readable (don't flip upside down)
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      label.rotation = angle + Math.PI;
    } else {
      label.rotation = angle;
    }

    container.addChild(label);
    labels.push(label);
  }

  function update(scale: number): void {
    if (!isEdgeLabelActive(scale)) {
      container.visible = false;
      return;
    }

    container.visible = true;
    const alpha = edgeLabelAlpha(scale);
    container.alpha = alpha;
  }

  function destroy(): void {
    container.removeChildren();
    container.destroy();
  }

  return { container, update, destroy };
}
