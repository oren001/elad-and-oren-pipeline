"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  ImageIcon,
  X,
  Edit3,
  Users,
  Bell,
  BellOff,
  Satellite,
  Download,
  Share,
} from "lucide-react";
import { USERS, getUserById, findMentions, type User } from "@/lib/users";

type Mood =
  | "chill"
  | "deep"
  | "hungry"
  | "paranoid"
  | "forgetful"
  | "eran-disses";

type ImageState = {
  prompt: string;
  refUsed: boolean;
  status: "pending" | "ready" | "error";
  url?: string;
  generationId?: string;
  error?: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type RoomMsg = {
  id: string;
  ts: number;
  author?: { id: string; name: string };
  role: "user" | "bot" | "system";
  text?: string;
  mood?: Mood;
  image?: ImageState;
};

const MOOD_LABEL: Record<Mood, string> = {
  chill: "רגוע",
  deep: "פילוסופי",
  hungry: "רעב",
  paranoid: "פרנואיד",
  forgetful: "שכחן",
  "eran-disses": "מדבר על ערן",
};

function readSelfId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("halviinim:userId");
}

function writeSelfId(id: string) {
  localStorage.setItem("halviinim:userId", id);
}

function clearSelfId() {
  localStorage.removeItem("halviinim:userId");
}

