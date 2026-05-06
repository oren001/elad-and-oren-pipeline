"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  Share2,
  Reply,
  SmilePlus,
  Paperclip,
  Mic,
  Square,
  Trash2,
  Pencil,
  Play,
  Pause,
  Palette,
  Search,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { USERS, getUserById, findMentions, type User } from "@/lib/users";
import {
  THEMES,
  applyTheme,
  readStoredTheme,
  writeStoredTheme,
  type Theme,
} from "@/lib/themes";

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

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> & { length: number } & { [index: number]: ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type ReplyTo = { id: string; authorName: string; snippet: string };

type RoomMsg = {
  id: string;
  ts: number;
  author?: { id: string; name: string };
  role: "user" | "bot" | "system";
  text?: string;
  mood?: Mood;
  image?: ImageState;
  reactions?: Record<string, string[]>;
  replyTo?: ReplyTo;
  uploaded?: boolean;
  voice?: { url: string; duration: number; transcript?: string };
  editedAt?: number;
  deleted?: boolean;
};

const REACTION_EMOJIS = ["❤️", "🔥", "💀", "😂", "🤔", "🟢", "👍", "🙄"];

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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTo | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, { url: string; hasRef: boolean }>>({});
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const profileFileRef = useRef<HTMLInputElement | null>(null);
  const [profileUploading, setProfileUploading] = useState(false);
  const [profileCropFile, setProfileCropFile] = useState<File | null>(null);
  const [profileTargetUserId, setProfileTargetUserId] = useState<string | null>(
    null,
  );
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lightbox, setLightbox] = useState<{
    images: { url: string; prompt?: string; ts: number; author?: string }[];
    index: number;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStartRef = useRef<number>(0);
  const recorderTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelLoopRef = useRef<{ stop: () => void } | null>(null);
  const recognitionRef = useRef<{
    instance: SpeechRecognitionLike | null;
    finalText: string;
  } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollTopRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const isVisibleRef = useRef(
    typeof document === "undefined" ? true : !document.hidden,
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);
  const scrolledToTargetRef = useRef(false);
  const pollingPendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = readSelfId();
    if (id) {
      const u = getUserById(id);
      if (u) {
        setSelf(u);
        fireSystemEvent(u.id);
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

    const storedTheme = readStoredTheme();
    if (storedTheme) {
      setThemeId(storedTheme);
      applyTheme(storedTheme);
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
          presence?: Record<string, number>;
        };
        if (cancelled) return;
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.daily) setDaily(data.daily);
        if (data.presence) setPresence(data.presence);
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

  useEffect(() => {
    let cancelled = false;
    const fetchProfiles = async () => {
      try {
        const res = await fetch("/api/user/profiles", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          profiles?: Record<string, { url: string; hasRef: boolean }>;
        };
        if (cancelled) return;
        if (data.profiles) setProfiles(data.profiles);
      } catch {
        // silent
      }
    };
    fetchProfiles();
    const id = setInterval(fetchProfiles, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function uploadProfile(
    blob: Blob,
    mime = "image/jpeg",
    forUserId?: string,
  ) {
    const targetId = forUserId ?? self?.id;
    if (!targetId) return;
    if (profileUploading) return;
    setProfileUploading(true);
    try {
      const fd = new FormData();
      fd.append("userId", targetId);
      fd.append("file", new File([blob], "profile.jpg", { type: mime }));
      const res = await fetch("/api/user/profile", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        photoUrl?: string;
        leonardoLinked?: boolean;
      };
      if (data.ok && data.photoUrl) {
        setProfiles((prev) => ({
          ...prev,
          [targetId]: {
            url: data.photoUrl + "?t=" + Date.now(),
            hasRef: Boolean(data.leonardoLinked),
          },
        }));
      }
    } finally {
      setProfileUploading(false);
      if (profileFileRef.current) profileFileRef.current.value = "";
    }
  }

  useEffect(() => {
    if (!self) return;
    let cancelled = false;
    const send = () => {
      fetch("/api/room/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: self.id }),
      }).catch(() => {});
    };
    send();
    const id = setInterval(() => {
      if (!cancelled) send();
    }, 25000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [self]);

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

  // Resilience: if any pending image bubble is in the feed, poll Leonardo
  // for it and finalize. Multiple clients may do this; finalize is idempotent.
  useEffect(() => {
    for (const m of messages) {
      const genId = m.image?.generationId;
      if (
        m.image?.status === "pending" &&
        genId &&
        !pollingPendingRef.current.has(genId)
      ) {
        pollingPendingRef.current.add(genId);
        const msgId = m.id;
        void (async () => {
          try {
            const url = await pollGeneration(genId);
            await fetch("/api/room/imagine/finalize", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ msgId, imageUrl: url }),
            });
          } catch (err) {
            const detail = err instanceof Error ? err.message : "unknown";
            await fetch("/api/room/imagine/finalize", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ msgId, error: detail }),
            });
          } finally {
            pollingPendingRef.current.delete(genId);
            void refresh();
          }
        })();
      }
    }
  }, [messages]);

  // Deep-link: scroll to ?msg=<id> after messages load
  useEffect(() => {
    if (scrolledToTargetRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("msg");
    if (!target) return;
    if (messages.length === 0) return;
    const exists = messages.some((m) => m.id === target);
    if (!exists) return;
    scrolledToTargetRef.current = true;
    setHighlightId(target);
    setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${cssEscape(target)}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    setTimeout(() => setHighlightId(null), 4000);
    window.history.replaceState(null, "", window.location.pathname);
  }, [messages]);

  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const grew = messages.length > lastMsgCountRef.current;
    if (grew) {
      const newOnes = messages.length - lastMsgCountRef.current;
      if (isAtBottomRef.current) {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        setShowJumpToBottom(true);
        setUnreadCount((c) => c + newOnes);
      }
      if (!isVisibleRef.current) {
        setUnreadCount((c) => c + newOnes);
      }
    }
    lastMsgCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = dist < 80;
      isAtBottomRef.current = atBottom;
      if (atBottom) {
        setShowJumpToBottom(false);
        setUnreadCount(0);
      }
      const cur = el.scrollTop;
      const delta = cur - lastScrollTopRef.current;
      if (Math.abs(delta) > 6) {
        if (delta > 0 && cur > 80) {
          setHideHeader(true);
        } else if (delta < 0) {
          setHideHeader(false);
        }
        lastScrollTopRef.current = cur;
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function onVis() {
      isVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        setUnreadCount(0);
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = unreadCount > 0 ? `(${unreadCount}) הלווינים` : "הלווינים";
  }, [unreadCount]);

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
          replyTo: replyTarget,
        }),
      });
      const data = (await res.json()) as {
        messages?: RoomMsg[];
        autoImage?: { msgId: string; generationId: string } | null;
      };
      if (Array.isArray(data.messages)) setMessages(data.messages);
      setReplyTarget(null);
      if (data.autoImage) {
        const { msgId, generationId } = data.autoImage;
        void (async () => {
          try {
            const url = await pollGeneration(generationId);
            await fetch("/api/room/imagine/finalize", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ msgId, imageUrl: url }),
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
        })();
      }
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

  async function react(msgId: string, emoji: string) {
    if (!self) return;
    setReactionPickerFor(null);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const r = { ...(m.reactions ?? {}) };
        const cur = r[emoji] ?? [];
        if (cur.includes(self.id)) {
          const next = cur.filter((u) => u !== self.id);
          if (next.length === 0) delete r[emoji];
          else r[emoji] = next;
        } else {
          r[emoji] = [...cur, self.id];
        }
        return { ...m, reactions: Object.keys(r).length ? r : undefined };
      }),
    );
    try {
      await fetch("/api/room/react", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, userId: self.id, emoji }),
      });
    } catch {
      // optimistic; next poll will resync
    }
  }

  function openLightbox(msgId: string) {
    const imagesAll = messages
      .filter((m) => m.image?.status === "ready" && m.image.url)
      .map((m) => ({
        id: m.id,
        url: m.image!.url!,
        prompt: m.image!.prompt,
        ts: m.ts,
        author: m.author?.name,
      }));
    const idx = imagesAll.findIndex((i) => i.id === msgId);
    if (idx < 0) return;
    setLightbox({
      images: imagesAll.map(({ url, prompt, ts, author }) => ({
        url,
        prompt,
        ts,
        author,
      })),
      index: idx,
    });
  }

  function startEdit(msg: RoomMsg) {
    if (!msg.text) return;
    setEditingId(msg.id);
    setInput(msg.text);
    setReplyTarget(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setInput("");
  }

  async function commitEdit() {
    if (!self || !editingId) return;
    const text = input.trim();
    if (!text) return;
    const msgId = editingId;
    setEditingId(null);
    setInput("");
    try {
      const res = await fetch("/api/room/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId, userId: self.id, text }),
      });
      const data = (await res.json()) as { messages?: RoomMsg[] };
      if (Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      // silent
    }
  }

  async function deleteMsg(msg: RoomMsg) {
    if (!self) return;
    if (!confirm("למחוק את ההודעה?")) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id
          ? { ...m, deleted: true, text: undefined, image: undefined, voice: undefined }
          : m,
      ),
    );
    try {
      await fetch("/api/room/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msgId: msg.id, userId: self.id }),
      });
    } catch {
      // optimistic; next poll resyncs
    }
  }

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const duration = Date.now() - recorderStartRef.current;
        const transcript = (recognitionRef.current?.finalText ?? "").trim();
        recognitionRef.current = null;
        setLiveTranscript("");
        await uploadVoice(blob, duration, transcript);
      };
      recorder.start();
      recorderRef.current = recorder;
      recorderStartRef.current = Date.now();
      setRecording(true);
      setRecordSeconds(0);
      setAudioLevel(0);

      // Live transcription via Web Speech API (Hebrew first)
      try {
        const SR =
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .webkitSpeechRecognition;
        if (SR) {
          const r: SpeechRecognitionLike = new SR();
          r.lang = "he-IL";
          r.continuous = true;
          r.interimResults = true;
          recognitionRef.current = { instance: r, finalText: "" };
          setLiveTranscript("");
          r.onresult = (e) => {
            let interim = "";
            let final = recognitionRef.current?.finalText ?? "";
            for (let i = 0; i < e.results.length; i++) {
              const res = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
              const piece = res[0]!.transcript;
              if (res.isFinal) final += piece;
              else interim += piece;
            }
            if (recognitionRef.current) recognitionRef.current.finalText = final;
            setLiveTranscript((final + interim).trim());
          };
          r.onerror = () => {};
          r.onend = () => {};
          try {
            r.start();
          } catch {
            // some browsers throw if start called while not idle
          }
        }
      } catch {
        // transcription failure is non-blocking
      }

      try {
        const Ctor =
          typeof window !== "undefined"
            ? window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext
            : null;
        if (Ctor) {
          const audioCtx = new Ctor();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          audioCtxRef.current = audioCtx;
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          let cancelled = false;
          const tick = () => {
            if (cancelled) return;
            analyser.getByteFrequencyData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) sum += buffer[i] ?? 0;
            const avg = sum / buffer.length / 255;
            setAudioLevel(avg);
            requestAnimationFrame(tick);
          };
          tick();
          levelLoopRef.current = {
            stop: () => {
              cancelled = true;
            },
          };
        }
      } catch {
        // analyser failure isn't critical
      }

      recorderTickRef.current = setInterval(() => {
        setRecordSeconds(
          Math.floor((Date.now() - recorderStartRef.current) / 1000),
        );
      }, 250);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "אין הרשאת מיקרופון"
          : "מיקרופון לא זמין";
      alert(msg);
    }
  }

  function teardownRecording() {
    if (recorderTickRef.current) {
      clearInterval(recorderTickRef.current);
      recorderTickRef.current = null;
    }
    if (levelLoopRef.current) {
      levelLoopRef.current.stop();
      levelLoopRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recognitionRef.current?.instance) {
      try {
        recognitionRef.current.instance.stop();
      } catch {
        // ignore
      }
    }
    setAudioLevel(0);
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (!r) return;
    teardownRecording();
    setRecording(false);
    if (r.state !== "inactive") r.stop();
    recorderRef.current = null;
  }

  function cancelRecording() {
    const r = recorderRef.current;
    if (r) {
      r.ondataavailable = null;
      r.onstop = () => {};
      if (r.state !== "inactive") r.stop();
      r.stream?.getTracks().forEach((t) => t.stop());
    }
    teardownRecording();
    setRecording(false);
    recorderRef.current = null;
  }

  async function uploadVoice(blob: Blob, durationMs: number, transcript = "") {
    if (!self) return;
    const fd = new FormData();
    const ext = (blob.type.split("/")[1] ?? "webm").split(";")[0];
    fd.append("file", blob, `voice.${ext}`);
    fd.append("authorId", self.id);
    fd.append("authorName", self.display);
    fd.append("duration", String(durationMs));
    if (transcript) fd.append("transcript", transcript);
    if (replyTarget) fd.append("replyTo", JSON.stringify(replyTarget));
    try {
      const res = await fetch("/api/room/voice", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { messages?: RoomMsg[] };
      if (Array.isArray(data.messages)) setMessages(data.messages);
      setReplyTarget(null);
    } catch {
      // silent
    }
  }

  function startReply(msg: RoomMsg) {
    if (!msg.author && msg.role !== "bot") return;
    const snippet =
      (msg.image?.prompt && `🎨 ${msg.image.prompt}`) ||
      (msg.text ?? "תמונה");
    setReplyTarget({
      id: msg.id,
      authorName: msg.author?.name ?? "המסטולון",
      snippet: snippet.slice(0, 140),
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function uploadPhoto(file: File) {
    if (!self) return;
    if (uploading) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("authorId", self.id);
    fd.append("authorName", self.display);
    if (input.trim()) fd.append("caption", input.trim());
    if (replyTarget) fd.append("replyTo", JSON.stringify(replyTarget));
    try {
      const res = await fetch("/api/room/photo", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { messages?: RoomMsg[] };
      if (Array.isArray(data.messages)) setMessages(data.messages);
      setInput("");
      setReplyTarget(null);
    } catch {
      // silent
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
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
      if (editingId) void commitEdit();
      else void send(input);
    }
    if (e.key === "Escape" && editingId) {
      e.preventDefault();
      cancelEdit();
    }
  }

  function pickIdentity(u: User) {
    writeSelfId(u.id);
    setSelf(u);
    fireSystemEvent(u.id);
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

  if (!themeId) {
    return (
      <ThemePicker
        onPick={(id) => {
          writeStoredTheme(id);
          applyTheme(id);
          setThemeId(id);
          setThemePickerOpen(false);
        }}
        showSkip
      />
    );
  }

  const imagining = messages.some((m) => m.image?.status === "pending");

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <SmokeBackdrop />

      <header
        className={`relative z-20 px-4 sm:px-8 py-4 flex items-center gap-3 border-b border-smoke-700/40 bg-smoke-950/40 backdrop-blur transition-transform duration-200 ease-out ${
          hideHeader ? "-translate-y-full" : "translate-y-0"
        }`}
      >
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
              ציורים: {daily.used}/{daily.limit} · הודעות: {messages.length}
            </span>
            <OnlineIndicator presence={presence} selfId={self.id} />
            <BuildBadge />
          </div>
          <div className="text-smoke-300/80 text-xs flex items-center gap-2 mt-0.5">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-smoke-800/70 border border-smoke-700/60 grid place-items-center hover:border-emerald-400/60 transition"
              aria-label="עדכן תמונת פרופיל"
              title="עדכן תמונת פרופיל"
            >
              {profiles[self.id]?.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profiles[self.id]!.url}
                  alt={self.display}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-smoke-200">
                  {self.display.slice(0, 1)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={switchIdentity}
              className="flex items-center gap-1 hover:text-smoke-100 transition truncate"
            >
              <span className="truncate">אתה: {self.display}</span>
              <Edit3 className="w-3 h-3 shrink-0" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="shrink-0 p-2 rounded-full bg-smoke-800/60 border border-smoke-700/60 text-smoke-200 hover:bg-smoke-700/70 transition"
          title="חיפוש"
          aria-label="חיפוש"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setThemePickerOpen(true)}
          className="shrink-0 p-2 rounded-full bg-smoke-800/60 border border-smoke-700/60 text-smoke-200 hover:bg-smoke-700/70 transition"
          title="ערכת צבעים"
          aria-label="ערכת צבעים"
        >
          <Palette className="w-4 h-4" />
        </button>
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
            messages.map((m, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const showSeparator = !prev || !isSameDay(prev.ts, m.ts);
              const node =
                m.role === "system" ? (
                  <SystemBubble key={m.id} msg={m} />
                ) : (
                  <Bubble
                    key={m.id}
                    msg={m}
                    myUserId={self.id}
                    profiles={profiles}
                    highlight={highlightId === m.id}
                    onReact={(emoji) => react(m.id, emoji)}
                    onReply={() => startReply(m)}
                    onEdit={() => startEdit(m)}
                    onDelete={() => deleteMsg(m)}
                    pickerOpen={reactionPickerFor === m.id}
                    onTogglePicker={() =>
                      setReactionPickerFor((cur) =>
                        cur === m.id ? null : m.id,
                      )
                    }
                    onOpenImage={() => openLightbox(m.id)}
                    onJumpTo={(id) => {
                      const el = document.querySelector(
                        `[data-msg-id="${cssEscape(id)}"]`,
                      );
                      if (el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        setHighlightId(id);
                        setTimeout(() => setHighlightId(null), 2500);
                      }
                    }}
                  />
                );
              if (showSeparator) {
                return (
                  <Fragment key={`sep-${m.id}`}>
                    <DateSeparator ts={m.ts} />
                    {node}
                  </Fragment>
                );
              }
              return node;
            })
          )}
        </div>
      </main>

      {showJumpToBottom && (
        <button
          type="button"
          onClick={() => {
            const el = scrollRef.current;
            if (el)
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setShowJumpToBottom(false);
            setUnreadCount(0);
          }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 bg-emerald-700/90 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-full shadow-2xl border border-emerald-400/40 flex items-center gap-2 active:scale-95 transition"
        >
          <span>↓ {unreadCount > 0 ? `${unreadCount} חדש` : "לסוף"}</span>
        </button>
      )}

      {themePickerOpen && (
        <ThemePicker
          currentId={themeId}
          onPick={(id) => {
            writeStoredTheme(id);
            applyTheme(id);
            setThemeId(id);
            setThemePickerOpen(false);
          }}
          onClose={() => setThemePickerOpen(false)}
        />
      )}

      {searchOpen && (
        <SearchPanel
          query={searchQuery}
          setQuery={setSearchQuery}
          messages={messages}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          onJump={(id) => {
            setSearchOpen(false);
            setSearchQuery("");
            setTimeout(() => {
              const el = document.querySelector(
                `[data-msg-id="${cssEscape(id)}"]`,
              );
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                setHighlightId(id);
                setTimeout(() => setHighlightId(null), 2500);
              }
            }, 50);
          }}
        />
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndex={(i) =>
            setLightbox(
              lightbox ? { ...lightbox, index: i } : null,
            )
          }
        />
      )}

      {profileCropFile && (
        <FaceCrop
          file={profileCropFile}
          onCancel={() => {
            setProfileCropFile(null);
            setProfileTargetUserId(null);
          }}
          onCrop={async (blob) => {
            const target = profileTargetUserId ?? self?.id ?? null;
            setProfileCropFile(null);
            setProfileTargetUserId(null);
            if (target) await uploadProfile(blob, "image/jpeg", target);
          }}
        />
      )}

      {profileModalOpen && self && (
        <div className="fixed inset-0 z-30 bg-smoke-950/75 backdrop-blur-sm grid place-items-center px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-5 shadow-2xl glow-ring">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-smoke-100 font-semibold flex-1">
                תמונות פרופיל
              </h2>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-smoke-300 mb-4">
              לחץ על מישהו כדי להעלות לו תמונה. אחרי שמעלים — חותכים את הפנים
              והתמונה גם משמשת כהתייחסות בציורים שהמסטולון יוצר.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {USERS.map((u) => {
                const p = profiles[u.id];
                const isMe = u.id === self.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setProfileTargetUserId(u.id);
                      profileFileRef.current?.click();
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-smoke-800/50 hover:bg-smoke-800/80 border border-smoke-700/60 transition active:scale-[0.99]"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-smoke-800/70 border border-smoke-700/60 grid place-items-center shrink-0">
                      {p?.url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.url}
                          alt={u.display}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg text-smoke-300">
                          {u.display.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <div className="text-smoke-100 font-semibold text-sm flex items-center gap-2 justify-end">
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-700/70 text-emerald-50">
                            אתה
                          </span>
                        )}
                        <span>{u.display}</span>
                      </div>
                      <div className="text-[11px] text-smoke-400 mt-0.5">
                        {p ? "החלף תמונה" : "אין תמונה — העלה"}
                      </div>
                    </div>
                    <ImageIcon className="w-4 h-4 text-smoke-300 shrink-0" />
                  </button>
                );
              })}
            </div>
            <input
              ref={profileFileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setProfileCropFile(f);
              }}
            />
            <p className="text-[10px] text-smoke-400/70 mt-4 text-center">
              עד 4MB · jpeg/png/webp · חיתוך פנים אחרי הבחירה
            </p>
            {profileUploading && (
              <div className="mt-3 text-center text-emerald-300 text-sm flex items-center justify-center gap-2">
                <span className="dot-typing" />
                <span className="dot-typing" />
                <span className="dot-typing" />
                <span className="ms-2">מעלה...</span>
              </div>
            )}
          </div>
        </div>
      )}

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
        onSend={() => (editingId ? void commitEdit() : void send(input))}
        onImagine={() => setImagineOpen(true)}
        disabled={sending || uploading || recording}
        inputRef={inputRef}
        photoInputRef={photoInputRef}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        onPhotoPicked={(file) => void uploadPhoto(file)}
        uploading={uploading}
        editing={editingId !== null}
        onCancelEdit={cancelEdit}
        recording={recording}
        recordSeconds={recordSeconds}
        audioLevel={audioLevel}
        liveTranscript={liveTranscript}
        onStartRecord={() => void startRecording()}
        onStopRecord={stopRecording}
        onCancelRecord={cancelRecording}
      />
    </div>
  );
}

