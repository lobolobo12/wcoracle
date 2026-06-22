/* ============================================================================
 * WCoracle — app shell. State, persistence, rendering, and orchestrating the
 * Monte Carlo engine in chunks so the phone never freezes.
 * ==========================================================================*/
(function () {
  "use strict";

  const FLAGS = {
    MEX:"🇲🇽",RSA:"🇿🇦",KOR:"🇰🇷",CZE:"🇨🇿",CAN:"🇨🇦",BIH:"🇧🇦",QAT:"🇶🇦",SUI:"🇨🇭",
    BRA:"🇧🇷",MAR:"🇲🇦",HAI:"🇭🇹",SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",USA:"🇺🇸",PAR:"🇵🇾",AUS:"🇦🇺",TUR:"🇹🇷",
    GER:"🇩🇪",CUW:"🇨🇼",CIV:"🇨🇮",ECU:"🇪🇨",NED:"🇳🇱",JPN:"🇯🇵",SWE:"🇸🇪",TUN:"🇹🇳",
    BEL:"🇧🇪",EGY:"🇪🇬",IRN:"🇮🇷",NZL:"🇳🇿",ESP:"🇪🇸",CPV:"🇨🇻",KSA:"🇸🇦",URU:"🇺🇾",
    FRA:"🇫🇷",SEN:"🇸🇳",IRQ:"🇮🇶",NOR:"🇳🇴",ARG:"🇦🇷",ALG:"🇩🇿",AUT:"🇦🇹",JOR:"🇯🇴",
    POR:"🇵🇹",COD:"🇨🇩",UZB:"🇺🇿",COL:"🇨🇴",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",CRO:"🇭🇷",GHA:"🇬🇭",PAN:"🇵🇦",
  };
  const flag = (c) => FLAGS[c] || "🏳️";

  const LS = {
    manual: "wcoracle.manual.v1",
    sentiment: "wcoracle.sentiment.v1",
    settings: "wcoracle.settings.v1",
  };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ---- State -------------------------------------------------------------
  const state = {
    groups: deepGroups(),                 // working copy (sentiment attached at run)
    seed: WCDATA.results.slice(),
    fetched: [],                          // from data/results.json
    fetchedMeta: null,
    manual: load(LS.manual, {}),          // canonKey -> {group,home,away,hg,ag}
    sentiment: load(LS.sentiment, {}),    // code -> -1..1
    settings: Object.assign({ sims: 4000, host: true }, load(LS.settings, {})),
    resultsByGroup: {},
    sim: null,
    tab: "oracle",
    matchFilter: "upcoming",
  };

  function deepGroups() {
    const g = {};
    Object.keys(WCDATA.groups).forEach((k) =>
      (g[k] = WCDATA.groups[k].map((t) => Object.assign({}, t))));
    return g;
  }
  const groupKeys = () => Object.keys(state.groups).sort();
  const allTeams = () => groupKeys().flatMap((g) => state.groups[g].map((t) => ({ ...t, group: g })));

  const canon = (group, a, b) => group + ":" + [a, b].sort().join("-");

  // Merge seed < fetched < manual into one map, then bucket by group.
  function rebuildResults() {
    const map = {};
    const put = (r) => { map[canon(r.group, r.home, r.away)] = { group: r.group, home: r.home, away: r.away, hg: +r.hg, ag: +r.ag }; };
    state.seed.forEach(put);
    state.fetched.forEach(put);
    Object.values(state.manual).forEach(put);
    const rbg = {}; groupKeys().forEach((g) => (rbg[g] = []));
    Object.values(map).forEach((r) => { if (rbg[r.group]) rbg[r.group].push(r); });
    state.resultsByGroup = rbg;
  }
  function resultFor(group, home, away) {
    const map = {};
    [...state.seed, ...state.fetched, ...Object.values(state.manual)].forEach((r) =>
      (map[canon(r.group, r.home, r.away)] = r));
    const r = map[canon(group, home, away)];
    if (!r) return null;
    // Re-orient to the requested home/away.
    return r.home === home ? { hg: +r.hg, ag: +r.ag } : { hg: +r.ag, ag: +r.hg };
  }

  // ---- Effective ratings (sentiment + auto form) -------------------------
  function opts() {
    return { sims: state.settings.sims, hostBonus: state.settings.host ? Oracle.DEFAULTS.hostBonus : 0 };
  }
  function applySentiment() {
    groupKeys().forEach((g) => state.groups[g].forEach((t) => (t.sentiment = state.sentiment[t.code] || 0)));
  }
  function effRatings() {
    applySentiment();
    const o = opts();
    const form = Oracle.deriveForm(state.groups, state.resultsByGroup, o);
    const eff = {};
    allTeams().forEach((t) => {
      const tt = { ...t, sentiment: state.sentiment[t.code] || 0, formAdj: form[t.code] || 0 };
      eff[t.code] = Oracle.effectiveRating(tt, Oracle.isHost(tt), o);
    });
    return { eff, form };
  }

  // ---- Run the Oracle in chunks (8 batches) ------------------------------
  let running = false;
  function runOracle(done) {
    if (running) return;
    running = true;
    applySentiment();
    rebuildResults();
    const o = opts();
    const batches = 8;
    const per = Math.max(150, Math.round(state.settings.sims / batches));
    let i = 0; let sum = null;
    showSim(true);
    const step = () => {
      const r = Oracle.simulate(state.groups, state.resultsByGroup, { ...o, sims: per });
      sum = accumulate(sum, r);
      i++;
      setProgress(i / batches);
      if (i < batches) { setTimeout(step, 0); }
      else {
        state.sim = finalizeSim(sum, batches);
        running = false;
        showSim(false);
        render();
        if (done) done();
      }
    };
    setTimeout(step, 30);
  }
  const PROBS = ["pFirst","pSecond","pThird","pQualify","pR16","pQF","pSF","pFinal","pChampion"];
  function accumulate(sum, r) {
    if (!sum) { sum = { teams: {} }; }
    Object.keys(r.teams).forEach((c) => {
      const s = (sum.teams[c] = sum.teams[c] || { team: r.teams[c].team, group: r.teams[c].group, effRating: r.teams[c].effRating, formAdj: r.teams[c].formAdj });
      PROBS.forEach((p) => (s[p] = (s[p] || 0) + r.teams[c][p]));
    });
    return sum;
  }
  function finalizeSim(sum, batches) {
    const out = { teams: {} };
    Object.keys(sum.teams).forEach((c) => {
      const s = sum.teams[c]; const o = { team: s.team, group: s.group, effRating: s.effRating, formAdj: s.formAdj };
      PROBS.forEach((p) => (o[p] = s[p] / batches));
      out.teams[c] = o;
    });
    return out;
  }

  // ---- Sim progress UI ----------------------------------------------------
  const simBar = document.getElementById("simBar");
  const simFill = simBar.querySelector(".sim-bar-fill");
  function showSim(on) { simBar.hidden = !on; if (on) setProgress(0.04); }
  function setProgress(f) { simFill.style.width = Math.round(f * 100) + "%"; }

  // ---- Helpers ------------------------------------------------------------
  const pct = (p) => (p >= 0.9995 ? "100" : p < 0.001 ? "<0.1" : (p * 100).toFixed(p < 0.1 ? 1 : 0));
  const dec = (p) => (p <= 0 ? "—" : (1 / p).toFixed(p > 0.5 ? 2 : 1));
  const sortedByChampion = () => Object.values(state.sim.teams).sort((a, b) => b.pChampion - a.pChampion || b.pQualify - a.pQualify);

  // ========================================================================
  // RENDER
  // ========================================================================
  const view = document.getElementById("view");
  function render() {
    if (!state.sim) { view.innerHTML = '<div class="empty">Consulting the Oracle…</div>'; return; }
    _effCache = null;
    const fn = { oracle: renderOracle, groups: renderGroups, matches: renderMatches, knockout: renderKnockout, settings: renderSettings }[state.tab];
    view.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fade-in";
    wrap.innerHTML = fn();
    view.appendChild(wrap);
    bindView();
    window.scrollTo({ top: 0 });
  }

  // ---- Oracle tab ---------------------------------------------------------
  function renderOracle() {
    const list = sortedByChampion();
    const fav = list[0];
    const updated = state.fetchedMeta?.updated;
    let h = `<div class="card hero">
      <div class="fav-flag">${flag(fav.team.code)}</div>
      <h2>${fav.team.name}</h2>
      <div class="fav-odds">${pct(fav.pChampion)}% to lift the trophy · fair odds ${dec(fav.pChampion)}</div>
      <div class="fav-sub">The Oracle's favourite, from ${state.sim ? "" : ""}${state.settings.sims.toLocaleString()} simulated tournaments</div>
    </div>`;

    h += `<div class="section-title">Title odds</div><div class="card">`;
    list.slice(0, 16).forEach((t, i) => {
      h += `<div class="leader">
        <div class="rank">${i + 1}</div>
        <div class="flag">${flag(t.team.code)}</div>
        <div class="who"><div class="name">${t.team.name}</div><div class="grp">Group ${t.group} · qualify ${pct(t.pQualify)}%</div>
          <div class="bar"><i style="width:${Math.max(2, t.pChampion / list[0].pChampion * 100).toFixed(0)}%"></i></div>
        </div>
        <div style="text-align:right"><div class="pct">${pct(t.pChampion)}%</div><div class="odds">@ ${dec(t.pChampion)}</div></div>
      </div>`;
    });
    h += `</div>`;
    h += `<p class="hint">Win the trophy = chance of going all the way (winning your group path through the knockout bracket). Fair odds is what a perfectly priced bookmaker would offer.</p>`;
    if (updated) h += `<p class="updated">Results auto-updated: ${new Date(updated).toLocaleString()}</p>`;
    return h;
  }

  // ---- Groups tab ---------------------------------------------------------
  function renderGroups() {
    let h = `<p class="hint">Live standings from results so far, with each team's chance to reach the knockouts (top 2 advance, plus the 8 best 3rd-placed teams across all groups).</p>`;
    groupKeys().forEach((g) => {
      const teams = state.groups[g];
      const rows = Oracle.currentStandings(teams, state.resultsByGroup[g]);
      const played = (state.resultsByGroup[g] || []).length;
      h += `<div class="card"><div class="group-head"><h3>Group ${g}</h3><div class="meta">${played}/6 played</div></div>
        <table class="standings"><thead><tr>
          <th style="text-align:left">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th>Qual</th>
        </tr></thead><tbody>`;
      rows.forEach((r, idx) => {
        const sim = state.sim.teams[r.team.code];
        const q = sim ? sim.pQualify : 0;
        const cls = idx < 2 ? "q1" : idx === 2 ? "q3" : "";
        const badge = q > 0.75 ? "adv" : q > 0.35 ? "maybe" : "out";
        h += `<tr class="${cls}">
          <td class="team"><span class="qbadge ${badge}"></span>${flag(r.team.code)} <span class="team-name">${r.team.name}</span></td>
          <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GD > 0 ? "+" + r.GD : r.GD}</td><td><b>${r.Pts}</b></td>
          <td class="qpct">${pct(q)}%</td>
        </tr>`;
      });
      h += `</tbody></table></div>`;
    });
    h += `<p class="hint">Enter or edit scores in the <b>Matches</b> tab — the whole forecast updates instantly.</p>`;
    return h;
  }

  // ---- Matches tab --------------------------------------------------------
  function renderMatches() {
    const { eff } = lazyEff();
    const fixtures = [];
    groupKeys().forEach((g) => {
      Oracle.groupFixtures(state.groups[g]).forEach((fx) => {
        const res = resultFor(g, fx.home.code, fx.away.code);
        fixtures.push({ g, home: fx.home, away: fx.away, res });
      });
    });
    const upcoming = fixtures.filter((f) => !f.res);
    const played = fixtures.filter((f) => f.res);

    let h = `<div class="chips" style="margin-bottom:10px">
      <button class="btn small ${state.matchFilter === "upcoming" ? "gold" : "ghost"}" data-filter="upcoming">Upcoming (${upcoming.length})</button>
      <button class="btn small ${state.matchFilter === "played" ? "gold" : "ghost"}" data-filter="played">Played (${played.length})</button>
    </div>`;

    const show = state.matchFilter === "upcoming" ? upcoming : played;
    if (!show.length) { h += `<div class="empty">No ${state.matchFilter} matches.</div>`; return h; }

    show.forEach((f) => {
      const pv = Oracle.previewMatch(eff[f.home.code], eff[f.away.code]);
      h += `<div class="card" data-fx="${f.g}|${f.home.code}|${f.away.code}">
        <div class="match">
          <div class="side"><span class="flag">${flag(f.home.code)}</span><span class="nm">${f.home.name}</span></div>
          <div class="mid"><div class="vs">${f.res ? f.res.hg + " – " + f.res.ag : "vs"}</div><div>Group ${f.g}</div></div>
          <div class="side away"><span class="nm">${f.away.name}</span><span class="flag">${flag(f.away.code)}</span></div>
        </div>`;

      if (!f.res) {
        h += `<div class="wdl">
            <div class="w" style="flex:${Math.max(0.05, pv.pHome)}">${pct(pv.pHome)}%</div>
            <div class="d" style="flex:${Math.max(0.05, pv.pDraw)}">${pct(pv.pDraw)}%</div>
            <div class="l" style="flex:${Math.max(0.05, pv.pAway)}">${pct(pv.pAway)}%</div>
          </div>
          <div class="match-meta">
            <span>Likeliest: <b>${pv.topScores[0].score}</b> · xG ${pv.xgHome.toFixed(1)}–${pv.xgAway.toFixed(1)}</span>
          </div>
          <div class="odds-row">
            <label>Bookie odds:</label>
            <span>${flag(f.home.code)}</span><input type="number" step="0.01" min="1" placeholder="H" data-odds="home">
            <span>X</span><input type="number" step="0.01" min="1" placeholder="D" data-odds="draw">
            <span>${flag(f.away.code)}</span><input type="number" step="0.01" min="1" placeholder="A" data-odds="away">
            <span class="value-flag no" data-valueout>enter odds →</span>
          </div>
          <div class="match-meta">
            <span class="score-input">Enter result:
              <input type="number" min="0" max="20" data-sc="hg"> – <input type="number" min="0" max="20" data-sc="ag">
            </span>
            <button class="btn small gold" data-save>Save</button>
          </div>`;
      } else {
        h += `<div class="match-meta">
            <span class="score-input">Edit:
              <input type="number" min="0" max="20" data-sc="hg" value="${f.res.hg}"> – <input type="number" min="0" max="20" data-sc="ag" value="${f.res.ag}">
            </span>
            <span>
              <button class="btn small gold" data-save>Update</button>
              <button class="btn small ghost" data-revert>Revert</button>
            </span>
          </div>`;
      }
      h += `</div>`;
    });

    if (state.matchFilter === "upcoming")
      h += `<p class="hint">💡 <b>Value</b> = the Oracle thinks an outcome is likelier than the bookie's odds imply. A green flag means there's value to be gained on that pick.</p>`;
    return h;
  }

  // ---- Knockout tab -------------------------------------------------------
  function renderKnockout() {
    const list = sortedByChampion().slice(0, 24);
    const heat = (p) => {
      const a = Math.min(0.9, 0.12 + p * 0.9);
      return `background:rgba(255,210,74,${a.toFixed(2)});color:${p > 0.45 ? "#20180a" : "var(--text)"}`;
    };
    const fin = list.slice().sort((a, b) => b.pFinal - a.pFinal);
    let h = `<div class="card hero">
        <div class="fav-sub" style="margin-bottom:4px">PROJECTED FINAL</div>
        <h2 style="font-size:19px">${flag(fin[0].team.code)} ${fin[0].team.name} <span style="color:var(--muted)">vs</span> ${flag(fin[1].team.code)} ${fin[1].team.name}</h2>
        <div class="fav-sub">Most likely finalists by the model — not a fixed bracket</div>
      </div>`;
    h += `<div class="section-title">How far each team goes</div><div class="card">
      <div class="kbar"><div class="h"></div><div class="h">Team</div><div class="h">R16</div><div class="h">QF</div><div class="h">SF</div><div class="h">Win</div></div>`;
    list.forEach((t, i) => {
      h += `<div class="kbar">
        <div class="cell" style="color:var(--muted)">${i + 1}</div>
        <div>${flag(t.team.code)} ${t.team.name}</div>
        <div class="cell heat" style="${heat(t.pR16)}">${pct(t.pR16)}</div>
        <div class="cell heat" style="${heat(t.pQF)}">${pct(t.pQF)}</div>
        <div class="cell heat" style="${heat(t.pSF)}">${pct(t.pSF)}</div>
        <div class="cell heat" style="${heat(t.pChampion)}">${pct(t.pChampion)}</div>
      </div>`;
    });
    h += `</div><p class="hint">Knockout seeding is the Oracle's projection (qualifiers ranked by strength into a standard bracket). FIFA's exact slotting of the 8 best third-placed teams can shift real matchups, so treat the bracket as a guide.</p>`;
    return h;
  }

  // ---- Settings / Tune tab ------------------------------------------------
  function renderSettings() {
    const { form } = lazyEff();
    let h = `<div class="section-title">Engine</div><div class="card">
      <div class="setting-line"><label>Host advantage (MEX/CAN/USA)</label><div class="toggle ${state.settings.host ? "on" : ""}" data-toggle="host"></div></div>
      <div class="setting-line"><label>Simulation depth</label>
        <span class="chips">
          ${[["Fast",1500],["Balanced",4000],["Deep",10000]].map(([n,v]) => `<button class="btn small ${state.settings.sims===v?"gold":"ghost"}" data-sims="${v}">${n}</button>`).join("")}
        </span>
      </div>
    </div>`;

    h += `<div class="section-title">Sentiment — nudge a team up or down</div>
      <p class="hint">Heard something the stats don't know — a key injury, a team on fire, locker-room drama? Slide it. This adjusts the team's strength before the Oracle simulates. Auto-form from played matches is shown as a small ± next to each team.</p>`;
    groupKeys().forEach((g) => {
      h += `<div class="card"><div class="group-head"><h3>Group ${g}</h3></div>`;
      state.groups[g].forEach((t) => {
        const v = Math.round((state.sentiment[t.code] || 0) * 5);
        const f = Math.round(form[t.code] || 0);
        h += `<div class="slider-row">
          <div style="font-size:20px">${flag(t.code)}</div>
          <div>
            <div class="nm">${t.name}</div>
            <div class="grp">base ${t.rating}${f ? ` · form ${f > 0 ? "+" + f : f}` : ""}</div>
            <input type="range" min="-5" max="5" value="${v}" data-sent="${t.code}">
          </div>
          <div class="sentiment-val ${v > 0 ? "up" : v < 0 ? "down" : ""}" data-sentval="${t.code}">${v > 0 ? "+" + v : v}</div>
        </div>`;
      });
      h += `</div>`;
    });

    h += `<div class="card">
        <button class="btn" data-reset-sent>Reset all sentiment</button>
        <button class="btn" data-reset-manual>Clear my manual scores</button>
      </div>
      <p class="hint">WCoracle · a Poisson + Monte-Carlo forecaster. Predictions are for fun and discussion — football laughs at math. ⚽</p>`;
    return h;
  }

  // ========================================================================
  // EVENT BINDING
  // ========================================================================
  function bindView() {
    // Match filter
    view.querySelectorAll("[data-filter]").forEach((b) =>
      b.addEventListener("click", () => { state.matchFilter = b.dataset.filter; render(); }));

    // Odds value calc (live)
    view.querySelectorAll(".card[data-fx]").forEach((card) => {
      const oddsInputs = card.querySelectorAll("[data-odds]");
      const out = card.querySelector("[data-valueout]");
      const [g, hc, ac] = (card.dataset.fx || "").split("|");
      if (oddsInputs.length && out) {
        const { eff } = lazyEff();
        const pv = Oracle.previewMatch(eff[hc], eff[ac]);
        const probs = { home: pv.pHome, draw: pv.pDraw, away: pv.pAway };
        const labels = { home: flag(hc) + " win", draw: "Draw", away: flag(ac) + " win" };
        const recalc = () => {
          let best = null;
          oddsInputs.forEach((inp) => {
            const k = inp.dataset.odds; const v = parseFloat(inp.value);
            const val = Oracle.value(probs[k], v);
            if (val && (!best || val.edge > best.edge)) best = { ...val, k };
          });
          if (!best) { out.className = "value-flag no"; out.textContent = "enter odds →"; return; }
          if (best.edge > 0.02) { out.className = "value-flag yes"; out.textContent = `VALUE: ${labels[best.k]} +${(best.edge * 100).toFixed(0)}%`; }
          else { out.className = "value-flag no"; out.textContent = `no edge (${(best.edge * 100).toFixed(0)}%)`; }
        };
        oddsInputs.forEach((inp) => inp.addEventListener("input", recalc));
      }

      // Save / revert / scores
      const saveBtn = card.querySelector("[data-save]");
      if (saveBtn) saveBtn.addEventListener("click", () => {
        const hg = card.querySelector('[data-sc="hg"]').value;
        const ag = card.querySelector('[data-sc="ag"]').value;
        if (hg === "" || ag === "") return;
        state.manual[canon(g, hc, ac)] = { group: g, home: hc, away: ac, hg: +hg, ag: +ag };
        save(LS.manual, state.manual);
        runOracle();
      });
      const revertBtn = card.querySelector("[data-revert]");
      if (revertBtn) revertBtn.addEventListener("click", () => {
        delete state.manual[canon(g, hc, ac)];
        save(LS.manual, state.manual);
        runOracle();
      });
    });

    // Settings
    view.querySelectorAll("[data-toggle]").forEach((el) => el.addEventListener("click", () => {
      state.settings.host = !state.settings.host; save(LS.settings, state.settings); runOracle();
    }));
    view.querySelectorAll("[data-sims]").forEach((b) => b.addEventListener("click", () => {
      state.settings.sims = +b.dataset.sims; save(LS.settings, state.settings); runOracle();
    }));
    view.querySelectorAll("[data-sent]").forEach((sl) => {
      const code = sl.dataset.sent;
      const lbl = view.querySelector(`[data-sentval="${code}"]`);
      sl.addEventListener("input", () => {
        const v = +sl.value;
        if (lbl) { lbl.textContent = v > 0 ? "+" + v : v; lbl.className = "sentiment-val " + (v > 0 ? "up" : v < 0 ? "down" : ""); }
      });
      sl.addEventListener("change", () => {
        state.sentiment[code] = (+sl.value) / 5; save(LS.sentiment, state.sentiment); runOracle();
      });
    });
    const rs = view.querySelector("[data-reset-sent]");
    if (rs) rs.addEventListener("click", () => { state.sentiment = {}; save(LS.sentiment, state.sentiment); runOracle(); });
    const rm = view.querySelector("[data-reset-manual]");
    if (rm) rm.addEventListener("click", () => { state.manual = {}; save(LS.manual, state.manual); runOracle(); });
  }

  // Cache eff ratings per render to avoid recompute per card.
  let _effCache = null;
  function lazyEff() { return _effCache || (_effCache = effRatings()); }

  // ---- Tabs ---------------------------------------------------------------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("is-active", x === t));
    state.tab = t.dataset.tab; _effCache = null; render();
  }));
  document.getElementById("refreshBtn").addEventListener("click", () => { _effCache = null; runOracle(); });

  // ---- Boot ---------------------------------------------------------------
  function boot() {
    rebuildResults();
    // Try to pull fresher auto-updated results (ignored if offline / absent).
    fetch("data/results.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.results)) { state.fetched = j.results; state.fetchedMeta = j; rebuildResults(); }
      })
      .catch(() => {})
      .finally(() => runOracle(() => { _effCache = null; }));

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  boot();
})();
