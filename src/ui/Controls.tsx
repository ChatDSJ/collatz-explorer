/**
 * Overlay controls for the Collatz Explorer.
 * - Jump to number
 * - Theme selector
 * - Animation style selector
 * - Info panel showing selected node + path
 * - Zoom controls
 */

import JumpToNumber from './JumpToNumber';
import { THEMES } from '../types';
import { collatzSequence, stoppingTime, isPowerOf2 } from '../engine/collatz';
import type { AnimationStyle } from '../canvas/animation';

const ANIMATION_STYLES: { key: AnimationStyle; label: string; icon: string }[] = [
  { key: 'flow', label: 'Flow', icon: '✦' },
  { key: 'pulse', label: 'Pulse', icon: '◉' },
  { key: 'wave', label: 'Wave', icon: '≈' },
  { key: 'off', label: 'Off', icon: '○' },
];

interface ControlsProps {
  selectedNumber: number | null;
  onJump: (n: number) => void;
  onClearSelection: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  animationStyle: AnimationStyle;
  onAnimationStyleChange: (style: AnimationStyle) => void;
}

export default function Controls({
  selectedNumber,
  onJump,
  onClearSelection,
  theme,
  onThemeChange,
  animationStyle,
  onAnimationStyleChange,
}: ControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '12px 16px',
          pointerEvents: 'auto',
        }}
      >
        {/* Left: title + jump */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#e0e0e0',
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
            }}
          >
            Collatz Explorer
          </h1>
          <JumpToNumber onJump={onJump} />
        </div>

        {/* Right: theme + animation controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {/* Theme selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => onThemeChange(key)}
                title={t.name}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: key === theme ? '2px solid #fff' : '2px solid transparent',
                  background: `#${t.background.toString(16).padStart(6, '0')}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                data-testid={`theme-${key}`}
              />
            ))}
          </div>

          {/* Animation style selector */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {ANIMATION_STYLES.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => onAnimationStyleChange(key)}
                title={`Animation: ${label}`}
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: 'none',
                  background: key === animationStyle
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  color: key === animationStyle ? '#fff' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
                data-testid={`anim-${key}`}
              >
                <span style={{ fontSize: '10px' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom info panel */}
      {selectedNumber !== null && (
        <NodeInfo value={selectedNumber} onClose={onClearSelection} />
      )}

      {/* Bottom-right: instructions */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '16px',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '11px',
          fontFamily: 'monospace',
          textAlign: 'right',
          pointerEvents: 'auto',
        }}
      >
        scroll to zoom · drag to pan · click a node to trace
      </div>
    </div>
  );
}

function NodeInfo({ value, onClose }: { value: number; onClose: () => void }) {
  const seq = collatzSequence(value);
  const steps = stoppingTime(value);
  const isSpine = isPowerOf2(value);
  const isEven = value % 2 === 0;
  const next = seq[1];

  // Format path display: show first and last few steps
  const pathDisplay = formatPath(seq);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '16px',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(12px)',
        borderRadius: '10px',
        padding: '14px 18px',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '12px',
        pointerEvents: 'auto',
        maxWidth: '360px',
        border: '1px solid rgba(255,215,0,0.15)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
      data-testid="node-info"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '2px 6px',
          borderRadius: '4px',
        }}
        title="Clear selection"
      >
        ✕
      </button>

      <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>
        {value.toLocaleString()}
        {isSpine && (
          <span style={{ color: '#ffd700', marginLeft: '8px', fontSize: '12px' }}>
            ⚡ spine (2<sup>{Math.log2(value)}</sup>)
          </span>
        )}
      </div>

      <div style={{ opacity: 0.8, lineHeight: 1.7 }}>
        <div>
          <span style={{ color: isEven ? '#4ecdc4' : '#ff6b6b' }}>
            {isEven ? '●' : '●'}
          </span>{' '}
          {isEven ? 'even' : 'odd'} · {steps} step{steps !== 1 ? 's' : ''} to 1
        </div>
        {next !== undefined && (
          <div style={{ opacity: 0.7 }}>
            next → {next.toLocaleString()} ({isEven ? `${value}÷2` : `3×${value}+1`})
          </div>
        )}
      </div>

      {/* Path trace display */}
      <div
        style={{
          marginTop: '10px',
          padding: '8px 10px',
          background: 'rgba(255,215,0,0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255,215,0,0.1)',
          fontSize: '10px',
          lineHeight: 1.8,
          wordBreak: 'break-all',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        <div style={{ color: 'rgba(255,215,0,0.6)', marginBottom: '2px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Journey to 1
        </div>
        {pathDisplay}
      </div>
    </div>
  );
}

/**
 * Format a Collatz sequence for display.
 * Shows first 6, ellipsis, last 4 if the sequence is long.
 */
function formatPath(seq: number[]): string {
  if (seq.length <= 12) {
    return seq.join(' → ');
  }
  const head = seq.slice(0, 6).join(' → ');
  const tail = seq.slice(-4).join(' → ');
  return `${head} → … (${seq.length - 10} more) … → ${tail}`;
}