function fireSystemEvent(userId: string): void {
  fetch("/api/room/system", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  }).catch(() => {});
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

function SystemBubble({ msg }: { msg: RoomMsg }) {
  return (
    <div className="flex justify-center" data-msg-id={msg.id}>
      <div className="text-[12px] px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-600/40 text-emerald-100/90">
        {msg.text}
      </div>
    </div>
  );
}

function DateSeparator({ ts }: { ts: number }) {
  return (
    <div className="flex justify-center my-2">
      <div className="text-[11px] px-3 py-0.5 rounded-full bg-smoke-800/70 border border-smoke-700/60 text-smoke-300 tracking-wide">
        {formatDateLabel(ts)}
      </div>
    </div>
  );
}

function formatBubbleTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatDateLabel(ts: number): string {
  const now = Date.now();
  if (isSameDay(ts, now)) return "היום";
  const yesterday = now - 24 * 60 * 60 * 1000;
  if (isSameDay(ts, yesterday)) return "אתמול";
  const d = new Date(ts);
  const diffDays = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
  if (diffDays < 7) {
    return d.toLocaleDateString("he-IL", { weekday: "long" });
  }
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

function BuildBadge() {
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;
  const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA;
  const [now, setNow] = useState(() =>
    typeof Date !== "undefined" ? Date.now() : 0,
  );
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!buildTime) return null;
  const d = new Date(buildTime);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <span
      className="text-[11px] opacity-70 tabular-nums"
      title={`build ${buildSha ?? ""} @ ${buildTime}`}
    >
      עודכן {formatRelativeIL(d, now)}
    </span>
  );
}

