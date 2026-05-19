"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home", icon: "🏠", color: "text-blue-400" },
  { href: "/fuel", label: "Fuel", icon: "⛽", color: "text-emerald-300" },
  { href: "/records", label: "Records", icon: "📅", color: "text-cyan-300" },
  { href: "/metrics", label: "Metrics", icon: "↗", color: "text-blue-300" },
  { href: "/garage", label: "Garage", icon: "🔧", color: "text-slate-300" },
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
              className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${isActive ? item.color : "text-slate-500"
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