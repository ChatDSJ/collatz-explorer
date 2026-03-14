/**
 * Overlay controls for the Collatz Explorer.
 * - Jump to number
 * - Theme selector
 * - Info panel showing selected node
 * - Zoom controls
 */

import { useState, useCallback } from 'react';
import JumpToNumber from './JumpToNumber';
import { THEMES } from '../types';
import { collatzSequence, stoppingTime, isPowerOf2 } from '../engine/collatz';

interface ControlsProps {
  selectedNumber: number | null;
  onJump: (n: number) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
}

export default function Controls({
  selectedNumber,
  onJump,
  theme,
  onThemeChange,
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

        {/* Right: theme selector */}
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
      </div>

      {/* Bottom info panel */}
      {selectedNumber !== null && (
        <NodeInfo value={selectedNumber} />
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
        scroll to zoom · drag to pan · click a node
      </div>
    </div>
  );
}

function NodeInfo({ value }: { value: number }) {
  const seq = collatzSequence(value);
  const steps = stoppingTime(value);
  const isSpine = isPowerOf2(value);
  const isEven = value % 2 === 0;
  const next = seq[1];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '16px',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '12px',
        pointerEvents: 'auto',
        maxWidth: '320px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      data-testid="node-info"
    >
      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '6px' }}>
        {value.toLocaleString()}
        {isSpine && <span style={{ color: '#ffd700', marginLeft: '6px', fontSize: '12px' }}>⚡ spine</span>}
      </div>
      <div style={{ opacity: 0.7, lineHeight: 1.6 }}>
        <div>{isEven ? 'even' : 'odd'} · {steps} steps to 1</div>
        {next !== undefined && (
          <div>
            next: {next.toLocaleString()} ({isEven ? `${value}÷2` : `3×${value}+1`})
          </div>
        )}
        <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.5, wordBreak: 'break-all' }}>
          {seq.slice(0, 8).join(' → ')}{seq.length > 8 ? ' → …' : ''}
        </div>
      </div>
    </div>
  );
}
