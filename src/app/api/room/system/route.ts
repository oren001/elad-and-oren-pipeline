import {
  appendSystem,
  recordFirstSeen,
  shouldAnnounceReturn,
} from "@/lib/room";
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
  const user = userId ? getUserById(userId) : undefined;
  if (!user) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }

  const isFirst = await recordFirstSeen(user.id);
  if (isFirst) {
    await appendSystem(`${user.display} הצטרף ללוויינים 🟢`);
    return Response.json({ ok: true, kind: "join" });
  }

  if (await shouldAnnounceReturn(user.id)) {
    await appendSystem(`${user.display} חזר 👋`);
    return Response.json({ ok: true, kind: "return" });
  }

  return Response.json({ ok: true, kind: "skip" });
}
