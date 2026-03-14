# 🌀 Collatz Explorer

Interactive visualization of the Collatz conjecture — explore an infinite zoomable tree where every natural number finds its way to 1.

## The Collatz Conjecture

Take any positive integer. If it's even, divide by 2. If it's odd, multiply by 3 and add 1. Repeat. The conjecture states that every number eventually reaches 1.

## Features

- **Infinite zoomable canvas** — pan and zoom through the inverse Collatz tree
- **Two arrow types** — teal for ÷2 steps, coral for 3n+1 steps
- **Powers-of-2 spine** — the golden vertical backbone (1→2→4→8→16→...)
- **Jump to any number** — type a number and fly directly to it
- **Click any node** — see its Collatz sequence and stopping time
- **Multiple themes** — Midnight, Paper, Neon
- **Level of Detail** — smooth transitions as you zoom in and out
- **Mobile support** — touch to pan, pinch to zoom

## Development

```bash
npm install
npm run dev      # Start dev server
npm run test     # Run unit tests
npm run build    # Production build
```

## Tech Stack

- **PixiJS v8** — WebGL 2D rendering (10K+ nodes at 60fps)
- **React 19** — UI components
- **Vite** — Build tooling
- **TypeScript** — Type safety
- **Vitest** — Unit testing
- **GitHub Actions** — CI/CD → GitHub Pages

## Architecture

```
src/
├── engine/        # Collatz math (pure functions, zero dependencies)
├── layout/        # Reingold-Tilford tree layout algorithm
├── canvas/        # PixiJS rendering (nodes, arrows, LOD)
└── ui/            # React overlay (controls, info panel)
```

## License

MIT
