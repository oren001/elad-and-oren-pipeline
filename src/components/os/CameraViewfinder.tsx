"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  prompt?: string;
  onCapture: (b64: string) => void;
}

export default function CameraViewfinder({ prompt, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "camera unavailable");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const b64 = dataUrl.split(",")[1] ?? "";
    onCapture(b64);
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-black border border-white/10 relative aspect-[3/4]">
      {error ? (
        <div className="p-4 text-red-300 text-sm">Camera error: {error}</div>
      ) : (
        <>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-white/90 text-sm">
            <span className="px-2 py-1 rounded-full bg-black/40">{prompt ?? "Tap to capture"}</span>
            <button
              onClick={() => setFacing(facing === "user" ? "environment" : "user")}
              className="px-2 py-1 rounded-full bg-black/40"
            >
              ⟳
            </button>
          </div>
          <button
            onClick={snap}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95"
            aria-label="capture"
          />
        </>
      )}
    </div>
  );
}
