import { describe, expect, it } from "vitest";
import { EvalTest, HostRunner, PromptResult } from "@mcpjam/sdk";

function supportDeskMockRunner() {
  return HostRunner.mock(async (message) => {
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
          : lowerMessage.includes("open") || lowerMessage.includes("high-priority")
            ? [
                {
                  toolName: "search_tickets",
                  arguments: { status: "open", priority: "high" }
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
}

describe("Layer 2 - Agent Behavior Tests", () => {
  const runner = supportDeskMockRunner();

  it("selects update_ticket_status to resolve a ticket", async () => {
    const trace = await runner.run("Please resolve ticket T-100");

    expect(trace.hasToolCall("update_ticket_status")).toBe(true);
    expect(trace.getToolArguments("update_ticket_status")).toMatchObject({
      id: "T-100",
      status: "resolved"
    });
  });

  it("obeys server.instructions in a multi-step lookup", async () => {
    const trace = await runner.run("Check the status of my billing report issue.");

    const tools = trace.toolsCalled();
    expect(tools[0]).toBe("search_tickets");
    expect(tools).toContain("get_ticket");
  });

  it("avoids SupportDesk tools for unrelated questions", async () => {
    const trace = await runner.run("What is the capital of France?");

    expect(trace.toolsCalled()).toEqual([]);
  });
});

describe("Layer 5 - MCPJam Eval Gate Examples", () => {
  it("measures repeated tool-selection accuracy with EvalTest", async () => {
    const evalTest = new EvalTest({
      id: "c_resolve_ticket_tool_selection",
      name: "resolve-ticket-tool-selection",
      test: async (agent) => {
        const trace = await agent.run("Please resolve ticket T-100");
        return trace.hasToolCall("update_ticket_status");
      }
    });

    await evalTest.run(supportDeskMockRunner(), {
      iterations: 5,
      concurrency: 1,
      mcpjam: { enabled: false }
    });

    expect(evalTest.accuracy()).toBe(1);
  });

  it("tracks no-tool behavior as a separate eval case", async () => {
    const evalTest = new EvalTest({
      id: "c_no_tool_for_general_knowledge",
      name: "no-tool-for-general-knowledge",
      test: async (agent) => {
        const trace = await agent.run("What is the capital of France?");
        return trace.toolsCalled().length === 0;
      }
    });

    await evalTest.run(supportDeskMockRunner(), {
      iterations: 5,
      concurrency: 1,
      mcpjam: { enabled: false }
    });

    expect(evalTest.accuracy()).toBe(1);
  });
});
