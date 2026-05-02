"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  confirmedLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
}

// Bunq-style "slide to pay". User must drag the thumb from left to right to fire.
// Bails out if released before the threshold.
export default function SlideToConfirm({ label, confirmedLabel, tone, onConfirm }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const thumbSize = 56;

  const bg = tone === "danger" ? "bg-red-500/20" : "bg-white/10";
  const fill = tone === "danger" ? "bg-red-500" : "bg-white";
  const thumbColor = tone === "danger" ? "bg-red-500" : "bg-white";
  const textColor = "text-white";

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const next = Math.max(0, Math.min(rect.width - thumbSize, clientX - rect.left - thumbSize / 2));
      setX(next);
    };
    const onUp = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const max = rect.width - thumbSize;
      if (x >= max - 4) {
        setX(max);
        setConfirmed(true);
        onConfirm();
      } else {
        setX(0);
      }
      setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, x, onConfirm]);

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-full overflow-hidden ${bg} select-none`}
    >
      <div
        className={`absolute inset-y-0 left-0 ${fill} opacity-40`}
        style={{ width: `${x + thumbSize}px` }}
      />
      <div className={`absolute inset-0 flex items-center justify-center ${textColor} font-medium`}>
        {confirmed ? confirmedLabel ?? "Done" : label}
      </div>
      <div
        className={`absolute top-1 left-1 rounded-full ${thumbColor} flex items-center justify-center shadow-lg`}
        style={{
          width: `${thumbSize - 8}px`,
          height: `${thumbSize - 8}px`,
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 200ms",
        }}
        onMouseDown={() => !confirmed && setDragging(true)}
        onTouchStart={() => !confirmed && setDragging(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke={tone === "danger" ? "white" : "black"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
