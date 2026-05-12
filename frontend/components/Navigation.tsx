"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, PackageSearch, Leaf, Users, LogOut } from "lucide-react";
import { clsx } from "clsx";
import NotificationBar from "./NotificationBar";
import { logout } from "@/lib/auth";

const NAV = [
  { href: "/",           label: "Özet Pano",     icon: LayoutDashboard },
  { href: "/stock",      label: "Stok Yönetimi", icon: PackageSearch   },
  { href: "/kanban",     label: "Görevler",       icon: KanbanSquare    },
  { href: "/suppliers",  label: "Tedarikçiler",   icon: Users           },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-2">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-6 select-none group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 shadow-sm group-hover:bg-brand-700 transition-colors">
            <Leaf size={16} className="text-white" strokeWidth={2} />
          </div>
          <div className="hidden sm:block">
            <span className="text-slate-900 font-bold text-sm tracking-tight">KOBI</span>
            <span className="text-slate-400 text-xs block leading-none -mt-0.5">Tarım Asistanı</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <NotificationBar />

          {/* Live indicator */}
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            Canlı
          </span>

          {/* Logout */}
          <button
            onClick={logout}
            title="Çıkış Yap"
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </nav>
  );
}
