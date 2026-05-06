export const runtime = "edge";

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest";

export async function GET(): Promise<Response> {
  const apiKey = process.env.LEONARDO_API_KEY;

  if (!apiKey) {
    return Response.json({
      key_present: false,
      key_length: 0,
      key_prefix: null,
      key_suffix: null,
      whitespace_warning: false,
      leonardo_status: null,
      leonardo_body: null,
    });
  }

  const trimmed = apiKey.trim();
  const whitespace = trimmed.length !== apiKey.length;

  const me = await fetch(`${LEONARDO_BASE}/v1/me`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${trimmed}`,
      accept: "application/json",
    },
  });

  const text = await me.text();
  let body: unknown = text.slice(0, 400);
  try {
    body = JSON.parse(text);
  } catch {
    // keep as text
  }

  return Response.json({
    key_present: true,
    key_length: apiKey.length,
    key_prefix: trimmed.slice(0, 4),
    key_suffix: trimmed.slice(-4),
    whitespace_warning: whitespace,
    leonardo_status: me.status,
    leonardo_body: body,
  });
}
