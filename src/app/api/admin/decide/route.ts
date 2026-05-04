import { isOwner } from "@/lib/admin";
import { getKv, loadPending, savePending } from "@/lib/kv";
import { startGeneration } from "@/lib/leonardo";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  if (!(await isOwner())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const pendingId = form?.get("id");
  const decision = form?.get("decision");

  if (typeof pendingId !== "string" || !pendingId) {
    return Response.json({ error: "missing_id" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "deny") {
    return Response.json({ error: "bad_decision" }, { status: 400 });
  }

  const kv = getKv();
  if (!kv) {
    return Response.json({ error: "kv_unavailable" }, { status: 500 });
  }

  const pending = await loadPending(kv, pendingId);
  if (!pending) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (pending.status !== "awaiting") {
    const dest = new URL(req.url);
    dest.pathname = `/admin/approve/${pendingId}`;
    dest.search = "";
    return Response.redirect(dest.toString(), 303);
  }

  if (decision === "deny") {
    pending.status = "denied";
    pending.reason = "owner_denied";
    await savePending(kv, pending);
  } else {
    const result = await startGeneration({
      prompt: pending.prompt,
      refImageId: pending.refImageId,
    });
    if (!result.ok) {
      pending.status = "denied";
      pending.reason = `leonardo_${result.error}`;
      await savePending(kv, pending);
    } else {
      pending.status = "approved";
      pending.generationId = result.generationId;
      await savePending(kv, pending);
    }
  }

  const dest = new URL(req.url);
  dest.pathname = `/admin/approve/${pendingId}`;
  dest.search = "";
  return Response.redirect(dest.toString(), 303);
}
