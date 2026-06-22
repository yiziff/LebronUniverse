"""FastAPI main application for NBA Multiverse Engine."""

import asyncio
import json
from pathlib import Path
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from cross_impact import get_immediate_career_events, get_immediate_impacts
from data_loader import (
    load_all_fork_events,
    load_career_milestones,
    load_decision_event,
    load_master_timeline,
    load_real_history,
)
from llm_engine import generate_branch_stream, _fallback_social_posts
from models import GeneratedBranch, GeneratedEvent, StatChange, SocialPost
from world_state import (
    FORK_ORDER,
    FORK_YEARS,
    WorldState,
    apply_npc_impacts,
    choices_satisfy_prerequisites,
    get_universe,
    push_npc_career_events,
    record_james_choice,
    reset_universe,
    set_universe,
    sync_universe_from_client,
    world_state_to_prompt_context,
)

load_dotenv()

app = FastAPI(title="NBA Multiverse Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

branch_cache: dict[str, GeneratedBranch] = {}
CACHE_FILE = Path(__file__).resolve().parent.parent / "data" / "branch_cache.json"


def _load_disk_cache() -> None:
    if not CACHE_FILE.exists():
        return
    try:
        raw = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        for key, payload in raw.items():
            branch_cache[key] = GeneratedBranch(**payload)
    except Exception as exc:
        print(f"[cache] failed to load disk cache: {exc}")


def _save_disk_cache() -> None:
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {k: v.model_dump() for k, v in branch_cache.items()}
        CACHE_FILE.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"[cache] failed to save disk cache: {exc}")


_load_disk_cache()


def _cache_key(universe_id: str, fork_id: str, choice_id: str) -> str:
    return f"{universe_id}:{fork_id}:{choice_id}"


def _filter_choices(fork_id: str, state: WorldState) -> list[dict]:
    decision = load_decision_event(fork_id)
    out = []
    for c in decision.choices:
        prereqs = [p.model_dump() for p in c.prerequisite_choices]
        if choices_satisfy_prerequisites(prereqs, state.james_choices):
            out.append(c.model_dump())
    return out


def _available_forks(state: WorldState) -> list[dict]:
    forks = load_all_fork_events()
    result = []
    for i, fid in enumerate(FORK_ORDER):
        if fid not in forks:
            continue
        if i > 0 and FORK_ORDER[i - 1] not in state.completed_forks:
            continue
        dec = forks[fid]
        fork_prereqs = [p.model_dump() for p in dec.prerequisite_choices]
        if not choices_satisfy_prerequisites(fork_prereqs, state.james_choices):
            continue
        filtered = _filter_choices(fid, state)
        if not filtered:
            continue
        result.append({
            "fork_id": fid,
            "fork_year": dec.fork_year,
            "title": dec.title,
            "subtitle": dec.subtitle,
            "description": dec.description,
            "timestamp": dec.timestamp,
            "is_completed": fid in state.completed_forks,
            "choices": filtered,
            "simulation_window": dec.simulation_window.model_dump(),
        })
    return result


class UniverseSyncBody(BaseModel):
    universe_id: str | None = None
    james_choices: list[dict] = []
    james_rpg: dict = {}
    npc_fates: dict = {}
    npc_career_events: dict = {}
    active_branch_events: list[dict] = []
    current_year: int = 2010
    completed_forks: list[str] = []


class RecordChoiceBody(BaseModel):
    fork_id: str
    choice_id: str
    choice_label: str
    timestamp: str


@app.get("/api/universe")
async def get_universe_state():
    """Return world state, available forks, master timeline, career milestones."""
    state = get_universe()
    milestones = load_career_milestones()
    return {
        "world_state": state.model_dump(),
        "available_forks": _available_forks(state),
        "fork_order": FORK_ORDER,
        "master_timeline": load_master_timeline(),
        "career_milestones": {k: v.model_dump() for k, v in milestones.items()},
        "cached_branches": list(branch_cache.keys()),
    }


@app.post("/api/universe/sync")
async def sync_universe(body: UniverseSyncBody):
    """Sync client world state to server."""
    payload = body.model_dump()
    state = sync_universe_from_client(payload)
    return {"status": "synced", "world_state": state.model_dump()}


@app.post("/api/universe/reset")
async def reset_universe_state():
    """Reset universe to initial 2010 state."""
    branch_cache.clear()
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
    state = reset_universe()
    return {"status": "reset", "world_state": state.model_dump()}


@app.post("/api/universe/choice")
async def record_choice(body: RecordChoiceBody):
    """Record a James choice into world state."""
    state = get_universe()
    decision = load_decision_event(body.fork_id)
    valid = [c.choice_id for c in decision.choices]
    if body.choice_id not in valid:
        raise HTTPException(400, f"Invalid choice for {body.fork_id}")

    filtered = _filter_choices(body.fork_id, state)
    if not any(c["choice_id"] == body.choice_id for c in filtered):
        raise HTTPException(400, "Choice not available given prior James decisions")

    state = record_james_choice(
        state, body.fork_id, body.choice_id, body.choice_label, body.timestamp,
    )

    impacts = get_immediate_impacts(body.fork_id, body.choice_id)
    if impacts:
        state = apply_npc_impacts(state, [i.model_dump() for i in impacts])

    career = get_immediate_career_events(body.fork_id, body.choice_id)
    if career:
        state = push_npc_career_events(state, career)

    year = FORK_YEARS.get(body.fork_id, state.current_year)
    end_year = decision.simulation_window.end_year
    state.current_year = max(state.current_year, end_year)

    set_universe(state)
    return {"status": "recorded", "world_state": state.model_dump()}


