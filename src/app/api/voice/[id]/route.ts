import { getKv } from "@/lib/kv";

export const runtime = "edge";

const VOICE_PREFIX = "voice:";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    return new Response("bad_id", { status: 400 });
  }
  const kv = getKv();
  if (!kv) return new Response("kv_unavailable", { status: 500 });

  const [b64, mime] = await Promise.all([
    kv.get(VOICE_PREFIX + id),
    kv.get(VOICE_PREFIX + id + ":mime"),
  ]);

  if (!b64) return new Response("not_found", { status: 404 });

  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

  return new Response(u8.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": mime || "audio/webm",
      "cache-control": "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
    },
  });
}
