/**
 * Jump-to-number input component.
 * Allows users to type a number and navigate directly to it.
 */

import { useState, useCallback } from 'react';

interface JumpToNumberProps {
  onJump: (n: number) => void;
  maxValue?: number;
}

export default function JumpToNumber({ onJump, maxValue = 100000 }: JumpToNumberProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) {
      setError('Enter a positive integer');
      return;
    }
    if (n > maxValue) {
      setError(`Max: ${maxValue.toLocaleString()}`);
      return;
    }
    setError('');
    onJump(n);
  }, [value, maxValue, onJump]);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="Go to number…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          padding: '6px 10px',
          color: '#e0e0e0',
          fontSize: '13px',
          width: '120px',
          fontFamily: 'monospace',
          outline: 'none',
        }}
        data-testid="jump-input"
      />
      <button
        type="submit"
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          padding: '6px 12px',
          color: '#e0e0e0',
          fontSize: '13px',
          cursor: 'pointer',
          fontFamily: 'monospace',
        }}
        data-testid="jump-button"
      >
        Go
      </button>
      {error && (
        <span style={{ color: '#ff6b6b', fontSize: '11px' }}>{error}</span>
      )}
    </form>
  );
}
