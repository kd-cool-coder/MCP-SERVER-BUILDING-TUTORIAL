import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCPClientManager } from "@mcpjam/sdk";
import {
  STDIO_SERVER_CONFIG,
  STDIO_SERVER_ID,
  createModernManager,
  textFromFirstResource,
  textFromToolResult
} from "./helpers/mcp.js";

describe("Layer 1 - Protocol and Server Surface", () => {
  let manager: MCPClientManager;

  beforeAll(async () => {
    manager = createModernManager();
    await manager.connectToServer(STDIO_SERVER_ID, STDIO_SERVER_CONFIG);
  }, 30_000);

  afterAll(async () => {
    await manager.disconnectServer(STDIO_SERVER_ID);
  });

  it("negotiates the latest MCP protocol version", () => {
    expect(manager.getNegotiatedProtocolVersion(STDIO_SERVER_ID)).toBe("2026-07-28");
  });

  it("exposes the expected tools, resources, resource template, and prompt", async () => {
    const tools = await manager.listTools(STDIO_SERVER_ID);
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "get_ticket",
      "search_tickets",
      "update_ticket_status"
    ]);

    const resources = await manager.listResources(STDIO_SERVER_ID);
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      "support://queue-summary"
    );

    const templates = await manager.listResourceTemplates(STDIO_SERVER_ID);
    expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toContain(
      "support://tickets/{id}"
    );

    const prompts = await manager.listPrompts(STDIO_SERVER_ID);
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain("triage-ticket");
  });

  it("executes read-only tools and resources with known outputs", async () => {
    const ticketResponse = await manager.executeTool(STDIO_SERVER_ID, "get_ticket", {
      id: "T-100"
    });
    expect(textFromToolResult(ticketResponse)).toContain("Login failure");

    const summary = await manager.readResource(STDIO_SERVER_ID, {
      uri: "support://queue-summary"
    });
    expect(textFromFirstResource(summary)).toContain('"open": 1');
  });

  it("returns the triage prompt template", async () => {
    const prompt = await manager.getPrompt(STDIO_SERVER_ID, {
      name: "triage-ticket",
      arguments: { id: "T-100" }
    });

    const firstMessage = prompt.messages[0];
    expect(firstMessage.content.type).toBe("text");
    const promptText =
      firstMessage.content.type === "text" ? firstMessage.content.text : "";
    expect(promptText).toContain("Please review ticket T-100");
  });
});