@app.get("/api/timeline")
async def get_timeline():
    """Backward-compatible timeline endpoint (includes master_timeline for fallback)."""
    decision = load_decision_event("evt_lebron_2010")
    real = load_real_history("evt_lebron_2010")
    state = get_universe()
    milestones = load_career_milestones()

    return {
        "decision_event": decision.model_dump(),
        "real_history": real.model_dump(),
        "master_timeline": load_master_timeline(),
        "available_forks": _available_forks(state),
        "career_milestones": {k: v.model_dump() for k, v in milestones.items()},
        "cached_branches": list(branch_cache.keys()),
    }


@app.get("/api/branch/{choice_id}")
async def get_branch(choice_id: str):
    for key, branch in branch_cache.items():
        if key.endswith(f":{choice_id}") or key == choice_id:
            return branch.model_dump()
    return {"status": "not_generated"}


async def _stream_branch(
    fork_id: str,
    choice_id: str,
    decision_dict: dict,
    real_dict: dict,
    choice_label: str,
    is_real: bool,
    cache_key: str,
) -> AsyncGenerator[str, None]:
    if is_real:
        for event in real_dict.get("events", []):
            yield f"event: timeline_event\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    if cache_key in branch_cache:
        cached = branch_cache[cache_key]
        for event in cached.events:
            yield f"event: timeline_event\ndata: {json.dumps(event.model_dump(), ensure_ascii=False)}\n\n"
        for sc in cached.stat_changes:
            yield f"event: stat_update\ndata: {json.dumps(sc.model_dump(), ensure_ascii=False)}\n\n"
        posts = cached.social_posts or _fallback_social_posts(choice_id, cached.events)
        for sp in posts:
            yield f"event: social_post\ndata: {json.dumps(sp.model_dump(), ensure_ascii=False)}\n\n"
        yield "event: done\ndata: {}\n\n"
        return

    state = get_universe()
    ws_context = world_state_to_prompt_context(state)

    events_buffer: list[GeneratedEvent] = []
    stats_buffer: list[StatChange] = []
    posts_buffer: list[SocialPost] = []

    async for item in generate_branch_stream(
        choice_id,
        decision_dict,
        real_dict,
        world_state_context=ws_context,
        fork_id=fork_id,
    ):
        if isinstance(item, GeneratedEvent):
            events_buffer.append(item)
            yield f"event: timeline_event\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"
        elif isinstance(item, StatChange):
            stats_buffer.append(item)
            yield f"event: stat_update\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"
        elif isinstance(item, SocialPost):
            posts_buffer.append(item)
            yield f"event: social_post\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"

    branch = GeneratedBranch(
        branch_id=f"branch_{fork_id}_{choice_id}",
        branch_name=choice_label,
        parent_event_id=fork_id,
        parent_choice_id=choice_id,
        narrative_summary="",
        events=events_buffer,
        stat_changes=stats_buffer,
        social_posts=posts_buffer,
    )
    branch_cache[cache_key] = branch
    _save_disk_cache()
    yield "event: done\ndata: {}\n\n"


@app.get("/api/generate/{fork_id}/{choice_id}")
async def generate_branch_fork(fork_id: str, choice_id: str):
    """Stream-generate alternate timeline for a specific James fork."""
    try:
        decision = load_decision_event(fork_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Fork '{fork_id}' not found")

    valid_choices = [c.choice_id for c in decision.choices]
    if choice_id not in valid_choices:
        raise HTTPException(400, f"Invalid choice '{choice_id}'. Valid: {valid_choices}")

    state = get_universe()
    filtered = _filter_choices(fork_id, state)
    if not any(c["choice_id"] == choice_id for c in filtered):
        raise HTTPException(400, "Choice not available given prior James decisions")

    choice = next(c for c in decision.choices if c.choice_id == choice_id)
    real = load_real_history(fork_id)
    cache_key = _cache_key(state.universe_id, fork_id, choice_id)

    async def stream():
        try:
            async for chunk in _stream_branch(
                fork_id,
                choice_id,
                decision.model_dump(),
                real.model_dump(),
                choice.label,
                choice.is_real_history,
                cache_key,
            ):
                yield chunk
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/api/generate/{choice_id}")
async def generate_branch_legacy(choice_id: str):
    """Legacy route — defaults to 2010 fork."""
    return await generate_branch_fork("evt_lebron_2010", choice_id)


@app.post("/api/cache/clear")
async def clear_cache():
    branch_cache.clear()
    if CACHE_FILE.exists():
        CACHE_FILE.unlink()
    return {"status": "cleared"}


@app.get("/health")
async def health():
    return {"status": "ok", "cached_branches": len(branch_cache)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
