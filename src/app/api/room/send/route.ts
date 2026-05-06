import {
  appendMessages,
  newId,
  type RoomMsg,
  shouldTriggerAutoImage,
  markAutoImageFired,
  readDailyCount,
  incrDailyCount,
  DAILY_LIMIT,
} from "@/lib/room";
import { generate } from "@/lib/persona";
import { notifyMentions } from "@/lib/notify";
import { buildAutoPrompt } from "@/lib/auto-image";
import { startGeneration } from "@/lib/leonardo";
import { findMentions, USERS } from "@/lib/users";
import { loadProfile } from "@/lib/profiles";

const AUTO_IMAGE_PROBABILITY = 0.18;
const AUTO_IMAGE_KEYWORD_BOOST = 0.5;
const AUTO_IMAGE_KEYWORDS = /ערן|מצחיק|תראו|תמונה|דמיין|ציור|חלום|מסטול|רעב/;

export const runtime = "edge";

const BOT_REPLY_PROBABILITY = 0.6;

type Body = {
  text?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  replyTo?: unknown;
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

  const replyTo = parseReplyTo(body.replyTo);

  const userMsg: RoomMsg = {
    id: newId(),
    ts: Date.now(),
    author: { id: authorId, name: authorName },
    role: "user",
    text,
    ...(replyTo ? { replyTo } : {}),
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

  let messages = await appendMessages(...toAppend);

  await notifyMentions({
    text,
    authorName,
    authorId,
  });

  let autoImage: { msgId: string; generationId: string } | null = null;
  try {
    const cap = await readDailyCount();
    if (cap < DAILY_LIMIT) {
      const baseProb = AUTO_IMAGE_PROBABILITY;
      const boosted = AUTO_IMAGE_KEYWORDS.test(text)
        ? Math.min(0.95, baseProb + AUTO_IMAGE_KEYWORD_BOOST)
        : baseProb;
      if (Math.random() < boosted) {
        const cool = await shouldTriggerAutoImage();
        if (cool) {
          const refImageId = await pickRefImageForMessage(text, authorId);
          const prompt = buildAutoPrompt(text);
          const result = await startGeneration({ prompt, refImageId });
          if (result.ok) {
            await incrDailyCount();
            await markAutoImageFired();
            const pendingId = newId();
            const pending: RoomMsg = {
              id: pendingId,
              ts: Date.now() + 2,
              role: "bot",
              text: "המסטולון מצייר משהו... 🟢",
              image: {
                prompt,
                refUsed: false,
                status: "pending",
                generationId: result.generationId,
              },
            };
            messages = await appendMessages(pending);
            autoImage = { msgId: pendingId, generationId: result.generationId };
          }
        }
      }
    }
  } catch {
    // never let auto-image break the send path
  }

  return Response.json({ messages, autoImage });
}

async function pickRefImageForMessage(
  text: string,
  authorId: string,
): Promise<string | null> {
  const mentioned = findMentions(text);
  const candidates = [...new Set([...mentioned.map((u) => u.id), authorId])];
  for (const uid of candidates) {
    const p = await loadProfile(uid);
    if (p?.leonardoId) return p.leonardoId;
  }
  // last resort: any user with a profile
  for (const u of USERS) {
    const p = await loadProfile(u.id);
    if (p?.leonardoId) return p.leonardoId;
  }
  return null;
}

function parseReplyTo(
  v: unknown,
): { id: string; authorName: string; snippet: string } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const authorName = typeof o.authorName === "string" ? o.authorName.slice(0, 30) : "";
  const snippet = typeof o.snippet === "string" ? o.snippet.slice(0, 140) : "";
  if (!id) return null;
  return { id, authorName, snippet };
}
