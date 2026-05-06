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

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadInitImage(
  bytes: ArrayBuffer,
  mime: string,
): Promise<string | null> {
  const apiKey = process.env.LEONARDO_API_KEY?.trim();
  if (!apiKey) return null;
  const ext = EXT_BY_MIME[mime.toLowerCase()];
  if (!ext) return null;

  const initRes = await fetch(`${LEONARDO_BASE}/v1/init-image`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ extension: ext }),
  });
  if (!initRes.ok) return null;
  const initData = (await initRes.json()) as {
    uploadInitImage?: {
      id?: string;
      url?: string;
      fields?: string;
    };
  };
  const upload = initData.uploadInitImage;
  if (!upload?.id || !upload?.url || typeof upload.fields !== "string") {
    return null;
  }
  let fields: Record<string, string>;
  try {
    fields = JSON.parse(upload.fields) as Record<string, string>;
  } catch {
    return null;
  }
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("file", new Blob([bytes], { type: mime }), `init.${ext}`);
  const s3Res = await fetch(upload.url, { method: "POST", body: fd });
  if (s3Res.status !== 204 && !s3Res.ok) return null;
  return upload.id;
}

function extractGenerationId(data: unknown): string | null {
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const PREFERRED = ["generationId", "generation_id", "id"];
  const WRAPPERS = [
    "sdGenerationJob",
    "generation",
    "generations",
    "generations_by_pk",
    "data",
    "result",
    "job",
  ];
  const seen = new WeakSet<object>();

  function walk(node: unknown, depth: number): string | null {
    if (depth > 5 || node == null) return null;
    if (typeof node === "string") {
      return UUID_RE.test(node) ? node : null;
    }
    if (typeof node !== "object") return null;
    if (seen.has(node as object)) return null;
    seen.add(node as object);

    const obj = node as Record<string, unknown>;

    for (const k of PREFERRED) {
      const v = obj[k];
      if (typeof v === "string" && UUID_RE.test(v)) return v;
    }

    for (const w of WRAPPERS) {
      if (w in obj) {
        const found = walk(obj[w], depth + 1);
        if (found) return found;
      }
    }

    for (const v of Object.values(obj)) {
      const found = walk(v, depth + 1);
      if (found) return found;
    }

    return null;
  }

  return walk(data, 0);
}
