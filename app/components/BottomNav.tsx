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

/* =========================================================
   NAV ITEMS
   Each entry defines the route, display label, emoji icon,
   and the Tailwind color class applied when the tab is active.
   ========================================================= */

const navItems = [
  { href: "/",        label: "Home",    icon: "🏠", color: "text-blue-400"    },
  { href: "/fuel",    label: "Fuel",    icon: "⛽", color: "text-emerald-300" },
  { href: "/records", label: "Records", icon: "📅", color: "text-cyan-300"    },
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
     Fixed bar pinned to the bottom of the viewport.
     translateZ(0) forces a GPU compositing layer so iOS Safari
     cannot reposition the nav during momentum scroll.  No
     backdrop-filter is used — it breaks fixed positioning on
     iOS when the element is scrolled past.
     ========================================================= */

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-[#020814] px-2 pb-2 pt-2 [transform:translateZ(0)]">

      {/* 5-COLUMN GRID — one cell per nav item */}
      <div className="mx-auto grid max-w-md grid-cols-5 text-center">

        {navItems.map((item) => {

          /* ACTIVE CHECK
             Home uses strict equality; all others use startsWith
             so child routes (e.g. /garage/maintenance) keep the
             Garage tab lit. */
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
                isActive ? item.color : "text-slate-500"
              }`}
            >
              {/* ICON */}
              <span className="text-xl leading-none">{item.icon}</span>

              {/* LABEL */}
              <span>{item.label}</span>
            </Link>
          );
        })}

      </div>
    </nav>
  );
}