export default function Page() {
  const [messages, setMessages] = useState<RoomMsg[]>([]);
  const [daily, setDaily] = useState<{ used: number; limit: number }>({
    used: 0,
    limit: 30,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [imagineOpen, setImagineOpen] = useState(false);
  const [self, setSelf] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstall, setIosInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = readSelfId();
    if (id) {
      const u = getUserById(id);
      if (u) {
        setSelf(u);
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          void ensurePushSubscription(u.id);
        }
      }
    }
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      } else {
        setNotifPermission("unsupported");
      }
    }

    if (typeof window !== "undefined") {
      const standalone =
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;
      if (standalone || iosStandalone) {
        setInstalled(true);
      } else {
        const ua = window.navigator.userAgent || "";
        if (/iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) {
          setIosInstall(true);
        }
        const dismissed =
          localStorage.getItem("halviinim:installDismissed") === "1";
        if (dismissed) setInstallDismissed(true);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await fetch("/api/room", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: RoomMsg[];
          daily?: { used: number; limit: number };
        };
        if (cancelled) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.daily) setDaily(data.daily);
      } catch {
        // silent
      }
    }
    fetchOnce();
    const id = setInterval(fetchOnce, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Notification on @mention of self
  useEffect(() => {
    if (!self || messages.length === 0) return;
    const lastSeen = lastSeenIdRef.current;
    let startIdx = 0;
    if (lastSeen) {
      const idx = messages.findIndex((m) => m.id === lastSeen);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    const newOnes = messages.slice(startIdx);
    lastSeenIdRef.current = messages[messages.length - 1]?.id ?? null;

    if (lastSeen === null) return; // first load — don't notify on history

    for (const m of newOnes) {
      if (!m.text) continue;
      if (m.author?.id === self.id) continue;
      const mentioned = findMentions(m.text);
      if (mentioned.some((u) => u.id === self.id)) {
        showMentionNotification(m, self);
      }
    }
  }, [messages, self]);

  // Scroll to bottom on new messages
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    lastMsgCountRef.current = messages.length;
  }, [messages.length]);

  async function send(text: string) {
    if (!self) return;
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/room/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          authorId: self.id,
          authorName: self.display,
        }),
      });
      const data = (await res.json()) as { messages?: RoomMsg[] };
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // silent — next poll resyncs
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function imagine(prompt: string, refFile: File | null) {
    if (!self) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;

    let refImageId: string | null = null;
    if (refFile) {
      try {
        const fd = new FormData();
        fd.append("file", refFile);
        const up = await fetch("/api/imagine/upload", {
          method: "POST",
          body: fd,
        });
        if (up.ok) {
          const upData = (await up.json()) as { imageId?: string };
          if (upData.imageId) refImageId = upData.imageId;
        }
      } catch {
        // continue
      }
    }

    let msgId: string | null = null;
    let generationId: string | null = null;
    let creationError: string | null = null;
    try {
      const create = await fetch("/api/room/imagine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          refImageId,
          authorId: self.id,
          authorName: self.display,
        }),
      });
      const createData = (await create.json()) as {
        msgId?: string;
        generationId?: string;
        error?: string;
        body?: unknown;
      };
      if (!create.ok) {
        creationError = `${create.status}/${createData.error ?? "unknown"}${
          createData.body
            ? ` | body: ${JSON.stringify(createData.body).slice(0, 300)}`
            : ""
        }`;
      } else {
        msgId = createData.msgId ?? null;
        generationId = createData.generationId ?? null;
      }
    } catch (err) {
      creationError =
        err instanceof Error ? `network: ${err.message}` : "network";
    }

    if (creationError) {
      const friendly = creationError.includes("daily_cap")
        ? "הגענו לתקרה היומית של ציורים. ננסה מחר."
        : `אחי הראש שלי לא צייר.\n[debug: ${creationError}]`;
      setMessages((prev) => [
        ...prev,
        {
          id: "local-" + Math.random().toString(36).slice(2, 8),
          ts: Date.now(),
          role: "bot",
          text: friendly,
          mood: "forgetful",
        },
      ]);
      return;
    }

    if (!msgId || !generationId) return;

    setTimeout(() => void refresh(), 500);

    try {
      const imageUrl = await pollGeneration(generationId);
      await fetch("/api/room/imagine/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, imageUrl }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown";
      await fetch("/api/room/imagine/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, error: detail }),
      });
    } finally {
      void refresh();
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/room", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: RoomMsg[];
        daily?: { used: number; limit: number };
      };
      if (Array.isArray(data.messages)) setMessages(data.messages);
      if (data.daily) setDaily(data.daily);
    } catch {
      // silent
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function pickIdentity(u: User) {
    writeSelfId(u.id);
    setSelf(u);
    requestNotificationPermission().then(async (perm) => {
      setNotifPermission(perm);
      if (perm === "granted") {
        await ensurePushSubscription(u.id);
      }
    });
  }

  function switchIdentity() {
    clearSelfId();
    setSelf(null);
  }

  async function doInstall() {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        await installPrompt.userChoice;
      } catch {
        // ignore
      }
      setInstallPrompt(null);
    } else if (iosInstall) {
      setShowIosGuide(true);
    }
  }

  function dismissInstall() {
    localStorage.setItem("halviinim:installDismissed", "1");
    setInstallDismissed(true);
  }

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === "granted" && self) {
      await ensurePushSubscription(self.id);
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-smoke-950 grid place-items-center text-smoke-300">
        טוען...
      </div>
    );
  }

  if (!self) {
    return <IdentityPicker onPick={pickIdentity} />;
  }

  const imagining = messages.some((m) => m.image?.status === "pending");

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <SmokeBackdrop />

      <header className="relative z-10 px-4 sm:px-8 py-4 flex items-center gap-3 border-b border-smoke-700/40 bg-smoke-950/40 backdrop-blur">
        <div className="w-9 h-9 rounded-full glow-ring flex items-center justify-center bg-smoke-800/70 shrink-0">
          <Satellite className="w-5 h-5 text-smoke-200" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-smoke-100 font-bold text-lg leading-tight">
              הלווינים
            </h1>
            <span className="text-smoke-300 text-[11px] px-2 py-0.5 rounded-full bg-smoke-800/60 border border-smoke-700/60 flex items-center gap-1">
              <Users className="w-3 h-3" />
              חדר ציבורי
            </span>
            <span className="text-smoke-400 text-[11px]">
              ציורים: {daily.used}/{daily.limit}
            </span>
          </div>
          <button
            type="button"
            onClick={switchIdentity}
            className="text-smoke-300/80 text-xs flex items-center gap-1 hover:text-smoke-100 transition truncate mt-0.5"
          >
            <span className="truncate">אתה: {self.display}</span>
            <Edit3 className="w-3 h-3 shrink-0" />
          </button>
        </div>
        {notifPermission !== "granted" && notifPermission !== "unsupported" && (
          <button
            type="button"
            onClick={enableNotifications}
            className="shrink-0 p-2 rounded-full bg-smoke-800/60 border border-smoke-700/60 text-smoke-200 hover:bg-smoke-700/70 transition"
            title="הפעל התראות"
            aria-label="הפעל התראות"
          >
            <BellOff className="w-4 h-4" />
          </button>
        )}
        {notifPermission === "granted" && (
          <div
            className="shrink-0 p-2 rounded-full bg-emerald-900/60 border border-emerald-600/40 text-emerald-200"
            title="התראות פעילות"
          >
            <Bell className="w-4 h-4" />
          </div>
        )}
      </header>

      {imagining && (
        <div className="relative z-10 px-4 py-2.5 flex items-center justify-center gap-2 bg-emerald-900/80 backdrop-blur-md border-b border-emerald-600/40 text-emerald-100">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-medium">
            המסטולון מצייר... רגע אחי 🟢
          </span>
          <span className="dot-typing" />
          <span className="dot-typing" />
          <span className="dot-typing" />
        </div>
      )}

      {!installed &&
        !installDismissed &&
        (installPrompt || iosInstall) && (
          <div className="relative z-10 px-3 py-2 flex items-center gap-2 bg-smoke-800/90 backdrop-blur border-b border-smoke-700/60 text-smoke-100">
            <Download className="w-4 h-4 shrink-0 text-emerald-300" />
            <span className="flex-1 text-xs">
              התקן את הלווינים לקבלת התראות גם כשהאפליקציה סגורה
            </span>
            <button
              type="button"
              onClick={doInstall}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium"
            >
              התקן
            </button>
            <button
              type="button"
              onClick={dismissInstall}
              className="p-1.5 rounded-md text-smoke-300/80 hover:text-smoke-100"
              aria-label="סגור"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      {showIosGuide && (
        <IosInstallGuide onClose={() => setShowIosGuide(false)} />
      )}

      <main className="relative z-10 max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-32">
        <div
          ref={scrollRef}
          className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1"
        >
          {messages.length === 0 ? (
            <div className="text-center text-smoke-300/70 text-sm py-12 px-6">
              עדיין שקט פה. תכתוב משהו, או לחץ על ✨ כדי לצייר.
              <br />
              תייג עם @ + שם כדי להתריע למישהו.
            </div>
          ) : (
            messages.map((m) => (
              <Bubble key={m.id} msg={m} myUserId={self.id} />
            ))
          )}
        </div>
      </main>

      {imagineOpen && (
        <ImaginePanel
          onClose={() => setImagineOpen(false)}
          onSubmit={(p, f) => {
            setImagineOpen(false);
            void imagine(p, f);
          }}
        />
      )}

      <Composer
        input={input}
        setInput={setInput}
        onKeyDown={onKeyDown}
        onSend={() => void send(input)}
        onImagine={() => setImagineOpen(true)}
        disabled={sending}
        inputRef={inputRef}
      />
    </div>
  );
}

