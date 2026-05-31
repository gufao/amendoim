# Repository Memory - amendoim

## Overview
* **Name**: amendoim
* **Framework**: React (v19), TypeScript, Tailwind CSS (v4), Vite, Tauri (v2)
* **Package Manager**: pnpm (determined from `pnpm-lock.yaml` and `pnpm-workspace.yaml`)

## Workflow Notes
* Checked out branch: `main` from `https://github.com/gufao/amendoim.git`
* Environment uses `pnpm` for package management

## Bug Fixes
* **New Query Numbering Bug**:
  - **Issue**: Clicking "+ Nova Query" generated names like `"SQL Query 124"` even if there were no other queries. This was due to a global `queryCounter` that was incremented forever on each addition and never reset or dynamically checked against current queries.
  - **Solution**: Replaced the global `queryCounter` with dynamic logic in `getNextTitle()` inside `src/stores/queryFileStore.ts`. It parses current queries for standard `"SQL Query {n}"` names and finds the smallest positive integer `n >= 1` that is not currently in use.
  - **Testing**: Added unit tests in `src/stores/queryFileStore.test.ts` to cover different list states (empty, sequence, gap, custom name interferences). All tests pass.

## Git / PR Status
* **Local Branch**: `fix-query-numbering`
* **Commit**: `46492402a79bc454b400734a739c5fd69e7b1f5a` (Signed by `estagiario-linhares <estagiario@linhares.sc>`)
* **Pull Request**: Successfully opened on GitHub: https://github.com/gufao/amendoim/pull/1