function formatRelativeIL(d: Date, now: number): string {
  const diffMs = now - d.getTime();
  if (diffMs < 0) return "כרגע";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "כרגע";
  const min = Math.floor(sec / 60);
  if (min < 60) return `לפני ${min} ד׳`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} שע׳`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "אתמול";
  if (day < 7) return `לפני ${day} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function OnlineIndicator({
  presence,
  selfId,
}: {
  presence: Record<string, number>;
  selfId: string;
}) {
  const now = Date.now();
  const ACTIVE_WINDOW_MS = 60_000;
  const activeUsers = USERS.filter((u) => {
    const ts = presence[u.id];
    if (!ts) return false;
    return now - ts < ACTIVE_WINDOW_MS;
  });
  if (activeUsers.length === 0) return null;
  const others = activeUsers.filter((u) => u.id !== selfId);
  return (
    <span
      className="text-emerald-300 text-[11px] flex items-center gap-1"
      title={activeUsers.map((u) => u.display).join(", ")}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {activeUsers.length} מחוברים
      {others.length > 0 && others.length <= 3 && (
        <span className="text-smoke-300/70">
          ({others.map((u) => u.display).join(", ")})
        </span>
      )}
    </span>
  );
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

function ThemePicker({
  currentId,
  onPick,
  onClose,
  showSkip,
}: {
  currentId?: string | null;
  onPick: (id: string) => void;
  onClose?: () => void;
  showSkip?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-smoke-950/85 backdrop-blur-md grid place-items-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-md bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-5 shadow-2xl glow-ring">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-5 h-5 text-emerald-300" />
          <h2 className="text-smoke-100 font-bold text-lg flex-1">
            בחר ערכת צבעים
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
              aria-label="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-smoke-300 text-xs mb-4">
          איזה ויב אתה רוצה לחדר?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={currentId === t.id}
              onPick={() => onPick(t.id)}
            />
          ))}
        </div>
        {showSkip && (
          <button
            type="button"
            onClick={() => onPick(THEMES[0]!.id)}
            className="mt-4 w-full text-xs text-smoke-300 hover:text-smoke-100"
          >
            דלג, השאר ברירת מחדל
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  onPick,
}: {
  theme: Theme;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        "rounded-xl overflow-hidden border transition active:scale-[0.98]",
        selected
          ? "border-emerald-400 ring-2 ring-emerald-400/60"
          : "border-smoke-700/60 hover:border-smoke-500/80",
      ].join(" ")}
    >
      <div
        className="h-20 relative"
        style={{
          background: `linear-gradient(135deg, ${theme.swatch.from}, ${theme.swatch.to})`,
        }}
      >
        <div
          className="absolute bottom-2 right-2 w-6 h-6 rounded-full"
          style={{ background: theme.swatch.accent }}
        />
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white"
          style={{ background: theme.swatch.accent }}
        >
          הדגמה
        </div>
      </div>
      <div className="px-2.5 py-2 bg-smoke-900/70 text-right">
        <div className="text-smoke-100 text-sm font-semibold">{theme.name}</div>
        <div className="text-smoke-400 text-[11px] truncate">{theme.vibe}</div>
      </div>
    </button>
  );
}

