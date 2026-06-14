import type { BunRequest } from "bun";
import { syncGongPipeline } from "../sync";

export async function handleGongSync(req: BunRequest): Promise<Response> {
  syncGongPipeline();
  return Response.json(null, { status: 200 });
}
