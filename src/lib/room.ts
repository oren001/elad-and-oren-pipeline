import { getKv } from "@/lib/kv";

export type Mood =
  | "chill"
  | "deep"
  | "hungry"
  | "paranoid"
  | "forgetful"
  | "eran-disses";

export type ImageState = {
  prompt: string;
  refUsed: boolean;
  status: "pending" | "ready" | "error";
  url?: string;
  generationId?: string;
  error?: string;
};

export type RoomMsg = {
  id: string;
  ts: number;
  author?: { id: string; name: string };
  role: "user" | "bot" | "system";
  text?: string;
  mood?: Mood;
  image?: ImageState;
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; authorName: string; snippet: string };
  uploaded?: boolean;
};

const ROOM_KEY = "room:main:msgs";
const MAX_MESSAGES = 200;
const DAILY_CAP_PREFIX = "room:main:cap:";
const DAILY_CAP_LIMIT = 30;

export async function loadMessages(): Promise<RoomMsg[]> {
  const kv = getKv();
  if (!kv) return [];
  const raw = await kv.get(ROOM_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as RoomMsg[]) : [];
  } catch {
    return [];
  }
}

async function saveMessages(msgs: RoomMsg[]): Promise<void> {
  const kv = getKv();
  if (!kv) return;
  const trimmed = msgs.slice(-MAX_MESSAGES);
  await kv.put(ROOM_KEY, JSON.stringify(trimmed));
}

export async function appendMessages(
  ...newMsgs: RoomMsg[]
): Promise<RoomMsg[]> {
  const all = await loadMessages();
  all.push(...newMsgs);
  await saveMessages(all);
  return all;
}

export async function patchImage(
  msgId: string,
  patch: Partial<ImageState> & { text?: string | null },
): Promise<RoomMsg[]> {
  const msgs = await loadMessages();
  const m = msgs.find((x) => x.id === msgId);
  if (m) {
    m.image = {
      prompt: m.image?.prompt ?? "",
      refUsed: m.image?.refUsed ?? false,
      status: patch.status ?? m.image?.status ?? "pending",
      url: patch.url ?? m.image?.url,
      generationId: patch.generationId ?? m.image?.generationId,
      error: patch.error ?? m.image?.error,
    };
    if (patch.text === null) {
      m.text = undefined;
    } else if (typeof patch.text === "string") {
      m.text = patch.text;
    }
    await saveMessages(msgs);
  }
  return msgs;
}

export async function toggleReaction(
  msgId: string,
  userId: string,
  emoji: string,
): Promise<RoomMsg[]> {
  const msgs = await loadMessages();
  const m = msgs.find((x) => x.id === msgId);
  if (!m) return msgs;
  if (!m.reactions) m.reactions = {};
  const current = m.reactions[emoji] ?? [];
  if (current.includes(userId)) {
    const next = current.filter((u) => u !== userId);
    if (next.length === 0) delete m.reactions[emoji];
    else m.reactions[emoji] = next;
  } else {
    m.reactions[emoji] = [...current, userId];
  }
  if (Object.keys(m.reactions).length === 0) delete m.reactions;
  await saveMessages(msgs);
  return msgs;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${DAILY_CAP_PREFIX}${y}-${m}-${day}`;
}

export async function readDailyCount(): Promise<number> {
  const kv = getKv();
  if (!kv) return 0;
  const raw = await kv.get(todayKey());
  return raw ? Number(raw) || 0 : 0;
}

export async function incrDailyCount(): Promise<number> {
  const kv = getKv();
  if (!kv) return 0;
  const k = todayKey();
  const raw = await kv.get(k);
  const n = (raw ? Number(raw) || 0 : 0) + 1;
  await kv.put(k, String(n), { expirationTtl: 60 * 60 * 48 });
  return n;
}

export const DAILY_LIMIT = DAILY_CAP_LIMIT;

export function newId(): string {
  return Math.random().toString(36).slice(2, 12);
}
