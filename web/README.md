# Iris Web

React, TypeScript, and Vite application with Vitest and Biome.

## Setup

```sh
mise install
npm install
```

`mise.toml` pins Node.js to 24.22.1.

## Scripts

- `npm run dev` — start the Vite development server.
- `npm run build` — typecheck and create a production build.
- `npm run lint` — check formatting, imports, and lint rules with Biome.
- `npm test` — run Vitest once.
- `npm run typecheck` — typecheck all TypeScript project references.
- `npm run preview` — preview the production build.

## Development proxy

During `npm run dev`, Vite forwards `/api`, `/mcp`, and `/healthz` to `http://localhost:8080`. Paths are forwarded unchanged; see `vite.config.ts`.
