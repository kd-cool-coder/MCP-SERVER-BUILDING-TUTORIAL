# SupportDesk MCP Server

This repo accompanies the article "How to Build an MCP Server in TypeScript". It exposes a small SupportDesk ticket system through MCP tools, resources, and a prompt.

The examples target `@modelcontextprotocol/server@2.0.0` and the MCP `2026-07-28` protocol revision.

## Prerequisites

```bash
npm install
```

## Run over stdio

Use stdio when a local MCP host launches the server process directly:

```bash
npm run dev:stdio
```

The process stays quiet while it waits for an MCP client. That is expected because stdout is reserved for MCP JSON-RPC messages.

The stdio entry point uses `legacy: "reject"`, so connect with a current MCP client that can negotiate the `2026-07-28` protocol revision.

## Test with MCPJam Inspector

```bash
npm run inspect:stdio
```

Open the local URL printed by MCPJam, usually `http://127.0.0.1:6274`.

This script passes an absolute path to `src/stdio.ts`. That matters because
`npx @mcpjam/inspector` runs from an npm cache directory, so a raw relative
path like `src/stdio.ts` can point at the Inspector package instead of this
project.

Use the default Inspector port for sign-in. Some hosted auth providers only
allow registered redirect URLs, and an alternate local port can produce a
"redirect address doesn't match" sign-in error. If the default port is already
busy and you do not need to sign in, use `npm run inspect:stdio:alt`.

The Inspector should discover:

- Tools: `search_tickets`, `get_ticket`, `update_ticket_status`
- Resources: `support://queue-summary`, `support://tickets/{id}`
- Prompt: `triage-ticket`

Useful manual checks:

- Call `search_tickets` with `{ "priority": "high" }`.
- Read `support://queue-summary`.
- Read `support://tickets/T-100`.

## Run the local HTTP adapter

`src/http.ts` exports a Fetch-style MCP handler. For local testing, `src/local-http.ts` wraps that handler in Node's HTTP server:

```bash
npm run dev:http
```

The endpoint is:

```text
http://localhost:8787/mcp
```

Use one of these bearer tokens when connecting an HTTP MCP client:

- `dev-read-token`: can connect and read.
- `dev-write-token`: can connect, read, and call `update_ticket_status`.

To inspect the HTTP transport with MCPJam, start the server and then connect
with one of the helper scripts:

```bash
npm run dev:http
```

In another terminal:

```bash
npm run inspect:http:write
```

If the default Inspector port is busy and you do not need Inspector sign-in,
use `npm run inspect:http:write:alt` instead.

## Typecheck

```bash
npm run typecheck
```

## Automated testing layers

Part 2 of the tutorial uses MCPJam SDK tests and Vitest. CI-safe commands:

```bash
npm run test:protocol
npm run test:security
npm run test:behavior
npm run test:cross-client
npm run test:ci
```

Live model-in-the-loop evals are opt-in because they require an API key:

```bash
export OPENAI_API_KEY="sk-..."
export RUN_LIVE_MODEL_EVALS=1
npm run eval:live
```

See `TESTING_LAYERS.md` for screenshot instructions for each tutorial layer.
