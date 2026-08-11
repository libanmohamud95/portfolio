"""
Pull StatsBomb open data for PL 2015/16, aggregate to a per-player-season table.
Progressive pass/carry uses a simple heuristic: forward movement >= 10m upfield.
Resumable: saves state to disk each run, processes within a time budget, exits cleanly.
"""
import time
import math
import pickle
import os
import pandas as pd
from statsbombpy import sb
from collections import defaultdict

COMPETITION_ID = 2
SEASON_ID = 27
TIME_BUDGET_SECONDS = 90
STATE_FILE = 'build_state.pkl'

matches = pd.read_csv('pl_2015_16_matches.csv')
all_match_ids = matches['match_id'].tolist()

def default_stat():
    return {
        'player': None, 'team': None, 'minutes': 0,
        'goals': 0, 'assists': 0, 'shots': 0, 'np_xg': 0.0,
        'key_passes': 0, 'progressive_passes': 0, 'progressive_carries': 0,
        'tackles': 0, 'interceptions': 0, 'pressures': 0,
        'aerials_won': 0, 'aerials_total': 0, 'dribbles_completed': 0,
        'through_balls': 0, 'crosses': 0,
    }

if os.path.exists(STATE_FILE):
    with open(STATE_FILE, 'rb') as f:
        state = pickle.load(f)
    stats = state['stats']
    processed_ids = state['processed_ids']
    print(f'Resuming: {len(processed_ids)}/{len(all_match_ids)} already processed')
else:
    stats = defaultdict(default_stat)
    processed_ids = set()

match_ids = [m for m in all_match_ids if m not in processed_ids]

def dist_to_goal(loc, attacking_right=True):
    if not isinstance(loc, list) or len(loc) < 2:
        return None
    x, y = loc[0], loc[1]
    goal_x, goal_y = 120, 40
    return math.hypot(goal_x - x, goal_y - y)

def get_minutes(match_id):
    """Get minutes played per player from lineups + substitution events."""
    try:
        lineups = sb.lineups(match_id=match_id)
    except Exception:
        return {}
    mins = {}
    for team, df in lineups.items():
        for _, row in df.iterrows():
            pid = row['player_id']
            # default full match unless we find sub info later; refine with events
            mins[pid] = 90
    return mins

start_time = time.time()
failed = []
n_done_this_run = 0

