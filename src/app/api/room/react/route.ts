import { toggleReaction } from "@/lib/room";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

const ALLOWED_EMOJIS = new Set([
  "❤️",
  "🔥",
  "💀",
  "😂",
  "🤔",
  "🟢",
  "👍",
  "🙄",
]);

type Body = { msgId?: unknown; userId?: unknown; emoji?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const msgId = typeof body.msgId === "string" ? body.msgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!msgId || !userId || !emoji) {
    return Response.json({ error: "missing_field" }, { status: 400 });
  }
  if (!getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return Response.json({ error: "emoji_not_allowed" }, { status: 400 });
  }
  const messages = await toggleReaction(msgId, userId, emoji);
  return Response.json({ messages });
}
