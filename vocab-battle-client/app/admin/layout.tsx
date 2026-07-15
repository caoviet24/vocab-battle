"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { DoorOpen, FolderTree, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/app/theme-toggle";

const NAV = [
  { href: "/admin", label: "Phòng", icon: DoorOpen, exact: true },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree, exact: false },
  { href: "/admin/cards", label: "Từ vựng", icon: BookOpen, exact: false },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-180">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-lg transition-colors duration-180">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight hover:text-electric transition-colors">
            <span className="grid size-8 place-items-center rounded-lg bg-signal/15 text-signal text-base">V</span>
            Vocab Admin
          </Link>

          {/* Desktop nav */}
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-electric/10 text-electric"
                      : "text-muted hover:bg-line/50 hover:text-foreground"
                  }`}
                >
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
            <ThemeToggle />
          </nav>

          {/* Mobile burger */}
          <div className="ml-auto flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid size-10 place-items-center rounded-xl border border-line bg-surface-raised text-muted"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {menuOpen && (
          <nav className="border-t border-line bg-surface px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-electric/10 text-electric"
                        : "text-muted hover:bg-line/50 hover:text-foreground"
                    }`}
                  >
                    <Icon size={18} /> {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}