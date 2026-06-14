import type { BunRequest } from "bun";
import { dispatchMcp } from "@/core/services/mcp-server";
import { JSON_RPC, type JsonRpcRequest } from "@/core/models/mcp-models";

const rpcError = (code: number, message: string, status: number): Response =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });

/**
 * Streamable HTTP MCP endpoint. Stateless: a POST containing a JSON-RPC request
 * gets a single application/json response; notifications get a 202; we never
 * open a server→client SSE stream, so GET/DELETE are not allowed.
 */
export async function handleMcp(req: BunRequest): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(JSON_RPC.PARSE_ERROR, "Parse error", 400);
  }

  // JSON-RPC batching was dropped from the MCP spec.
  if (Array.isArray(body)) {
    return rpcError(JSON_RPC.INVALID_REQUEST, "Batching not supported", 400);
  }
  if (typeof body !== "object" || body === null) {
    return rpcError(JSON_RPC.INVALID_REQUEST, "Invalid request", 400);
  }

  const result = await dispatchMcp(body as JsonRpcRequest);
  if (result === null) {
    return new Response(null, { status: 202 }); // notification — no response body
  }
  return Response.json(result);
}
