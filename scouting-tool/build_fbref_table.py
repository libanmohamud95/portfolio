"""
Pull FBref aggregate player-season stats for the Premier League (several recent
seasons) via the `soccerdata` library, producing one player-season-per-row table
tagged source='fbref', depth='aggregate' to match the StatsBomb table's schema.

FBref only exposes 5 player-season stat pages through soccerdata: standard,
shooting, playing_time, keeper, misc. That's enough to cover the notes' shared
core columns (goals, xG, assists, progressive passes/carries, tackles+
interceptions, aerial win%) via 'standard' + 'misc', plus shots/SoT via
'shooting' as a bonus. There is no player-passing or player-possession page at
this granularity, so key_passes/through_balls (present in the StatsBomb table)
have no FBref equivalent here — left out rather than faked.

No stable player ID is available from these pages (FBref player URLs aren't
extracted by soccerdata's read_player_season_stats), so rows are keyed by
(league, season, team, player) name. Cross-source merging in step 2 will need
name-based matching, not ID joins.

Requires a real Chrome install locally — FBref's bot protection means
soccerdata drives an actual browser (via seleniumbase/undetected-chromedriver)
rather than plain requests. Rate limiting (7s+ between requests) and HTML
caching are handled internally by the library; rerunning this script only
re-fetches whatever wasn't already cached.
"""
import sys

import pandas as pd
import soccerdata as sd

LEAGUE = "ENG-Premier League"
SEASONS = ["2022-23", "2023-24", "2024-25"]
OUTPUT = "data/pl_fbref_player_seasons.csv"

STAT_TYPES = ["standard", "misc", "shooting"]


def pick(df: pd.DataFrame, stat_code: str, group_contains: str | None = None) -> pd.Series:
    """Find a column by its FBref stat abbreviation (second level of the
    MultiIndex), optionally disambiguated by a substring of the group name
    (first level). Raises loudly if the match isn't unique, so a change in
    FBref's table structure fails fast instead of silently reading the wrong
    column."""
    matches = [
        col
        for col in df.columns
        if col[1] == stat_code and (group_contains is None or group_contains in col[0])
    ]
    if len(matches) != 1:
        raise ValueError(
            f"Expected exactly one column matching stat={stat_code!r} "
            f"group~={group_contains!r}, found {matches}"
        )
    return df[matches[0]]


def fetch_stats() -> dict[str, pd.DataFrame]:
    fbref = sd.FBref(leagues=LEAGUE, seasons=SEASONS)
    tables = {}
    failed = []
    for stat_type in STAT_TYPES:
        try:
            print(f"Fetching {stat_type} stats for {SEASONS}...", flush=True)
            tables[stat_type] = fbref.read_player_season_stats(stat_type=stat_type)
        except Exception as e:
            print(f"FAILED fetching {stat_type}: {e}", flush=True)
            failed.append(stat_type)
    if failed:
        print(f"\n{len(failed)} stat type(s) failed: {failed}")
        print("Cached responses for successful pulls are saved locally by soccerdata"
              " (~/soccerdata/data/FBref) - rerun this script to retry only what failed.")
    if "standard" not in tables:
        sys.exit("Cannot build table without 'standard' stats - aborting.")
    return tables


def build_table(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    standard = tables["standard"]

    df = pd.DataFrame(index=standard.index)
    df["minutes"] = pick(standard, "Min", "Playing Time")
    df["goals"] = pick(standard, "Gls", "Performance")
    df["assists"] = pick(standard, "Ast", "Performance")
    df["np_xg"] = pick(standard, "npxG", "Expected")
    df["xg"] = pick(standard, "xG", "Expected")
    df["xag"] = pick(standard, "xAG", "Expected")
    df["progressive_passes"] = pick(standard, "PrgP", "Progression")
    df["progressive_carries"] = pick(standard, "PrgC", "Progression")

    if "misc" in tables:
        misc = tables["misc"]
        df["tackles"] = pick(misc, "TklW", "Performance")
        df["interceptions"] = pick(misc, "Int", "Performance")
        df["crosses"] = pick(misc, "Crs", "Performance")
        df["aerials_won"] = pick(misc, "Won", "Aerial")
        aerials_lost = pick(misc, "Lost", "Aerial")
        df["aerials_total"] = df["aerials_won"] + aerials_lost
    else:
        print("Skipping tackles/interceptions/crosses/aerials - 'misc' stats unavailable.")

    if "shooting" in tables:
        shooting = tables["shooting"]
        df["shots"] = pick(shooting, "Sh", "Standard")
        df["shots_on_target"] = pick(shooting, "SoT", "Standard")
    else:
        print("Skipping shots/SoT - 'shooting' stats unavailable.")

    df = df.reset_index()  # league, season, team, player back out as columns
    df = df[df["minutes"] > 0].copy()

    df["per90"] = 90 / df["minutes"]
    p90_cols = [
        c
        for c in [
            "goals", "assists", "np_xg", "xg", "xag", "progressive_passes",
            "progressive_carries", "tackles", "interceptions", "crosses",
            "aerials_won", "shots", "shots_on_target",
        ]
        if c in df.columns
    ]
    for col in p90_cols:
        df[f"{col}_p90"] = (df[col] * df["per90"]).round(2)

    if "aerials_total" in df.columns:
        df["aerial_win_pct"] = (
            df["aerials_won"] / df["aerials_total"].replace(0, float("nan")) * 100
        ).round(1)

    df["source"] = "fbref"
    df["depth"] = "aggregate"
    df["competition"] = "Premier League"
    df = df.drop(columns=["league"])

    return df


if __name__ == "__main__":
    tables = fetch_stats()
    df = build_table(tables)
    df.to_csv(OUTPUT, index=False)
    print(f"\nSaved {len(df)} player-season rows to {OUTPUT}")
    print(df.sort_values("goals", ascending=False)[["player", "team", "season", "minutes", "goals", "np_xg"]].head(10))
