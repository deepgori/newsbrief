/**
 * Daily 8am (Sydney) briefing: always published to the website's Briefing
 * page (data/digests/DATE.json); also emailed if Gmail is configured.
 *
 * The workflow runs every ~10 minutes; this script does nothing until a run
 * lands at/after 8am Sydney (daylight saving handled), and only runs when it's 8am or
 * later in Sydney AND today's briefing hasn't been recorded in data/digests/.
 *
 * Email is optional: without GMAIL_USER, GMAIL_APP_PASSWORD and
 * DIGEST_RECIPIENTS the briefing is published to the site only.
 *
 *   npm run digest                 # publish (and email) if due
 *   npm run digest -- --force      # do it now regardless of time / already-done
 *   npm run digest -- --dry-run    # write a preview HTML file, send nothing
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { renderHtml, renderText } from "./email-template.js";
import { buildSections } from "./sections.js";
import { digestExists, loadStories, saveDigest } from "./store.js";
import { sydneyLongDate, sydneyNow } from "./time.js";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY_RUN = args.has("--dry-run");
const SEND_HOUR = 8;

async function main() {
  const { date, hour } = sydneyNow();
  if (!FORCE && !DRY_RUN) {
    if (hour < SEND_HOUR) return console.log(`Not yet ${SEND_HOUR}am in Sydney (hour=${hour}); skipping.`);
    if (digestExists(date)) return console.log(`Digest for ${date} already sent; skipping.`);
  }

  const sections = buildSections(loadStories());
  const count = sections.reduce((n, s) => n + s.stories.length, 0);
  if (!count) throw new Error("No stories from the last 24 hours; has ingest been running?");

  const dateLabel = sydneyLongDate();
  const html = renderHtml(dateLabel, sections, process.env.SITE_URL);
  const text = renderText(dateLabel, sections);

  if (DRY_RUN) {
    const out = fileURLToPath(new URL("../out/digest-preview.html", import.meta.url));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    return console.log(`Dry run: ${count} stories in ${sections.length} sections. Preview: ${out}`);
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const recipients = (process.env.DIGEST_RECIPIENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const emailOn = Boolean(user && pass && recipients.length);

  if (emailOn) {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transport.sendMail({
      from: `"Morning Briefing" <${user}>`,
      to: user,
      bcc: recipients, // recipients don't see each other
      subject: `Morning Briefing: ${dateLabel}`,
      html,
      text,
    });
  }

  saveDigest({
    date,
    sentAt: new Date().toISOString(),
    recipients: emailOn ? recipients.length : 0,
    sections: sections.map((s) => ({ title: s.title, storyIds: s.stories.map((x) => x.id) })),
  });
  console.log(
    emailOn
      ? `Published and emailed briefing for ${date}: ${count} stories to ${recipients.length} recipient(s).`
      : `Published briefing for ${date} to the site (${count} stories). Email not configured, so nothing was sent.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
