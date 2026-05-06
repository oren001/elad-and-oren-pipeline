import { loadAllProfiles } from "@/lib/profiles";
import { USERS } from "@/lib/users";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const profiles = await loadAllProfiles(USERS.map((u) => u.id));
  const out: Record<string, { url: string; hasRef: boolean }> = {};
  for (const [uid, p] of Object.entries(profiles)) {
    out[uid] = {
      url: `/api/user/profile/${p.photoId}`,
      hasRef: Boolean(p.leonardoId),
    };
  }
  return Response.json({ profiles: out });
}
