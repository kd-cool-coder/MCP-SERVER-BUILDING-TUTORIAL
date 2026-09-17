import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  MCPClientManager,
  type MCPServerConfig
} from "@mcpjam/sdk";

export const STDIO_SERVER_ID = "supportdesk";
export const HTTP_SERVER_ID = "supportdesk-http";
export const HTTP_PORT = 8788;
export const HTTP_URL = `http://localhost:${HTTP_PORT}/mcp`;

export const STDIO_SERVER_CONFIG: MCPServerConfig = {
  command: "npx",
  args: ["tsx", "src/stdio.ts"],
  cwd: process.cwd(),
  stderr: "pipe",
  supportedProtocolVersions: ["2026-07-28"]
};

export function createModernManager() {
  return new MCPClientManager(undefined, {
    defaultSupportedProtocolVersions: ["2026-07-28"]
  });
}

export function httpServerConfig(accessToken?: string): MCPServerConfig {
  return {
    url: HTTP_URL,
    accessToken,
    mcpProtocolVersion: "2026-07-28",
    disableSseFallback: true
  };
}

export function textFromToolResult(
  result: Awaited<ReturnType<MCPClientManager["executeTool"]>>
) {
  const content = Array.isArray(result.content) ? result.content : [];
  const firstText = content.find((item) => item.type === "text");
  return firstText && "text" in firstText ? firstText.text : "";
}

export function textFromFirstResource(
  result: Awaited<ReturnType<MCPClientManager["readResource"]>>
) {
  const first = result.contents[0];
  return first && "text" in first ? first.text : "";
}

export async function startHttpServer() {
  const child = spawn("npx", ["tsx", "src/local-http.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(HTTP_PORT) },
    stdio: "pipe"
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  child.stdout.on("data", () => {
    // The MCP HTTP server should not write protocol data here during tests.
  });

  await waitForHttpServer(child, () => stderr);

  return {
    child,
    getStderr: () => stderr,
    async stop() {
      await stopProcess(child);
    }
  };
}

async function waitForHttpServer(
  child: ChildProcessWithoutNullStreams,
  getStderr: () => string
) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`HTTP server exited early:\n${getStderr()}`);
    }

    try {
      const response = await fetch(`http://localhost:${HTTP_PORT}/health`);
      if (response.status === 404) return;
    } catch {
      // Keep polling until the local server starts accepting connections.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`Timed out waiting for HTTP server:\n${getStderr()}`);
}

async function stopProcess(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) return;

  child.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolve();
    }, 3_000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
