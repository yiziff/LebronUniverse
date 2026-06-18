"""Load seed data from JSON files with caching."""

import json
from pathlib import Path

from models import DecisionEvent, RealHistory, Player, PlayerCareerProfile

DATA_DIR = Path(__file__).parent.parent / "data"

FORK_EVENT_FILES = {
    "evt_lebron_2010": "event_lebron_2010.json",
    "evt_lebron_2014": "event_lebron_2014.json",
    "evt_lebron_2017": "event_lebron_2017.json",
    "evt_lebron_2018": "event_lebron_2018.json",
}

REAL_HISTORY_FILES = {
    "evt_lebron_2010": "real_history.json",
    "evt_lebron_2014": "real_history_2014.json",
    "evt_lebron_2017": "real_history_2017.json",
    "evt_lebron_2018": "real_history_2018.json",
}

_fork_event_cache: dict[str, DecisionEvent] = {}
_real_history_cache: dict[str, RealHistory] = {}
_players_cache: dict[str, Player] | None = None
_all_forks_cache: dict[str, DecisionEvent] | None = None
_milestones_cache: dict[str, PlayerCareerProfile] | None = None
_master_timeline_cache: dict | None = None


def load_players() -> dict[str, Player]:
    global _players_cache
    if _players_cache is None:
        with open(DATA_DIR / "players.json", "r", encoding="utf-8") as f:
            raw = json.load(f)
        _players_cache = {k: Player(**v) for k, v in raw.items()}
    return _players_cache


def load_decision_event(fork_id: str = "evt_lebron_2010") -> DecisionEvent:
    if fork_id not in _fork_event_cache:
        filename = FORK_EVENT_FILES.get(fork_id, "event_lebron_2010.json")
        with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
            _fork_event_cache[fork_id] = DecisionEvent(**json.load(f))
    return _fork_event_cache[fork_id]


def load_all_fork_events() -> dict[str, DecisionEvent]:
    global _all_forks_cache
    if _all_forks_cache is None:
        events: dict[str, DecisionEvent] = {}
        for fid, filename in FORK_EVENT_FILES.items():
            path = DATA_DIR / filename
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    events[fid] = DecisionEvent(**json.load(f))
        _all_forks_cache = events
    return _all_forks_cache


def load_real_history(fork_id: str = "evt_lebron_2010") -> RealHistory:
    if fork_id not in _real_history_cache:
        filename = REAL_HISTORY_FILES.get(fork_id, "real_history.json")
        with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
            _real_history_cache[fork_id] = RealHistory(**json.load(f))
    return _real_history_cache[fork_id]


def load_master_timeline() -> dict:
    global _master_timeline_cache
    if _master_timeline_cache is None:
        path = DATA_DIR / "master_timeline.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                _master_timeline_cache = json.load(f)
        else:
            real = load_real_history("evt_lebron_2010")
            _master_timeline_cache = {
                "forks": [{"fork_id": "evt_lebron_2010", "insert_after_event_id": None}],
                "events": [e.model_dump() for e in real.events],
            }
    return _master_timeline_cache


def load_career_milestones() -> dict[str, PlayerCareerProfile]:
    global _milestones_cache
    if _milestones_cache is None:
        path = DATA_DIR / "player_career_milestones.json"
        if not path.exists():
            _milestones_cache = {}
        else:
            with open(path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            _milestones_cache = {k: PlayerCareerProfile(**v) for k, v in raw.items()}
    return _milestones_cache
