import type { BunRequest } from "bun";

export function withCors(handler: (req: BunRequest) => Promise<Response>) {
  return async (req: BunRequest) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(req) });
    }

    const response = await handler(req);
    const headers = new Headers(response.headers);
    Object.entries(getCorsHeaders(req)).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, headers });
  };
}

function getCorsHeaders(req: BunRequest) {
  const allowedOrigins = [process.env.BUN_PUBLIC_BACKEND_BASE_URL];
  const origin = req.headers.get("Origin");

  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

