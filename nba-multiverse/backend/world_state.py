"""Global World State — James-centric universe with derived NPC fates."""

from __future__ import annotations

import copy
from uuid import uuid4

from pydantic import BaseModel, Field

from models import PlayerCareerEvent, TimelineEvent

NPC_PLAYER_IDS = [
    "dwyane-wade",
    "kevin-durant",
    "paul-george",
    "stephen-curry",
]

FORK_ORDER = [
    "evt_lebron_2010",
    "evt_lebron_2014",
    "evt_lebron_2017",
    "evt_lebron_2018",
]

FORK_YEARS = {
    "evt_lebron_2010": 2010,
    "evt_lebron_2014": 2014,
    "evt_lebron_2017": 2017,
    "evt_lebron_2018": 2018,
}


class JamesChoiceRecord(BaseModel):
    fork_id: str
    choice_id: str
    choice_label: str
    timestamp: str


class JamesRPG(BaseModel):
    championships: int = 0
    legacy: int = 50
    media_favor: int = 50
    fan_reputation: int = 50
    cap_health: int = 50
    physical_toll: int = 0


class NPCFate(BaseModel):
    legacy: int = 50
    ring_chance: int = 50
    media_heat: int = 50
    team_fit: int = 50
    total_swing: int = 0
    last_reason: str = ""


class WorldState(BaseModel):
    universe_id: str = Field(default_factory=lambda: str(uuid4()))
    james_choices: list[JamesChoiceRecord] = Field(default_factory=list)
    james_rpg: JamesRPG = Field(default_factory=JamesRPG)
    npc_fates: dict[str, NPCFate] = Field(default_factory=dict)
    npc_career_events: dict[str, list[PlayerCareerEvent]] = Field(default_factory=dict)
    active_branch_events: list[TimelineEvent] = Field(default_factory=list)
    current_year: int = 2010
    completed_forks: list[str] = Field(default_factory=list)


def _base_npc_fates() -> dict[str, NPCFate]:
    return {pid: NPCFate() for pid in NPC_PLAYER_IDS}


def create_initial_world_state() -> WorldState:
    return WorldState(npc_fates=_base_npc_fates())


def clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def apply_npc_impacts(
    state: WorldState,
    impacts: list[dict],
) -> WorldState:
    """Apply fate deltas to NPC stars (never lebron-james)."""
    s = copy.deepcopy(state)
    fates = s.npc_fates
    for imp in impacts:
        pid = str(imp.get("player_id", "")).lower()
        if pid not in fates or pid == "lebron-james":
            continue
        cur = fates[pid]
        legacy = int(imp.get("legacy", 0))
        ring = int(imp.get("ring_chance", 0))
        media = int(imp.get("media_heat", 0))
        team = int(imp.get("team_fit", 0))
        swing = abs(legacy) + abs(ring) + abs(media) + abs(team)
        fates[pid] = NPCFate(
            legacy=clamp(cur.legacy + legacy, 0, 100),
            ring_chance=clamp(cur.ring_chance + ring, 0, 100),
            media_heat=clamp(cur.media_heat + media, 0, 100),
            team_fit=clamp(cur.team_fit + team, 0, 100),
            total_swing=cur.total_swing + swing,
            last_reason=str(imp.get("reason", cur.last_reason))[:40],
        )
    return s


def push_npc_career_events(
    state: WorldState,
    events: list[PlayerCareerEvent],
) -> WorldState:
    s = copy.deepcopy(state)
    for ev in events:
        if ev.player_id == "lebron-james":
            continue
        lst = list(s.npc_career_events.get(ev.player_id, []))
        lst.append(ev)
        lst.sort(key=lambda e: e.timestamp)
        s.npc_career_events[ev.player_id] = lst
    return s


def record_james_choice(
    state: WorldState,
    fork_id: str,
    choice_id: str,
    choice_label: str,
    timestamp: str,
) -> WorldState:
    s = copy.deepcopy(state)
    s.james_choices = [c for c in s.james_choices if c.fork_id != fork_id]
    s.james_choices.append(
        JamesChoiceRecord(
            fork_id=fork_id,
            choice_id=choice_id,
            choice_label=choice_label,
            timestamp=timestamp,
        )
    )
    if fork_id not in s.completed_forks:
        s.completed_forks.append(fork_id)
    year = FORK_YEARS.get(fork_id, s.current_year)
    s.current_year = max(s.current_year, year)
    return s


def get_next_fork(completed: list[str]) -> str | None:
    for fid in FORK_ORDER:
        if fid not in completed:
            return fid
    return None


def choices_satisfy_prerequisites(
    prerequisite_choices: list[dict],
    james_choices: list[JamesChoiceRecord],
) -> bool:
    if not prerequisite_choices:
        return True
    choice_map = {c.fork_id: c.choice_id for c in james_choices}
    for req in prerequisite_choices:
        fork_id = req.get("fork_id", "")
        allowed = req.get("choice_ids", [])
        if fork_id not in choice_map:
            return False
        if allowed and choice_map[fork_id] not in allowed:
            return False
    return True


def world_state_to_prompt_context(state: WorldState) -> str:
    """Serialize accumulated universe for LLM injection."""
    lines = ["【当前平行宇宙状态 — Global World State】"]
    lines.append(f"宇宙 ID: {state.universe_id}")
    lines.append(f"推演进度: {state.current_year} 年")
    if state.james_choices:
        lines.append("\n【詹姆斯已确认的选择链】")
        for c in state.james_choices:
            lines.append(f"- {c.fork_id}: {c.choice_label} ({c.choice_id})")
    else:
        lines.append("\n【詹姆斯选择链】尚未做出任何平行选择")

    rpg = state.james_rpg
    lines.append(
        f"\n【詹姆斯当前六维】冠军{rpg.championships} 地位{rpg.legacy} "
        f"媒体{rpg.media_favor} 口碑{rpg.fan_reputation} 薪资{rpg.cap_health} 体能{rpg.physical_toll}"
    )

    swung = [
        (pid, f) for pid, f in state.npc_fates.items() if f.total_swing > 0
    ]
    swung.sort(key=lambda x: x[1].total_swing, reverse=True)
    if swung:
        lines.append("\n【其他球星命运偏移（因詹姆斯选择而变）】")
        for pid, f in swung[:8]:
            lines.append(
                f"- {pid}: 地位{f.legacy} 冠军机会{f.ring_chance} "
                f"({f.last_reason or '蝴蝶效应'})"
            )

    career_lines = []
    for pid, evs in state.npc_career_events.items():
        for ev in evs[-2:]:
            career_lines.append(f"- {pid} @ {ev.timestamp}: {ev.title}")
    if career_lines:
        lines.append("\n【已发生的平行生涯转折】")
        lines.extend(career_lines[-12:])

    lines.append(
        "\n【铁律】其他球星不得出现独立决策分叉；"
        "他们的命运只能是詹姆斯上述选择的后果。"
    )
    return "\n".join(lines)


# In-memory universe (single-player session)
_universe: WorldState = create_initial_world_state()


def get_universe() -> WorldState:
    return _universe


def set_universe(state: WorldState) -> None:
    global _universe
    _universe = state


def reset_universe() -> WorldState:
    state = create_initial_world_state()
    set_universe(state)
    return state


def sync_universe_from_client(payload: dict) -> WorldState:
    """Merge client world state snapshot into server."""
    global _universe
    try:
        _universe = WorldState(**payload)
    except Exception:
        pass
    return _universe
