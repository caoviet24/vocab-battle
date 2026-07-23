"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, FolderTree, Frame, LayoutDashboard, Menu, Swords, X } from "lucide-react";
import { ThemeToggle } from "@/app/theme-toggle";

const navigation = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/categories", label: "Danh mục", icon: FolderTree, exact: false },
  { href: "/frames", label: "Frame", icon: Frame, exact: false },
  { href: "/cards", label: "Từ vựng", icon: BookOpen, exact: false },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto grid min-h-16 w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 font-display text-base font-extrabold tracking-[-0.03em] text-foreground">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-signal text-background"><Swords size={19} aria-hidden="true" /></span>
          <span className="truncate">Vocab Battle · Admin</span>
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
          {navigation.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${active ? "bg-electric/15 text-electric" : "text-muted hover:bg-surface-raised hover:text-foreground"}`}><Icon size={16} aria-hidden="true" />{label}</Link>;
          })}
        </nav>

        <div className="justify-self-end flex items-center gap-2">
          <Link href="/cards" className="hidden min-h-11 items-center rounded-lg bg-signal px-4 text-sm font-extrabold text-background whitespace-nowrap transition-[background-color,transform] duration-200 hover:bg-signal/85 active:translate-y-px sm:inline-flex">Quản lý từ</Link>
          <ThemeToggle />
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition-colors duration-200 hover:bg-line lg:hidden" aria-expanded={menuOpen} aria-controls="site-mobile-menu" aria-label={menuOpen ? "Đóng menu" : "Mở menu"}>
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && <nav id="site-mobile-menu" aria-label="Điều hướng trên điện thoại" className="border-t border-line bg-surface px-4 py-3 lg:hidden"><div className="mx-auto grid max-w-7xl gap-1 sm:px-2">
        {navigation.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${active ? "bg-electric/15 text-electric" : "text-muted hover:bg-surface-raised hover:text-foreground"}`}><Icon size={18} aria-hidden="true" />{label}</Link>;
        })}
        <Link href="/cards" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-signal px-4 text-sm font-extrabold text-background whitespace-nowrap transition-[background-color,transform] duration-200 hover:bg-signal/85 active:translate-y-px">Quản lý từ</Link>
      </div></nav>}
    </header>
  );
}

export function SiteFooter() {
  return <footer className="border-t border-line bg-surface"><div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
    <p className="max-w-[28ch] font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-none tracking-[-0.05em] text-foreground">Kho từ rõ ràng. Trận đấu ổn định.</p>
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line pt-4 text-sm">
      <Link href="/" className="font-display font-extrabold tracking-[-0.03em] text-foreground whitespace-nowrap">Vocab Battle · Admin</Link>
      <nav aria-label="Liên kết cuối trang" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted"><Link href="/categories" className="min-h-11 inline-flex items-center font-semibold whitespace-nowrap hover:text-foreground">Danh mục</Link><Link href="/frames" className="min-h-11 inline-flex items-center font-semibold whitespace-nowrap hover:text-foreground">Frame</Link><Link href="/cards" className="min-h-11 inline-flex items-center font-semibold whitespace-nowrap hover:text-foreground">Từ vựng</Link></nav>
      <span className="text-muted">© 2026</span>
    </div>
  </div></footer>;
}
