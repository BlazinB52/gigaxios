"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export const COMMON_PLATFORMS = [
  "GoPuff",
  "Amazon Flex",
  "Uber Eats",
  "DoorDash",
  "Shipt",
  "Veho",
  "Other",
];

type PlatformFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

export default function PlatformField({
  value,
  onChange,
  label = "Platform",
  placeholder = "Select or enter platform",
  className = "",
  inputClassName = "bg-slate-900",
}: PlatformFieldProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  function selectPlatform(platform: string) {
    onChange(platform);
    setSuggestionsOpen(false);
  }

  return (
    <label className={`block ${className}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <div className="relative mt-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
          className={`w-full rounded-xl border border-slate-700 p-3 pr-10 text-white placeholder:text-slate-500 ${inputClassName}`}
          autoComplete="off"
        />
        <button
          type="button"
          aria-label="Show platform suggestions"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setSuggestionsOpen((open) => !open)}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 active:bg-slate-800"
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>

        {suggestionsOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-xl shadow-black/30">
            {COMMON_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectPlatform(platform)}
                className="block w-full px-3 py-3 text-left text-sm text-white active:bg-slate-800"
              >
                {platform}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}
