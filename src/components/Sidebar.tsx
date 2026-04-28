"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kanban, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { adminLogout } from "@/lib/actions/auth";

const items = [
  { href: "/admin", label: "Pipeline", icon: Kanban, exact: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-16 lg:w-56 bg-ink-900 text-ink-100 flex flex-col shrink-0">
      <div className="h-14 flex items-center justify-center lg:justify-start lg:px-4 border-b border-ink-800">
        <div className="w-8 h-8 rounded bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
          EO
        </div>
        <span className="hidden lg:block ml-2 font-semibold text-white">Elad &amp; Oren</span>
      </div>
      <nav className="flex-1 py-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm",
                active
                  ? "bg-brand text-white"
                  : "text-ink-300 hover:bg-ink-800 hover:text-white"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-ink-800">
        <form action={adminLogout}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full mx-auto px-3 py-2 rounded-md text-sm text-ink-300 hover:bg-ink-800 hover:text-white transition"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="hidden lg:inline">Log out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
