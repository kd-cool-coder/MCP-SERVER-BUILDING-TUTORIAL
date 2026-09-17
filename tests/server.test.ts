import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EvalTest,
  HostRunner,
  MCPClientManager,
  PromptResult,
  type MCPServerConfig
} from "@mcpjam/sdk";

const SERVER_ID = "supportdesk";

const SERVER_CONFIG: MCPServerConfig = {
  command: "npx",
  args: ["tsx", "src/stdio.ts"],
  cwd: process.cwd(),
  stderr: "pipe",
  supportedProtocolVersions: ["2026-07-28"]
};

function textFromToolResult(result: Awaited<ReturnType<MCPClientManager["executeTool"]>>) {
  const content = Array.isArray(result.content) ? result.content : [];
  const firstText = content.find((item) => item.type === "text");
  return firstText && "text" in firstText ? firstText.text : "";
}

function textFromFirstResource(result: Awaited<ReturnType<MCPClientManager["readResource"]>>) {
  const first = result.contents[0];
  return first && "text" in first ? first.text : "";
}

describe("SupportDesk Server - Deterministic Tests", () => {
  let manager: MCPClientManager;

  beforeAll(async () => {
    manager = new MCPClientManager(undefined, {
      defaultSupportedProtocolVersions: ["2026-07-28"]
    });

    await manager.connectToServer(SERVER_ID, SERVER_CONFIG);
  }, 30_000);

  afterAll(async () => {
    await manager.disconnectServer(SERVER_ID);
  });

  it("negotiates the latest MCP protocol version", () => {
    expect(manager.getNegotiatedProtocolVersion(SERVER_ID)).toBe("2026-07-28");
  });

  it("exposes the expected tools, resources, resource template, and prompt", async () => {
    const tools = await manager.listTools(SERVER_ID);
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "get_ticket",
      "search_tickets",
      "update_ticket_status"
    ]);

    const resources = await manager.listResources(SERVER_ID);
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      "support://queue-summary"
    );

    const templates = await manager.listResourceTemplates(SERVER_ID);
    expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toContain(
      "support://tickets/{id}"
    );

    const prompts = await manager.listPrompts(SERVER_ID);
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain("triage-ticket");
  });

  it("returns ticket data for a valid ID", async () => {
    const response = await manager.executeTool(SERVER_ID, "get_ticket", {
      id: "T-100"
    });

    const text = textFromToolResult(response);
    expect(text).toContain("Login failure");
    expect(text).toContain("Acme Corp");
  });

  it("fails validation when requesting an invalid status", async () => {
    const response = await manager.executeTool(SERVER_ID, "update_ticket_status", {
      id: "T-100",
      status: "archived"
    });

    expect(response.isError).toBe(true);
    expect(textFromToolResult(response)).toContain("Invalid option");
  });

  it("reads queue summary and ticket resources", async () => {
    const summary = await manager.readResource(SERVER_ID, {
      uri: "support://queue-summary"
    });
    expect(textFromFirstResource(summary)).toContain('"open": 1');

    const ticket = await manager.readResource(SERVER_ID, {
      uri: "support://tickets/T-100"
    });
    expect(textFromFirstResource(ticket)).toContain("Login failure");
  });

  it("fetches the triage prompt", async () => {
    const prompt = await manager.getPrompt(SERVER_ID, {
      name: "triage-ticket",
      arguments: { id: "T-100" }
    });

    const firstMessage = prompt.messages[0];
    expect(firstMessage.content.type).toBe("text");
    expect(firstMessage.content.text).toContain("Please review ticket T-100");
  });
});

describe("SupportDesk Agent Behavior", () => {
  const runner = HostRunner.mock(async (message) => {
    const lowerMessage = message.toLowerCase();
    const toolCalls =
      lowerMessage.includes("resolve")
        ? [
            {
              toolName: "update_ticket_status",
              arguments: { id: "T-100", status: "resolved" }
            }
          ]
        : lowerMessage.includes("billing")
          ? [
              {
                toolName: "search_tickets",
                arguments: { query: "billing" }
              },
              {
                toolName: "get_ticket",
                arguments: { id: "T-101" }
              }
            ]
          : [];

    return PromptResult.from({
      prompt: message,
      messages: [
        { role: "user", content: message },
        {
          role: "assistant",
          content: toolCalls.length
            ? "Using the appropriate SupportDesk tools."
            : "No SupportDesk tool is needed."
        }
      ],
      text: toolCalls.length
        ? "Using the appropriate SupportDesk tools."
        : "No SupportDesk tool is needed.",
      toolCalls,
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      latency: { e2eMs: 5, llmMs: 0, mcpMs: 0 }
    });
  });

  it("agent selects update_ticket_status to resolve a ticket", async () => {
    const trace = await runner.run("Please resolve ticket T-100");

    expect(trace.hasToolCall("update_ticket_status")).toBe(true);
    expect(trace.getToolArguments("update_ticket_status")).toMatchObject({
      id: "T-100",
      status: "resolved"
    });
  });

  it("agent obeys server.instructions in a multi-step lookup", async () => {
    const trace = await runner.run("Check the status of my billing report issue.");

    const tools = trace.toolsCalled();
    expect(tools[0]).toBe("search_tickets");
    expect(tools).toContain("get_ticket");
  });

  it("agent avoids SupportDesk tools for unrelated questions", async () => {
    const trace = await runner.run("What is the capital of France?");

    expect(trace.toolsCalled()).toEqual([]);
  });

  it("can run the same assertion through EvalTest", async () => {
    const evalTest = new EvalTest({
      id: "c_resolve_ticket_tool_selection",
      name: "resolve-ticket-tool-selection",
      test: async (agent) => {
        const trace = await agent.run("Please resolve ticket T-100");
        return trace.hasToolCall("update_ticket_status");
      }
    });

    await evalTest.run(runner, {
      iterations: 2,
      concurrency: 1,
      mcpjam: { enabled: false }
    });

    expect(evalTest.accuracy()).toBe(1);
  });
});
