/**
 * Root application component for Collatz Explorer.
 */

import { useState, useCallback } from 'react';
import CollatzCanvas from './canvas/CollatzCanvas';
import Controls from './ui/Controls';

export default function App() {
  const [theme, setTheme] = useState('midnight');
  const [jumpToNumber, setJumpToNumber] = useState<number | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  const handleNodeClick = useCallback((value: number) => {
    setSelectedNumber(value);
  }, []);

  const handleJump = useCallback((n: number) => {
    setJumpToNumber(n);
    setSelectedNumber(n);
    // Reset jumpToNumber after animation triggers
    setTimeout(() => setJumpToNumber(null), 100);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CollatzCanvas
        theme={theme}
        onNodeClick={handleNodeClick}
        jumpToNumber={jumpToNumber}
        selectedNumber={selectedNumber}
      />
      <Controls
        selectedNumber={selectedNumber}
        onJump={handleJump}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}
