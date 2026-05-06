import { setHeartbeat } from "@/lib/room";
import { getUserById } from "@/lib/users";

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
  if (!userId || !getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }
  await setHeartbeat(userId);
  return Response.json({ ok: true });
}
