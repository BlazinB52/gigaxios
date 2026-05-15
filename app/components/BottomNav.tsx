"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/fuel", label: "Fuel", icon: "⛽" },
  { href: "/records", label: "Records", icon: "▦" },
  { href: "/metrics", label: "Metrics", icon: "◌" },
  { href: "/settings", label: "Account", icon: "○" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-[#020814]/95 px-2 pb-2 pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 text-center">
        {navItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
                isActive ? "text-blue-400" : "text-slate-500"
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}