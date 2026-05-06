import { deleteMessage } from "@/lib/room";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

type Body = { msgId?: unknown; userId?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const msgId = typeof body.msgId === "string" ? body.msgId : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!msgId || !userId) {
    return Response.json({ error: "missing_field" }, { status: 400 });
  }
  if (!getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }
  const result = await deleteMessage(msgId, userId);
  if (!result.ok) {
    return Response.json(
      { error: result.reason ?? "failed" },
      { status: result.reason === "forbidden" ? 403 : 400 },
    );
  }
  return Response.json({ messages: result.messages });
}
