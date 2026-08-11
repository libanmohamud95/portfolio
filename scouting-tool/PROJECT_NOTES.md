# AI Scouting Report Tool — Project Notes

## The idea
An AI scouting copilot: natural-language player queries → filtered shortlist →
scout-style written report. Wedge: aimed at fans/analysts/lower-budget clubs who
can't afford StatsBomb/Wyscout enterprise pricing. v0 goal is proving the engine
works and produces genuinely sharp output — not covering every league.

## Data strategy
Two sources, combined into one player-season table, tagged by source/depth:

- **StatsBomb open data** — PL 2015/16, 380 matches, full event-level data
  (free, licensed for this use — competition_id=2, season_id=27).
  Gives shot locations, pressures, carries — real tactical detail.
- **FBref** (via `soccerdata` or `fbrefdata` libraries) — aggregate per-90 stats,
  broader season/league coverage, but no event-level nuance.
  IMPORTANT: FBref/Stathead rate-limits to 10 requests/min — the libraries handle
  this, don't hand-roll a scraper.

Each player-season row carries `source` and `depth` (`event-level` vs `aggregate`)
so the write-up layer can be honest about what it actually knows — event-level
seasons can talk tactics, aggregate-only seasons should stick to what the numbers
support. This is deliberate: faking tactical depth on aggregate data is how you
end up with generic AI slop instead of a credible report.

## Status as of this session
- ✅ StatsBomb PL 2015/16 fully pulled and aggregated: 549 players,
  `pl_2015_16_player_season.csv`
- ✅ Sanity-checked against reality — Kane's 25 goals (Golden Boot winner),
  Vardy's and Agüero's goal tallies, Mahrez's 17 goals all check out correctly.
  Counting stats (goals, shots, xG) are solid.
- ⚠️ KNOWN ISSUE: minutes-played is a crude estimate (span between a player's
  first and last touch in a match), not real substitution timing. This makes
  per-90 rate stats noisy for squad players/subs. Fix before trusting per-90
  comparisons in a report — use actual substitution event timestamps instead.
- ✅ FBref pull script written: `build_fbref_table.py`, using `soccerdata`
  (chosen over `fbrefdata`: `fbrefdata` is requests-only and only supports
  "Big 5 European Leagues Combined" as a single grouping; `soccerdata` drives
  a real Chrome browser via seleniumbase to get past FBref's bot protection,
  and supports pulling `ENG-Premier League` directly). Pulls `standard` +
  `misc` (+ `shooting` as a bonus) for 2022-23/2023-24/2024-25, covering all
  the shared core columns except key_passes/through_balls (FBref has no
  player-level passing-type page at this granularity — left out rather than
  faked). Rows are keyed by (league, season, team, player) name since FBref's
  player-season pages don't expose a stable player ID via soccerdata.
  **NOT YET EXECUTED**: this dev sandbox's network policy blocks fbref.com
  outright (403 at the egress proxy), so the pull couldn't be run or
  sanity-checked here. Needs to run somewhere with real internet access and
  Chrome installed — a local machine, most likely. Run
  `pip install -r requirements.txt && python build_fbref_table.py` there,
  then sanity-check the output the same way the StatsBomb table was checked
  (known scorers' goal tallies) before trusting it.
- ⬜ Not started: unified schema merge, filter/query layer, LLM write-up
  layer, interface.

## Next steps (in order)
1. Run `build_fbref_table.py` on a machine with real internet access (see
   status note above) and sanity-check the output
2. Normalize both sources into one player-season table (shared core columns:
   goals, xG, assists, progressive passes/carries, tackles+interceptions,
   aerial win%) + source/depth tags
3. Fix minutes-played properly using substitution events
4. Build the filter layer (query → shortlist, deterministic code not LLM)
5. Build the write-up layer (LLM, branches behavior on `depth`)
6. Bare-bones web interface to test on real queries

## Files in this handoff
- `build_statsbomb_table.py` — resumable pull/aggregation script (chunked,
  saves state to `build_state.pkl`, safe to rerun)
- `build_fbref_table.py` — FBref pull/aggregation script via `soccerdata`;
  written but not yet run (see status note above)
- `requirements.txt` — `pandas`, `statsbombpy`, `soccerdata`
- `data/pl_2015_16_player_season.csv` — StatsBomb output: 549 players, 2015/16
  PL season
- `data/pl_2015_16_matches.csv` — raw match list for reference
