"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/week", label: "本周", icon: "📋" },
  { href: "/day", label: "今日", icon: "📅" },
  { href: "/reports", label: "报告", icon: "📊" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1C2541] border-t border-[#2a3a5c] z-50 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-lg transition-colors",
                isActive
                  ? "text-[#F3C969] bg-[#1B998B]/20"
                  : "text-[#CBD5E1] hover:text-[#F1F5F9]",
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
