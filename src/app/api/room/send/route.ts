import { appendMessages, newId, type RoomMsg } from "@/lib/room";
import { generate } from "@/lib/persona";
import { notifyMentions } from "@/lib/notify";

export const runtime = "edge";

const BOT_REPLY_PROBABILITY = 0.6;

type Body = {
  text?: unknown;
  authorId?: unknown;
  authorName?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const authorId =
    typeof body.authorId === "string" && body.authorId
      ? body.authorId
      : "anon";
  const authorName =
    typeof body.authorName === "string" && body.authorName.trim()
      ? body.authorName.trim().slice(0, 30)
      : "אנונימי";

  if (!text) return Response.json({ error: "empty" }, { status: 400 });
  if (text.length > 2000)
    return Response.json({ error: "too_long" }, { status: 413 });

  const userMsg: RoomMsg = {
    id: newId(),
    ts: Date.now(),
    author: { id: authorId, name: authorName },
    role: "user",
    text,
  };

  const mentioned = /מסטולון|@bot|@מסטולון/.test(text);
  const eranBait = /ערן/.test(text);
  const shouldReply =
    mentioned || eranBait || Math.random() < BOT_REPLY_PROBABILITY;

  const toAppend: RoomMsg[] = [userMsg];

  if (shouldReply) {
    const { mood, reply } = generate(text);
    toAppend.push({
      id: newId(),
      ts: Date.now() + 1,
      role: "bot",
      text: reply,
      mood,
    });
  }

  const messages = await appendMessages(...toAppend);

  await notifyMentions({
    text,
    authorName,
    authorId,
  });

  return Response.json({ messages });
}
