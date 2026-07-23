'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, Menu, Swords, X } from 'lucide-react';
import { ThemeToggle } from '@/app/theme-toggle';

const navigation = [
    { href: '/', label: 'Đấu trường', icon: Swords, exact: true },
    { href: '/learn-word', label: 'Học từ', icon: BookOpen, exact: false }
] as const;

export function SiteHeader() {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

    return (
        <header className="sticky top-0 z-[var(--z-sticky)] border-b border-line bg-surface/90 backdrop-blur-xl">
            <div className="mx-auto grid min-h-16 w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
                <Link
                    href="/"
                    className="inline-flex min-h-11 min-w-0 items-center gap-2.5 font-display text-base font-extrabold tracking-[-0.03em] text-foreground"
                >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-signal text-background">
                        <Swords size={19} aria-hidden="true" />
                    </span>
                    <span className="truncate">Vocab Battle</span>
                </Link>

                <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
                    {navigation.map(({ href, label, icon: Icon, exact }) => {
                        const active = isActive(href, exact);
                        return (
                            <Link
                                key={href}
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
                                    active
                                        ? 'bg-electric/15 text-electric'
                                        : 'text-muted hover:bg-surface-raised hover:text-foreground'
                                }`}
                            >
                                <Icon size={16} aria-hidden="true" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="justify-self-end flex items-center gap-2">
                    <ThemeToggle />
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        className="grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-foreground transition-colors duration-200 hover:bg-line lg:hidden"
                        aria-expanded={menuOpen}
                        aria-controls="site-mobile-menu"
                        aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                    >
                        {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {menuOpen && (
                <nav
                    id="site-mobile-menu"
                    aria-label="Điều hướng trên điện thoại"
                    className="border-t border-line bg-surface px-4 py-3 lg:hidden"
                >
                    <div className="mx-auto grid max-w-7xl gap-1 sm:px-2">
                        {navigation.map(({ href, label, icon: Icon, exact }) => {
                            const active = isActive(href, exact);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setMenuOpen(false)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
                                        active
                                            ? 'bg-electric/15 text-electric'
                                            : 'text-muted hover:bg-surface-raised hover:text-foreground'
                                    }`}
                                >
                                    <Icon size={18} aria-hidden="true" />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}
        </header>
    );
}
