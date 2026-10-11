import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "邮件回复助手",
  description: "用你的语气，在本地整理和起草邮件回复。",
  applicationName: "邮件回复助手",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "回复助手",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7faf8"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
