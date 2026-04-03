import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "学习计划",
  description: "孩子每日学习计划 Dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "学习计划",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#0B132B" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0B132B] text-[#F1F5F9]">
        <main className="flex-1 pb-20">{children}</main>
        <BottomNav />
        <Toaster position="top-center" />
        <PWARegister />
      </body>
    </html>
  );
}
