import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HostRunner, MCPClientManager } from "@mcpjam/sdk";
import {
  STDIO_SERVER_CONFIG,
  STDIO_SERVER_ID,
  createModernManager
} from "./helpers/mcp.js";

const shouldRunLiveEvals =
  process.env.RUN_LIVE_MODEL_EVALS === "1" && Boolean(process.env.OPENAI_API_KEY);

const liveDescribe = shouldRunLiveEvals ? describe : describe.skip;

liveDescribe("Layer 5 - Live Model-in-the-Loop Eval", () => {
  let manager: MCPClientManager;
  let runner: HostRunner;

  beforeAll(async () => {
    manager = createModernManager();
    await manager.connectToServer(STDIO_SERVER_ID, STDIO_SERVER_CONFIG);

    runner = new HostRunner({
      tools: await manager.getToolsForAiSdk([STDIO_SERVER_ID]),
      model: process.env.MCP_EVAL_MODEL ?? "openai/gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY!,
      temperature: 0,
      maxSteps: 5,
      mcpClientManager: manager
    });
  }, 45_000);

  afterAll(async () => {
    await manager.disconnectServer(STDIO_SERVER_ID);
  });

  it("uses SupportDesk tools for a natural-language ticket lookup", async () => {
    const trace = await runner.run(
      "Use the SupportDesk tools to find the billing report issue, then inspect the matching ticket."
    );

    expect(trace.hasToolCall("search_tickets")).toBe(true);
    expect(trace.hasToolCall("get_ticket")).toBe(true);
  }, 60_000);

  it("does not call SupportDesk tools for unrelated general knowledge", async () => {
    const trace = await runner.run("What is the capital of France?");

    expect(trace.toolsCalled()).toEqual([]);
  }, 60_000);
});
