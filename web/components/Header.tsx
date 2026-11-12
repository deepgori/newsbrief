import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/", label: "Top Stories", short: "Top" },
  { href: "/finance/", label: "Finance", short: "Finance" },
  { href: "/briefing/", label: "Briefing", short: "Briefing" },
];

export function Header({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {SITE_NAME}
          <span className="text-emerald-600">.</span>
        </Link>
        <nav className="flex shrink-0 gap-0.5 text-sm font-medium sm:gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-2 py-1.5 sm:px-2.5 ${
                active === n.href
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span className="sm:hidden">{n.short}</span>
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
