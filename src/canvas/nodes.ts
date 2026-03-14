/**
 * Node rendering for the Collatz tree.
 *
 * Each node is a circle with the number displayed.
 * Visual properties change based on:
 * - Whether it's on the spine (power of 2)
 * - Whether it's selected
 * - Current zoom level (LOD)
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { CollatzNode } from '../engine/collatz';
import { isPowerOf2 } from '../engine/collatz';
import type { LayoutNode } from '../layout/reingold-tilford';
import type { Theme, ZoomLevel } from '../types';

const NODE_RADIUS = 16;
const SPINE_RADIUS = 20;

interface NodeSprite {
  container: Container;
  circle: Graphics;
  label: Text;
  value: number;
  isSpine: boolean;
}

const nodeSprites: Map<number, NodeSprite> = new Map();

/**
 * Render all nodes in the tree.
 */
export function renderNodes(
  treeNodes: Map<number, CollatzNode>,
  layoutNodes: Map<number, LayoutNode>,
  theme: Theme,
  onClick: (value: number) => void,
): Container {
  const container = new Container();
  nodeSprites.clear();

  for (const [value, layoutNode] of layoutNodes) {
    const isSpine = isPowerOf2(value);
    const radius = isSpine ? SPINE_RADIUS : NODE_RADIUS;

    // Node container
    const nodeContainer = new Container();
    nodeContainer.x = layoutNode.x;
    nodeContainer.y = layoutNode.y;
    nodeContainer.eventMode = 'static';
    nodeContainer.cursor = 'pointer';

    // Circle
    const circle = new Graphics();
    drawNodeCircle(circle, radius, isSpine, theme, false);
    nodeContainer.addChild(circle);

    // Label
    const label = new Text({
      text: value.toString(),
      style: {
        fontFamily: 'monospace',
        fontSize: isSpine ? 14 : 11,
        fill: isSpine ? theme.spineColor : theme.textColor,
        fontWeight: isSpine ? 'bold' : 'normal',
      },
    });
    label.anchor.set(0.5, 0.5);
    nodeContainer.addChild(label);

    // Click handler
    nodeContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick(value);
    });

    // Hover effects
    nodeContainer.on('pointerover', () => {
      circle.clear();
      drawNodeCircle(circle, radius * 1.15, isSpine, theme, true);
      nodeContainer.zIndex = 1000;
    });
    nodeContainer.on('pointerout', () => {
      circle.clear();
      drawNodeCircle(circle, radius, isSpine, theme, false);
      nodeContainer.zIndex = 0;
    });

    container.addChild(nodeContainer);

    nodeSprites.set(value, {
      container: nodeContainer,
      circle,
      label,
      value,
      isSpine,
    });
  }

  container.sortableChildren = true;
  return container;
}

function drawNodeCircle(
  g: Graphics,
  radius: number,
  isSpine: boolean,
  theme: Theme,
  isHovered: boolean,
): void {
  const fillColor = isSpine ? theme.spineColor : theme.nodeColor;
  const strokeColor = isHovered ? theme.highlightColor : (isSpine ? theme.spineColor : theme.nodeStroke);
  const fillAlpha = isSpine ? 0.15 : 0.8;
  const strokeWidth = isSpine ? 2.5 : 1.5;

  g.circle(0, 0, radius);
  g.fill({ color: fillColor, alpha: fillAlpha });
  g.stroke({ color: strokeColor, width: strokeWidth, alpha: isHovered ? 1 : 0.8 });
}

/**
 * Update node visibility and detail based on zoom level.
 */
export function updateNodeLOD(
  container: Container,
  zoomLevel: ZoomLevel,
  _theme: Theme,
): void {
  for (const sprite of nodeSprites.values()) {
    switch (zoomLevel) {
      case 'far':
        // Only show spine nodes, hide labels
        sprite.container.visible = sprite.isSpine;
        sprite.label.visible = false;
        break;
      case 'medium':
        // Show all nodes, labels only for spine
        sprite.container.visible = true;
        sprite.label.visible = sprite.isSpine || sprite.value <= 20;
        break;
      case 'close':
        // Show all nodes and labels
        sprite.container.visible = true;
        sprite.label.visible = true;
        break;
      case 'detail':
        // Show everything with full detail
        sprite.container.visible = true;
        sprite.label.visible = true;
        break;
    }
  }
}

/**
 * Highlight a specific node (for selection/journey).
 */
export function highlightNode(value: number, theme: Theme): void {
  const sprite = nodeSprites.get(value);
  if (!sprite) return;

  sprite.circle.clear();
  const radius = sprite.isSpine ? SPINE_RADIUS : NODE_RADIUS;

  sprite.circle.circle(0, 0, radius * 1.3);
  sprite.circle.fill({ color: theme.highlightColor, alpha: 0.3 });
  sprite.circle.stroke({ color: theme.highlightColor, width: 3 });

  sprite.container.zIndex = 500;
}

/**
 * Clear highlight from a node.
 */
export function clearHighlight(value: number, theme: Theme): void {
  const sprite = nodeSprites.get(value);
  if (!sprite) return;

  sprite.circle.clear();
  const radius = sprite.isSpine ? SPINE_RADIUS : NODE_RADIUS;
  drawNodeCircle(sprite.circle, radius, sprite.isSpine, theme, false);
  sprite.container.zIndex = 0;
}
