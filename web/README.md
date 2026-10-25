# Iris Web

React 19, TypeScript and Vite single-page app with React Router, TanStack Query, Tailwind CSS v4, shadcn/ui, Vitest and Biome.

## Setup

```sh
mise install
npm install
```

`mise.toml` pins Node.js to 24.22.1.

## Scripts

- `npm run dev` — start the Vite development server.
- `npm run dev:mock` — start Vite with the in-browser MSW mock API (no backend needed).
- `npm run gen:api` — regenerate `src/api/schema.d.ts` from `openapi/iris.yaml`.
- `npm run check:api` — regenerate to a temp file and fail if `schema.d.ts` is stale (for CI).
- `npm run build` — typecheck and create a production build.
- `npm run lint` — check formatting, imports, and lint rules with Biome.
- `npm test` — run Vitest once.
- `npm run typecheck` — typecheck all TypeScript project references.
- `npm run preview` — preview the production build.

## Development proxy

During `npm run dev`, Vite forwards `/api`, `/mcp`, and `/healthz` to `http://localhost:8080`. Paths are forwarded unchanged; see `vite.config.ts`.

## Mock API

`npm run dev:mock` sets `VITE_MOCK_API=true`; `src/main.tsx` then dynamically imports `src/mocks/browser.ts` and starts an MSW service worker before rendering, so MSW is not part of the production bundle. The worker script lives in `dev-public/` and is served only by the dev server (see `vite.config.ts`), so it never reaches `dist/`.

`src/mocks/db.ts` is an in-memory store seeded with two users, two projects and about a dozen tasks. `src/mocks/handlers.ts` implements every endpoint in the draft contract, including the lifecycle rules (for example, moving an agent task into In Progress is a 409). Tests use the same handlers through `src/mocks/server.ts`; `src/setupTests.ts` resets the store after each test. Use `renderApp(route)` (real routes) or `renderWithProviders(ui)` from `src/testUtils.tsx`.

## API contract workflow

The contract is `openapi/iris.yaml` (OpenAPI 3.1, draft, written ahead of the backend). Types are generated into `src/api/schema.d.ts` (committed); `src/api/types.ts` re-exports convenient aliases and `src/api/client.ts` is an `openapi-fetch` client that sends `X-Iris-User` and throws `ApiError` on non-2xx responses.

1. Edit `openapi/iris.yaml`.
2. Run `npm run gen:api`.
3. Fix the type errors and update `src/mocks/handlers.ts` to match.

Once the backend serves its own OpenAPI document, the input of `gen:api` and `check:api` switches from `openapi/iris.yaml` to that document and the draft file is deleted.

## Dev user

The header has a user switcher fed by `GET /api/users`. The choice is stored in `localStorage` (`iris.userId`) and sent as `X-Iris-User` on every API request.

## UI components

shadcn/ui components live in `src/components/ui/` (configured by `components.json`; the `@/` alias maps to `src/`). Add more with `npx shadcn@latest add <name>`.
