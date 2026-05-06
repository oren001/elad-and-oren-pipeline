import { findMentions } from "./users";
import { getKv } from "./kv";
import { sendWebPush, type WebPushSubscription } from "./webpush";

const SUB_PREFIX = "push:sub:";

export async function loadSubscription(
  userId: string,
): Promise<WebPushSubscription | null> {
  const kv = getKv();
  if (!kv) return null;
  const raw = await kv.get(SUB_PREFIX + userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebPushSubscription;
  } catch {
    return null;
  }
}

export async function saveSubscription(
  userId: string,
  sub: WebPushSubscription,
): Promise<void> {
  const kv = getKv();
  if (!kv) return;
  await kv.put(SUB_PREFIX + userId, JSON.stringify(sub));
}

export async function deleteSubscription(userId: string): Promise<void> {
  const kv = getKv();
  if (!kv) return;
  await kv.delete(SUB_PREFIX + userId);
}

export async function notifyMentions(opts: {
  text: string;
  authorName: string;
  authorId?: string;
}): Promise<void> {
  const mentioned = findMentions(opts.text);
  const recipients = opts.authorId
    ? mentioned.filter((u) => u.id !== opts.authorId)
    : mentioned;
  if (recipients.length === 0) return;

  await Promise.allSettled(
    recipients.map((u) => notifyOne(u.id, opts.authorName, opts.text)),
  );
}

async function notifyOne(
  userId: string,
  authorName: string,
  text: string,
): Promise<void> {
  const sub = await loadSubscription(userId);
  if (!sub) return;
  const result = await sendWebPush(sub, {
    title: `${authorName} תייג אותך`,
    body: text.slice(0, 140),
    url: "/",
    tag: `mention-${userId}`,
  });
  if (!result.ok && result.gone) {
    await deleteSubscription(userId);
  }
}
