# MCPJam testing layers and screenshot guide

Use these commands to demonstrate each testing layer from the tutorial. Run all commands from the repo root.

```bash
cd /home/kd/Desktop/Zenith1/MCPJam_test/part1_build
npm install
```

## Layer 1: protocol and server surface

This proves the stdio server negotiates MCP `2026-07-28` and exposes the expected tools, resources, resource template, and prompt.

```bash
npm run test:protocol
```

Screenshot idea: terminal output showing `Layer 1 - Protocol and Server Surface` passing.

Manual MCPJam Inspector screenshot:

```bash
npm run inspect:stdio
```

Capture the Tools, Resources, and Prompts tabs.

If you run the raw Inspector command yourself, pass the server entrypoint as an
absolute path:

```bash
npx -y @mcpjam/inspector@latest --tab tools npx tsx "$PWD/src/stdio.ts"
```

Use the default Inspector port when you need to sign in. If you see a redirect
address mismatch, close any old Inspector process and return to the default
port. If the default port is busy and you only need local screenshots, run
`npm run inspect:stdio:alt`.

## Layer 2: automated deterministic testing

The protocol test also executes deterministic read-only operations:

- `get_ticket` with `T-100`
- `support://queue-summary`
- `triage-ticket`

For article screenshots, show the `tests/01-protocol-surface.test.ts` file beside the passing terminal output.

## Layer 3: authentication and authorization

This starts the real HTTP transport and checks bearer-token behavior end to end:

- no token is rejected
- bad token is rejected
- `dev-read-token` can read
- `dev-read-token` cannot write
- `dev-write-token` can call `update_ticket_status`

```bash
npm run test:security
```

Manual HTTP Inspector screenshot:

```bash
npm run dev:http
```

In another terminal:

```bash
npm run inspect:http:write
```

Capture `update_ticket_status` succeeding with:

```json
{
  "id": "T-100",
  "status": "resolved"
}
```

Then repeat with `npm run inspect:http:read` and capture the write denial.

## Layer 4: behavioral testing and evals

This uses MCPJam `HostRunner.mock` and `EvalTest` so the article can show repeatable agent behavior without an API key.

```bash
npm run test:behavior
```

Screenshot idea: terminal output showing both `Layer 2 - Agent Behavior Tests` and `Layer 5 - MCPJam Eval Gate Examples` passing.

## Layer 5: test across clients and models

This CI-safe compatibility matrix runs the same prompt corpus across ChatGPT-style, Claude-style, and Cursor-style host profiles.

```bash
npm run test:cross-client
```

Screenshot idea: terminal output showing each profile passing the lookup and resolve cases.

For a real cross-client demo, run the same prompt corpus in MCPJam Inspector or MCPJam Cloud against the clients/models you want to compare, then capture the selected tools and generated arguments.

## Layer 6: model-in-the-loop testing

Live model evals are intentionally opt-in because they require a model API key and can spend money.

```bash
export OPENAI_API_KEY="sk-..."
export RUN_LIVE_MODEL_EVALS=1
export MCP_EVAL_MODEL="openai/gpt-4o-mini"
npm run eval:live
```

Screenshot idea: terminal output showing `Layer 5 - Live Model-in-the-Loop Eval` passing.

If you want to compare models:

```bash
MCP_EVAL_MODEL="openai/gpt-4o" npm run eval:live
MCP_EVAL_MODEL="openai/gpt-4o-mini" npm run eval:live
```

## Layer 7: CI checks

The repo includes `.github/workflows/mcp-tests.yml`. It runs:

```bash
npm ci
npm run typecheck
npm run test:ci
```

Local CI-equivalent command:

```bash
npm run test:ci
```

Screenshot idea: GitHub Actions run showing the workflow passing, or local terminal output for `npm run test:ci`.

## Hosted MCPJam web app

The hosted MCPJam web app cannot spawn a local stdio command. To use it, expose the HTTP transport as a public HTTPS `/mcp` endpoint and connect that URL in the app. For local tutorial screenshots, use MCPJam Inspector or the desktop/local MCPJam experience.
