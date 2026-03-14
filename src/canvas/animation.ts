/**
 * Animation system for the Collatz tree.
 *
 * Manages arrow pulse animations with multiple styles:
 * - flow: continuous energy particles streaming base→tip
 * - pulse: wave of brightness traveling along arrows
 * - wave: sine-wave oscillation of arrow brightness
 * - off: no animation
 *
 * Uses PixiJS ticker for frame-accurate updates.
 */

import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../types';

export type AnimationStyle = 'flow' | 'pulse' | 'wave' | 'off';

export interface ArrowData {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: 'div2' | '3np1';
  /** The edge connects child→parent (toward 1) */
  fromValue: number;
  toValue: number;
}

const NODE_RADIUS = 16;
const PULSE_SPEED = 0.4; // units per second (0→1 is one full arrow traversal)

/**
 * Arrow animation system.
 * Creates an overlay container with animated pulse effects.
 */
export class ArrowAnimationSystem {
  private arrows: ArrowData[] = [];
  private container: Container;
  private particles: Graphics[] = [];
  private elapsed = 0;
  private _style: AnimationStyle = 'flow';
  private theme: Theme;
  private hiddenArrows = new Set<number>();

  constructor(theme: Theme) {
    this.container = new Container();
    this.theme = theme;
  }

  get displayObject(): Container {
    return this.container;
  }

  get style(): AnimationStyle {
    return this._style;
  }

  set style(s: AnimationStyle) {
    this._style = s;
    this.rebuild();
  }

  /** Load arrow data for animation. */
  setArrows(arrows: ArrowData[]): void {
    this.arrows = arrows;
    this.rebuild();
  }

