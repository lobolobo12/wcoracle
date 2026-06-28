# 🔮 WCoracle — the World Cup 2026 Oracle

A free, self-updating web app that forecasts the **2026 FIFA World Cup**: title odds,
group qualification chances, match predictions, a knockout outlook, and **value picks**
(where the bookmakers' odds look generous vs. the model). It installs on an iPhone like
a normal app — no App Store, no cost.

> Built for the group stage + knockouts, dynamic with results and "sentiment", exactly as
> requested. It's for fun and arguments down the pub — football laughs at math. ⚽

---

## 📲 Put it on your iPhone (for the uncle)

1. Open the link in **Safari**: **https://lobolobo12.github.io/wcoracle/**
   *(this works once GitHub Pages is turned on — see "Going live" below).*
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen** → **Add**.
4. You now have a **WCoracle icon** on your home screen. Open it like any app —
   it runs full-screen and even works offline.

That's it. No account, no install, no payment.

---

## 🧭 What the five tabs do

| Tab | What you get |
|-----|--------------|
| 🏆 **Oracle** | Every team's chance to win the trophy + "fair odds", from thousands of simulated tournaments. |
| 📊 **Groups** | Live standings from real results, plus each team's chance to reach the knockouts (top 2 **+ 8 best 3rd-placed**, the real 48-team format). |
| ⚽ **Matches** | Win/draw/loss % and likeliest scoreline for every fixture. Type in a bookie's odds and it flags where there's **value to be gained**. You can also enter/edit any score here. |
| 🥊 **Knockout** | Each team's odds of reaching R16 / QF / SF / winning it all, plus a projected final. |
| 🎛️ **Tune** | Nudge any team up or down with a **sentiment** slider (injury news, hot streak, drama). Toggle host advantage and simulation depth. |

Everything you type (scores, sentiment, settings) is saved on the phone and survives reloads.

---

## 🧠 How the Oracle works (plain version)

1. **Strength rating** — each of the 48 teams has an Elo-style rating (`js/data.js`).
2. **Expected goals** — the rating gap is turned into expected goals for each side.
3. **Scoreline odds** — a *Poisson* model turns expected goals into win/draw/loss and
   exact-score probabilities (`Oracle.previewMatch`).
4. **Simulation** — the rest of the tournament is played out **thousands of times**
   (`Oracle.simulate`). Matches already played use the real scores; the rest are rolled
   from the model. Counting how often each team finishes 1st/2nd, qualifies, or lifts the
   cup gives the percentages you see.
5. **Dynamic with history** — teams that over/under-perform in matches already played get
   a small automatic **form** boost or penalty. Your **sentiment** sliders stack on top.
6. **Value** — for any market, `edge = your odds × model probability − 1`. Positive = the
   Oracle thinks it's a better bet than the price implies.

It's a model, not a crystal ball (well… 🔮). Treat the knockout bracket as a guide — FIFA's
exact slotting of the 8 best third-placed teams can change real matchups.

---

## 🔄 Auto-updating results

A scheduled GitHub Action (`.github/workflows/update-results.yml`) runs every few hours,
pulls the latest group-stage scores from a **free, no-key public source**, and commits them
to `data/results.json`. The app loads that file on open, so it stays current on its own.
**Any score you enter by hand in the app always wins** over the auto-feed.

- **Change the data source:** set a repo Variable `WCORACLE_SOURCE_URL` to any URL that
  returns results JSON — the parser in `scripts/fetch-results.mjs` handles several common
  shapes (openfootball-style `rounds/matches`, flat arrays, `score.ft` or `score1/score2`).
- **Safety:** if the source is unreachable or would *reduce* the number of known results,
  the existing file is left untouched — it never wipes good data.

---

## 🚀 Going live (basically automatic)

1. The **Deploy to GitHub Pages** workflow runs on every push and **auto-enables Pages**
   (`configure-pages` with `enablement: true`), then publishes the site at
   `https://lobolobo12.github.io/wcoracle/`. No manual Pages setting needed.
2. If your org/account blocks auto-enable, do it once by hand:
   **Settings → Pages → Build and deployment → Source: “GitHub Actions”**, then re-run the
   workflow from the **Actions** tab.
3. (Optional) In **Settings → Actions → General**, allow workflows to **write**, so the
   results auto-updater can commit. Then trigger **Update results** once from the Actions
   tab to confirm it works.

---

## 🛠️ Run / tweak locally

```bash
# serve the folder (any static server works)
python3 -m http.server 8000
# then open http://localhost:8000

# regenerate the app icons after editing icons/icon.svg
node scripts/make-icons.mjs

# pull fresh results manually
node scripts/fetch-results.mjs
```

- **Adjust a team's strength:** edit its `rating` in `js/data.js`.
- **Tune the model:** constants live at the top of `js/engine.js` (`totalGoals`, `perGoal`,
  `hostBonus`, `formScale`).

No build step, no dependencies — just HTML, CSS and vanilla JS.

---

## 📁 Layout

```
index.html              app shell + tab bar
css/styles.css          dark, mobile-first, iPhone safe-area aware
js/data.js              48 teams, 12 groups, seed results (edit ratings here)
js/engine.js            Poisson model + Monte Carlo simulator (no DOM)
js/app.js               UI, state, localStorage, runs the engine in chunks
data/results.json       auto-updated live results (manual edits win in-app)
scripts/fetch-results.mjs   pulls + maps results from a free source
scripts/make-icons.mjs      generates PNG icons from the SVG
manifest.webmanifest, sw.js, icons/   PWA / Add-to-Home-Screen
.github/workflows/      auto-update results + deploy to Pages
```