async function ensurePushSubscription(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const vapidRes = await fetch("/api/push/vapid");
      if (!vapidRes.ok) return;
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) return;
      const applicationServerKey = b64urlToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        subscription: sub.toJSON(),
      }),
    });
  } catch {
    // silent — fall back to in-tab notifications
  }
}

function b64urlToUint8Array(s: string): Uint8Array {
  const pad = s.length % 4;
  const padded = pad ? s + "=".repeat(4 - pad) : s;
  const std = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

function showMentionNotification(msg: RoomMsg, self: User) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const author = msg.author?.name ?? "מישהו";
  const title = `${author} תייג אותך`;
  const body = (msg.text ?? "").slice(0, 140);
  try {
    new Notification(title, {
      body,
      icon: "/icon",
      tag: `mention-${self.id}-${msg.id}`,
      lang: "he",
      dir: "rtl",
    });
  } catch {
    // some browsers throw if not in a user gesture
  }
}

async function pollGeneration(id: string): Promise<string> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(i === 0 ? 2500 : 2000);
    const res = await fetch(`/api/imagine/${encodeURIComponent(id)}`);
    if (!res.ok) continue;
    const data = (await res.json()) as { status?: string; imageUrl?: string };
    if (data.status === "COMPLETE" && data.imageUrl) return data.imageUrl;
    if (data.status === "FAILED") throw new Error("generation_failed");
  }
  throw new Error("timeout");
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function IosInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-smoke-950/80 backdrop-blur-sm grid place-items-center px-4">
      <div className="w-full max-w-sm bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-5 shadow-2xl glow-ring">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-5 h-5 text-emerald-300" />
          <h2 className="text-smoke-100 font-semibold flex-1">
            התקנה באייפון
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ol className="text-smoke-200 text-sm space-y-3 mt-2">
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 grid place-items-center text-xs font-bold">
              1
            </span>
            <span>
              לחץ על כפתור{" "}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-smoke-800/70 text-smoke-100">
                <Share className="w-3 h-3" /> שתף
              </span>{" "}
              בסרגל התחתון של ספארי
            </span>
          </li>
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 grid place-items-center text-xs font-bold">
              2
            </span>
            <span>גלול ברשימה ובחר &quot;Add to Home Screen&quot;</span>
          </li>
          <li className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 grid place-items-center text-xs font-bold">
              3
            </span>
            <span>לחץ &quot;Add&quot; בפינה</span>
          </li>
        </ol>
        <p className="text-[11px] text-smoke-400/80 mt-4">
          חייב להיות בספארי (לא בכרום או באפליקציה אחרת) כדי שזה יעבוד באייפון.
        </p>
      </div>
    </div>
  );
}

