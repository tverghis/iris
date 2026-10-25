# Performance

The UI must feel instant on a laptop and on the oldest phone in the house.

## Budget

| Measure                            | Target                                      | How it is checked                                        |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Board route JavaScript, first load | 150 KB gzipped or less                      | `npm run check:size` (fails the build)                   |
| Repeat open to board visible       | Under 300 ms                                | Installed PWA on a phone, cached shell and data (manual) |
| First open, mid-range phone        | Lighthouse mobile performance 90 or higher  | `npm run lighthouse -- --assert`                         |
| Response to a tap, drop or edit    | Visible in the next frame; INP under 100 ms | Chrome DevTools, 4x CPU throttling (manual)              |
| Scrolling and dragging             | 60 fps, no task over 50 ms during a drag    | DevTools Performance panel and a real phone (manual)     |
| A remote change arriving over SSE  | Re-renders only the affected cards          | React Profiler (manual)                                  |

## Automated checks

All run from `web/`.

- `npm run verify` runs lint, typecheck, test, build, check:size and check:api in order. This is the one command CI needs.
- `npm run check:size` reads `dist/.vite/manifest.json` and sums the gzipped JavaScript of the HTML entry, the `BoardPage` chunk and everything they import statically (transitively, which includes the modulepreloaded chunks). Lazy chunks (drawer, Markdown renderer, other routes) and CSS are not counted. It exits 1 when over budget, when the manifest is missing, or when the entry or `BoardPage` is absent. Set `SIZE_BUDGET_KB` to try another budget, for example `SIZE_BUDGET_KB=50 npm run check:size` must fail.
- `npm run lighthouse` serves `dist/` with `vite preview` and runs Lighthouse (mobile preset, performance category) against `/` and `/projects/1`, printing the score and FCP, LCP, TBT, CLS, Speed Index and TTI. Run `npm run build` first. Flags (after `--`):
  - `--assert` exits 1 if any page scores under 90.
  - `--url https://host` audits a real deployment instead of preview. Preview has no backend, so API calls fail and the score covers the app shell only; use `--url` for a number that includes data.
  - `--path /x` (repeatable) replaces the default paths.
  - Chromium comes from Playwright; set `CHROME_PATH` to use another binary.
- React Compiler is enabled in `vite.config.ts` through `@rolldown/plugin-babel` and `reactCompilerPreset()`, so cards are memoized automatically.
- Board cards use `content-visibility: auto` with `contain-intrinsic-size` (`TaskCard.tsx`).

## Manual pass on the oldest phone

Do this before each release that touches the board, and when the spec's exit criterion is checked.

1. Open the installed PWA, close it, open it again with the network on. The board must be visible in under 300 ms (use a screen recording and count frames).
2. On a laptop, open Chrome DevTools on the board, Performance tab, set CPU to 4x slowdown.
   - Tap a card, drop a card into another column, edit a title. Record each. INP shown in the Performance Insights / Web Vitals lane must be under 100 ms and the result visible in the next frame.
   - Record a drag across columns. There must be no task over 50 ms (no red corners on tasks in the Main track) and the frame chart should stay green at 60 fps.
3. Repeat the drag and scroll on the real phone with remote debugging (Chrome on Android, Safari Web Inspector on iOS) and by eye.
4. React Profiler (React DevTools, "Highlight updates" on): trigger an SSE change to one task (edit it from a second device or with curl against the API). Only that card may re-render; other cards and the columns must not flash.

## CI wiring (needs the repo owner)

Agents may not edit `.github/`. In `.github/workflows/web.yml`, replace the separate lint, typecheck, test, build and size steps with:

```yaml
- run: npm ci
- run: npm run verify
```

Or, to keep the existing steps, add this after the build step:

```yaml
- name: Bundle budget
  run: npm run check:size
```

Both run in `working-directory: web` (or whatever default the workflow already uses).
