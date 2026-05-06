import { patchImage } from "@/lib/room";

export const runtime = "edge";

type Body = {
  msgId?: unknown;
  imageUrl?: unknown;
  error?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const msgId = typeof body.msgId === "string" ? body.msgId : "";
  if (!msgId) return Response.json({ error: "missing_msgId" }, { status: 400 });

  const imageUrl =
    typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : null;
  const errorReason =
    typeof body.error === "string" && body.error ? body.error : null;

  if (imageUrl) {
    await patchImage(msgId, {
      status: "ready",
      url: imageUrl,
      text: null,
    });
  } else {
    await patchImage(msgId, {
      status: "error",
      error: errorReason ?? "unknown",
      text: "אחי הראש שלי לא צייר.",
    });
  }

  return Response.json({ ok: true });
}