function SearchPanel({
  query,
  setQuery,
  messages,
  onClose,
  onJump,
}: {
  query: string;
  setQuery: (v: string) => void;
  messages: RoomMsg[];
  onClose: () => void;
  onJump: (id: string) => void;
}) {
  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? messages.filter((m) => {
        const hay = [
          m.text,
          m.image?.prompt,
          m.author?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(trimmed);
      })
    : [];

  return (
    <div className="fixed inset-0 z-40 bg-smoke-950/80 backdrop-blur-md flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-smoke-700/40">
        <Search className="w-5 h-5 text-smoke-300" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חפש בחדר..."
          className="flex-1 bg-transparent border-0 text-smoke-100 placeholder:text-smoke-300/50 focus:outline-none"
          dir="rtl"
        />
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-smoke-800/60 text-smoke-300"
          aria-label="סגור"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {trimmed === "" ? (
          <div className="text-center text-smoke-400/70 text-sm py-12">
            הקלד מילה כדי לחפש
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-smoke-400/70 text-sm py-12">
            לא נמצא כלום עם &quot;{trimmed}&quot;
          </div>
        ) : (
          results
            .slice()
            .reverse()
            .slice(0, 100)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onJump(m.id)}
                className="w-full text-right p-3 rounded-xl bg-smoke-800/40 hover:bg-smoke-800/70 border border-smoke-700/60 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-300 text-xs font-semibold">
                    {m.author?.name ?? (m.role === "bot" ? "המסטולון" : "")}
                  </span>
                  <span className="text-smoke-400 text-[10px]">
                    {new Date(m.ts).toLocaleString("he-IL", {
                      day: "numeric",
                      month: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-smoke-100 text-sm whitespace-pre-wrap line-clamp-3">
                  {m.text || (m.image?.prompt ? `🎨 ${m.image.prompt}` : "תמונה")}
                </div>
              </button>
            ))
        )}
      </div>
    </div>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: { url: string; prompt?: string; ts: number; author?: string }[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const current = images[index];
  if (!current) return null;
  const prev = () => onIndex((index - 1 + images.length) % images.length);
  const next = () => onIndex((index + 1) % images.length);
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 text-white">
        <span className="text-sm flex-1">
          {current.author ?? "תמונה"}
          {current.prompt && (
            <span className="text-white/60 text-xs ms-2">
              — &quot;{current.prompt.slice(0, 80)}&quot;
            </span>
          )}
        </span>
        <span className="text-white/60 text-xs">
          {index + 1}/{images.length}
        </span>
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-full hover:bg-white/10"
          title="פתח במקור"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10"
          aria-label="סגור"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 grid place-items-center overflow-hidden touch-pan-y"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.prompt ?? "תמונה"}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <button
            type="button"
            onClick={prev}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="קודמת"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={next}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label="הבאה"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

function FaceCrop({
  file,
  onCancel,
  onCrop,
}: {
  file: File;
  onCancel: () => void;
  onCrop: (blob: Blob) => void;
}) {
  const imgUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(imgUrl), [imgUrl]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgRect, setImgRect] = useState<{
    left: number;
    top: number;
    w: number;
    h: number;
  } | null>(null);
  const [circle, setCircle] = useState<{
    x: number;
    y: number;
    r: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    cx: number;
    cy: number;
  } | null>(null);

  function recalc() {
    const img = imgRef.current;
    const cont = containerRef.current;
    if (!img || !cont) return;
    const cb = cont.getBoundingClientRect();
    const ib = img.getBoundingClientRect();
    const rect = {
      left: ib.left - cb.left,
      top: ib.top - cb.top,
      w: ib.width,
      h: ib.height,
    };
    setImgRect(rect);
    setCircle((prev) => {
      const r = prev?.r ?? Math.min(rect.w, rect.h) * 0.3;
      const cx = prev?.x ?? rect.left + rect.w / 2;
      const cy = prev?.y ?? rect.top + rect.h / 2;
      return clampCircle({ x: cx, y: cy, r }, rect);
    });
  }

  useEffect(() => {
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (!circle) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      cx: circle.x,
      cy: circle.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !circle || !imgRect) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setCircle(
      clampCircle(
        { x: dragRef.current.cx + dx, y: dragRef.current.cy + dy, r: circle.r },
        imgRect,
      ),
    );
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function setRadius(r: number) {
    if (!circle || !imgRect) return;
    const max = Math.min(imgRect.w, imgRect.h) / 2;
    const newR = Math.max(28, Math.min(max, r));
    setCircle(clampCircle({ ...circle, r: newR }, imgRect));
  }

  async function handleConfirm() {
    if (busy) return;
    if (!circle || !imgRect || !imgRef.current) return;
    const img = imgRef.current;
    const scale = img.naturalWidth / imgRect.w;
    const cx = (circle.x - imgRect.left) * scale;
    const cy = (circle.y - imgRect.top) * scale;
    const r = circle.r * scale;
    const sx = Math.max(0, cx - r);
    const sy = Math.max(0, cy - r);
    const s = Math.min(2 * r, img.naturalWidth - sx, img.naturalHeight - sy);

    const out = 512;
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, out, out);

    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onCrop(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="px-4 py-3 flex items-center gap-2 text-white">
        <h2 className="flex-1 font-semibold">חתוך את הפנים</h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-full hover:bg-white/10"
          aria-label="סגור"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 relative grid place-items-center overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imgUrl}
          alt=""
          onLoad={recalc}
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
        {circle && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height="100%"
          >
            <defs>
              <mask id="hl-circle-mask">
                <rect width="100%" height="100%" fill="white" />
                <circle cx={circle.x} cy={circle.y} r={circle.r} fill="black" />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.65)"
              mask="url(#hl-circle-mask)"
            />
            <circle
              cx={circle.x}
              cy={circle.y}
              r={circle.r}
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              style={{
                filter: "drop-shadow(0 0 8px rgba(0,0,0,0.7))",
              }}
            />
          </svg>
        )}
      </div>
      <div className="px-4 py-3 space-y-3 bg-black/95 border-t border-white/10">
        <input
          type="range"
          min={30}
          max={Math.min(imgRect?.w ?? 320, imgRect?.h ?? 320) / 2 || 200}
          value={circle?.r ?? 100}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl bg-white/10 text-white"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !circle}
            className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-60"
          >
            אשר וחתוך
          </button>
        </div>
        <p className="text-[11px] text-white/60 text-center">
          גרור את העיגול לכוון פנים, השתמש בסליידר לגודל
        </p>
      </div>
    </div>
  );
}

function clampCircle(
  c: { x: number; y: number; r: number },
  rect: { left: number; top: number; w: number; h: number },
): { x: number; y: number; r: number } {
  const r = Math.min(c.r, rect.w / 2, rect.h / 2);
  const x = Math.max(rect.left + r, Math.min(rect.left + rect.w - r, c.x));
  const y = Math.max(rect.top + r, Math.min(rect.top + rect.h - r, c.y));
  return { x, y, r };
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

function Bubble({
  msg,
  myUserId,
  profiles,
  highlight,
  onReact,
  onReply,
  onEdit,
  onDelete,
  pickerOpen,
  onTogglePicker,
  onOpenImage,
  onJumpTo,
}: {
  msg: RoomMsg;
  myUserId: string;
  profiles: Record<string, { url: string; hasRef: boolean }>;
  highlight: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onOpenImage: () => void;
  onJumpTo: (id: string) => void;
}) {
  const isMe = msg.author?.id === myUserId;
  const isUser = msg.role === "user";
  const isLocal = msg.id.startsWith("local-");
  const isDeleted = msg.deleted === true;
  const reactionEntries = Object.entries(msg.reactions ?? {});

  return (
    <div
      data-msg-id={msg.id}
      className={`flex ${isMe ? "justify-start" : "justify-end"} scroll-mt-24`}
    >
      <div
        className={[
          "relative max-w-[82%] sm:max-w-[70%] px-4 py-3 rounded-2xl shadow-lg leading-relaxed text-[15px] transition-shadow",
          isMe ? "bubble-me rounded-br-sm" : "bubble-bot rounded-bl-sm",
          highlight ? "ring-2 ring-emerald-400 shadow-emerald-500/30" : "",
        ].join(" ")}
      >
        {msg.replyTo && (
          <button
            type="button"
            onClick={() => onJumpTo(msg.replyTo!.id)}
            className="block w-full text-right mb-2 px-2.5 py-1.5 rounded-lg bg-smoke-950/40 border-r-2 border-emerald-400/70 hover:bg-smoke-950/60 transition"
          >
            <div className="text-[11px] text-emerald-300 font-semibold">
              {msg.replyTo.authorName}
            </div>
            <div className="text-[12px] text-smoke-300/80 truncate">
              {msg.replyTo.snippet}
            </div>
          </button>
        )}
        {isUser && msg.author && !isMe && (
          <div className="text-[11px] text-smoke-100/90 font-semibold mb-1 flex items-center gap-1.5">
            {msg.author.id && profiles[msg.author.id]?.url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={profiles[msg.author.id]!.url}
                alt={msg.author.name}
                className="w-5 h-5 rounded-full object-cover border border-smoke-700/60"
              />
            ) : null}
            <span>{msg.author.name}</span>
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
          <button
            type="button"
            onClick={onOpenImage}
            className="block rounded-xl overflow-hidden border border-smoke-700/40 mb-2 w-full active:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.image.url}
              alt={msg.image.prompt ?? "imagine"}
              className="w-full h-auto"
              loading="lazy"
            />
          </button>
        )}

        {msg.image?.prompt && msg.image.status === "ready" && (
          <div className="text-[12px] text-smoke-300/80 mb-1">
            “{msg.image.prompt}”
          </div>
        )}

        {msg.voice && !isDeleted && (
          <div>
            {msg.voice.transcript && (
              <div className="mb-1 text-[15px] whitespace-pre-wrap leading-relaxed">
                {msg.voice.transcript}
              </div>
            )}
            <VoicePlayer
              url={msg.voice.url}
              duration={msg.voice.duration}
              compact={Boolean(msg.voice.transcript)}
            />
          </div>
        )}

        {isDeleted ? (
          <div className="text-smoke-300/60 italic text-sm">
            ההודעה נמחקה
          </div>
        ) : msg.text ? (
          <div className="whitespace-pre-wrap">
            {renderMentions(msg.text)}
            {msg.editedAt && (
              <span className="text-[10px] text-smoke-300/50 ms-1">
                (נערך)
              </span>
            )}
          </div>
        ) : null}

        {reactionEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {reactionEntries.map(([emoji, ids]) => {
              const mine = ids.includes(myUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className={[
                    "text-xs px-2 py-0.5 rounded-full border transition flex items-center gap-1",
                    mine
                      ? "bg-emerald-700/60 border-emerald-400/60 text-emerald-50"
                      : "bg-smoke-950/40 border-smoke-700/60 text-smoke-200 hover:bg-smoke-800/60",
                  ].join(" ")}
                >
                  <span>{emoji}</span>
                  <span className="text-[11px]">{ids.length}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-1 text-[10px] text-smoke-300/50 flex items-center justify-end tabular-nums">
          {formatBubbleTime(msg.ts)}
        </div>

        {!isLocal && !isDeleted && (
          <div className="mt-1 flex items-center justify-end gap-1 opacity-50 hover:opacity-100 transition">
            <button
              type="button"
              onClick={onTogglePicker}
              className="p-1 rounded-md hover:bg-black/10"
              title="הוסף אימוג'י"
              aria-label="הוסף אימוג'י"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onReply}
              className="p-1 rounded-md hover:bg-black/10"
              title="השב"
              aria-label="השב"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => shareDeepLink(msg)}
              className="p-1 rounded-md hover:bg-black/10"
              title="שתף"
              aria-label="שתף"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {isMe && msg.text && !msg.voice && (
              <button
                type="button"
                onClick={onEdit}
                className="p-1 rounded-md hover:bg-black/10"
                title="ערוך"
                aria-label="ערוך"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {isMe && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded-md hover:bg-red-500/15"
                title="מחק"
                aria-label="מחק"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {pickerOpen && (
          <div
            className="mt-2 p-1 rounded-xl flex flex-wrap gap-0.5"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="text-lg w-8 h-8 grid place-items-center rounded-full transition active:scale-95"
                style={{ background: "rgba(0,0,0,0)" }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatVoiceDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VoicePlayer({
  url,
  duration,
  compact,
}: {
  url: string;
  duration: number;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      const d =
        a.duration && Number.isFinite(a.duration)
          ? a.duration
          : actualDuration || 1;
      setProgress(a.currentTime / d);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onMeta = () => {
      if (a.duration && Number.isFinite(a.duration))
        setActualDuration(a.duration);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [actualDuration]);

  const remaining = Math.max(0, actualDuration - actualDuration * progress);

  return (
    <div
      className={`flex items-center gap-2 ${compact ? "py-0.5 mt-0.5 opacity-80 text-xs" : "py-1 my-0.5"} min-w-[180px]`}
    >
      <button
        type="button"
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          if (playing) {
            a.pause();
            setPlaying(false);
          } else {
            a.play().catch(() => {});
            setPlaying(true);
          }
        }}
        className="w-9 h-9 rounded-full grid place-items-center transition active:scale-95 shrink-0"
        style={{ background: "rgba(0,0,0,0.18)" }}
        aria-label={playing ? "השהה" : "נגן"}
      >
        {playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 -scale-x-100" />
        )}
      </button>
      <div className="flex-1 flex items-center gap-[2px] h-7 px-1">
        {Array.from({ length: 28 }).map((_, i) => {
          const pos = i / 27;
          const isPast = pos <= progress;
          const seed = (i * 137 + 91) % 100;
          const h = 22 + (seed % 60);
          return (
            <span
              key={i}
              className="w-[2px] rounded-full"
              style={{
                height: `${h}%`,
                background: isPast
                  ? "rgba(0,0,0,0.7)"
                  : "rgba(0,0,0,0.22)",
                transition: "background 90ms ease-out",
              }}
            />
          );
        })}
      </div>
      <span className="text-[11px] tabular-nums opacity-70 shrink-0">
        {formatVoiceDuration(remaining)}
      </span>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}

function shareDeepLink(msg: RoomMsg) {
  if (typeof window === "undefined") return;
  const link = `${window.location.origin}/?msg=${encodeURIComponent(msg.id)}`;

  let text: string;
  if (msg.image?.url && msg.image.status === "ready") {
    const caption = msg.image.prompt
      ? `"${msg.image.prompt}" — מהלווינים`
      : "תמונה מהלווינים";
    text = `${msg.image.url}\n\n${caption}\n${link}`;
  } else if (msg.text) {
    const author = msg.author?.name ?? "מישהו";
    const snippet = msg.text.length > 140 ? msg.text.slice(0, 140) + "…" : msg.text;
    text = `${author} בלווינים: "${snippet}"\n${link}`;
  } else {
    text = `הצטרף ללווינים\n${link}`;
  }

  if (typeof navigator.share === "function") {
    navigator
      .share({ title: "הלווינים", text, url: link })
      .catch(() => {
        openWhatsApp(text);
      });
  } else {
    openWhatsApp(text);
  }
}

function openWhatsApp(text: string) {
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, "_blank");
}

function cssEscape(s: string): string {
  if (typeof window !== "undefined" && typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(s);
  }
  return s.replace(/(["\\\]\[])/g, "\\$1");
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

function PhotoAttachButton({
  disabled,
  uploading,
  onPicked,
  inputRef,
}: {
  disabled: boolean;
  uploading: boolean;
  onPicked: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const multiRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6);
    arr.forEach((f, i) => setTimeout(() => onPicked(f), i * 250));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={disabled}
        className="h-11 w-11 shrink-0 rounded-full bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-200 grid place-items-center transition active:scale-95 disabled:opacity-40"
        aria-label="צרף תמונה"
        title="צרף תמונה"
      >
        {uploading ? (
          <span className="dot-typing" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPicked(f);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={multiRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-40 px-3 pointer-events-none"
            style={{
              paddingBottom:
                "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))",
            }}
          >
            <div
              className="w-full max-w-md mx-auto bg-smoke-900/95 border border-smoke-700/60 rounded-2xl p-3 shadow-2xl glow-ring pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                cameraRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-smoke-800/70 text-smoke-100 text-right"
            >
              <Camera className="w-5 h-5 text-emerald-300" />
              <div className="flex-1">
                <div className="font-semibold text-sm">צלם עכשיו</div>
                <div className="text-xs text-smoke-400">פותח את המצלמה</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                inputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-smoke-800/70 text-smoke-100 text-right"
            >
              <ImageIcon className="w-5 h-5 text-emerald-300" />
              <div className="flex-1">
                <div className="font-semibold text-sm">תמונה אחת</div>
                <div className="text-xs text-smoke-400">בחר מהגלריה</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                multiRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-smoke-800/70 text-smoke-100 text-right"
            >
              <Paperclip className="w-5 h-5 text-emerald-300" />
              <div className="flex-1">
                <div className="font-semibold text-sm">כמה תמונות</div>
                <div className="text-xs text-smoke-400">עד 6 בבת אחת</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="w-full mt-1 px-4 py-2.5 rounded-xl text-smoke-300 hover:text-smoke-100 text-sm"
            >
              ביטול
            </button>
            </div>
          </div>
        </>
      )}
    </>
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
  photoInputRef,
  replyTarget,
  onCancelReply,
  onPhotoPicked,
  uploading,
  editing,
  onCancelEdit,
  recording,
  recordSeconds,
  onStartRecord,
  onStopRecord,
  onCancelRecord,
  audioLevel,
  liveTranscript,
}: {
  input: string;
  setInput: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onImagine: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  replyTarget: ReplyTo | null;
  onCancelReply: () => void;
  onPhotoPicked: (file: File) => void;
  uploading: boolean;
  editing: boolean;
  onCancelEdit: () => void;
  recording: boolean;
  recordSeconds: number;
  audioLevel: number;
  liveTranscript: string;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onCancelRecord: () => void;
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
        {editing && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-amber-900/40 border border-amber-600/40 flex items-center gap-2">
            <Pencil className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="flex-1 min-w-0 text-xs text-amber-100">
              עריכת הודעה — Esc לבטל
            </div>
            <button
              type="button"
              onClick={onCancelEdit}
              className="p-1 rounded-md text-amber-200/80 hover:text-amber-100"
              aria-label="בטל עריכה"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {replyTarget && !editing && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-smoke-800/60 border border-smoke-700/60 flex items-center gap-2">
            <Reply className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-emerald-300 font-semibold">
                בתגובה ל{replyTarget.authorName}
              </div>
              <div className="text-xs text-smoke-200 truncate">
                {replyTarget.snippet}
              </div>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="p-1 rounded-md text-smoke-300/80 hover:text-smoke-100"
              aria-label="בטל תגובה"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {recording && liveTranscript && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-emerald-900/40 border border-emerald-600/30">
            <div className="text-[11px] text-emerald-300/90 mb-0.5">תמליל</div>
            <div className="text-sm text-emerald-50 whitespace-pre-wrap">
              {liveTranscript}
            </div>
          </div>
        )}
        {recording && (
          <div className="mb-2 px-3 py-2.5 rounded-xl bg-red-900/55 border border-red-500/60 flex items-center gap-3">
            <div
              className="relative w-9 h-9 rounded-full bg-red-500 grid place-items-center shrink-0"
              style={{
                transform: `scale(${1 + audioLevel * 0.5})`,
                transition: "transform 60ms linear",
                boxShadow: `0 0 ${8 + audioLevel * 28}px rgba(255,80,80,${0.4 + audioLevel * 0.6})`,
              }}
            >
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-red-50 tabular-nums w-12 shrink-0">
              {formatVoiceDuration(recordSeconds)}
            </span>
            <div className="flex-1 flex items-center justify-center gap-1 h-6">
              {Array.from({ length: 14 }).map((_, i) => {
                const center = 6.5;
                const distance = Math.abs(i - center) / center;
                const peak = audioLevel * 100 * (1 - distance * 0.3);
                const h = Math.max(8, Math.min(100, peak * 1.5 + 6));
                return (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-200/80"
                    style={{
                      height: `${h}%`,
                      transition: "height 80ms ease-out",
                    }}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={onCancelRecord}
              className="text-xs px-2 py-1 rounded-md text-red-200 hover:text-red-100"
            >
              בטל
            </button>
            <button
              type="button"
              onClick={onStopRecord}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-medium flex items-center gap-1"
            >
              <Square className="w-3 h-3" />
              שלח
            </button>
          </div>
        )}
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
          <PhotoAttachButton
            disabled={uploading || disabled}
            uploading={uploading}
            onPicked={onPhotoPicked}
            inputRef={photoInputRef}
          />
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
            placeholder={editing ? "ערוך הודעה..." : "כתוב משהו..."}
            className="flex-1 input-glow resize-none rounded-2xl bg-smoke-900/70 border border-smoke-700/60 px-5 py-3.5 text-smoke-100 placeholder:text-smoke-300/50 text-base min-h-[48px] max-h-40"
            dir="rtl"
          />
          {input.trim() ? (
            <button
              type="button"
              onClick={onSend}
              disabled={disabled}
              className="h-12 px-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold grid grid-flow-col items-center gap-1.5 shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              aria-label={editing ? "שמור" : "שלח"}
            >
              <span className="text-sm">{editing ? "שמור" : "שלח"}</span>
              <Send className="w-4 h-4 -scale-x-100" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartRecord}
              disabled={recording || editing || disabled}
              className="h-12 w-12 shrink-0 rounded-full bg-smoke-800/70 hover:bg-smoke-700/80 border border-smoke-700/60 text-smoke-200 grid place-items-center transition active:scale-95 disabled:opacity-40"
              aria-label="הקלט הודעת קול"
              title="הקלט הודעת קול"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
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
