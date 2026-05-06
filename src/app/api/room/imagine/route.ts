import {
  appendMessages,
  incrDailyCount,
  newId,
  readDailyCount,
  DAILY_LIMIT,
  type RoomMsg,
} from "@/lib/room";
import { startGeneration } from "@/lib/leonardo";

export const runtime = "edge";

type Body = {
  prompt?: unknown;
  refImageId?: unknown;
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

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const refImageId =
    typeof body.refImageId === "string" && body.refImageId
      ? body.refImageId
      : null;
  const authorId =
    typeof body.authorId === "string" && body.authorId
      ? body.authorId
      : "anon";
  const authorName =
    typeof body.authorName === "string" && body.authorName.trim()
      ? body.authorName.trim().slice(0, 30)
      : "אנונימי";

  if (!prompt) return Response.json({ error: "empty" }, { status: 400 });
  if (prompt.length > 2000)
    return Response.json({ error: "too_long" }, { status: 413 });

  const used = await readDailyCount();
  if (used >= DAILY_LIMIT) {
    return Response.json(
      {
        error: "daily_cap_reached",
        used,
        limit: DAILY_LIMIT,
      },
      { status: 429 },
    );
  }

  const result = await startGeneration({ prompt, refImageId });
  if (!result.ok) {
    return Response.json(
      { error: result.error, status: result.status, body: result.body },
      { status: result.status >= 400 ? result.status : 502 },
    );
  }

  await incrDailyCount();

  const userMsg: RoomMsg = {
    id: newId(),
    ts: Date.now(),
    author: { id: authorId, name: authorName },
    role: "user",
    text: refImageId
      ? `🎨 ${prompt}  (תמונת התייחסות מצורפת)`
      : `🎨 ${prompt}`,
  };
  const pendingMsgId = newId();
  const pendingMsg: RoomMsg = {
    id: pendingMsgId,
    ts: Date.now() + 1,
    role: "bot",
    text: "המסטולון מצייר... רגע אחי 🟢",
    image: {
      prompt,
      refUsed: !!refImageId,
      status: "pending",
      generationId: result.generationId,
    },
  };

  await appendMessages(userMsg, pendingMsg);

  return Response.json({
    msgId: pendingMsgId,
    generationId: result.generationId,
    daily: { used: used + 1, limit: DAILY_LIMIT },
  });
}
