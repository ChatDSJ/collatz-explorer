/**
 * Node rendering for the Collatz tree.
 *
 * Each node is a circle with the number displayed.
 * Visual properties change based on:
 * - Whether it's on the spine (power of 2)
 * - Whether it's selected
 * - Current zoom level (continuous alpha-based emergence)
 * - Whether it's in the foreground subtree (click-to-foreground)
 *
 * Detail layers emerge smoothly as zoom increases:
 * - Nodes → Labels → Edge-op context → Even/odd rings → Step badges
 *
 * Overlap / occlusion tracking:
 * - In the geometric layout, subtrees can overlap by design (compact layout).
 * - Nodes rendered later in BFS order appear visually "on top" of earlier ones.
 * - A node is "occluded" if another node overlaps it and renders on top.
 * - Occluded nodes are excluded from the "displayed" set, so their arrows
 *   are hidden (fixing the spurious red arrow bug).
 * - Clicking a parent with a 3n+1 child foregrounds that child's subtree,
 *   overriding occlusion and bringing it to the visual front.
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { CollatzNode } from '../engine/collatz';
import { isPowerOf2, stoppingTime } from '../engine/collatz';
import type { LayoutNode } from '../layout/reingold-tilford';
import type { Theme } from '../types';
import {
  nodeAlpha,
  labelAlpha,
  nodeScaleFactor,
  detailRingAlpha,
  stepBadgeAlpha,
  isDetailActive,
  isStepBadgeActive,
} from './zoomEmergence';

const NODE_RADIUS = 16;
const SPINE_RADIUS = 20;

/** Distance threshold for overlap detection (center-to-center) */
const OVERLAP_THRESHOLD = NODE_RADIUS * 2;

interface NodeSprite {
  container: Container;
  circle: Graphics;
  label: Text;
  value: number;
  isSpine: boolean;
  isEven: boolean;
  depth: number;
  /** Detail ring (even/odd indicator) — created lazily */
  detailRing: Graphics | null;
  /** Step badge — created lazily */
  stepBadge: Text | null;
}

const nodeSprites: Map<number, NodeSprite> = new Map();

/**
 * The currently foregrounded subtree (or null for default).
 * When set, nodes in this set get high z-index and full opacity;
 * other nodes are dimmed and pushed to background.
 */
let currentForeground: Set<number> | null = null;

/**
 * The highlighted subtree — the 3n+1 child's subtree that gets
 * the highest z-priority (on top of other foreground nodes).
 * This is the subtree that was "brought to front" by clicking its parent.
 */
let currentHighlight: Set<number> | null = null;

/**
 * Precomputed set of nodes that are occluded by overlapping nodes
 * in the default z-ordering (BFS render order).
 * An occluded node is behind another node and not visible to the user.
 */
let occludedNodes = new Set<number>();

/**
 * Precompute which nodes are occluded by overlapping neighbors.
 *
 * In the geometric layout, nodes can overlap by design. When two nodes
 * are within OVERLAP_THRESHOLD pixels, the one rendered later (higher BFS
 * index) visually covers the earlier one. The earlier node is "occluded"
 * and its arrows should be hidden.
 *
 * Must be called AFTER renderNodes() populates the layout.
 */
export function initOverlapDetection(layoutNodes: Map<number, LayoutNode>): void {
  occludedNodes = new Set();

  const thresholdSq = OVERLAP_THRESHOLD * OVERLAP_THRESHOLD;
  const entries = Array.from(layoutNodes.entries());

  // entries are in Map insertion order (BFS order from root).
  // In PixiJS with sortableChildren and equal zIndex, later children
  // render on top. So entries[j] (j > i) renders on top of entries[i].
  for (let i = 0; i < entries.length; i++) {
    const [v1, l1] = entries[i]!;
    for (let j = i + 1; j < entries.length; j++) {
      const [, l2] = entries[j]!;
      const dx = l1.x - l2.x;
      const dy = l1.y - l2.y;
      if (dx * dx + dy * dy < thresholdSq) {
        // v1 (earlier in BFS) is occluded by entries[j] (later, on top)
        occludedNodes.add(v1);
        break; // v1 is already marked as occluded
      }
    }
  }
}

