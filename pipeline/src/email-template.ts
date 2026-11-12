import type { Story } from "./types.js";

export interface Section {
  title: string;
  stories: Story[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sourceLinks(story: Story) {
  return story.sources
    .slice(0, 3)
    .map((s) => `<a href="${esc(s.url)}" style="color:#0b6e4f;text-decoration:none;">${esc(s.name)}</a>`)
    .join(" · ");
}

export function renderHtml(dateLabel: string, sections: Section[], siteUrl?: string): string {
  const body = sections
    .map(
      (sec) => `
      <tr><td style="padding:28px 0 8px;">
        <h2 style="margin:0;font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0b6e4f;">${esc(sec.title)}</h2>
      </td></tr>
      ${sec.stories
        .map(
          (s, i) => `
      <tr><td style="padding:12px 0;border-top:1px solid #e6e8eb;">
        <div style="font:600 16px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;">${i + 1}. ${esc(s.headline)}</div>
        <div style="font:400 14px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:#3c4043;margin-top:4px;">${esc(s.summary)}</div>
        <div style="font:400 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#80868b;margin-top:6px;">${sourceLinks(s)}</div>
      </td></tr>`,
        )
        .join("")}`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:12px;padding:8px 28px 28px;">
      <tr><td style="padding:20px 0 4px;">
        <div style="font:800 22px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;">Morning Briefing</div>
        <div style="font:400 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#80868b;margin-top:4px;">${esc(dateLabel)} · Australia &amp; global finance and economy</div>
      </td></tr>
      ${body}
      <tr><td style="padding-top:28px;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#9aa0a6;">
        Summaries are AI-generated from publishers' headlines and ledes; tap a source for the full story.${
          siteUrl ? ` <a href="${esc(siteUrl)}" style="color:#0b6e4f;">Read more on the site</a>.` : ""
        }
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function renderText(dateLabel: string, sections: Section[]): string {
  const lines = [`Morning Briefing: ${dateLabel}`, ""];
  for (const sec of sections) {
    lines.push(`## ${sec.title}`, "");
    sec.stories.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.headline}`, s.summary, `(${s.sources.map((x) => x.name).join(", ")}) ${s.sources[0]?.url ?? ""}`, "");
    });
  }
  return lines.join("\n");
}
