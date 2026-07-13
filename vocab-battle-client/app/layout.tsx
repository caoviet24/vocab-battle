import type { Metadata } from "next";
import "@fontsource-variable/roboto";
import "./globals.css";

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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
