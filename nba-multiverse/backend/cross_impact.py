"""Cross-impact rules engine — deterministic butterfly ripples from James choices."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from models import PlayerCareerEvent, PlayerImpact

DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=1)
def load_cross_impact_rules() -> dict:
    path = DATA_DIR / "cross_impact_rules.json"
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def rule_key(fork_id: str, choice_id: str) -> str:
    year = fork_id.replace("evt_lebron_", "")
    return f"lebron_{choice_id}_{year}"


def lookup_rule(fork_id: str, choice_id: str) -> dict | None:
    rules = load_cross_impact_rules()
    key = rule_key(fork_id, choice_id)
    if key in rules:
        return rules[key]
    alt = f"{choice_id}_{fork_id}"
    return rules.get(alt)


def get_immediate_impacts(fork_id: str, choice_id: str) -> list[PlayerImpact]:
    rule = lookup_rule(fork_id, choice_id)
    if not rule:
        return []
    out: list[PlayerImpact] = []
    for item in rule.get("immediate_fates", []):
        try:
            out.append(PlayerImpact(
                player_id=str(item["player_id"]),
                legacy=int(item.get("legacy", 0)),
                ring_chance=int(item.get("ring_chance", 0)),
                media_heat=int(item.get("media_heat", 0)),
                team_fit=int(item.get("team_fit", 0)),
                reason=str(item.get("reason", ""))[:40],
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def get_immediate_career_events(fork_id: str, choice_id: str) -> list[PlayerCareerEvent]:
    rule = lookup_rule(fork_id, choice_id)
    if not rule:
        return []
    out: list[PlayerCareerEvent] = []
    for item in rule.get("immediate_career_events", []):
        try:
            pid = str(item["player_id"])
            if pid == "lebron-james":
                continue
            out.append(PlayerCareerEvent(
                player_id=pid,
                timestamp=str(item.get("timestamp", ""))[:10],
                title=str(item.get("title", ""))[:32],
                description=str(item.get("description", ""))[:280],
                vs_real_history=str(item.get("vs_real_history", ""))[:200],
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def get_blocked_real_milestones(fork_id: str, choice_id: str) -> list[dict]:
    rule = lookup_rule(fork_id, choice_id)
    if not rule:
        return []
    return rule.get("npc_milestones_override", [])
