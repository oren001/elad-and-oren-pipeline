export const runtime = "edge";

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const apiKey = process.env.LEONARDO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "missing_api_key" }, { status: 500 });
  }

  const { id } = await ctx.params;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return Response.json({ error: "bad_id" }, { status: 400 });
  }

  const upstream = await fetch(`${LEONARDO_BASE}/v1/generations/${id}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  const text = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "leonardo_bad_response", status: upstream.status },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return Response.json(
      { error: "leonardo_error", status: upstream.status, body: data },
      { status: 502 },
    );
  }

  const pk = (data as Record<string, unknown>).generations_by_pk as
    | Record<string, unknown>
    | undefined;

  const status = (pk?.status as string | undefined) ?? "PENDING";
  const images = (pk?.generated_images as Array<{ url?: string }> | undefined) ?? [];
  const imageUrl = images[0]?.url ?? null;

  return Response.json({ status, imageUrl });
}
