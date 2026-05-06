import { getOrCreateVapidKeys } from "@/lib/vapid";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const keys = await getOrCreateVapidKeys();
  if (!keys) {
    return Response.json({ error: "kv_unavailable" }, { status: 500 });
  }
  return Response.json({ publicKey: keys.publicRaw });
}
