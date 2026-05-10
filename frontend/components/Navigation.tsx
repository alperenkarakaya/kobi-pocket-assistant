"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, PackageSearch } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/",        label: "Dashboard",       icon: LayoutDashboard },
  { href: "/kanban",  label: "Görevler",        icon: KanbanSquare    },
  { href: "/stock",   label: "Stok Yönetimi",   icon: PackageSearch   },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-[rgba(34,197,94,0.08)] bg-[#0a0f0d]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14 gap-1">
        <span className="text-xs font-black text-brand-500 tracking-[0.2em] uppercase mr-5 select-none">
          KOBI
        </span>

        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              pathname === href
                ? "bg-brand-500/15 text-brand-400 border border-brand-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            )}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
