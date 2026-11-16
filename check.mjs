// Checks the Oslo kommune "ledige barnehageplasser" page for places for
// children under 3, compares with the previous run and emails on changes.
//
// Usage:
//   node check.mjs                 fetch live page, email if changed, save state
//   node check.mjs --dry-run       same, but print the email instead of sending
//   node check.mjs --file p.html   parse a local HTML file instead of fetching
//   node check.mjs --force         send the email even when nothing changed
//   node check.mjs --no-save       do not update state/last.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseLedigePlasser, mentionsUnder3 } from "./ledige_parser.mjs";
import { sendEmail } from "./email.mjs";

const SOURCE = "https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/";
const STATE_FILE = process.env.STATE_FILE || "state/last.json";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const dryRun = flag("--dry-run");
const force = flag("--force");
const save = !flag("--no-save");

// ---------- fetch & parse ----------
let html;
if (flag("--file")) {
  html = readFileSync(args[args.indexOf("--file") + 1], "utf8");
} else {
  const res = await fetch(SOURCE, {
    headers: { "user-agent": "Mozilla/5.0 (barnehage-watch; GitHub Actions)" },
  });
  if (!res.ok) {
    console.error(`Upstream responded ${res.status}`);
    process.exit(1);
  }
  html = await res.text();
}

const all = parseLedigePlasser(html);
if (all.length === 0) {
  // Either the page layout changed or we got an error page. Do not overwrite
  // the state with an empty list, and fail so the Actions run shows red.
  console.error("Parsed 0 kindergartens. Page layout may have changed.");
  process.exit(2);
}

const hits = all.filter((e) => mentionsUnder3(e.text));
console.log(`Parsed ${all.length} kindergartens, ${hits.length} with places for children under 3.`);

// ---------- compare with previous state ----------
const key = (e) => `${e.bydel}|${e.url}|${e.text}`;
const previous = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;
const prevHits = previous ? previous.hits : [];
const prevKeys = new Set(prevHits.map(key));
const currKeys = new Set(hits.map(key));

const added = hits.filter((e) => !prevKeys.has(key(e)));
const removed = prevHits.filter((e) => !currKeys.has(key(e)));
const firstRun = previous === null;
const changed = firstRun || added.length > 0 || removed.length > 0;

console.log(firstRun ? "First run, no previous state." : `Changes since last run: +${added.length} / -${removed.length}`);

// ---------- build email ----------
function groupByBydel(list) {
  const m = new Map();
  for (const e of list) {
    if (!m.has(e.bydel)) m.set(e.bydel, []);
    m.get(e.bydel).push(e);
  }
  return m;
}

function sectionText(title, list) {
  if (list.length === 0) return "";
  let out = `${title}\n${"-".repeat(title.length)}\n`;
  for (const [bydel, items] of groupByBydel(list)) {
    out += `\nBydel ${bydel} (oppdatert ${items[0].updated})\n`;
    for (const e of items) out += `  * ${e.text}\n    ${e.url}\n`;
  }
  return out + "\n";
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sectionHtml(title, list, color) {
  if (list.length === 0) return "";
  let out = `<h2 style="color:${color}">${esc(title)}</h2>`;
  for (const [bydel, items] of groupByBydel(list)) {
    out += `<h3>Bydel ${esc(bydel)} <small style="font-weight:normal">(oppdatert ${esc(items[0].updated)})</small></h3><ul>`;
    for (const e of items) {
      const rest = e.text.startsWith(e.name) ? e.text.slice(e.name.length) : ` ${e.text}`;
      out += `<li><a href="${esc(e.url)}">${esc(e.name)}</a>${esc(rest)}</li>`;
    }
    out += "</ul>";
  }
  return out;
}

const now = new Date().toLocaleString("nb-NO", { timeZone: "Europe/Oslo" });
let subject;
if (firstRun) subject = `Barnehage under 3 år: første oversikt (${hits.length} barnehager)`;
else if (added.length) subject = `Barnehage under 3 år: ${added.length} ny(e)/endret, ${hits.length} totalt`;
else if (removed.length) subject = `Barnehage under 3 år: ${removed.length} fjernet, ${hits.length} totalt`;
else subject = `Barnehage under 3 år: ingen endring (${hits.length} barnehager)`;

const firstTitle = "Alle barnehager med plass under 3 år";
const text =
  `Sjekket ${now}\n${SOURCE}\n\n` +
  sectionText(firstRun ? firstTitle : "Nye eller endrede", firstRun ? hits : added) +
  sectionText("Fjernet siden sist", removed) +
  (firstRun ? "" : sectionText("Hele listen nå", hits));

const htmlBody =
  `<div style="font-family:sans-serif;max-width:700px">` +
  `<p>Sjekket ${esc(now)} &middot; <a href="${SOURCE}">Kilde: oslo.kommune.no</a></p>` +
  sectionHtml(firstRun ? firstTitle : "Nye eller endrede", firstRun ? hits : added, "#1a7f37") +
  sectionHtml("Fjernet siden sist", removed, "#b42318") +
  (firstRun ? "" : sectionHtml("Hele listen nå", hits, "#444")) +
  `</div>`;

// ---------- send ----------
if (changed || force) {
  if (dryRun) {
    console.log(`\n[dry-run] Would send email with subject: ${subject}\n\n${text}`);
  } else {
    await sendEmail({ subject, text, html: htmlBody });
    console.log(`Email sent: ${subject}`);
  }
} else {
  console.log("No change, no email.");
}

// ---------- save state ----------
if (save) {
  mkdirSync("state", { recursive: true });
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ checked_at: new Date().toISOString(), source: SOURCE, hits }, null, 2) + "\n",
  );
  console.log(`State saved to ${STATE_FILE}`);
}
