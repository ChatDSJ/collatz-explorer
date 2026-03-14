import { describe, it, expect } from 'vitest';
import {
  collatzNext,
  collatzSequence,
  stoppingTime,
  inversePredecessors,
  buildInverseTree,
  getEdges,
  isPowerOf2,
  getSpine,
} from '../src/engine/collatz';

describe('collatzNext', () => {
  it('divides even numbers by 2', () => {
    expect(collatzNext(2)).toBe(1);
    expect(collatzNext(4)).toBe(2);
    expect(collatzNext(16)).toBe(8);
    expect(collatzNext(100)).toBe(50);
  });

  it('applies 3n+1 to odd numbers', () => {
    expect(collatzNext(1)).toBe(4);
    expect(collatzNext(3)).toBe(10);
    expect(collatzNext(5)).toBe(16);
    expect(collatzNext(7)).toBe(22);
    expect(collatzNext(27)).toBe(82);
  });

  it('throws for non-positive numbers', () => {
    expect(() => collatzNext(0)).toThrow();
    expect(() => collatzNext(-1)).toThrow();
  });
});

describe('collatzSequence', () => {
  it('returns [1] for input 1 (reaches 1 immediately via identity)', () => {
    const seq = collatzSequence(1);
    expect(seq[0]).toBe(1);
    // 1 → 4 → 2 → 1
    expect(seq[seq.length - 1]).toBe(1);
  });

  it('computes correct sequence for 7', () => {
    const seq = collatzSequence(7);
    expect(seq[0]).toBe(7);
    expect(seq[1]).toBe(22); // 3*7+1
    expect(seq[2]).toBe(11); // 22/2
    expect(seq[seq.length - 1]).toBe(1);
  });

  it('computes correct sequence for 6', () => {
    // 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1
    const seq = collatzSequence(6);
    expect(seq).toEqual([6, 3, 10, 5, 16, 8, 4, 2, 1]);
  });

  it('handles powers of 2 (straight down the spine)', () => {
    const seq = collatzSequence(16);
    expect(seq).toEqual([16, 8, 4, 2, 1]);
  });
});

describe('stoppingTime', () => {
  it('returns known stopping times', () => {
    expect(stoppingTime(1)).toBe(0); // 1 is already at 1
    expect(stoppingTime(2)).toBe(1); // 2→1
    expect(stoppingTime(4)).toBe(2); // 4→2→1
    expect(stoppingTime(6)).toBe(8); // 6→3→10→5→16→8→4→2→1
    expect(stoppingTime(27)).toBe(111); // famously long
  });
});

describe('inversePredecessors', () => {
  it('always includes 2n', () => {
    const preds = inversePredecessors(5);
    expect(preds.find(p => p.value === 10 && p.type === 'div2')).toBeDefined();
  });

  it('includes (n-1)/3 when valid', () => {
    // For n=16: (16-1)/3 = 5, which is odd → valid
    const preds = inversePredecessors(16);
    expect(preds.find(p => p.value === 5 && p.type === '3np1')).toBeDefined();
  });

  it('excludes (n-1)/3 when result is even', () => {
    // For n=7: (7-1)/3 = 2, which is even → not valid
    const preds = inversePredecessors(7);
    expect(preds.every(p => p.type === 'div2')).toBe(true);
  });

  it('excludes the 1→4 loop by default', () => {
    const preds = inversePredecessors(4);
    // Should have 8 (div2) but NOT 1 (3np1 loop)
    expect(preds.find(p => p.value === 8)).toBeDefined();
    expect(preds.find(p => p.value === 1)).toBeUndefined();
  });

  it('can include the 1→4 loop when requested', () => {
    const preds = inversePredecessors(4, false);
    expect(preds.find(p => p.value === 1 && p.type === '3np1')).toBeDefined();
  });
});

describe('buildInverseTree', () => {
  it('builds a tree with root at 1', () => {
    const tree = buildInverseTree(100, 10);
    expect(tree.has(1)).toBe(true);
    expect(tree.get(1)!.parent).toBeNull();
    expect(tree.get(1)!.depth).toBe(0);
  });

  it('includes spine nodes', () => {
    const tree = buildInverseTree(100, 10);
    expect(tree.has(2)).toBe(true);
    expect(tree.has(4)).toBe(true);
    expect(tree.has(8)).toBe(true);
    expect(tree.has(16)).toBe(true);
  });

  it('correctly links parent-child relationships', () => {
    const tree = buildInverseTree(100, 10);
    // 2's parent should be 1 (since 2/2=1)
    expect(tree.get(2)!.parent).toBe(1);
    expect(tree.get(2)!.edgeType).toBe('div2');
    // 5's parent should be 16 (since 3*5+1=16)
    expect(tree.get(5)!.parent).toBe(16);
    expect(tree.get(5)!.edgeType).toBe('3np1');
  });

  it('respects maxNodes limit', () => {
    const tree = buildInverseTree(50, 100);
    expect(tree.size).toBeLessThanOrEqual(50);
  });

  it('has no duplicate nodes', () => {
    const tree = buildInverseTree(1000, 20);
    const values = new Set<number>();
    for (const key of tree.keys()) {
      expect(values.has(key)).toBe(false);
      values.add(key);
    }
  });
});

describe('getEdges', () => {
  it('returns edges for all non-root nodes', () => {
    const tree = buildInverseTree(100, 10);
    const edges = getEdges(tree);
    expect(edges.length).toBe(tree.size - 1); // all nodes except root
  });

  it('edges have correct types', () => {
    const tree = buildInverseTree(100, 10);
    const edges = getEdges(tree);
    for (const edge of edges) {
      expect(['div2', '3np1']).toContain(edge.type);
    }
  });
});

describe('isPowerOf2', () => {
  it('identifies powers of 2', () => {
    expect(isPowerOf2(1)).toBe(true);
    expect(isPowerOf2(2)).toBe(true);
    expect(isPowerOf2(4)).toBe(true);
    expect(isPowerOf2(1024)).toBe(true);
  });

  it('rejects non-powers', () => {
    expect(isPowerOf2(3)).toBe(false);
    expect(isPowerOf2(6)).toBe(false);
    expect(isPowerOf2(0)).toBe(false);
  });
});

describe('getSpine', () => {
  it('returns powers of 2 up to maxValue', () => {
    expect(getSpine(16)).toEqual([1, 2, 4, 8, 16]);
    expect(getSpine(10)).toEqual([1, 2, 4, 8]);
  });
});
