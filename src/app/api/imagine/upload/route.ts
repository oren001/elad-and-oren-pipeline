export const runtime = "edge";

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest";
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.LEONARDO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing_api_key" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }

  const file = formData.get("file");
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
  const extension = EXT_BY_MIME[mime];
  if (!extension) {
    return Response.json(
      { error: "unsupported_type", mime },
      { status: 415 },
    );
  }

  const initRes = await fetch(`${LEONARDO_BASE}/v1/init-image`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ extension }),
  });

  const initText = await initRes.text();
  let initData: unknown;
  try {
    initData = JSON.parse(initText);
  } catch {
    return Response.json(
      { error: "leonardo_init_bad_response", status: initRes.status },
      { status: 502 },
    );
  }

  if (!initRes.ok) {
    return Response.json(
      { error: "leonardo_init_error", status: initRes.status, body: initData },
      { status: 502 },
    );
  }

  const upload = (initData as Record<string, unknown>).uploadInitImage as
    | Record<string, unknown>
    | undefined;

  if (!upload) {
    return Response.json(
      { error: "no_upload_block", body: initData },
      { status: 502 },
    );
  }

  const imageId = upload.id as string | undefined;
  const url = upload.url as string | undefined;
  const fieldsRaw = upload.fields;

  if (!imageId || !url || typeof fieldsRaw !== "string") {
    return Response.json(
      { error: "missing_upload_fields", body: upload },
      { status: 502 },
    );
  }

  let fields: Record<string, string>;
  try {
    fields = JSON.parse(fieldsRaw) as Record<string, string>;
  } catch {
    return Response.json(
      { error: "fields_parse_failed", fields: fieldsRaw },
      { status: 502 },
    );
  }

  const s3Form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    s3Form.append(k, v);
  }
  s3Form.append("file", file);

  const s3Res = await fetch(url, { method: "POST", body: s3Form });
  if (s3Res.status !== 204 && !s3Res.ok) {
    const errText = await s3Res.text().catch(() => "");
    return Response.json(
      {
        error: "s3_upload_failed",
        status: s3Res.status,
        body: errText.slice(0, 500),
      },
      { status: 502 },
    );
  }

  return Response.json({ imageId });
}
