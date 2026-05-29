/**
 * MCP (Model Context Protocol) integration — skeleton.
 *
 * This module defines the interfaces and placeholder endpoints for MCP.
 * Actual MCP protocol implementation (tool discovery, tool calls, context
 * injection) will be implemented in a future PR once MCP servers are
 * configured via MCP_SERVERS env var.
 */
import type { Express, Request, Response } from "express";

export interface McpServer {
  name: string;
  url: string;
  status: "connected" | "disconnected" | "error";
  tools: McpTool[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCallRequest {
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface McpCallResponse {
  result?: unknown;
  error?: string;
}

/**
 * Check if MCP is configured via environment variables.
 */
function isMcpConfigured(): boolean {
  return !!(process.env.MCP_SERVERS || process.env.MCP_CONFIG);
}

/**
 * Parse configured MCP servers from environment.
 * Expected format: JSON array of {name, url} objects.
 */
function getConfiguredServers(): { name: string; url: string }[] {
  const raw = process.env.MCP_SERVERS;
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function registerMcpRoutes(app: Express): void {
  // MCP Status — reports whether MCP is configured and lists servers
  app.get("/api/mcp/status", (_req: Request, res: Response) => {
    const configured = isMcpConfigured();
    const servers = getConfiguredServers().map((s) => ({
      name: s.name,
      url: s.url,
      status: "disconnected" as const,
      tools: [],
    }));

    res.json({
      configured,
      servers,
      message: configured
        ? `${servers.length} MCP server(s) configured`
        : "MCP not configured. Set MCP_SERVERS env var with a JSON array of {name, url} objects.",
    });
  });

  // MCP Tool Call — placeholder
  app.post("/api/mcp/call", (req: Request, res: Response) => {
    if (!isMcpConfigured()) {
      return res.status(503).json({
        error: "MCP servers not configured. Add MCP_SERVERS env var.",
        hint: 'Set MCP_SERVERS=\'[{"name":"my-server","url":"http://localhost:3100"}]\' in your .env file.',
      });
    }

    const { server, tool, arguments: args } = req.body as McpCallRequest;
    if (!server || !tool) {
      return res.status(400).json({ error: "Missing 'server' and 'tool' fields." });
    }

    // TODO: Implement actual MCP protocol call
    // This will:
    // 1. Connect to the specified MCP server
    // 2. Call the tool with the given arguments
    // 3. Return the result or error
    res.status(501).json({
      error: "MCP tool execution not yet implemented.",
      message: "This endpoint will call MCP tools once protocol implementation is complete.",
      requestedServer: server,
      requestedTool: tool,
      requestedArgs: args,
    });
  });

  // List tools available on a specific MCP server
  app.get("/api/mcp/servers/:name/tools", (req: Request, res: Response) => {
    if (!isMcpConfigured()) {
      return res.status(503).json({ error: "MCP servers not configured." });
    }

    const serverName = req.params.name;
    const servers = getConfiguredServers();
    const server = servers.find((s) => s.name === serverName);

    if (!server) {
      return res.status(404).json({ error: `MCP server '${serverName}' not found.` });
    }

    // TODO: Implement tool discovery via MCP protocol
    res.json({
      server: serverName,
      tools: [],
      message: "Tool discovery not yet implemented. Configure and restart to see tools.",
    });
  });
}
