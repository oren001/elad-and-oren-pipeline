import { saveProfile, saveProfilePhoto, type Profile } from "@/lib/profiles";
import { uploadInitImage } from "@/lib/leonardo";
import { getUserById } from "@/lib/users";

export const runtime = "edge";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }

  const userId = String(form.get("userId") ?? "").trim();
  if (!userId || !getUserById(userId)) {
    return Response.json({ error: "unknown_user" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 413 });
  }
  const mime = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return Response.json({ error: "unsupported_type", mime }, { status: 415 });
  }

  const bytes = await file.arrayBuffer();
  const photoId = newId();
  await saveProfilePhoto(photoId, bytes, mime);

  let leonardoId: string | undefined;
  try {
    const id = await uploadInitImage(bytes, mime);
    if (id) leonardoId = id;
  } catch {
    // continue without ref ability
  }

  const profile: Profile = {
    photoId,
    leonardoId,
    mime,
    ts: Date.now(),
  };
  await saveProfile(userId, profile);

  return Response.json({
    ok: true,
    userId,
    photoUrl: `/api/user/profile/${photoId}`,
    leonardoLinked: Boolean(leonardoId),
  });
}

function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14);
}
