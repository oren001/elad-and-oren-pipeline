import { startGeneration } from "@/lib/leonardo";
import {
  getKv,
  readNumber,
  writeNumber,
  savePending,
  type Pending,
} from "@/lib/kv";

export const runtime = "edge";

const FREE_LIMIT = 10;
const COUNT_KEY = "imagine:count";

type CreateBody = {
  prompt?: unknown;
  refImageId?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const refImageId =
    typeof body.refImageId === "string" && body.refImageId
      ? body.refImageId
      : null;

  if (!prompt) return Response.json({ error: "empty_prompt" }, { status: 400 });
  if (prompt.length > 2000)
    return Response.json({ error: "prompt_too_long" }, { status: 413 });

  const kv = getKv();

  if (!kv) {
    const result = await startGeneration({ prompt, refImageId });
    if (!result.ok) return errorResponse(result);
    return Response.json({ generationId: result.generationId });
  }

  const count = await readNumber(kv, COUNT_KEY);

  if (count < FREE_LIMIT) {
    await writeNumber(kv, COUNT_KEY, count + 1);
    const result = await startGeneration({ prompt, refImageId });
    if (!result.ok) {
      await writeNumber(kv, COUNT_KEY, count);
      return errorResponse(result);
    }
    return Response.json({
      generationId: result.generationId,
      remainingFree: Math.max(0, FREE_LIMIT - (count + 1)),
    });
  }

  const pendingId = newPendingId();
  const pending: Pending = {
    id: pendingId,
    prompt,
    refImageId,
    createdAt: Date.now(),
    status: "awaiting",
  };
  await savePending(kv, pending);

  return Response.json({
    awaitingApproval: true,
    pendingId,
  });
}

function newPendingId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

function errorResponse(result: {
  ok: false;
  error: string;
  status: number;
  body?: unknown;
}): Response {
  return Response.json(
    { error: result.error, status: result.status, body: result.body },
    { status: result.status >= 400 ? result.status : 502 },
  );
}
