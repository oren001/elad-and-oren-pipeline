import { generate } from "@/lib/persona";

export const runtime = "edge";

const STALL_MIN_MS = 600;
const STALL_MAX_MS = 1600;

export async function POST(req: Request): Promise<Response> {
  let message = "";
  try {
    const body = (await req.json()) as { message?: unknown };
    if (typeof body?.message === "string") message = body.message;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  if (!message.trim()) {
    return Response.json({ error: "empty" }, { status: 400 });
  }
  if (message.length > 2000) {
    return Response.json({ error: "too_long" }, { status: 413 });
  }

  const { mood, reply } = generate(message);
  const delay =
    STALL_MIN_MS + Math.floor(Math.random() * (STALL_MAX_MS - STALL_MIN_MS));
  await new Promise<void>((r) => setTimeout(r, delay));

  return Response.json({ mood, reply });
}

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, persona: "mastulon" });
}
