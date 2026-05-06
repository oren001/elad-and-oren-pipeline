import { deleteSubscription } from "@/lib/notify";

export const runtime = "edge";

type Body = { userId?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return Response.json({ error: "missing_userId" }, { status: 400 });
  await deleteSubscription(userId);
  return Response.json({ ok: true });
}
