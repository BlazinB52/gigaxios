"use client";

/* =========================================================
   BOTTOM NAV
   ---------------------------------------------------------
   Persistent fixed navigation bar rendered at the bottom of
   every page.  Five tabs link to the app's main sections.
   The active tab highlights in its accent color; inactive
   tabs are muted slate.

   Active detection:
     - Home ("/") uses exact match to avoid marking every
       route as active (all routes start with "/").
     - All other tabs use startsWith so nested routes (e.g.
       /garage/maintenance) keep the parent tab highlighted.
   ========================================================= */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";

/* =========================================================
   NAV ITEMS
   Each entry defines the route, display label, emoji icon,
   and the Tailwind color class applied when the tab is active.
   ========================================================= */

const navItems = [
  { href: "/dashboard", label: "Home",    icon: "🏠", color: "text-blue-400"    },
  { href: "/fuel",    label: "Fuel",    icon: "⛽", color: "text-emerald-300" },
  {
    href: "/records",
    label: "Records",
    icon: <CalendarDays aria-hidden="true" className="h-5 w-5 stroke-[2.25]" />,
    color: "text-cyan-300",
  },
  { href: "/metrics", label: "Metrics", icon: "↗",  color: "text-blue-300"    },
  { href: "/garage",  label: "Garage",  icon: "🔧", color: "text-slate-300"   },
];

export default function BottomNav() {

  /* =========================================================
     ACTIVE ROUTE DETECTION
     usePathname() returns the current URL path so each tab
     can compare itself and apply its active color.
     ========================================================= */

  const pathname = usePathname();

  /* =========================================================
     RENDER
     Fixed bar pinned to the bottom of the viewport. Avoid
     transforms here because mobile browsers can re-anchor
     transformed fixed layers while the page scrolls.
     ========================================================= */

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-800 bg-[#020814] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">

      {/* 5-COLUMN GRID — one cell per nav item */}
      <div className="mx-auto grid max-w-md grid-cols-5 text-center">

        {navItems.map((item) => {

          /* ACTIVE CHECK
             Home uses strict equality; all others use startsWith
             so child routes (e.g. /garage/maintenance) keep the
             Garage tab lit. */
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs font-semibold"
            >
              {/* ICON */}
              <span className={`flex h-5 w-5 items-center justify-center text-xl leading-none ${item.color}`}>
                {item.icon}
              </span>

              {/* LABEL */}
              <span className={isActive ? item.color : "text-slate-500"}>{item.label}</span>
            </Link>
          );
        })}

      </div>
    </nav>
  );
}
