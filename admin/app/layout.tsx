import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
} from "next/font/google";
import { Providers } from "@/app/providers";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import "./globals.css";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  variable: "--font-bricolage",
  display: "swap",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-plex",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

const themeScript = `try{var t=localStorage.getItem("vocab-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: "Vocab Battle — Đấu trường từ vựng",
  description: "Thi đấu từ vựng thời gian thực cùng bạn bè.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} min-h-full`}>
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <a
              href="#main-content"
              className="sr-only z-[var(--z-toast)] rounded-lg bg-signal px-4 py-2 font-semibold text-background focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
              Đi tới nội dung chính
            </a>
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
