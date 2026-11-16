// Parser for https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/
//
// The page is server-rendered: one <h3>Bydel X (oppdatert <date>)</h3> per
// borough, followed by a <ul> with one <li> per kindergarten, or a
// <p>Ingen ledige plasser.</p> when the borough has nothing.

const BARNEHAGE_LINK = /finn-barnehage-i-oslo/;

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").replace(/\s+([:,.])/g, "$1").trim();
}

// True when the free-text description of a kindergarten's open places
// includes places for children under 3. Variants seen on the page:
//   "2 plasser under 3 år"          "1 ledig plass til barn under tre år"
//   "3 småbarnsplasser"             "plasser for barn 0-3 år" / "1–3 år"
//   "barn i alderen 2–6 år"         (range starts below 3 -> includes under 3)
//   "1 plass for barn født 2024"    (born refYear-2 or later -> under 3)
export function mentionsUnder3(text, refYear = new Date().getFullYear()) {
  const t = text.toLowerCase();

  if (/under\s*(3|tre)\s*år/.test(t)) return true;
  if (/småbarn/.test(t)) return true;

  // Age ranges such as "0-3 år", "1–3 år", "2–6 år": low end below 3.
  const rangeRe = /(\d)\s*[–\-]\s*(\d)\s*år/g;
  let r;
  while ((r = rangeRe.exec(t))) {
    if (Number(r[1]) < 3) return true;
  }

  // Birth years: "født 2024", "født i 2024", "født 2023–2024".
  const bornRe = /født\s+(?:i\s+)?(\d{4})(?:\s*[–\-]\s*(\d{4}))?/g;
  let b;
  while ((b = bornRe.exec(t))) {
    const maxYear = Number(b[2] || b[1]);
    if (maxYear >= refYear - 2) return true;
  }

  return false;
}

// Returns [{ bydel, updated, url, name, text }] for every kindergarten
// listed, in page order. `updated` is the borough's "oppdatert" date as
// written on the page.
export function parseLedigePlasser(html) {
  const start = html.search(/<h2[^>]*>\s*Liste over ledige barnehageplasser/i);
  const content = start === -1 ? html : html.slice(start);

  const entries = [];
  const sections = content.split(/<h3[^>]*>/).slice(1);

  for (const section of sections) {
    const headingEnd = section.indexOf("</h3>");
    if (headingEnd === -1) continue;
    const heading = stripTags(section.slice(0, headingEnd));
    const body = section.slice(headingEnd + "</h3>".length);

    const hm = heading.match(/^Bydel\s+(.+?)\s*\(\s*oppdatert\s+(.+?)\s*\)/i);
    if (!hm) continue;
    const bydel = hm[1].trim();
    const updated = hm[2].trim();

    const itemRe = /<(li|p)[^>]*>([\s\S]*?)<\/\1>/gi;
    let item;
    while ((item = itemRe.exec(body))) {
      const inner = item[2];
      const link = inner.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!link || !BARNEHAGE_LINK.test(link[1])) continue;

      const url = link[1].replace(/\/+$/, "");
      const name = stripTags(link[2]).replace(/[:\s]+$/, "");
      const text = stripTags(inner);
      entries.push({ bydel, updated, url, name, text });
    }
  }

  return entries;
}
