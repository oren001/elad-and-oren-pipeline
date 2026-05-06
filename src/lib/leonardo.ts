const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest";
const NANO_BANANA_PRO = "gemini-image-2";

const PERSONA_SUFFIX =
  ", smoky green haze, soft 35mm film grain, dreamy stoned aesthetic, hazy atmosphere";

export type StartGenerationResult =
  | { ok: true; generationId: string }
  | { ok: false; error: string; status: number; body?: unknown };

export async function startGeneration(opts: {
  prompt: string;
  refImageId: string | null;
  width?: number;
  height?: number;
}): Promise<StartGenerationResult> {
  const apiKey = process.env.LEONARDO_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "missing_api_key", status: 500 };
  }

  const finalPrompt = opts.prompt + PERSONA_SUFFIX;
  const parameters: Record<string, unknown> = {
    prompt: finalPrompt,
    width: opts.width ?? 1024,
    height: opts.height ?? 1024,
    quantity: 1,
    prompt_enhance: "OFF",
  };
  if (opts.refImageId) {
    parameters.guidances = {
      image_reference: [
        {
          image: { id: opts.refImageId, type: "UPLOADED" },
          strength: "MID",
        },
      ],
    };
  }

  const upstream = await fetch(`${LEONARDO_BASE}/v2/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      model: NANO_BANANA_PRO,
      parameters,
      public: false,
    }),
  });

  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "leonardo_bad_response",
      status: upstream.status,
      body: text.slice(0, 500),
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      error: "leonardo_error",
      status: upstream.status,
      body: data,
    };
  }

  const generationId = extractGenerationId(data);
  if (!generationId) {
    return {
      ok: false,
      error: "no_generation_id",
      status: 502,
      body: data,
    };
  }

  return { ok: true, generationId };
}

function extractGenerationId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const candidates: Array<unknown> = [
    (d.sdGenerationJob as Record<string, unknown> | undefined)?.generationId,
    (d.generation as Record<string, unknown> | undefined)?.id,
    (d.generations as Record<string, unknown> | undefined)?.id,
    d.id,
    d.generationId,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}
