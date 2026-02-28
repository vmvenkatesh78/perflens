# Performance

## Budgets

| Metric | Budget |
|--------|--------|
| Per-render overhead | < 1ms |
| Store mutation | < 0.1ms |
| Memory per component | < 10KB |
| Panel render cycle | < 5ms |
| Core bundle (gzip) | < 5KB |
| Full bundle (gzip) | < 40KB |

## Why It's Fast

Mutable store — no immutable copies. Panel polls every 500ms, not per mutation. Circular buffer — fixed memory. When disabled, zero overhead.
