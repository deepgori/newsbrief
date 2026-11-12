import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { getLatestDigest } from "@/lib/data";

export const metadata: Metadata = { title: "Morning Briefing" };

const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

export default function BriefingPage() {
  const digest = getLatestDigest();
  return (
    <>
      <Header active="/briefing/" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Morning Briefing</h1>
        {!digest ? (
          <p className="mt-4 text-zinc-500">The first briefing goes out at 8am Sydney time.</p>
        ) : (
          <>
            <p className="mt-1 text-zinc-500">{longDate(digest.record.date)} · Australia &amp; global finance and economy</p>
            {digest.sections.map((sec) => (
              <section key={sec.title} className="mt-10">
                <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{sec.title}</h2>
                <ol className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sec.stories.map((s, i) => (
                    <li key={s.id} className="py-4">
                      <h3 className="font-semibold leading-snug">
                        {i + 1}. {s.headline}
                      </h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{s.summary}</p>
                      <p className="mt-1.5 text-sm text-zinc-500">
                        {s.sources.slice(0, 3).map((src, j) => (
                          <span key={src.url}>
                            {j > 0 && " · "}
                            <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-400">
                              {src.name}
                            </a>
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