function IdentityPicker({ onPick }: { onPick: (u: User) => void }) {
  return (
    <div className="min-h-screen bg-smoke-950 grid place-items-center px-4 py-8 relative overflow-hidden">
      <SmokeBackdrop />
      <div className="relative z-10 w-full max-w-md bg-smoke-900/90 border border-smoke-700/60 rounded-2xl p-6 shadow-2xl glow-ring">
        <div className="flex items-center gap-2 mb-5">
          <Satellite className="w-6 h-6 text-smoke-200" />
          <h1 className="text-smoke-100 font-bold text-xl">הלווינים</h1>
        </div>
        <p className="text-smoke-300 text-sm mb-4">מי אתה?</p>
        <div className="grid grid-cols-2 gap-2">
          {USERS.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onPick(u)}
              className="px-4 py-3 rounded-xl bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-100 font-medium transition active:scale-[0.98]"
            >
              {u.display}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-smoke-400/70 mt-5 text-center">
          לחיצה על שם תבקש הרשאת התראות. תוכל להחליף שם מאוחר יותר.
        </p>
      </div>
    </div>
  );
}

function Bubble({ msg, myUserId }: { msg: RoomMsg; myUserId: string }) {
  const isMe = msg.author?.id === myUserId;
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
      <div
        className={[
          "max-w-[82%] sm:max-w-[70%] px-4 py-3 rounded-2xl shadow-lg leading-relaxed text-[15px]",
          isMe ? "bubble-me rounded-bl-sm" : "bubble-bot rounded-br-sm",
        ].join(" ")}
      >
        {isUser && msg.author && !isMe && (
          <div className="text-[11px] text-smoke-100/90 font-semibold mb-1">
            {msg.author.name}
          </div>
        )}

        {msg.role === "bot" && msg.mood && !msg.image && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-smoke-400 animate-pulse" />
            <span>מצב רוח: {MOOD_LABEL[msg.mood]}</span>
          </div>
        )}

        {msg.image?.status === "pending" && (
          <div className="text-[11px] text-smoke-300 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>nano banana pro · רץ</span>
          </div>
        )}

        {msg.image?.status === "ready" && msg.image.url && (
          <a
            href={msg.image.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl overflow-hidden border border-smoke-700/40 mb-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.image.url}
              alt={msg.image.prompt ?? "imagine"}
              className="w-full h-auto"
              loading="lazy"
            />
          </a>
        )}

        {msg.image?.prompt && msg.image.status === "ready" && (
          <div className="text-[12px] text-smoke-300/80 mb-1">
            “{msg.image.prompt}”
          </div>
        )}

        {msg.text && (
          <div className="whitespace-pre-wrap">{renderMentions(msg.text)}</div>
        )}
      </div>
    </div>
  );
}