/**
 * Get the set of nodes currently "displayed" — visible to the user
 * and not hidden behind overlapping nodes.
 *
 * A node is displayed if:
 * 1. Its PixiJS container is visible (not hidden by zoom emergence)
 * 2. It is NOT occluded, UNLESS it is in the highlighted subtree
 */
export function getDisplayedNodes(): Set<number> {
  const displayed = new Set<number>();

  for (const [value, sprite] of nodeSprites) {
    if (!sprite.container.visible) continue;

    // Highlighted subtree always counts as displayed (overrides occlusion)
    if (currentHighlight?.has(value)) {
      displayed.add(value);
      continue;
    }

    // Foregrounded nodes are displayed (their z-index is boosted)
    if (currentForeground?.has(value)) {
      displayed.add(value);
      continue;
    }

    // In default state (no selection), check occlusion
    if (occludedNodes.has(value)) continue;

    displayed.add(value);
  }

  return displayed;
}

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
    label.alpha = 0; // start hidden, emergence system controls visibility
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
      nodeContainer.zIndex = 3000; // hover always on top
    });
    nodeContainer.on('pointerout', () => {
      circle.clear();
      drawNodeCircle(circle, radius, isSpine, theme, false);
      // Restore z-index based on foreground state
      if (currentHighlight?.has(value)) {
        nodeContainer.zIndex = 2000 - layoutNode.depth;
      } else if (currentForeground?.has(value)) {
        nodeContainer.zIndex = 1000 - layoutNode.depth;
      } else if (currentForeground) {
        nodeContainer.zIndex = -1;
      } else {
        nodeContainer.zIndex = 0;
      }
    });

    container.addChild(nodeContainer);

    nodeSprites.set(value, {
      container: nodeContainer,
      circle,
      label,
      value,
      isSpine,
      isEven: value % 2 === 0,
      depth: layoutNode.depth,
      detailRing: null,
      stepBadge: null,
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
 * Set which subtree is in the foreground.
 * Foregrounded nodes get high z-index; others are pushed to background.
 * Pass null to reset to default.
 *
 * @param values - All foreground node values, or null to reset
 * @param highlightSubtree - Optional 3n+1 child's subtree that gets
 *   even higher z-priority (renders on top of other foreground nodes).
 *   This is used when clicking a node to reveal its red child.
 */
export function setSubtreeForeground(
  values: Set<number> | null,
  highlightSubtree?: Set<number> | null,
): void {
  currentForeground = values;
  currentHighlight = highlightSubtree ?? null;

  for (const sprite of nodeSprites.values()) {
    if (values === null) {
      // Reset to default z-ordering
      sprite.container.zIndex = 0;
    } else if (currentHighlight?.has(sprite.value)) {
      // Highlighted subtree: highest z-priority (above other foreground)
      sprite.container.zIndex = 2000 - sprite.depth;
    } else if (values.has(sprite.value)) {
      // Foreground: high z-index, lower depth = more in front
      sprite.container.zIndex = 1000 - sprite.depth;
    } else {
      // Background: behind everything
      sprite.container.zIndex = -1;
    }
  }
}

/**
 * Update all nodes with continuous zoom emergence.
 * Called every frame (or on zoom change) with the current canvas scale.
 *
 * When a foreground subtree is active, background nodes are dimmed.
 */
export function updateNodeZoom(scale: number, theme: Theme): void {
  const showDetails = isDetailActive(scale);
  const showBadges = isStepBadgeActive(scale);

  for (const sprite of nodeSprites.values()) {
    // ── Node visibility (alpha-based, no hard cutoff) ───────────
    const nAlpha = nodeAlpha(scale, sprite.isSpine);

    if (nAlpha < 0.01) {
      // Fully transparent — hide to save draw calls
      sprite.container.visible = false;
      continue;
    }

    sprite.container.visible = true;

    // Apply foreground dimming when a subtree is selected
    if (currentForeground && !currentForeground.has(sprite.value)) {
      sprite.container.alpha = nAlpha * 0.15; // dim background
    } else {
      sprite.container.alpha = nAlpha;
    }

    // ── Label emergence ─────────────────────────────────────────
    const lAlpha = labelAlpha(scale, sprite.isSpine, sprite.value);
    sprite.label.visible = lAlpha > 0.01;
    sprite.label.alpha = lAlpha;

    // ── Subtle scale growth at close zoom ───────────────────────
    const sf = nodeScaleFactor(scale, sprite.isSpine);
    sprite.container.scale.set(sf);

    // ── Detail ring (even/odd indicator) — lazy creation ────────
    if (showDetails) {
      const ringAlpha = detailRingAlpha(scale);
      if (ringAlpha > 0.01) {
        if (!sprite.detailRing) {
          sprite.detailRing = createDetailRing(sprite, theme);
          sprite.container.addChildAt(sprite.detailRing, 0); // behind circle
        }
        sprite.detailRing.visible = true;
        sprite.detailRing.alpha = ringAlpha;
      } else if (sprite.detailRing) {
        sprite.detailRing.visible = false;
      }
    } else if (sprite.detailRing) {
      sprite.detailRing.visible = false;
    }

    // ── Step badge — lazy creation ──────────────────────────────
    if (showBadges && sprite.value > 1) {
      const badgeAlpha = stepBadgeAlpha(scale);
      if (badgeAlpha > 0.01) {
        if (!sprite.stepBadge) {
          sprite.stepBadge = createStepBadge(sprite);
          sprite.container.addChild(sprite.stepBadge);
        }
        sprite.stepBadge.visible = true;
        sprite.stepBadge.alpha = badgeAlpha;
      } else if (sprite.stepBadge) {
        sprite.stepBadge.visible = false;
      }
    } else if (sprite.stepBadge) {
      sprite.stepBadge.visible = false;
    }
  }
}

/**
 * Create the even/odd detail ring for a node.
 * Teal ring for even, coral for odd.
 */
function createDetailRing(sprite: NodeSprite, theme: Theme): Graphics {
  const ring = new Graphics();
  const radius = (sprite.isSpine ? SPINE_RADIUS : NODE_RADIUS) + 5;
  const color = sprite.isEven ? theme.div2ArrowColor : theme.threenplusoneArrowColor;

  // Outer glow ring
  ring.circle(0, 0, radius);
  ring.stroke({ color, width: 1.5, alpha: 0.5 });

  // Subtle fill
  ring.circle(0, 0, radius);
  ring.fill({ color, alpha: 0.04 });

  return ring;
}

/**
 * Create a step count badge below the node.
 * Shows "→1 in N" (stopping time).
 */
function createStepBadge(sprite: NodeSprite): Text {
  const steps = stoppingTime(sprite.value);
  const badge = new Text({
    text: `${steps}→1`,
    style: {
      fontFamily: 'monospace',
      fontSize: 8,
      fill: 0x888888,
    },
  });
  badge.anchor.set(0.5, 0);
  const radius = sprite.isSpine ? SPINE_RADIUS : NODE_RADIUS;
  badge.y = radius + 4;
  return badge;
}

/**
 * Legacy LOD function — kept for backward compat but now delegates
 * to updateNodeZoom with an approximate scale.
 */
export function updateNodeLOD(
  _container: Container,
  zoomLevel: string,
  theme: Theme,
): void {
  const scaleMap: Record<string, number> = {
    far: 0.08,
    medium: 0.35,
    close: 1.0,
    detail: 2.0,
  };
  updateNodeZoom(scaleMap[zoomLevel] ?? 0.35, theme);
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
