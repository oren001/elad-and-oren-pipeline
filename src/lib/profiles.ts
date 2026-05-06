import { getKv } from "./kv";

export type Profile = {
  photoId: string;
  leonardoId?: string;
  mime: string;
  ts: number;
};

const PROFILE_PREFIX = "profile:";
const PROFILE_PHOTO_PREFIX = "profile_photo:";
const PROFILE_TTL_SEC = 60 * 60 * 24 * 365;

export async function loadProfile(userId: string): Promise<Profile | null> {
  const kv = getKv();
  if (!kv) return null;
  const raw = await kv.get(PROFILE_PREFIX + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function saveProfile(
  userId: string,
  profile: Profile,
): Promise<void> {
  const kv = getKv();
  if (!kv) return;
  await kv.put(PROFILE_PREFIX + userId, JSON.stringify(profile), {
    expirationTtl: PROFILE_TTL_SEC,
  });
}

export async function loadProfilePhoto(
  photoId: string,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const kv = getKv();
  if (!kv) return null;
  const [b64, mime] = await Promise.all([
    kv.get(PROFILE_PHOTO_PREFIX + photoId),
    kv.get(PROFILE_PHOTO_PREFIX + photoId + ":mime"),
  ]);
  if (!b64) return null;
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { bytes: u8, mime: mime || "image/jpeg" };
}

export async function saveProfilePhoto(
  photoId: string,
  bytes: ArrayBuffer,
  mime: string,
): Promise<void> {
  const kv = getKv();
  if (!kv) return;
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  const b64 = btoa(bin);
  await kv.put(PROFILE_PHOTO_PREFIX + photoId, b64, {
    expirationTtl: PROFILE_TTL_SEC,
  });
  await kv.put(PROFILE_PHOTO_PREFIX + photoId + ":mime", mime, {
    expirationTtl: PROFILE_TTL_SEC,
  });
}

export async function loadAllProfiles(
  userIds: string[],
): Promise<Record<string, Profile>> {
  const out: Record<string, Profile> = {};
  await Promise.all(
    userIds.map(async (uid) => {
      const p = await loadProfile(uid);
      if (p) out[uid] = p;
    }),
  );
  return out;
}
