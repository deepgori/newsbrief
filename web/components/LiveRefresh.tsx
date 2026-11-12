"use client";

import { useEffect, useState } from "react";

const POLL_MS = 2 * 60_000;

/**
 * The site is static and redeployed whenever new stories land. A page left
 * open polls /version.json and offers a refresh once a newer build is live.
 */
export function LiveRefresh({ builtAt }: { builtAt: string }) {
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const res = await fetch(`${base}/version.json`, { cache: "no-store" });
        const { builtAt: latest } = (await res.json()) as { builtAt: string };
        if (!stopped && latest > builtAt) setNewer(true);
      } catch {
        // offline or mid-deploy: try again next tick
      }
    };
    const t = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [builtAt]);

  if (!newer) return null;
  return (
    <button
      onClick={() => location.reload()}
      className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
    >
      New stories · tap to refresh
    </button>
  );
}
