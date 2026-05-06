import { appendMessages, newId, type RoomMsg } from "@/lib/room";
import { getKv } from "@/lib/kv";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

const MAX_BYTES = 6 * 1024 * 1024;
const PHOTO_PREFIX = "photo:";
const PHOTO_TTL_SEC = 60 * 60 * 24 * 60;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request): Promise<Response> {
  const kv = getKv();
  if (!kv) {
    return Response.json({ error: "kv_unavailable" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 413 });
  }
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return Response.json({ error: "unsupported_type", mime }, { status: 415 });
  }

  const authorId =
    String(form.get("authorId") ?? "").trim().slice(0, 40) || "anon";
  const authorName =
    String(form.get("authorName") ?? "").trim().slice(0, 30) || "אנונימי";
  const caption = String(form.get("caption") ?? "").trim().slice(0, 500);
  const replyToRaw = form.get("replyTo");
  const replyTo = parseReplyTo(replyToRaw);

  if (authorId !== "anon" && !getUserById(authorId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }

  const photoId = newPhotoId();
  const buf = await file.arrayBuffer();

  await kv.put(PHOTO_PREFIX + photoId, arrayBufferToBase64(buf), {
    expirationTtl: PHOTO_TTL_SEC,
  });
  await kv.put(
    PHOTO_PREFIX + photoId + ":mime",
    mime,
    { expirationTtl: PHOTO_TTL_SEC },
  );

  const url = `/api/photo/${photoId}`;
  const msg: RoomMsg = {
    id: newId(),
    ts: Date.now(),
    author: { id: authorId, name: authorName },
    role: "user",
    text: caption || undefined,
    image: {
      prompt: caption || "",
      refUsed: false,
      status: "ready",
      url,
    },
    uploaded: true,
    ...(replyTo ? { replyTo } : {}),
  };

  const messages = await appendMessages(msg);
  return Response.json({ messages, msgId: msg.id, url });
}

function newPhotoId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let bin = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

function parseReplyTo(
  v: unknown,
): { id: string; authorName: string; snippet: string } | null {
  if (typeof v !== "string") return null;
  try {
    const o = JSON.parse(v) as {
      id?: unknown;
      authorName?: unknown;
      snippet?: unknown;
    };
    const id = typeof o.id === "string" ? o.id : "";
    const authorName =
      typeof o.authorName === "string" ? o.authorName.slice(0, 30) : "";
    const snippet =
      typeof o.snippet === "string" ? o.snippet.slice(0, 140) : "";
    if (!id) return null;
    return { id, authorName, snippet };
  } catch {
    return null;
  }
}
