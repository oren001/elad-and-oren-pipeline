"use client";

import { useState } from "react";
import type { Action, Node, UISpec } from "@/lib/os/ui-schema";
import SlideToConfirm from "./SlideToConfirm";
import CameraViewfinder from "./CameraViewfinder";

interface RendererProps {
  spec: UISpec;
  onAction: (action: Action) => void;
  onPhoto?: (b64: string) => void;
}

export default function Renderer({ spec, onAction, onPhoto }: RendererProps) {
  return (
    <div className="px-4 pt-2 pb-32">
      {spec.title && <div className="text-2xl font-semibold text-white mb-3">{spec.title}</div>}
      <RenderNode node={spec.root} onAction={onAction} onPhoto={onPhoto} />
      {spec.suggestions && spec.suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {spec.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onAction({ kind: "send", prompt: s })}
              className="px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-sm hover:bg-white/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RenderNode({
  node,
  onAction,
  onPhoto,
}: {
  node: Node;
  onAction: (a: Action) => void;
  onPhoto?: (b64: string) => void;
}) {
  switch (node.type) {
    case "text": {
      const tone = node.tone ?? "default";
      const cls =
        tone === "title"
          ? "text-xl font-semibold text-white"
          : tone === "headline"
            ? "text-3xl font-semibold text-white tracking-tight"
            : tone === "muted"
              ? "text-white/60 text-sm"
              : tone === "caption"
                ? "text-white/50 text-xs uppercase tracking-wide"
                : "text-white/90 text-base leading-snug";
      return <div className={cls}>{node.value}</div>;
    }
    case "stack":
      return (
        <div className="flex flex-col" style={{ gap: `${node.gap ?? 12}px` }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} onAction={onAction} onPhoto={onPhoto} />
          ))}
        </div>
      );
    case "row": {
      const justify =
        node.align === "center"
          ? "justify-center"
          : node.align === "between"
            ? "justify-between"
            : node.align === "end"
              ? "justify-end"
              : "justify-start";
      return (
        <div className={`flex items-center ${justify}`} style={{ gap: `${node.gap ?? 8}px` }}>
          {node.children.map((c, i) => (
            <RenderNode key={i} node={c} onAction={onAction} onPhoto={onPhoto} />
          ))}
        </div>
      );
    }
    case "card":
      return (
        <div
          className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-4 shadow-lg"
          style={node.accent ? { boxShadow: `0 0 0 1px ${node.accent}55, 0 8px 24px ${node.accent}22` } : undefined}
        >
          {node.title && <div className="text-white font-semibold mb-0.5">{node.title}</div>}
          {node.subtitle && <div className="text-white/60 text-sm mb-2">{node.subtitle}</div>}
          <div className="flex flex-col gap-3">
            {node.children.map((c, i) => (
              <RenderNode key={i} node={c} onAction={onAction} onPhoto={onPhoto} />
            ))}
          </div>
        </div>
      );
    case "button": {
      const variant = node.variant ?? "primary";
      const cls =
        variant === "primary"
          ? "bg-white text-black"
          : variant === "danger"
            ? "bg-red-500 text-white"
            : variant === "soft"
              ? "bg-white/10 text-white"
              : "bg-transparent text-white border border-white/20";
      return (
        <button
          onClick={() => onAction(node.action)}
          className={`w-full px-4 py-3 rounded-xl font-medium ${cls} active:scale-[0.99]`}
        >
          {node.label}
        </button>
      );
    }
    case "slide_to_confirm":
      return (
        <SlideToConfirm
          label={node.label}
          confirmedLabel={node.confirmedLabel}
          tone={node.tone}
          onConfirm={() => onAction(node.action)}
        />
      );
    case "list":
      return (
        <div className="flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          {node.items.map((item, i) => (
            <button
              key={i}
              onClick={() => item.action && onAction(item.action)}
              className="text-left px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 active:bg-white/10 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-white truncate">{item.title}</div>
                {item.subtitle && <div className="text-white/60 text-sm truncate">{item.subtitle}</div>}
              </div>
              {item.trailing && <div className="text-white/70 text-sm">{item.trailing}</div>}
            </button>
          ))}
        </div>
      );
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={node.src} alt={node.alt ?? ""} className={node.rounded ? "rounded-2xl w-full" : "w-full"} />;
    case "photo_grid":
      return (
        <div className="grid grid-cols-3 gap-1">
          {node.photos.map((p, i) => (
            <button
              key={i}
              onClick={() => p.action && onAction(p.action)}
              className="aspect-square overflow-hidden rounded-md bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt ?? ""} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      );
    case "field":
      return <FieldNode node={node} />;
    case "form":
      return <FormNode node={node} onAction={onAction} />;
    case "toggle":
      return <ToggleNode node={node} onAction={onAction} />;
    case "slider":
      return <SliderNode node={node} onAction={onAction} />;
    case "metric":
      return (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="text-white/50 text-xs uppercase tracking-wide">{node.label}</div>
          <div className="text-white text-3xl font-semibold mt-1">{node.value}</div>
          {node.delta && (
            <div
              className={`text-sm mt-1 ${node.tone === "good" ? "text-emerald-400" : node.tone === "bad" ? "text-red-400" : "text-white/60"}`}
            >
              {node.delta}
            </div>
          )}
        </div>
      );
    case "chips":
      return (
        <div className="flex flex-wrap gap-2">
          {node.chips.map((c, i) => (
            <button
              key={i}
              onClick={() => c.action && onAction(c.action)}
              className={`px-3 py-1.5 rounded-full text-sm ${c.selected ? "bg-white text-black" : "bg-white/10 text-white"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      );
    case "divider":
      return <div className="h-px bg-white/10 my-2" />;
    case "spacer":
      return <div style={{ height: `${node.size ?? 12}px` }} />;
    case "map":
      return (
        <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-[4/3]">
          <iframe
            title="map"
            className="w-full h-full"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${node.lng - 0.01}%2C${node.lat - 0.01}%2C${node.lng + 0.01}%2C${node.lat + 0.01}&layer=mapnik&marker=${node.lat}%2C${node.lng}`}
          />
        </div>
      );
    case "media_player":
      return (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
          {node.artwork && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.artwork} alt="" className="w-14 h-14 rounded-md object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white truncate">{node.title}</div>
            {node.subtitle && <div className="text-white/60 text-sm truncate">{node.subtitle}</div>}
          </div>
          {node.action && (
            <button onClick={() => node.action && onAction(node.action)} className="text-white text-2xl px-2">
              {node.playing ? "❚❚" : "▶"}
            </button>
          )}
        </div>
      );
    case "camera_viewfinder":
      return (
        <CameraViewfinder
          prompt={node.capturePrompt}
          onCapture={(b64) => onPhoto?.(b64)}
        />
      );
    case "loading":
      return (
        <div className="flex items-center gap-2 text-white/70">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {node.label && <div>{node.label}</div>}
        </div>
      );
    case "error":
      return (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-3 text-red-200">{node.message}</div>
      );
  }
}

function FieldNode({ node }: { node: Extract<Node, { type: "field" }> }) {
  const [v, setV] = useState(node.value ?? "");
  return (
    <label className="flex flex-col gap-1">
      <span className="text-white/60 text-xs uppercase tracking-wide">{node.label}</span>
      {node.kind === "multiline" ? (
        <textarea
          name={node.name}
          placeholder={node.placeholder}
          value={v}
          onChange={(e) => setV(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30"
        />
      ) : (
        <input
          name={node.name}
          type={node.kind === "number" ? "number" : node.kind === "tel" ? "tel" : node.kind === "email" ? "email" : node.kind === "password" ? "password" : "text"}
          placeholder={node.placeholder}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-white/10 text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-white/30"
        />
      )}
    </label>
  );
}

function FormNode({ node, onAction }: { node: Extract<Node, { type: "form" }>; onAction: (a: Action) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const values: Record<string, string> = {};
        for (const [k, v] of fd.entries()) values[k] = String(v);
        // Inject form values into the action's tool input if present
        if (node.submit.kind === "tool") {
          onAction({ ...node.submit, input: { ...node.submit.input, ...values } });
        } else if (node.submit.kind === "send") {
          const filled = Object.entries(values).map(([k, v]) => `${k}: ${v}`).join("\n");
          onAction({ kind: "send", prompt: `${node.submit.prompt}\n\n${filled}` });
        } else {
          onAction(node.submit);
        }
      }}
      className="flex flex-col gap-3"
    >
      {node.fields.map((f, i) => (
        <FieldNode key={i} node={f} />
      ))}
      <button type="submit" className="w-full px-4 py-3 rounded-xl bg-white text-black font-medium">
        {node.submitLabel}
      </button>
    </form>
  );
}

function ToggleNode({ node, onAction }: { node: Extract<Node, { type: "toggle" }>; onAction: (a: Action) => void }) {
  const [v, setV] = useState(node.value);
  return (
    <button
      onClick={() => {
        const next = !v;
        setV(next);
        if (node.onChange) onAction(node.onChange);
      }}
      className="flex items-center justify-between w-full"
    >
      <span className="text-white">{node.label}</span>
      <span
        className={`w-12 h-7 rounded-full p-0.5 transition ${v ? "bg-emerald-400" : "bg-white/20"}`}
      >
        <span
          className={`block w-6 h-6 rounded-full bg-white transition ${v ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

function SliderNode({ node, onAction }: { node: Extract<Node, { type: "slider" }>; onAction: (a: Action) => void }) {
  const [v, setV] = useState(node.value);
  return (
    <div className="flex flex-col gap-1">
      {node.label && (
        <div className="flex justify-between text-white/80 text-sm">
          <span>{node.label}</span>
          <span>
            {v}
            {node.unit ?? ""}
          </span>
        </div>
      )}
      <input
        type="range"
        min={node.min}
        max={node.max}
        step={node.step ?? 1}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onMouseUp={() => node.onChange && onAction(node.onChange)}
        onTouchEnd={() => node.onChange && onAction(node.onChange)}
        className="w-full accent-white"
      />
    </div>
  );
}
