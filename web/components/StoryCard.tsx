import type { Story } from "@/lib/data";
import { TimeAgo } from "./TimeAgo";

const CATEGORY_LABEL: Record<Story["category"], string> = {
  economy: "Economy",
  markets: "Markets",
  business: "Business",
  property: "Property",
  politics: "Politics",
  world: "World",
  tech: "Tech",
  health: "Health",
  science: "Science",
  sport: "Sport",
  entertainment: "Entertainment",
  lifestyle: "Lifestyle",
  other: "News",
};

const FINANCE = new Set(["economy", "markets", "business", "property"]);

export function StoryCard({ story }: { story: Story }) {
  const [primary, ...others] = story.sources;
  const finance = FINANCE.has(story.category);
  return (
    <article className="flex h-full flex-col overflow-hidden bg-white dark:bg-zinc-900 md:h-auto md:rounded-2xl md:border md:border-zinc-200 md:shadow-sm dark:md:border-zinc-800">
      {story.imageUrl && (
        // Publisher images are hotlinked; plain <img> because the site is a static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[16/9] max-h-[38vh] w-full shrink-0 bg-zinc-100 object-cover dark:bg-zinc-800 md:max-h-none"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className={finance ? "text-emerald-700 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400"}>
            {CATEGORY_LABEL[story.category]}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">•</span>
          <span className="text-zinc-500 dark:text-zinc-400">{story.region === "australia" ? "Australia" : "Global"}</span>
        </div>
        <h2 className="text-xl font-bold leading-snug text-zinc-900 dark:text-zinc-50">{story.headline}</h2>
        <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{story.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-sm text-zinc-500 dark:text-zinc-400">
          <TimeAgo iso={story.publishedAt} />
          {primary && (
            <>
              <span>·</span>
              <a
                href={primary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Read more at {primary.name} →
              </a>
            </>
          )}
          {others.length > 0 && (
            <span title={others.map((o) => o.name).join(", ")}>
              +{others.length} more source{others.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
