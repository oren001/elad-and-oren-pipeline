import { loadSubscription } from "@/lib/notify";
import { sendWebPush } from "@/lib/webpush";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

type Body = { userId?: unknown; title?: unknown; body?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }
  const sub = await loadSubscription(userId);
  if (!sub) {
    return Response.json({ error: "no_subscription" }, { status: 404 });
  }
  const title =
    typeof body.title === "string" && body.title ? body.title : "בדיקה";
  const text =
    typeof body.body === "string" && body.body
      ? body.body
      : "התראה לבדיקה מהלווינים";
  const result = await sendWebPush(sub, { title, body: text, url: "/" });
  return Response.json(result);
}
