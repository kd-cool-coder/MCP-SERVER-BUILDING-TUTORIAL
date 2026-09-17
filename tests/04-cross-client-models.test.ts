import { describe, expect, it } from "vitest";
import { HostRunner, PromptResult } from "@mcpjam/sdk";

type HostProfile = {
  name: string;
  resolvesByTicketId: boolean;
  searchesBeforeLookup: boolean;
};

const hostProfiles: HostProfile[] = [
  { name: "chatgpt-style", resolvesByTicketId: true, searchesBeforeLookup: true },
  { name: "claude-style", resolvesByTicketId: true, searchesBeforeLookup: true },
  { name: "cursor-style", resolvesByTicketId: true, searchesBeforeLookup: true }
];

function runnerFor(profile: HostProfile) {
  return HostRunner.mock(async (message) => {
    const lowerMessage = message.toLowerCase();
    const toolCalls = [];

    if (profile.searchesBeforeLookup && lowerMessage.includes("billing")) {
      toolCalls.push({ toolName: "search_tickets", arguments: { query: "billing" } });
      toolCalls.push({ toolName: "get_ticket", arguments: { id: "T-101" } });
    }

    if (profile.resolvesByTicketId && lowerMessage.includes("resolve")) {
      toolCalls.push({
        toolName: "update_ticket_status",
        arguments: { id: "T-100", status: "resolved" }
      });
    }

    return PromptResult.from({
      prompt: message,
      messages: [
        { role: "user", content: message },
        { role: "assistant", content: `${profile.name} selected ${toolCalls.length} tools.` }
      ],
      text: `${profile.name} selected ${toolCalls.length} tools.`,
      toolCalls,
      usage: { inputTokens: 25, outputTokens: 12, totalTokens: 37 },
      latency: { e2eMs: 5, llmMs: 0, mcpMs: 0 }
    });
  });
}

describe("Layer 4 - Cross-Client Compatibility Matrix", () => {
  for (const profile of hostProfiles) {
    it(`${profile.name} follows the SupportDesk lookup policy`, async () => {
      const trace = await runnerFor(profile).run(
        "Check the status of my billing report issue."
      );

      expect(trace.toolsCalled()).toEqual(["search_tickets", "get_ticket"]);
      expect(trace.getToolArguments("get_ticket")).toMatchObject({ id: "T-101" });
    });

    it(`${profile.name} maps explicit resolve requests to the write tool`, async () => {
      const trace = await runnerFor(profile).run("Please resolve ticket T-100.");

      expect(trace.hasToolCall("update_ticket_status")).toBe(true);
      expect(trace.getToolArguments("update_ticket_status")).toMatchObject({
        id: "T-100",
        status: "resolved"
      });
    });
  }
});
