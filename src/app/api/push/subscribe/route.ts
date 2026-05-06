import { saveSubscription } from "@/lib/notify";
import { getUserById } from "@/lib/users";
import type { WebPushSubscription } from "@/lib/webpush";

export const runtime = "edge";

type Body = {
  userId?: unknown;
  subscription?: unknown;
};

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

  const sub = body.subscription as WebPushSubscription | undefined;
  if (
    !sub ||
    typeof sub.endpoint !== "string" ||
    !sub.keys ||
    typeof sub.keys.p256dh !== "string" ||
    typeof sub.keys.auth !== "string"
  ) {
    return Response.json({ error: "bad_subscription" }, { status: 400 });
  }

  await saveSubscription(userId, sub);
  return Response.json({ ok: true });
}
