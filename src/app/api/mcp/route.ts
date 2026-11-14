import { CORS_HEADERS, json, preflight } from "@/lib/http";
import { handleRpc } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/** MCP Streamable HTTP endpoint (stateless, JSON responses). Add it to an MCP client as: {APP_URL}/api/mcp */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(handleRpc))).filter((r) => r !== null);
    return responses.length ? json(responses) : new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const response = await handleRpc(body);
  if (response === null) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return json(response);
}

/** No server-initiated stream: this server only answers requests. */
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS_HEADERS } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: CORS_HEADERS });
}

export const OPTIONS = preflight;
