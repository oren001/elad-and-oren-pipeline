import { loadProfilePhoto } from "@/lib/profiles";

export const runtime = "edge";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) {
    return new Response("bad_id", { status: 400 });
  }
  const photo = await loadProfilePhoto(id);
  if (!photo) return new Response("not_found", { status: 404 });
  return new Response(photo.bytes.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": photo.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
