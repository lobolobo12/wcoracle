/* ============================================================================
 * WCoracle — Seed data for the 2026 FIFA World Cup
 *
 * Groups, 48 teams with Elo-style strength ratings, and the group-stage
 * results confirmed through 2026-06-21. This is the starting snapshot; the
 * app merges fresher results from data/results.json (auto-updated) on top,
 * and any manual edits the user makes win over both.
 *
 * Ratings are on the eloratings.net scale (~1450 weakest … ~2150 strongest).
 * Edit freely — they're just the model's opinion of each team's strength.
 * ==========================================================================*/
window.WCDATA = {
  groups: {
    A: [
      { name: "Mexico", code: "MEX", rating: 1880 },
      { name: "South Africa", code: "RSA", rating: 1620 },
      { name: "South Korea", code: "KOR", rating: 1780 },
      { name: "Czechia", code: "CZE", rating: 1790 },
    ],
    B: [
      { name: "Canada", code: "CAN", rating: 1830 },
      { name: "Bosnia and Herzegovina", code: "BIH", rating: 1720 },
      { name: "Qatar", code: "QAT", rating: 1600 },
      { name: "Switzerland", code: "SUI", rating: 1900 },
    ],
    C: [
      { name: "Brazil", code: "BRA", rating: 1990 },
      { name: "Morocco", code: "MAR", rating: 1870 },
      { name: "Haiti", code: "HAI", rating: 1500 },
      { name: "Scotland", code: "SCO", rating: 1800 },
    ],
    D: [
      { name: "United States", code: "USA", rating: 1840 },
      { name: "Paraguay", code: "PAR", rating: 1760 },
      { name: "Australia", code: "AUS", rating: 1740 },
      { name: "Türkiye", code: "TUR", rating: 1830 },
    ],
    E: [
      { name: "Germany", code: "GER", rating: 2030 },
      { name: "Curaçao", code: "CUW", rating: 1530 },
      { name: "Côte d'Ivoire", code: "CIV", rating: 1790 },
      { name: "Ecuador", code: "ECU", rating: 1850 },
    ],
    F: [
      { name: "Netherlands", code: "NED", rating: 2010 },
      { name: "Japan", code: "JPN", rating: 1870 },
      { name: "Sweden", code: "SWE", rating: 1800 },
      { name: "Tunisia", code: "TUN", rating: 1690 },
    ],
    G: [
      { name: "Belgium", code: "BEL", rating: 1950 },
      { name: "Egypt", code: "EGY", rating: 1720 },
      { name: "IR Iran", code: "IRN", rating: 1780 },
      { name: "New Zealand", code: "NZL", rating: 1540 },
    ],
    H: [
      { name: "Spain", code: "ESP", rating: 2129 },
      { name: "Cabo Verde", code: "CPV", rating: 1620 },
      { name: "Saudi Arabia", code: "KSA", rating: 1640 },
      { name: "Uruguay", code: "URU", rating: 1920 },
    ],
    I: [
      { name: "France", code: "FRA", rating: 2084 },
      { name: "Senegal", code: "SEN", rating: 1860 },
      { name: "Iraq", code: "IRQ", rating: 1620 },
      { name: "Norway", code: "NOR", rating: 1880 },
    ],
    J: [
      { name: "Argentina", code: "ARG", rating: 2128 },
      { name: "Algeria", code: "ALG", rating: 1780 },
      { name: "Austria", code: "AUT", rating: 1830 },
      { name: "Jordan", code: "JOR", rating: 1620 },
    ],
    K: [
      { name: "Portugal", code: "POR", rating: 2000 },
      { name: "DR Congo", code: "COD", rating: 1720 },
      { name: "Uzbekistan", code: "UZB", rating: 1660 },
      { name: "Colombia", code: "COL", rating: 1930 },
    ],
    L: [
      { name: "England", code: "ENG", rating: 2055 },
      { name: "Croatia", code: "CRO", rating: 1900 },
      { name: "Ghana", code: "GHA", rating: 1720 },
      { name: "Panama", code: "PAN", rating: 1640 },
    ],
  },

  // Results use team CODES (matching the groups above) so they survive renames.
  // hg = home goals, ag = away goals.
  results: [
    { group: "A", home: "MEX", away: "RSA", hg: 2, ag: 0, date: "2026-06-11" },
    { group: "A", home: "KOR", away: "CZE", hg: 2, ag: 1, date: "2026-06-11" },
    { group: "A", home: "MEX", away: "KOR", hg: 1, ag: 0, date: "2026-06-18" },
    { group: "A", home: "CZE", away: "RSA", hg: 1, ag: 1, date: "2026-06-18" },

    { group: "B", home: "CAN", away: "BIH", hg: 1, ag: 1, date: "2026-06-12" },
    { group: "B", home: "SUI", away: "QAT", hg: 1, ag: 1, date: "2026-06-13" },
    { group: "B", home: "SUI", away: "BIH", hg: 4, ag: 1, date: "2026-06-18" },
    { group: "B", home: "CAN", away: "QAT", hg: 6, ag: 0, date: "2026-06-18" },

    { group: "C", home: "BRA", away: "MAR", hg: 1, ag: 1, date: "2026-06-13" },
    { group: "C", home: "SCO", away: "HAI", hg: 1, ag: 0, date: "2026-06-13" },
    { group: "C", home: "SCO", away: "MAR", hg: 0, ag: 1, date: "2026-06-19" },
    { group: "C", home: "BRA", away: "HAI", hg: 3, ag: 0, date: "2026-06-19" },

    { group: "D", home: "USA", away: "PAR", hg: 4, ag: 1, date: "2026-06-12" },
    { group: "D", home: "AUS", away: "TUR", hg: 2, ag: 0, date: "2026-06-13" },
    { group: "D", home: "USA", away: "AUS", hg: 2, ag: 0, date: "2026-06-19" },
    { group: "D", home: "TUR", away: "PAR", hg: 0, ag: 1, date: "2026-06-19" },

    { group: "E", home: "GER", away: "CUW", hg: 7, ag: 1, date: "2026-06-14" },
    { group: "E", home: "CIV", away: "ECU", hg: 1, ag: 0, date: "2026-06-14" },
    { group: "E", home: "GER", away: "CIV", hg: 2, ag: 1, date: "2026-06-20" },
    { group: "E", home: "ECU", away: "CUW", hg: 0, ag: 0, date: "2026-06-20" },

    { group: "F", home: "NED", away: "JPN", hg: 2, ag: 2, date: "2026-06-14" },
    { group: "F", home: "SWE", away: "TUN", hg: 5, ag: 1, date: "2026-06-14" },
    { group: "F", home: "NED", away: "SWE", hg: 5, ag: 1, date: "2026-06-20" },
    { group: "F", home: "JPN", away: "TUN", hg: 4, ag: 0, date: "2026-06-20" },

    { group: "G", home: "BEL", away: "EGY", hg: 1, ag: 1, date: "2026-06-15" },
    { group: "G", home: "IRN", away: "NZL", hg: 2, ag: 2, date: "2026-06-15" },

    { group: "H", home: "ESP", away: "CPV", hg: 0, ag: 0, date: "2026-06-15" },
    { group: "H", home: "KSA", away: "URU", hg: 1, ag: 1, date: "2026-06-15" },
    { group: "H", home: "ESP", away: "KSA", hg: 4, ag: 0, date: "2026-06-21" },

    { group: "I", home: "FRA", away: "SEN", hg: 3, ag: 1, date: "2026-06-16" },
    { group: "I", home: "IRQ", away: "NOR", hg: 1, ag: 4, date: "2026-06-16" },

    { group: "J", home: "ARG", away: "ALG", hg: 3, ag: 0, date: "2026-06-16" },
    { group: "J", home: "AUT", away: "JOR", hg: 3, ag: 1, date: "2026-06-16" },

    { group: "K", home: "POR", away: "COD", hg: 1, ag: 1, date: "2026-06-17" },
    { group: "K", home: "UZB", away: "COL", hg: 1, ag: 3, date: "2026-06-17" },

    { group: "L", home: "ENG", away: "CRO", hg: 4, ag: 2, date: "2026-06-17" },
    { group: "L", home: "GHA", away: "PAN", hg: 1, ag: 0, date: "2026-06-17" },
  ],
};
