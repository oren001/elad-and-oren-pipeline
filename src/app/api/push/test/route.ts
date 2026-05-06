import { loadSubscription } from "@/lib/notify";
import { sendWebPush } from "@/lib/webpush";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

type Body = { userId?: unknown; title?: unknown; body?: unknown };

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  const title = url.searchParams.get("title") ?? "בדיקה";
  const text =
    url.searchParams.get("body") ?? "התראה לבדיקה מהלווינים";
  return run(userId, title, text);
}

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const title =
    typeof body.title === "string" && body.title ? body.title : "בדיקה";
  const text =
    typeof body.body === "string" && body.body
      ? body.body
      : "התראה לבדיקה מהלווינים";
  return run(userId, title, text);
}

async function run(
  userId: string,
  title: string,
  text: string,
): Promise<Response> {
  if (!userId || !getUserById(userId)) {
    return Response.json({ error: "unknown_user", userId }, { status: 400 });
  }
  const sub = await loadSubscription(userId);
  if (!sub) {
    return Response.json(
      { error: "no_subscription", userId },
      { status: 404 },
    );
  }
  const result = await sendWebPush(sub, { title, body: text, url: "/" });
  return Response.json({ userId, ...result });
}