function renderMentions(text: string): React.ReactNode {
  const mentioned = findMentions(text);
  if (mentioned.length === 0) return text;
  // Highlight all @<handle> tokens
  const parts: React.ReactNode[] = [];
  const allHandles = USERS.flatMap((u) => u.handles).sort(
    (a, b) => b.length - a.length,
  );
  let cursor = 0;
  let i = 0;
  while ((i = text.indexOf("@", cursor)) !== -1) {
    let bestHandle = "";
    for (const h of allHandles) {
      if (
        text.startsWith("@" + h, i) &&
        h.length > bestHandle.length
      ) {
        bestHandle = h;
      }
    }
    if (bestHandle) {
      if (i > cursor) parts.push(text.slice(cursor, i));
      parts.push(
        <span
          key={`m-${i}`}
          className="text-emerald-300 font-semibold bg-emerald-900/30 rounded px-1"
        >
          {"@" + bestHandle}
        </span>,
      );
      cursor = i + 1 + bestHandle.length;
      i = cursor;
    } else {
      i += 1;
    }
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function ImaginePanel({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (prompt: string, ref: File | null) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = file ? URL.createObjectURL(file) : null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="fixed inset-0 z-30 bg-smoke-950/70 backdrop-blur-sm grid place-items-end sm:place-items-center px-3 sm:px-0">
      <div className="w-full sm:max-w-md bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-4 shadow-2xl glow-ring">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-smoke-200" />
          <h2 className="text-smoke-100 font-semibold flex-1">תצייר לחדר</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="לדוגמה: ערן יושב על ספה ירוקה ובוכה לתוך בונג ריק"
          className="w-full input-glow resize-none rounded-xl bg-smoke-950/80 border border-smoke-700/60 px-3 py-2.5 text-smoke-100 placeholder:text-smoke-300/50 text-sm"
          dir="rtl"
        />

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-full bg-smoke-800/60 hover:bg-smoke-700/70 border border-smoke-700/60 text-smoke-200 flex items-center gap-1.5 transition"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {file ? "החלף תמונה" : "תמונת התייחסות (לא חובה)"}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-smoke-300/80 hover:text-smoke-100"
            >
              הסר
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
          />
        </div>

        {previewUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-smoke-700/60 max-h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="preview"
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (submitting || !prompt.trim()) return;
            setSubmitting(true);
            onSubmit(prompt, file);
          }}
          disabled={submitting || !prompt.trim()}
          className="mt-4 w-full h-11 rounded-xl bg-gradient-to-br from-smoke-400 to-smoke-600 text-white font-medium disabled:opacity-60 transition active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="dot-typing" />
              <span className="dot-typing" />
              <span className="dot-typing" />
              <span className="ms-2">שולח לציור...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              תצייר ושתף לחדר
            </>
          )}
        </button>

        <p className="text-[10px] text-smoke-400/70 mt-3 text-center">
          nano banana pro · בערך 10–25 שניות · גלוי לכולם בחדר
        </p>
      </div>
    </div>
  );
}

