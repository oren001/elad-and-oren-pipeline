import { editMessage } from "@/lib/room";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

type Body = { msgId?: unknown; userId?: unknown; text?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const msgId = typeof body.msgId === "string" ? body.msgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const text =
    typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!msgId || !userId || !text) {
    return Response.json({ error: "missing_field" }, { status: 400 });
  }
  if (!getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }
  const result = await editMessage(msgId, userId, text);
  if (!result.ok) {
    return Response.json(
      { error: result.reason ?? "failed" },
      { status: result.reason === "forbidden" ? 403 : 400 },
    );
  }
  return Response.json({ messages: result.messages });
}
