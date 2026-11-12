"use client";

import { useEffect, useState } from "react";

const absolute = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Static HTML shows the absolute Sydney time; switches to "3h ago" after hydration. */
export function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => absolute(iso));
  useEffect(() => {
    const tick = () => setLabel(relative(iso));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [iso]);
  return (
    <time dateTime={iso} title={absolute(iso)} suppressHydrationWarning>
      {label}
    </time>
  );
}
