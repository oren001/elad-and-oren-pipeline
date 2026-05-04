import { getKv, loadPending } from "@/lib/kv";

export const runtime = "edge";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return Response.json({ error: "bad_id" }, { status: 400 });
  }

  const kv = getKv();
  if (!kv) {
    return Response.json({ error: "kv_unavailable" }, { status: 500 });
  }

  const pending = await loadPending(kv, id);
  if (!pending) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    status: pending.status,
    generationId: pending.generationId ?? null,
    reason: pending.reason ?? null,
  });
}
