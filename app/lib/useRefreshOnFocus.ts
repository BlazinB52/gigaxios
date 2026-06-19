"use client";

import { useEffect, useRef } from "react";

const DEFAULT_DEDUPE_MS = 750;

export function useRefreshOnFocus(
  onRefresh: () => void | Promise<void>,
  dedupeMs = DEFAULT_DEDUPE_MS
) {
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    let refreshInProgress = false;
    let lastRefreshAt = 0;

    async function refreshIfVisible() {
      if (document.visibilityState !== "visible" || refreshInProgress) return;

      const now = Date.now();
      if (now - lastRefreshAt < dedupeMs) return;

      lastRefreshAt = now;
      refreshInProgress = true;

      try {
        await onRefreshRef.current();
      } catch (error) {
        console.error("Focus refresh failed:", error);
      } finally {
        refreshInProgress = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshIfVisible();
      }
    }

    function handleFocus() {
      void refreshIfVisible();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dedupeMs]);
}
