/**
 * Camera animation system for smooth transitions.
 *
 * Provides spring-based easing for pan and zoom when
 * navigating to nodes (click or jump-to-number).
 */

import { Container } from 'pixi.js';

export interface CameraTarget {
  x: number;
  y: number;
  scale: number;
}

interface CameraAnimation {
  startX: number;
  startY: number;
  startScale: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  startTime: number;
  duration: number;
}

export class CameraSystem {
  private world: Container;
  private screenWidth: number;
  private screenHeight: number;
  private animation: CameraAnimation | null = null;
  private onUpdate?: (scale: number) => void;

  constructor(
    world: Container,
    screenWidth: number,
    screenHeight: number,
    onUpdate?: (scale: number) => void,
  ) {
    this.world = world;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.onUpdate = onUpdate;
  }

  /** Update screen dimensions (on resize). */
  setScreenSize(w: number, h: number): void {
    this.screenWidth = w;
    this.screenHeight = h;
  }

  /**
   * Smoothly animate to center on a world-space point.
   * Optionally adjusts zoom to a target scale.
   */
  flyTo(
    worldX: number,
    worldY: number,
    targetScale?: number,
    duration = 700,
  ): void {
    const currentScale = this.world.scale.x;
    const scale = targetScale ?? currentScale;

    this.animation = {
      startX: this.world.x,
      startY: this.world.y,
      startScale: currentScale,
      targetX: this.screenWidth / 2 - worldX * scale,
      targetY: this.screenHeight / 2 - worldY * scale,
      targetScale: scale,
      startTime: performance.now(),
      duration,
    };
  }

  /**
   * Smoothly animate to frame a specific node, adjusting zoom
   * so it appears at a comfortable size.
   */
  flyToNode(
    worldX: number,
    worldY: number,
    duration = 700,
  ): void {
    // Target scale: zoom in slightly so the node is prominent
    const currentScale = this.world.scale.x;
    const targetScale = Math.max(currentScale, Math.min(1.5, currentScale * 1.2));

    this.flyTo(worldX, worldY, targetScale, duration);
  }

  /** Called each frame. Returns true if animation is in progress. */
  tick(): boolean {
    if (!this.animation) return false;

    const now = performance.now();
    const elapsed = now - this.animation.startTime;
    const t = Math.min(elapsed / this.animation.duration, 1);

    // Smooth ease-out (quintic for a buttery feel)
    const ease = 1 - Math.pow(1 - t, 4);

    const { startX, startY, startScale, targetX, targetY, targetScale } = this.animation;

    // Interpolate position and scale
    const newScale = startScale + (targetScale - startScale) * ease;
    this.world.scale.set(newScale);

    // Recompute target position based on current scale (keeps centering accurate)
    const currentTargetX = this.screenWidth / 2 -
      ((this.screenWidth / 2 - targetX) / targetScale) * newScale;
    const currentTargetY = this.screenHeight / 2 -
      ((this.screenHeight / 2 - targetY) / targetScale) * newScale;

    this.world.x = startX + (currentTargetX - startX) * ease;
    this.world.y = startY + (currentTargetY - startY) * ease;

    this.onUpdate?.(newScale);

    if (t >= 1) {
      this.animation = null;
      return false;
    }

    return true;
  }

  /** Whether a camera animation is in progress. */
  get isAnimating(): boolean {
    return this.animation !== null;
  }

  /** Cancel any in-progress animation. */
  cancel(): void {
    this.animation = null;
  }
}
