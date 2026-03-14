/**
 * Main PixiJS canvas component.
 * Renders the infinite zoomable Collatz tree.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { THEMES, getZoomLevel } from '../types';
import type { Theme, ZoomLevel } from '../types';
import { buildInverseTree, getEdges, isPowerOf2 } from '../engine/collatz';
import type { CollatzNode } from '../engine/collatz';
import { layoutTree } from '../layout/reingold-tilford';
import type { LayoutNode } from '../layout/reingold-tilford';
import { renderNodes, updateNodeLOD } from './nodes';
import { renderArrows } from './arrows';

interface CollatzCanvasProps {
  theme?: string;
  onNodeClick?: (value: number) => void;
  jumpToNumber?: number | null;
  selectedNumber?: number | null;
}

// Canvas state exposed for external access
export interface CanvasState {
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
  treeNodes: Map<number, CollatzNode>;
  layoutNodes: Map<number, LayoutNode>;
  zoomLevel: ZoomLevel;
}

export default function CollatzCanvas({
  theme: themeName = 'midnight',
  onNodeClick,
  jumpToNumber,
  selectedNumber,
}: CollatzCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const stateRef = useRef<CanvasState | null>(null);
  const [isReady, setIsReady] = useState(false);

  const theme = THEMES[themeName] ?? THEMES['midnight']!;

  // Initialize PixiJS application
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;

    async function init() {
      const app = new Application();
      await app.init({
        background: theme.background,
        resizeTo: container!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container!.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // Build Collatz tree
      const treeNodes = buildInverseTree(5000, 40);
      const layout = layoutTree(treeNodes, 80);
      const edges = getEdges(treeNodes);

      // Create world container (everything moves together)
      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      // Render arrows first (behind nodes)
      const arrowContainer = renderArrows(edges, layout.nodes, theme);
      world.addChild(arrowContainer);

      // Render nodes on top
      const nodeContainer = renderNodes(
        treeNodes,
        layout.nodes,
        theme,
        (value: number) => onNodeClick?.(value)
      );
      world.addChild(nodeContainer);

      // Initialize state
      stateRef.current = {
        viewport: { x: 0, y: 0, scale: 1 },
        treeNodes,
        layoutNodes: layout.nodes,
        zoomLevel: 'medium',
      };

      // Center on root (node 1)
      const rootLayout = layout.nodes.get(1);
      if (rootLayout) {
        world.x = app.screen.width / 2 - rootLayout.x;
        world.y = app.screen.height * 0.85 - rootLayout.y;
      }

      // Set up pan and zoom
      setupInteraction(app, world, stateRef, nodeContainer, theme);

      setIsReady(true);

      // Expose test hooks
      if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).__collatz_test = {
          getState: () => stateRef.current,
          getNodeCount: () => treeNodes.size,
          getVisibleNodes: () => {
            // Count nodes within viewport bounds
            const state = stateRef.current;
            if (!state || !appRef.current) return 0;
            const app = appRef.current;
            let count = 0;
            for (const node of state.layoutNodes.values()) {
              const screenX = node.x * world.scale.x + world.x;
              const screenY = node.y * world.scale.y + world.y;
              if (
                screenX >= -50 && screenX <= app.screen.width + 50 &&
                screenY >= -50 && screenY <= app.screen.height + 50
              ) {
                count++;
              }
            }
            return count;
          },
        };
      }
    }

    init();

    return () => {
      destroyed = true;
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLCanvasElement;
        canvas.parentElement?.removeChild(canvas);
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeName]);

  // Handle jumpToNumber
  useEffect(() => {
    if (!jumpToNumber || !worldRef.current || !stateRef.current || !appRef.current) return;

    const layoutNode = stateRef.current.layoutNodes.get(jumpToNumber);
    if (!layoutNode) return;

    const world = worldRef.current;
    const app = appRef.current;

    // Animate to the target node
    const targetX = app.screen.width / 2 - layoutNode.x * world.scale.x;
    const targetY = app.screen.height / 2 - layoutNode.y * world.scale.y;

    // Simple animation
    const startX = world.x;
    const startY = world.y;
    const duration = 500;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic

      world.x = startX + (targetX - startX) * ease;
      world.y = startY + (targetY - startY) * ease;

      if (t < 1) {
        requestAnimationFrame(animate);
      }
    }
    animate();
  }, [jumpToNumber]);

  // Handle selectedNumber highlight
  useEffect(() => {
    // Highlight logic would update node visuals here
    // For Phase 1, we'll handle this via node rendering updates
  }, [selectedNumber]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        touchAction: 'none',
      }}
      data-testid="collatz-canvas"
    />
  );
}

/**
 * Set up mouse/touch interaction for pan and zoom.
 */
function setupInteraction(
  app: Application,
  world: Container,
  stateRef: React.MutableRefObject<CanvasState | null>,
  nodeContainer: Container,
  theme: Theme,
) {
  const canvas = app.canvas as HTMLCanvasElement;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.02, Math.min(10, world.scale.x * scaleFactor));

    // Zoom toward mouse position
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    const worldX = (mouseX - world.x) / world.scale.x;
    const worldY = (mouseY - world.y) / world.scale.y;

    world.scale.set(newScale);

    world.x = mouseX - worldX * newScale;
    world.y = mouseY - worldY * newScale;

    // Update state
    if (stateRef.current) {
      stateRef.current.viewport = { x: world.x, y: world.y, scale: newScale };
      stateRef.current.zoomLevel = getZoomLevel(newScale);
    }

    // Update LOD
    updateNodeLOD(nodeContainer, getZoomLevel(newScale), theme);
  }, { passive: false });

  // Pan with mouse drag
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    world.x += dx;
    world.y += dy;
    lastX = e.clientX;
    lastY = e.clientY;

    if (stateRef.current) {
      stateRef.current.viewport = { x: world.x, y: world.y, scale: world.scale.x };
    }
  });

  canvas.addEventListener('pointerup', () => {
    isDragging = false;
  });

  canvas.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  // Touch zoom (pinch)
  let lastTouchDist = 0;
  let lastTouchMidX = 0;
  let lastTouchMidY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      lastTouchMidX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      lastTouchMidY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
      const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2;
      const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2;

      if (lastTouchDist > 0) {
        const scaleFactor = dist / lastTouchDist;
        const newScale = Math.max(0.02, Math.min(10, world.scale.x * scaleFactor));

        const worldX = (midX - world.x) / world.scale.x;
        const worldY = (midY - world.y) / world.scale.y;

        world.scale.set(newScale);
        world.x = midX - worldX * newScale;
        world.y = midY - worldY * newScale;

        // Pan from pinch movement
        world.x += midX - lastTouchMidX;
        world.y += midY - lastTouchMidY;

        if (stateRef.current) {
          stateRef.current.viewport = { x: world.x, y: world.y, scale: newScale };
          stateRef.current.zoomLevel = getZoomLevel(newScale);
        }
        updateNodeLOD(nodeContainer, getZoomLevel(newScale), theme);
      }

      lastTouchDist = dist;
      lastTouchMidX = midX;
      lastTouchMidY = midY;
    }
  }, { passive: true });
}
