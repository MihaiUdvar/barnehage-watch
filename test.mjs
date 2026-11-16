// Unit tests for the parser and the "under 3" matcher. Run: node test.mjs
import assert from "node:assert/strict";
import { mentionsUnder3, parseLedigePlasser } from "./ledige_parser.mjs";

const REF = 2026;
const yes = [
  "Lutvannskollen barnehage: 2 plasser under 3 år, ledig fra november",
  "Elmholt barnehage: 1 ledig plass til barn under tre år",
  "Bøler menighetsbarnehage: 1 småbarnsplass ledig fra 1. desember",
  "Foo barnehage: 3 ledige plasser for barn 0-3 år",
  "Foo barnehage: 2 plasser 1–3 år",
  "Hoff terrasse barnehage: ledige plasser barn i alderen 2–6 år",
  "Treklang barnehage: 1 plass for barn 3–6 år, og 1 plass for barn født 2024",
  "Norlandia Myrertoppen: 1 plass for barn født i 2024 fra 1. desember",
  "Foo: 1 plass for barn født 2023–2025",
  "Ravnkollen barnehage: 4 plasser under 3 år, 5 plasser over 3 år",
];
const no = [
  "Barneslottet barnehage: 1 plass over 3 år, ledig fra november",
  "Elmholt barnehage: 1 ledig plass til barn over tre år fra 1. november",
  "Ruseløkka barnehage: 6 ledige plasser for barn 3–6 år, ledig fra september",
  "Sognsveien barnehage: 1 ledig plass for barn 3–5 år",
  "Norlandia Myrertoppen: 1 plass for barn født i 2022 fra 1. desember",
  "Norlandia Gaustadskogen: 2 plasser for barn født i 2021 og 2 plasser for barn over 3 år",
];
for (const t of yes) assert.equal(mentionsUnder3(t, REF), true, `should match: ${t}`);
for (const t of no) assert.equal(mentionsUnder3(t, REF), false, `should NOT match: ${t}`);

const html = `
<h2>Ledige plasser uten søkere</h2><ul><li><a href="https://www.oslo.kommune.no/barnehage/kontakt-oss-om-barnehage/">Kontakt</a></li></ul>
<h2>Liste over ledige barnehageplasser per bydel</h2>
<h3>Bydel Alna (oppdatert 16. november 2026)</h3>
<ul><li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/lutvannskollen-barnehage/">Lutvannskollen barnehage</a>: 2 plasser under 3 år</li>
<li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/lohogda-barnehage/">Lohøgda barnehage</a>: 1 plass over 3 år</li></ul>
<h3>Bydel Gamle Oslo (oppdatert 15. september 2026)</h3><p>Ingen ledige plasser.</p>
<h3>Bydel Frogner (oppdatert 26. oktober 2026)</h3>
<ul><li><a href="https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/gydas-vei-barnehage/">Gydas Vei barnehage:</a> 1 plass ledig for barn 3-6 år</li></ul>`;

const entries = parseLedigePlasser(html);
assert.equal(entries.length, 3);
assert.deepEqual(entries[0], {
  bydel: "Alna",
  updated: "16. november 2026",
  url: "https://www.oslo.kommune.no/barnehage/finn-barnehage-i-oslo/lutvannskollen-barnehage",
  name: "Lutvannskollen barnehage",
  text: "Lutvannskollen barnehage: 2 plasser under 3 år",
});
assert.equal(entries[2].name, "Gydas Vei barnehage");
assert.equal(entries[2].bydel, "Frogner");
assert.equal(entries.filter((e) => mentionsUnder3(e.text, REF)).length, 1);

console.log(`All tests passed (${yes.length + no.length} matcher cases, parser ok).`);
