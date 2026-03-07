/**
 * Fixed-size ring buffer. Overwrites oldest on push when full.
 * Pre-allocates once — no GC pressure after init.
 */
export class CircularBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private _count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity);
  }

  get count(): number {
    return this._count;
  }

  get isFull(): boolean {
    return this._count === this.capacity;
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._count < this.capacity) this._count++;
  }

  /** Returns items oldest-first. Stitches the two halves after wrap. */
  toArray(): T[] {
    if (this._count === 0) return [];

    if (this._count < this.capacity) {
      return this.buffer.slice(0, this._count) as T[];
    }

    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)] as T[];
  }

  /** Items where getTime(item) >= since. */
  itemsSince(since: number, getTime: (item: T) => number): T[] {
    return this.toArray().filter((item) => getTime(item) >= since);
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this._count = 0;
  }
}
