# Performance Optimization Report

## How to Read This Report

### Key Terms

**Render duration** — time React spent calling component functions and computing the virtual DOM (reconciliation). Shown as "Render: Xms" in the DevTools Profiler right panel.

**Commit duration** — total time for one commit cycle: render + DOM mutations + effects (useLayoutEffect + useEffect). Formula: `Render + Layout effects + Passive effects`. In this app both values are equal because there are no heavy effects (<0.1ms).

**Commit** — one discrete update React applies to the DOM. A single user interaction can trigger multiple commits (e.g., typing "United" = 6 commits, one per keystroke).

**Flame chart** — tree visualization of component renders. Block width = render time. The label format `ComponentName (Xms of Yms)` means:
- `Xms` = time spent in this component itself (self time, excluding children)
- `Yms` = total time including all descendants

**What to look for:**
- Wide orange/yellow blocks = slow components
- Many small blocks = many components re-rendering unnecessarily
- A component appearing when its props did not change = missing `React.memo`

---

## Baseline Measurements

> Profiled in **development mode** with React DevTools Profiler (recording stopped after each interaction).
> Screenshots: `screenshots/baseline/`

### Interaction A: Sort countries

- **Commit duration**: 250ms
- **Render duration**: 250ms
- **Flame chart hotspot**: `CountryList (39.7ms of 237ms)` — CountryList accounts for 95% of render time. All ~250 CountryCard components re-render on every sort.
- **Screenshot**: ![Sort baseline](screenshots/baseline/sort.png)

### Interaction B: Search countries

- **Commit duration**: 118.5ms (per commit; 6 commits total — one per keystroke)
- **Render duration**: 118.5ms
- **Flame chart hotspot**: `CountryList (13.8ms of 104.1ms)` — every keystroke re-renders all visible CountryCards even when results don't change yet.
- **Screenshot**: ![Search baseline](screenshots/baseline/search.png)

### Interaction C: Change year

- **Commit duration**: 19.3ms
- **Render duration**: 19.3ms
- **Flame chart hotspot**: `YearSelector (9.5ms of 9.9ms)` — YearSelector re-renders despite its own value not changing (no `React.memo`).
- **Screenshot**: ![Year baseline](screenshots/baseline/year.png)

### Interaction D: Toggle column

- **Commit duration**: 23.1ms (commit 1 of 3)
- **Render duration**: 23.1ms
- **Flame chart hotspot**: `YearSelector (12.2ms of 12.5ms)` — YearSelector re-renders when a column is toggled, even though year state is unchanged. Classic case for `React.memo`.
- **Screenshot**: ![Column baseline](screenshots/baseline/column.png)

---

## Optimized Measurements

> Screenshots: `screenshots/optimized/`

### Interaction A: Sort countries

- **Commit duration**: ___ ms
- **Render duration**: ___ ms
- **Screenshot**: ![Sort optimized](screenshots/optimized/sort.png)

### Interaction B: Search countries

- **Commit duration**: ___ ms
- **Render duration**: ___ ms
- **Screenshot**: ![Search optimized](screenshots/optimized/search.png)

### Interaction C: Change year

- **Commit duration**: ___ ms
- **Render duration**: ___ ms
- **Screenshot**: ![Year optimized](screenshots/optimized/year.png)

### Interaction D: Toggle column

- **Commit duration**: ___ ms
- **Render duration**: ___ ms
- **Screenshot**: ![Column optimized](screenshots/optimized/column.png)

---

## Summary of Improvements

| Interaction      | Baseline (ms) | Optimized (ms) | Improvement |
| ---------------- | ------------- | -------------- | ----------- |
| Sort countries   | ___           | ___            | ___%        |
| Search countries | ___           | ___            | ___%        |
| Change year      | ___           | ___            | ___%        |
| Toggle column    | ___           | ___            | ___%        |
| **Average**      | **___**       | **___**        | **___%**    |

---

## Applied Optimizations

### 1. `useMemo` — cache expensive computed values

`useMemo(fn, deps)` runs `fn` only when `deps` change. Between renders it returns the cached result.

**When to use:** heavy calculations, filtered/sorted lists, object/array values passed as props (to keep referential equality).

Changes made:
- `App`: `years` and `availableColumns` memoized — were recomputed on every render
- `CountryList`: filtered+sorted list memoized; `yearDataMap` pre-computed per country before sort (previously `createYearDataMap()` was called O(n log n) times inside the sort comparator)
- `CountryCard`: `yearDataMap`, `population`, `co2` memoized — `createYearDataMap()` was called on every render
- `DataTable`: `yearData` (result of `data.filter()`) memoized by `data` + `year`

### 2. `useCallback` — stable function references

`useCallback(fn, deps)` returns the same function instance between renders as long as `deps` don't change. Without it, every render creates a new function object — even if the logic is identical.

**Why it matters:** if a memoized child receives a new function reference on every parent render, `React.memo` won't help — the child re-renders anyway because its props changed (referentially).

**Key pattern:** use functional `setState(prev => ({ ...prev, field: value }))` inside `useCallback` so the dependency array stays `[]` and the handler is never recreated.

Changes made:
- All 6 event handlers in `App` (`handleSearch`, `handleYearChange`, `handleSortFieldChange`, `handleSortOrderToggle`, `handleColumnToggle`, `handleModalToggle`) wrapped with `useCallback`

### 3. `React.memo` — skip re-renders when props are unchanged

`React.memo(Component)` wraps a component so it only re-renders when its props change (shallow comparison). Without it, a component re-renders every time its parent renders — regardless of whether its own props changed.

**Seen in baseline:** `YearSelector` re-rendered during column toggle (23.1ms) even though `year`, `years`, and `onChange` were all identical.

**Only works if props are stable** — pairing with `useCallback`/`useMemo` is required.

Changes made: `SearchBar`, `YearSelector`, `ColumnModal`, `DataTable`, `CountryCard`, `CountryList`

### 4. Proper Key Props — correct list reconciliation

React uses `key` to match elements between renders. Using array `index` as key causes React to re-render and re-mount items when list order changes (e.g., after sort/filter). Using a stable unique id lets React reuse existing DOM nodes.

Changes made:
- `CountryList`: `key={country.id}` (was `key={index}`)
- `DataTable`: `key={column}` (was `key={index}`)

### 5. Virtualization — render only what's visible

Without virtualization, all ~250 country cards are in the DOM simultaneously even if only 5–10 are visible. Each state change causes all 250 to re-render.

`react-window` `FixedSizeList` renders only the visible rows (+ a small overscan buffer). DOM node count drops from ~250 cards to ~10.

Changes made: `CountryList` replaced flat `.map()` with `FixedSizeList` from `react-window`
