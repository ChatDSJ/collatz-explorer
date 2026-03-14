/**
 * Root application component for Collatz Explorer.
 */

import { useState, useCallback } from 'react';
import CollatzCanvas from './canvas/CollatzCanvas';
import Controls from './ui/Controls';
import type { AnimationStyle } from './canvas/animation';

export default function App() {
  const [theme, setTheme] = useState('midnight');
  const [jumpToNumber, setJumpToNumber] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('flow');

  const handleNodeClick = useCallback((value: number) => {
    setSelectedNumber((prev) => prev === value ? null : value);
  }, []);

  const handleJump = useCallback((n: number) => {
    setJumpToNumber(n);
    setSelectedNumber(n);
    // Reset jumpToNumber after animation triggers
    setTimeout(() => setJumpToNumber(null), 100);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNumber(null);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CollatzCanvas
        theme={theme}
        onNodeClick={handleNodeClick}
        jumpToNumber={jumpToNumber}
        selectedNumber={selectedNumber}
        animationStyle={animationStyle}
      />
      <Controls
        selectedNumber={selectedNumber}
        onJump={handleJump}
        onClearSelection={handleClearSelection}
        theme={theme}
        onThemeChange={setTheme}
        animationStyle={animationStyle}
        onAnimationStyleChange={setAnimationStyle}
      />
    </div>
  );
}
