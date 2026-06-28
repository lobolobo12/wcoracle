/* ============================================================================
 * WCoracle — Prediction Engine
 * Pure forecasting logic: no DOM, no globals beyond `Oracle`.
 *
 * Model in one sentence: each team has a strength rating; the rating gap is
 * turned into expected goals for each side; a Poisson model turns expected
 * goals into a full scoreline distribution; Monte Carlo simulation rolls the
 * whole tournament thousands of times to get qualification + title odds.
 * ==========================================================================*/
(function (global) {
  "use strict";

  // --- Tunables ------------------------------------------------------------
  const DEFAULTS = {
    totalGoals: 2.65,   // avg combined goals in an even WC match
    perGoal: 150,       // rating points worth ~1 goal of supremacy
    maxGoals: 9,        // truncate Poisson scoreline grid here
    hostBonus: 45,      // rating boost for host nations (MEX/CAN/USA) at home
    formScale: 70,      // a full +1 sentiment slider is worth this many points
  };

  // --- Small math helpers --------------------------------------------------
  const FACT = (() => {
    const f = [1];
    for (let i = 1; i <= 20; i++) f[i] = f[i - 1] * i;
    return f;
  })();

  function poissonPmf(k, lambda) {
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / FACT[k];
  }

  // Draw a Poisson sample (Knuth) — used by the Monte Carlo simulator.
  function poissonSample(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  // --- Core: rating gap -> expected goals for each side --------------------
  function expectedGoals(ratingA, ratingB, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const supremacy = (ratingA - ratingB) / o.perGoal;
    let la = o.totalGoals / 2 + supremacy / 2;
    let lb = o.totalGoals / 2 - supremacy / 2;
    la = Math.max(0.18, la);
    lb = Math.max(0.18, lb);
    return [la, lb];
  }

  // Full analytic match preview from two ratings.
  function previewMatch(ratingA, ratingB, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const [la, lb] = expectedGoals(ratingA, ratingB, o);
    let pHome = 0, pDraw = 0, pAway = 0;
    const scoreList = [];
    for (let i = 0; i <= o.maxGoals; i++) {
      for (let j = 0; j <= o.maxGoals; j++) {
        const p = poissonPmf(i, la) * poissonPmf(j, lb);
        if (i > j) pHome += p;
        else if (i === j) pDraw += p;
        else pAway += p;
        scoreList.push({ i, j, p });
      }
    }
    const norm = pHome + pDraw + pAway;
    pHome /= norm; pDraw /= norm; pAway /= norm;
    scoreList.sort((a, b) => b.p - a.p);
    return {
      pHome, pDraw, pAway,
      xgHome: la, xgAway: lb,
      topScores: scoreList.slice(0, 4).map((s) => ({
        score: s.i + "–" + s.j, p: s.p / norm,
      })),
      // Expected league points (3/1/0) — handy for projected group tables.
      epHome: 3 * pHome + pDraw,
      epAway: 3 * pAway + pDraw,
    };
  }

  // --- Effective rating: base + host bonus + sentiment/form ----------------
  function effectiveRating(team, isHost, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    let r = team.rating;
    if (isHost) r += o.hostBonus;
    if (typeof team.sentiment === "number") r += team.sentiment * o.formScale;
    if (typeof team.formAdj === "number") r += team.formAdj; // auto in-tournament form
    return r;
  }

  const HOSTS = { MEX: true, CAN: true, USA: true };
  function isHost(team) { return !!HOSTS[team.code]; }

  // --- Build the round-robin fixtures for a group of 4 ---------------------
  // Standard ordering keeps it deterministic and readable.
  const RR_PAIRS = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];
  function groupFixtures(teams) {
    return RR_PAIRS.map(([h, a]) => ({ home: teams[h], away: teams[a] }));
  }

  // Apply already-entered results onto a fresh standings table.
  function blankRow(team) {
    return { team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  }
  function applyResult(rowH, rowA, hg, ag) {
    rowH.P++; rowA.P++;
    rowH.GF += hg; rowH.GA += ag; rowA.GF += ag; rowA.GA += hg;
    rowH.GD = rowH.GF - rowH.GA; rowA.GD = rowA.GF - rowA.GA;
    if (hg > ag) { rowH.W++; rowA.L++; rowH.Pts += 3; }
    else if (hg < ag) { rowA.W++; rowH.L++; rowA.Pts += 3; }
    else { rowH.D++; rowA.D++; rowH.Pts++; rowA.Pts++; }
  }

  function sortRows(rows) {
    return rows.slice().sort((a, b) =>
      b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF ||
      a.team.name.localeCompare(b.team.name));
  }

  // Current (actual) standings for one group given played results.
  function currentStandings(teams, results) {
    const rows = {};
    teams.forEach((t) => (rows[t.code] = blankRow(t)));
    (results || []).forEach((r) => {
      if (rows[r.home] && rows[r.away]) {
        applyResult(rows[r.home], rows[r.away], r.hg, r.ag);
      }
    });
    return sortRows(Object.values(rows));
  }

  // --- Derive in-tournament "form" from played results ---------------------
  // Teams that overperform their expected goal difference get a small boost.
  function deriveForm(groups, resultsByGroup, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const form = {};
    Object.keys(groups).forEach((g) => {
      const teams = groups[g];
      const byCode = {}; teams.forEach((t) => (byCode[t.code] = t));
      (resultsByGroup[g] || []).forEach((r) => {
        const h = byCode[r.home], a = byCode[r.away];
        if (!h || !a) return;
        const [xh, xa] = expectedGoals(
          effectiveRating(h, isHost(h), o), effectiveRating(a, isHost(a), o), o);
        const surpriseH = (r.hg - r.ag) - (xh - xa); // + means overperformed
        form[h.code] = (form[h.code] || 0) + surpriseH;
        form[a.code] = (form[a.code] || 0) - surpriseH;
      });
    });
    // Convert goal-surprise into a capped rating nudge.
    Object.keys(form).forEach((c) => {
      form[c] = Math.max(-90, Math.min(90, form[c] * 22));
    });
    return form;
  }

  // ========================================================================
  // Monte Carlo: simulate the whole tournament many times.
  // ========================================================================
  function simulate(groups, resultsByGroup, opts) {
    const o = Object.assign({}, DEFAULTS, opts);
    const N = o.sims || 4000;
    const groupKeys = Object.keys(groups).sort();

    // Pre-compute effective ratings (incl. auto form) once.
    const form = deriveForm(groups, resultsByGroup, o);
    const eff = {};
    groupKeys.forEach((g) => groups[g].forEach((t) => {
      const tt = Object.assign({}, t, { formAdj: form[t.code] || 0 });
      eff[t.code] = effectiveRating(tt, isHost(tt), o);
    }));

    // Accumulators.
    const stat = {};
    groupKeys.forEach((g) => groups[g].forEach((t) => {
      stat[t.code] = {
        team: t, group: g,
        first: 0, second: 0, third: 0, qualify: 0,
        r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0,
      };
    }));

    function sampleGoals(ca, cb) {
      const [la, lb] = expectedGoals(eff[ca], eff[cb], o);
      return [poissonSample(la), poissonSample(lb)];
    }
    // Single knockout match: returns winner code (penalties = slight edge to favourite).
    function knockout(ca, cb) {
      let [ga, gb] = sampleGoals(ca, cb);
      if (ga === gb) {
        const pa = 1 / (1 + Math.pow(10, (eff[cb] - eff[ca]) / 400));
        return Math.random() < 0.5 + (pa - 0.5) * 0.4 ? ca : cb;
      }
      return ga > gb ? ca : cb;
    }

    for (let s = 0; s < N; s++) {
      const thirds = [];
      const advancing = []; // { code, group, rank, Pts, GD, GF }
      groupKeys.forEach((g) => {
        const teams = groups[g];
        const rows = {};
        teams.forEach((t) => (rows[t.code] = blankRow(t)));
        // Played fixtures: use real scores. Unplayed: simulate.
        const played = {};
        (resultsByGroup[g] || []).forEach((r) => {
          played[r.home + "v" + r.away] = r;
        });
        groupFixtures(teams).forEach((fx) => {
          const key = fx.home.code + "v" + fx.away.code;
          const altKey = fx.away.code + "v" + fx.home.code;
          let hg, ag;
          if (played[key]) { hg = played[key].hg; ag = played[key].ag; }
          else if (played[altKey]) { hg = played[altKey].ag; ag = played[altKey].hg; }
          else { [hg, ag] = sampleGoals(fx.home.code, fx.away.code); }
          applyResult(rows[fx.home.code], rows[fx.away.code], hg, ag);
        });
        const sorted = sortRows(Object.values(rows));
        stat[sorted[0].team.code].first++;
        stat[sorted[1].team.code].second++;
        stat[sorted[2].team.code].third++;
        advancing.push(mkSeed(sorted[0], g, 1), mkSeed(sorted[1], g, 2));
        thirds.push(mkSeed(sorted[2], g, 3));
      });

      // 8 best third-placed teams advance.
      thirds.sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || Math.random() - 0.5);
      const bestThirds = thirds.slice(0, 8);
      bestThirds.forEach((t) => advancing.push(t));

      advancing.forEach((t) => {
        stat[t.code].qualify++;
        stat[t.code].r32++;
      });

      // Seed the Round of 32 by overall strength of qualifiers (group winners,
      // then runners-up, then best thirds; ties by Pts/GD/GF). Standard bracket.
      advancing.sort((a, b) =>
        a.rank - b.rank || b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || Math.random() - 0.5);
      let round = advancing.map((t) => t.code);
      const reachKey = ["r16", "qf", "sf", "final", "champion"];
      let ri = 0;
      while (round.length > 1) {
        const next = [];
        for (let k = 0; k < round.length / 2; k++) {
          const w = knockout(round[k], round[round.length - 1 - k]);
          next.push(w);
        }
        next.forEach((c) => { if (reachKey[ri]) stat[c][reachKey[ri]]++; });
        round = next;
        ri++;
      }
    }

    function mkSeed(row, g, rank) {
      return { code: row.team.code, group: g, rank, Pts: row.Pts, GD: row.GD, GF: row.GF };
    }

    // Normalise to probabilities.
    const out = {};
    Object.keys(stat).forEach((c) => {
      const s = stat[c];
      out[c] = {
        team: s.team, group: s.group,
        pFirst: s.first / N, pSecond: s.second / N, pThird: s.third / N,
        pQualify: s.qualify / N,
        pR16: s.r16 / N, pQF: s.qf / N, pSF: s.sf / N,
        pFinal: s.final / N, pChampion: s.champion / N,
        effRating: eff[c], formAdj: form[c] || 0,
      };
    });
    return { teams: out, sims: N };
  }

  // --- Value / "where is more to be gained" --------------------------------
  // edge = modelProb * decimalOdds - 1.  Positive => value bet.
  function value(modelProb, decimalOdds) {
    if (!decimalOdds || decimalOdds <= 1) return null;
    const implied = 1 / decimalOdds;
    return {
      modelProb,
      impliedProb: implied,
      edge: modelProb * decimalOdds - 1,
      fairOdds: modelProb > 0 ? 1 / modelProb : Infinity,
    };
  }

  global.Oracle = {
    DEFAULTS,
    previewMatch,
    expectedGoals,
    effectiveRating,
    isHost,
    groupFixtures,
    currentStandings,
    sortRows,
    deriveForm,
    simulate,
    value,
  };
})(typeof window !== "undefined" ? window : globalThis);
