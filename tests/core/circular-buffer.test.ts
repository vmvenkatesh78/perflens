import { describe, it, expect } from 'vitest';
import { CircularBuffer } from '../../src/core/circular-buffer';

describe('CircularBuffer', () => {
  it('starts empty', () => {
    const buf = new CircularBuffer<number>(5);
    expect(buf.count).toBe(0);
    expect(buf.isFull).toBe(false);
    expect(buf.toArray()).toEqual([]);
  });

  it('stores items up to capacity', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);

    expect(buf.count).toBe(3);
    expect(buf.isFull).toBe(true);
    expect(buf.toArray()).toEqual([1, 2, 3]);
  });

  it('overwrites oldest when full', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);

    expect(buf.count).toBe(3);
    expect(buf.toArray()).toEqual([2, 3, 4]);
  });

  it('handles multiple wraps', () => {
    const buf = new CircularBuffer<number>(3);
    for (let i = 1; i <= 8; i++) buf.push(i);
    expect(buf.toArray()).toEqual([6, 7, 8]);
  });

  it('maintains chronological order after wrap', () => {
    const buf = new CircularBuffer<string>(3);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    buf.push('d');
    buf.push('e');

    expect(buf.toArray()).toEqual(['c', 'd', 'e']);
  });

  it('filters by time window', () => {
    const buf = new CircularBuffer<{ ts: number; value: string }>(10);
    buf.push({ ts: 100, value: 'old' });
    buf.push({ ts: 200, value: 'mid' });
    buf.push({ ts: 300, value: 'new' });

    const recent = buf.itemsSince(200, (item) => item.ts);
    expect(recent).toEqual([
      { ts: 200, value: 'mid' },
      { ts: 300, value: 'new' },
    ]);
  });

  it('clears without reallocating', () => {
    const buf = new CircularBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.clear();

    expect(buf.count).toBe(0);
    expect(buf.isFull).toBe(false);
    expect(buf.toArray()).toEqual([]);

    buf.push(10);
    expect(buf.toArray()).toEqual([10]);
  });

  it('handles capacity of 1', () => {
    const buf = new CircularBuffer<number>(1);
    buf.push(1);
    expect(buf.toArray()).toEqual([1]);

    buf.push(2);
    expect(buf.toArray()).toEqual([2]);
    expect(buf.count).toBe(1);
  });
});
