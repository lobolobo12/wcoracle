#!/usr/bin/env node
/* ============================================================================
 * WCoracle — auto-update group-stage results.
 *
 * Pulls the latest WC2026 results from a free, no-key public source and writes
 * them into data/results.json in WCoracle's schema. Run by the scheduled
 * GitHub Action (.github/workflows/update-results.yml).
 *
 * SAFETY: if the fetch fails, the source is unreachable, or the parsed result
 * count would REGRESS below what we already have, the existing file is left
 * untouched. We never wipe good data.
 *
 * SWAP THE SOURCE: set repo/Action env `WCORACLE_SOURCE_URL` to any URL that
 * returns one of the shapes handled by extractMatches() below.
 * ==========================================================================*/
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "results.json");

// Single source of truth for the 48 teams: code, group and name aliases.
const TEAMS = [
  ["A","MEX",["mexico"]],["A","RSA",["south africa"]],["A","KOR",["south korea","korea republic","korea"]],["A","CZE",["czechia","czech republic"]],
  ["B","CAN",["canada"]],["B","BIH",["bosnia and herzegovina","bosnia"]],["B","QAT",["qatar"]],["B","SUI",["switzerland"]],
  ["C","BRA",["brazil"]],["C","MAR",["morocco"]],["C","HAI",["haiti"]],["C","SCO",["scotland"]],
  ["D","USA",["united states","usa","united states of america"]],["D","PAR",["paraguay"]],["D","AUS",["australia"]],["D","TUR",["turkiye","turkey"]],
  ["E","GER",["germany"]],["E","CUW",["curacao"]],["E","CIV",["cote divoire","ivory coast","cote d ivoire"]],["E","ECU",["ecuador"]],
  ["F","NED",["netherlands","holland"]],["F","JPN",["japan"]],["F","SWE",["sweden"]],["F","TUN",["tunisia"]],
  ["G","BEL",["belgium"]],["G","EGY",["egypt"]],["G","IRN",["ir iran","iran"]],["G","NZL",["new zealand"]],
  ["H","ESP",["spain"]],["H","CPV",["cabo verde","cape verde"]],["H","KSA",["saudi arabia"]],["H","URU",["uruguay"]],
  ["I","FRA",["france"]],["I","SEN",["senegal"]],["I","IRQ",["iraq"]],["I","NOR",["norway"]],
  ["J","ARG",["argentina"]],["J","ALG",["algeria"]],["J","AUT",["austria"]],["J","JOR",["jordan"]],
  ["K","POR",["portugal"]],["K","COD",["dr congo","congo dr","democratic republic of the congo"]],["K","UZB",["uzbekistan"]],["K","COL",["colombia"]],
  ["L","ENG",["england"]],["L","CRO",["croatia"]],["L","GHA",["ghana"]],["L","PAN",["panama"]],
];
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim();
const NAME2CODE = {}; const CODE2GROUP = {};
for (const [g, code, names] of TEAMS) { CODE2GROUP[code] = g; names.forEach((n) => (NAME2CODE[norm(n)] = code)); }
const codeOf = (name) => NAME2CODE[norm(name)] || null;

const SOURCES = [
  process.env.WCORACLE_SOURCE_URL,
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/cup.json",
].filter(Boolean);

// Normalize any of several known JSON shapes into flat match objects.
function extractMatches(json) {
  let raw = [];
  if (Array.isArray(json)) raw = json;
  else if (Array.isArray(json.matches)) raw = json.matches;
  else if (Array.isArray(json.rounds)) raw = json.rounds.flatMap((r) => r.matches || []);
  else if (Array.isArray(json.stages)) raw = json.stages.flatMap((s) => (s.rounds || []).flatMap((r) => r.matches || []));

  const out = [];
  for (const m of raw) {
    const t1 = m.team1?.name || m.team1 || m.home?.name || m.home;
    const t2 = m.team2?.name || m.team2 || m.away?.name || m.away;
    let a, b;
    if (m.score && Array.isArray(m.score.ft)) { [a, b] = m.score.ft; }
    else if (typeof m.score1 === "number") { a = m.score1; b = m.score2; }
    else if (Array.isArray(m.ft)) { [a, b] = m.ft; }
    else if (typeof m.homeScore === "number") { a = m.homeScore; b = m.awayScore; }
    if (!t1 || !t2 || !Number.isFinite(a) || !Number.isFinite(b)) continue; // not played / unknown

    const c1 = codeOf(t1), c2 = codeOf(t2);
    if (!c1 || !c2) continue;
    // Group: explicit field, else infer (both teams share a group).
    let group = (m.group || "").toString().replace(/group/i, "").trim().toUpperCase();
    if (!group && CODE2GROUP[c1] === CODE2GROUP[c2]) group = CODE2GROUP[c1];
    if (!group || CODE2GROUP[c1] !== group || CODE2GROUP[c2] !== group) continue; // group-stage only, sane
    out.push({ group, home: c1, away: c2, hg: a, ag: b, date: (m.date || "").slice(0, 10) });
  }
  // De-dup by group + unordered pair (keep the last seen).
  const map = {};
  out.forEach((r) => (map[r.group + ":" + [r.home, r.away].sort().join("-")] = r));
  return Object.values(map);
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { "user-agent": "wcoracle-bot" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function existing() {
  try { return JSON.parse(readFileSync(OUT, "utf8")); } catch { return { results: [] }; }
}

export { extractMatches, codeOf };

export async function main() {
  const prev = existing();
  let best = null, usedUrl = null;
  for (const url of SOURCES) {
    try {
      const json = await fetchJSON(url);
      const matches = extractMatches(json);
      console.log(`[wcoracle] ${url} -> ${matches.length} parsed results`);
      if (!best || matches.length > best.length) { best = matches; usedUrl = url; }
    } catch (e) { console.log(`[wcoracle] ${url} failed: ${e.message}`); }
  }

  if (!best || best.length === 0) { console.log("[wcoracle] no usable source; keeping existing file."); return; }
  if (best.length < (prev.results?.length || 0)) {
    console.log(`[wcoracle] parsed ${best.length} < existing ${prev.results.length}; keeping existing (no regression).`);
    return;
  }

  best.sort((x, y) => x.group.localeCompare(y.group) || (x.date || "").localeCompare(y.date || ""));
  const payload = {
    updated: new Date().toISOString(),
    source: usedUrl,
    note: "Auto-updated by .github/workflows/update-results.yml. Codes match js/data.js.",
    results: best,
  };
  const next = JSON.stringify(payload, null, 2) + "\n";
  const prevStr = (() => { try { return readFileSync(OUT, "utf8"); } catch { return ""; } })();
  // Compare ignoring the `updated` timestamp so we only commit real changes.
  const strip = (s) => s.replace(/"updated":\s*"[^"]*",?\s*/g, "");
  if (strip(prevStr) === strip(next)) { console.log("[wcoracle] no result changes; not writing."); return; }
  writeFileSync(OUT, next);
  console.log(`[wcoracle] wrote ${best.length} results from ${usedUrl}`);
}

// Auto-run only when invoked directly (not when imported by a test).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