  /** Update theme (e.g. when user switches). */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.rebuild();
  }

  /** Update which arrows are hidden (indices into the arrows array). */
  setHiddenArrows(indices: Set<number>): void {
    this.hiddenArrows = indices;
  }

  /** Called every frame by PixiJS ticker. dt is in seconds. */
  tick(dt: number): void {
    if (this._style === 'off') return;
    this.elapsed += dt;

    switch (this._style) {
      case 'flow':
        this.tickFlow();
        break;
      case 'pulse':
        this.tickPulse();
        break;
      case 'wave':
        this.tickWave();
        break;
    }
  }

  /** Rebuild all animation graphics from scratch. */
  private rebuild(): void {
    this.container.removeChildren();
    this.particles = [];

    if (this._style === 'off') return;

    switch (this._style) {
      case 'flow':
        this.buildFlow();
        break;
      case 'pulse':
      case 'wave':
        this.buildPulseWave();
        break;
    }
  }

  // ── Flow style: bright dots traveling along each arrow ──────────────

  private buildFlow(): void {
    // Create 2 particles per arrow (staggered)
    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]!;
      const color = arrow.type === 'div2'
        ? this.theme.div2ArrowColor
        : this.theme.threenplusoneArrowColor;

      for (let j = 0; j < 2; j++) {
        const dot = new Graphics();
        dot.circle(0, 0, 2.5);
        dot.fill({ color, alpha: 0 }); // start invisible
        this.container.addChild(dot);
        this.particles.push(dot);
      }
    }
  }

  private tickFlow(): void {
    const speed = PULSE_SPEED;
    let pIdx = 0;

    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]!;

      // Skip hidden arrows — hide their particles
      if (this.hiddenArrows.has(i)) {
        for (let j = 0; j < 2; j++) {
          const dot = this.particles[pIdx];
          if (dot) dot.alpha = 0;
          pIdx++;
        }
        continue;
      }
      const dx = arrow.toX - arrow.fromX;
      const dy = arrow.toY - arrow.fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) { pIdx += 2; continue; }

      const nx = dx / len;
      const ny = dy / len;
      const startX = arrow.fromX + nx * NODE_RADIUS;
      const startY = arrow.fromY + ny * NODE_RADIUS;
      const endX = arrow.toX - nx * NODE_RADIUS;
      const endY = arrow.toY - ny * NODE_RADIUS;

      for (let j = 0; j < 2; j++) {
        const dot = this.particles[pIdx];
        if (!dot) { pIdx++; continue; }

        // Each particle offset by 0.5 for staggering
        const phase = (this.elapsed * speed + j * 0.5 + i * 0.137) % 1;

        // Smooth fade in/out at endpoints
        const fadeDist = 0.15;
        let alpha = 0.85;
        if (phase < fadeDist) {
          alpha = 0.85 * (phase / fadeDist);
        } else if (phase > 1 - fadeDist) {
          alpha = 0.85 * ((1 - phase) / fadeDist);
        }

        dot.x = startX + (endX - startX) * phase;
        dot.y = startY + (endY - startY) * phase;
        dot.alpha = alpha;

        pIdx++;
      }
    }
  }

  // ── Pulse / Wave styles: arrows brighten in sequence ────────────────

  private pulseGraphics: Graphics[] = [];

  private buildPulseWave(): void {
    this.pulseGraphics = [];
    for (let i = 0; i < this.arrows.length; i++) {
      const g = new Graphics();
      this.container.addChild(g);
      this.pulseGraphics.push(g);
    }
  }

  private tickPulse(): void {
    const time = this.elapsed * 0.8;

    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]!;
      const g = this.pulseGraphics[i];
      if (!g) continue;

      // Skip hidden arrows
      if (this.hiddenArrows.has(i)) { g.clear(); continue; }

      const color = arrow.type === 'div2'
        ? this.theme.div2ArrowColor
        : this.theme.threenplusoneArrowColor;

      // Pulse based on distance from root (creates cascading wave)
      const dx = arrow.toX - arrow.fromX;
      const dy = arrow.toY - arrow.fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const nx = dx / len;
      const ny = dy / len;
      const startX = arrow.fromX + nx * NODE_RADIUS;
      const startY = arrow.fromY + ny * NODE_RADIUS;
      const endX = arrow.toX - nx * NODE_RADIUS;
      const endY = arrow.toY - ny * NODE_RADIUS;

      // Use fromValue's depth as phase offset (rough proxy via y position)
      const depthPhase = (arrow.fromY / -80) * 0.15;
      const phase = (time + depthPhase) % 2;

      // Pulse intensity: peaks briefly then fades
      let intensity = 0;
      if (phase < 1) {
        intensity = Math.sin(phase * Math.PI); // smooth bell curve
      }

      g.clear();
      if (intensity > 0.05) {
        g.moveTo(startX, startY);
        g.lineTo(endX, endY);
        g.stroke({
          color,
          width: 1.5 + intensity * 2.5,
          alpha: intensity * 0.6,
        });
      }
    }
  }

  private tickWave(): void {
    const time = this.elapsed * 1.2;

    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]!;
      const g = this.pulseGraphics[i];
      if (!g) continue;

      // Skip hidden arrows
      if (this.hiddenArrows.has(i)) { g.clear(); continue; }

      const color = arrow.type === 'div2'
        ? this.theme.div2ArrowColor
        : this.theme.threenplusoneArrowColor;

      const dx = arrow.toX - arrow.fromX;
      const dy = arrow.toY - arrow.fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const nx = dx / len;
      const ny = dy / len;
      const startX = arrow.fromX + nx * NODE_RADIUS;
      const startY = arrow.fromY + ny * NODE_RADIUS;
      const endX = arrow.toX - nx * NODE_RADIUS;
      const endY = arrow.toY - ny * NODE_RADIUS;

      // Continuous sine wave — each arrow oscillates based on its position
      const spatialFreq = 0.02;
      const intensity = 0.3 + 0.3 * Math.sin(
        time * Math.PI + arrow.fromY * spatialFreq + arrow.fromX * spatialFreq * 0.5
      );

      g.clear();
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
      g.stroke({
        color,
        width: 1 + intensity * 2,
        alpha: intensity * 0.5,
      });
    }
  }

  /** Destroy and clean up. */
  destroy(): void {
    this.container.removeChildren();
    this.container.destroy();
    this.particles = [];
    this.pulseGraphics = [];
  }
}
