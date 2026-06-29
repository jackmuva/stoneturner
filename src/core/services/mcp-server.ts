import { z } from "zod";
import {
  JSON_RPC,
  PROTOCOL_VERSION,
  SERVER_INFO,
  SUPPORTED_PROTOCOL_VERSIONS,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
} from "@/core/models/mcp-models";
import { toolsByName, tools } from "@/core/services/mcp-tools";
import type { SqliteDb } from "../models/db-models";

const success = (id: string | number | null, result: unknown): JsonRpcSuccess => ({
  jsonrpc: "2.0",
  id,
  result,
});

const error = (
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcError => ({ jsonrpc: "2.0", id, error: { code, message } });

/**
 * Pure JSON-RPC dispatcher for the MCP protocol. Returns `null` for
 * notifications (no `id`), which the HTTP handler maps to a 202.
 */
export async function dispatchMcp(
  message: JsonRpcRequest,
  db?: SqliteDb
): Promise<JsonRpcResponse | null> {
  if (!db) return null;

  // Notifications carry no id and expect no response.
  if (message.id === undefined || message.id === null) {
    return null;
  }
  const id = message.id;

  switch (message.method) {
    case "initialize": {
      const requested = (message.params as { protocolVersion?: string } | undefined)
        ?.protocolVersion;
      const protocolVersion =
        requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : PROTOCOL_VERSION;
      return success(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });
    }

    case "ping":
      return success(id, {});

    case "tools/list":
      return success(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          annotations: t.annotations,
          inputSchema: z.toJSONSchema(t.inputSchema, { io: "input" }),
        })),
      });

    case "tools/call": {
      const params = message.params as
        | { name?: string; arguments?: unknown }
        | undefined;
      const name = params?.name;
      if (!name) {
        return error(id, JSON_RPC.INVALID_PARAMS, "Missing tool name");
      }
      const tool = toolsByName.get(name);
      if (!tool) {
        return error(id, JSON_RPC.INVALID_PARAMS, `Unknown tool: ${name}`);
      }
      try {
        const result = await tool.handler(params?.arguments ?? {}, db!);
        return success(id, result);
      } catch (err) {
        // Tool execution failures surface as a tool result, not a protocol error.
        return success(id, {
          content: [
            {
              type: "text",
              text: `Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        });
      }
    }

    default:
      return error(id, JSON_RPC.METHOD_NOT_FOUND, `Unknown method: ${message.method}`);
  }
}
