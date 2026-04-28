export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="h-14 border-b border-ink-200 bg-white flex items-center px-6 shrink-0">
      <div className="flex-1">
        <h1 className="font-semibold text-ink-800">{title}</h1>
        {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
      </div>
    </header>
  );
}
