import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCPClientManager } from "@mcpjam/sdk";
import {
  HTTP_SERVER_ID,
  HTTP_URL,
  createModernManager,
  httpServerConfig,
  startHttpServer,
  textFromToolResult
} from "./helpers/mcp.js";

type HttpServerHandle = Awaited<ReturnType<typeof startHttpServer>>;

async function postRawMcpRequest(accessToken?: string) {
  return fetch(HTTP_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    })
  });
}

async function captureToolFailure(action: () => Promise<unknown>) {
  try {
    const result = await action();
    return JSON.stringify(result);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("Layer 3 - Authentication and Authorization", () => {
  let server: HttpServerHandle;

  beforeAll(async () => {
    server = await startHttpServer();
  }, 30_000);

  afterAll(async () => {
    await server?.stop();
  });

  it("rejects unauthenticated HTTP MCP requests", async () => {
    const response = await postRawMcpRequest();

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("rejects invalid bearer tokens", async () => {
    const response = await postRawMcpRequest("bad-token");

    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Invalid token");
  });

  it("allows read tokens to call read-only tools", async () => {
    const manager = createModernManager();
    await manager.connectToServer(HTTP_SERVER_ID, httpServerConfig("dev-read-token"));

    try {
      const response = await manager.executeTool(HTTP_SERVER_ID, "get_ticket", {
        id: "T-100"
      });

      expect(textFromToolResult(response)).toContain("Login failure");
    } finally {
      await manager.disconnectServer(HTTP_SERVER_ID);
    }
  });

  it("blocks write tools when the token lacks tickets:write", async () => {
    const manager = createModernManager();
    await manager.connectToServer(HTTP_SERVER_ID, httpServerConfig("dev-read-token"));

    try {
      const failure = await captureToolFailure(() =>
        manager.executeTool(HTTP_SERVER_ID, "update_ticket_status", {
          id: "T-100",
          status: "resolved"
        })
      );

      expect(failure).toContain("Unauthorized");
      expect(failure).toContain("tickets:write");
    } finally {
      await manager.disconnectServer(HTTP_SERVER_ID);
    }
  });

  it("allows write tools when the token includes tickets:write", async () => {
    const manager = createModernManager();
    await manager.connectToServer(HTTP_SERVER_ID, httpServerConfig("dev-write-token"));

    try {
      const response = await manager.executeTool(HTTP_SERVER_ID, "update_ticket_status", {
        id: "T-100",
        status: "resolved"
      });

      const text = textFromToolResult(response);
      expect(text).toContain("Success. Ticket updated");
      expect(text).toContain('"status": "resolved"');
    } finally {
      await manager.disconnectServer(HTTP_SERVER_ID);
    }
  });
});
