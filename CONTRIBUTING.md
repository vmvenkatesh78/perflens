# Contributing

## Setup

```bash
git clone https://github.com/vmvenkatesh78/perflens.git
cd perflens
npm install
```

## Commands

```bash
npm run dev          # watch mode
npm test             # tests
npm run test:watch   # tests in watch mode
npm run lint         # lint check
npm run typecheck    # type check
npm run build        # build
npm run ci           # everything CI runs
```

## Before Submitting a PR

```bash
npm run ci
```

If it passes locally, it passes in CI.

## Commits

[Conventional commits](https://www.conventionalcommits.org/):

```
feat: add render cascade detection
fix: panel not hiding when enabled=false
docs: add recipes for common patterns
chore: update dev dependencies
```

Breaking changes: `feat!: change PerfLensConfig shape`

## Code Style

- TypeScript strict. No `any`.
- Prettier handles formatting.
- Comments explain why, not what.

## Testing

- New features need tests.
- Bug fixes need regression tests.
- Analyzer rules need 100% coverage.

## Architecture

Read `docs/architecture.md` before structural changes. The three-layer split (core / analyzer / UI) is intentional.
