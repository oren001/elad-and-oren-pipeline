import { getRequestContext } from "@cloudflare/next-on-pages";

export type KvLike = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

export function getKv(): KvLike | null {
  try {
    const { env } = getRequestContext();
    const kv = (env as Record<string, unknown>).MASTULON_KV as
      | KvLike
      | undefined;
    return kv ?? null;
  } catch {
    return null;
  }
}

export async function readNumber(kv: KvLike, key: string): Promise<number> {
  const raw = await kv.get(key);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function writeNumber(
  kv: KvLike,
  key: string,
  value: number,
): Promise<void> {
  await kv.put(key, String(value));
}

export type Pending = {
  id: string;
  prompt: string;
  refImageId: string | null;
  createdAt: number;
  status: "awaiting" | "approved" | "denied";
  generationId?: string;
  imageUrl?: string;
  reason?: string;
};

const PENDING_PREFIX = "pending:";
const PENDING_TTL_SEC = 60 * 60 * 24 * 7;

export async function savePending(
  kv: KvLike,
  pending: Pending,
): Promise<void> {
  await kv.put(PENDING_PREFIX + pending.id, JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SEC,
  });
}

export async function loadPending(
  kv: KvLike,
  id: string,
): Promise<Pending | null> {
  const raw = await kv.get(PENDING_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
}