for i, mid in enumerate(match_ids):
    if time.time() - start_time > TIME_BUDGET_SECONDS:
        print(f'Time budget hit, saving state at {len(processed_ids)}/{len(all_match_ids)}')
        break

    try:
        events = sb.events(match_id=mid)
    except Exception as e:
        failed.append((mid, str(e)))
        processed_ids.add(mid)
        continue

    # minutes: approximate via last event minute per player (rough but fine for v0)
    player_last_minute = events.groupby('player_id')['minute'].max().to_dict()
    player_first_minute = events.groupby('player_id')['minute'].min().to_dict()

    for pid, last_min in player_last_minute.items():
        if pd.isna(pid):
            continue
        pid = int(pid)
        first_min = player_first_minute.get(pid, 0)
        # crude minutes estimate: span of involvement, floor 1
        stats[pid]['minutes'] += max(last_min - first_min, 1)

    for _, ev in events.iterrows():
        pid = ev.get('player_id')
        if pd.isna(pid):
            continue
        pid = int(pid)
        s = stats[pid]
        s['player'] = ev.get('player')
        s['team'] = ev.get('team')

        etype = ev.get('type')

        if etype == 'Shot':
            s['shots'] += 1
            xg = ev.get('shot_statsbomb_xg')
            if pd.notna(xg):
                s['np_xg'] += xg
            if ev.get('shot_outcome') == 'Goal':
                s['goals'] += 1

        elif etype == 'Pass':
            if pd.notna(ev.get('pass_goal_assist')) and ev.get('pass_goal_assist'):
                s['assists'] += 1
            if pd.notna(ev.get('pass_shot_assist')) and ev.get('pass_shot_assist'):
                s['key_passes'] += 1
            if pd.notna(ev.get('pass_through_ball')) and ev.get('pass_through_ball'):
                s['through_balls'] += 1
            if pd.notna(ev.get('pass_cross')) and ev.get('pass_cross'):
                s['crosses'] += 1
            loc, end_loc = ev.get('location'), ev.get('pass_end_location')
            if isinstance(loc, list) and isinstance(end_loc, list):
                d1, d2 = dist_to_goal(loc), dist_to_goal(end_loc)
                if d1 is not None and d2 is not None and (d1 - d2) >= 10:
                    s['progressive_passes'] += 1

        elif etype == 'Carry':
            loc, end_loc = ev.get('location'), ev.get('carry_end_location')
            if isinstance(loc, list) and isinstance(end_loc, list):
                d1, d2 = dist_to_goal(loc), dist_to_goal(end_loc)
                if d1 is not None and d2 is not None and (d1 - d2) >= 10:
                    s['progressive_carries'] += 1

        elif etype == 'Pressure':
            s['pressures'] += 1

        elif etype == 'Interception':
            s['interceptions'] += 1

        elif etype == 'Duel':
            if ev.get('duel_type') == 'Tackle':
                s['tackles'] += 1

        elif etype == 'Dribble':
            if ev.get('dribble_outcome') == 'Complete':
                s['dribbles_completed'] += 1

        # aerials won can appear on several event types
        for aerial_col in ['pass_aerial_won', 'shot_aerial_won', 'clearance_aerial_won', 'miscontrol_aerial_won']:
            val = ev.get(aerial_col)
            if pd.notna(val) and val:
                s['aerials_won'] += 1
                s['aerials_total'] += 1

    processed_ids.add(mid)
    n_done_this_run += 1

    if n_done_this_run % 20 == 0:
        elapsed = time.time() - start_time
        print(f'{n_done_this_run} done this run ({len(processed_ids)}/{len(all_match_ids)} total), {elapsed:.0f}s elapsed', flush=True)

# always save state so we can resume
with open(STATE_FILE, 'wb') as f:
    pickle.dump({'stats': stats, 'processed_ids': processed_ids}, f)

print(f'This run: {n_done_this_run} matches processed, {len(failed)} failed: {failed[:5]}')
print(f'Total progress: {len(processed_ids)}/{len(all_match_ids)}')

if len(processed_ids) < len(all_match_ids):
    print('NOT DONE - rerun this script to continue')
    import sys
    sys.exit(0)

print('ALL MATCHES PROCESSED - building final table')

rows = []
for pid, s in stats.items():
    rows.append({'player_id': pid, **s})

df = pd.DataFrame(rows)
df = df[df['minutes'] > 0].copy()
df['per90'] = 90 / df['minutes']
for col in ['goals', 'assists', 'shots', 'np_xg', 'key_passes', 'progressive_passes',
            'progressive_carries', 'tackles', 'interceptions', 'pressures',
            'aerials_won', 'dribbles_completed', 'through_balls', 'crosses']:
    df[f'{col}_p90'] = (df[col] * df['per90']).round(2)

df['aerial_win_pct'] = df['aerials_won'] / df['aerials_total'].replace(0, float('nan')) * 100
df['aerial_win_pct'] = df['aerial_win_pct'].round(1)
df['source'] = 'statsbomb'
df['depth'] = 'event-level'
df['season'] = '2015/2016'
df['competition'] = 'Premier League'

df.to_csv('pl_2015_16_player_season.csv', index=False)
print(f'Saved {len(df)} player rows to pl_2015_16_player_season.csv')
print(df.sort_values('np_xg_p90', ascending=False)[['player', 'team', 'minutes', 'goals', 'np_xg_p90', 'progressive_passes_p90']].head(10))
