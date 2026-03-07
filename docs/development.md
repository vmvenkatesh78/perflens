# Development

How we work on perflens. Read this before opening a PR.

## Branches

| Branch      | Purpose                                                |
| ----------- | ------------------------------------------------------ |
| `main`      | Stable, release-ready. Tags trigger npm publish.       |
| `dev`       | Active development. All feature work lands here first. |
| `feature/*` | Larger features branch off `dev`, merge back to `dev`. |

Day-to-day work goes into `dev`. When a release is ready, `dev` gets merged to `main` and tagged.

## Commits

We use [conventional commits](https://www.conventionalcommits.org/). This isn't just style — semantic-release reads these to decide version bumps.

```
feat: add render cascade detection       → minor bump (0.1.0 → 0.2.0)
fix: panel not hiding when enabled=false  → patch bump (0.1.0 → 0.1.1)
feat!: rename useAnchor to useFloat       → major bump (0.1.0 → 1.0.0)
docs: add recipes for common patterns     → no release
chore: update dev dependencies            → no release
refactor: simplify store eviction         → no release
test: add edge cases for circular buffer  → no release
```

Keep commits atomic. One logical change per commit. If your diff touches the store AND the tests for the store, that's one commit. If it also adds a new doc page, that's a separate commit.

## Before pushing

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsup
npm run size        # size-limit (core < 5KB, full < 40KB)
```

Or run everything CI runs:

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run size
```

## Project structure

```
src/
├── core/           # Data collection. Profiler, store, hooks.
├── analyzer/       # Insight generation. One file per rule.
├── panel/          # Floating UI overlay (v0.2.0).
├── detail/         # Expanded view (v0.2.0).
├── types.ts        # All shared interfaces.
├── constants.ts    # Defaults and thresholds.
└── index.ts        # Public API surface.

playground/         # Vite app with anti-pattern demo components.
tests/              # Mirrors src/ structure.
docs/               # Architecture, API reference, recipes.
```

The three-layer split (core → analyzer → UI) is intentional. Core has zero UI dependencies. Analyzer is pure functions. UI reads from the store on a timer. See `docs/architecture.md` for the full picture.

## Code style

- Comments explain **why**, not what. If the code needs a comment to explain what it does, the code should be clearer.
- JSDoc on public API functions and non-obvious interfaces. Skip it on self-documenting fields.
- No `any`. TypeScript strict mode is on.
- Prettier handles formatting. Don't fight it.
- Catch blocks that intentionally swallow errors get a comment explaining why.