function Composer({
  input,
  setInput,
  onKeyDown,
  onSend,
  onImagine,
  disabled,
  inputRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onImagine: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [anchor, setAnchor] = useState<{
    start: number;
    query: string;
  } | null>(null);

  function recompute(value: string, cursor: number) {
    const window = value.slice(Math.max(0, cursor - 20), cursor);
    const lastAt = window.lastIndexOf("@");
    if (lastAt < 0) {
      setAnchor(null);
      return;
    }
    const start = cursor - window.length + lastAt;
    const query = value.slice(start + 1, cursor);
    if (/[\n,]/.test(query)) {
      setAnchor(null);
      return;
    }
    setAnchor({ start, query });
  }

  function pickMention(u: User) {
    if (!anchor) return;
    const handle = u.handles[0];
    const before = input.slice(0, anchor.start);
    const after = input.slice(anchor.start + 1 + anchor.query.length);
    const next = before + "@" + handle + " " + after;
    setInput(next);
    setAnchor(null);
    const caret = before.length + 1 + handle.length + 1;
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    }, 0);
  }

  const matches = anchor ? matchUsersForMention(anchor.query) : [];
  const showDropdown = anchor !== null && matches.length > 0;

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-smoke-700/40 bg-smoke-950/80 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 relative">
        {showDropdown && (
          <div className="absolute bottom-full inset-x-3 sm:inset-x-6 mb-2 bg-smoke-900/95 border border-smoke-700/60 rounded-xl shadow-2xl overflow-hidden glow-ring max-h-64 overflow-y-auto">
            {matches.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(u)}
                className="w-full text-right px-4 py-2.5 hover:bg-smoke-800/70 text-smoke-100 text-sm flex items-center justify-between gap-3 border-b border-smoke-800/50 last:border-b-0"
              >
                <span className="text-smoke-300/70 text-xs">{u.display}</span>
                <span>
                  <span className="text-emerald-300 font-semibold">@</span>
                  {u.handles[0]}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={onImagine}
            className="h-12 w-12 shrink-0 rounded-full bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-200 grid place-items-center transition active:scale-95"
            aria-label="תצייר"
            title="תצייר לחדר"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              recompute(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={(e) => {
              if (showDropdown && (e.key === "Escape" || e.key === "Tab")) {
                e.preventDefault();
                setAnchor(null);
                return;
              }
              if (showDropdown && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                pickMention(matches[0]);
                return;
              }
              onKeyDown(e);
            }}
            onSelect={(e) =>
              recompute(e.currentTarget.value, e.currentTarget.selectionStart)
            }
            onClick={(e) =>
              recompute(e.currentTarget.value, e.currentTarget.selectionStart)
            }
            onBlur={() => setTimeout(() => setAnchor(null), 150)}
            rows={1}
            placeholder="כתוב לחדר... תייג עם @ + שם"
            className="flex-1 input-glow resize-none rounded-2xl bg-smoke-900/70 border border-smoke-700/60 px-4 py-3 text-smoke-100 placeholder:text-smoke-300/50 max-h-40"
            dir="rtl"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !input.trim()}
            className="h-12 w-12 rounded-full bg-gradient-to-br from-smoke-400 to-smoke-600 text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed glow-ring transition active:scale-95"
            aria-label="שלח"
          >
            <Send className="w-5 h-5 -scale-x-100" />
          </button>
        </div>
        <p className="text-center text-[10px] text-smoke-400/70 mt-2">
          הלווינים · החדר של החבר'ה
        </p>
      </div>
    </div>
  );
}

function matchUsersForMention(query: string): User[] {
  const q = query.trim();
  if (!q) return [...USERS];
  const lower = q.toLowerCase();
  const seen = new Set<string>();
  const out: User[] = [];
  for (const u of USERS) {
    if (seen.has(u.id)) continue;
    const hit =
      u.display.toLowerCase().startsWith(lower) ||
      u.handles.some((h) => h.toLowerCase().startsWith(lower));
    if (hit) {
      seen.add(u.id);
      out.push(u);
    }
  }
  return out;
}

function SmokeBackdrop() {
  const puffs = Array.from({ length: 8 });
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {puffs.map((_, i) => (
        <div
          key={i}
          className="smoke-puff animate-drift"
          style={{
            left: `${(i * 13 + 5) % 100}%`,
            animationDelay: `${i * 1.2}s`,
            animationDuration: `${8 + (i % 4)}s`,
            transform: `scale(${0.6 + ((i * 17) % 10) / 12})`,
          }}
        />
      ))}
    </div>
  );
}
