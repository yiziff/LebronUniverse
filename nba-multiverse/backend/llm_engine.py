"""LLM engine: streaming generation of alternate timelines via DeepSeek API."""

import asyncio
import json
import os
from typing import AsyncGenerator

from openai import AsyncOpenAI

from models import GeneratedEvent, StatChange, SocialPost, PlayerImpact, PlayerCareerEvent
from prompt_templates import build_system_prompt, build_user_prompt, build_custom_user_prompt


def get_client() -> AsyncOpenAI:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY environment variable not set")
    return AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com",
    )


def _event_key(event_data: dict) -> str:
    """Unique key for deduplicating streamed events."""
    return f"{event_data.get('timestamp', '')}|{event_data.get('title', '')}"


def _extract_events_from_buffer(buffer: str) -> list[dict]:
    """Extract event-looking JSON objects from a streaming text buffer."""
    results = []
    depth = 0
    start = -1

    for i, ch in enumerate(buffer):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    obj = json.loads(buffer[start : i + 1])
                    if isinstance(obj, dict) and "title" in obj and "timestamp" in obj:
                        results.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1

    return results


def _strip_markdown_fences(raw: str) -> str:
    """Remove ```json ... ``` wrappers from LLM output."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_full_response(raw: str) -> dict | None:
    """Parse the top-level JSON object from a full LLM response."""
    cleaned = _strip_markdown_fences(raw)
    try:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(cleaned[start : end + 1])
            if isinstance(data, dict):
                return data
    except json.JSONDecodeError:
        pass
    return None


def _fallback_social_posts(choice_id: str, events: list[GeneratedEvent]) -> list[SocialPost]:
    """Generate entertaining fallback tweets when LLM omits social_posts."""
    team_labels = {
        "new_york_knicks": "纽约",
        "chicago_bulls": "芝加哥",
        "cleveland_cavaliers": "克利夫兰",
        "miami_heat": "迈阿密",
    }
    city = team_labels.get(choice_id, "联盟")
    headline = events[0].title if events else "平行宇宙震动"
    return [
        SocialPost(
            username="Skip Bayless",
            handle="@RealSkipBayless",
            avatar_color="#E53E3E",
            content=f"LEBRON TO {city.upper()}?! {headline} — I told you this changes EVERYTHING. But can he DELIVER under pressure? 👀",
            sentiment="sarcastic",
        ),
        SocialPost(
            username="NBA Central",
            handle="@NBACentral",
            avatar_color="#1DA1F2",
            content=f"🚨 BREAKING: {headline}。联盟格局已被改写，东部球队连夜开会。",
            sentiment="shocked",
        ),
        SocialPost(
            username="Burner Account",
            handle="@LeBronHater42",
            avatar_color="#991B1B",
            content=f"又是决定N？没有超级队友就不会打球 🐐❌ #{city}球迷先别急着开香槟",
            sentiment="hate",
        ),
        SocialPost(
            username=f"{city}球迷会",
            handle="@FanClub",
            avatar_color="#F58426",
            content=f"我们得到了Bron！！！MSG IS SHAKING 🗽🔥 这是篮球天堂！！！",
            sentiment="excited",
        ),
    ]


def _parse_player_impacts(raw_list: list) -> list[PlayerImpact]:
    impacts: list[PlayerImpact] = []
    for item in raw_list or []:
        if not isinstance(item, dict) or "player_id" not in item:
            continue
        try:
            impacts.append(PlayerImpact(
                player_id=str(item["player_id"]).lower().replace(" ", "-"),
                legacy=int(item.get("legacy", 0)),
                ring_chance=int(item.get("ring_chance", 0)),
                media_heat=int(item.get("media_heat", 0)),
                team_fit=int(item.get("team_fit", 0)),
                reason=str(item.get("reason", ""))[:40],
            ))
        except (TypeError, ValueError):
            continue
    return impacts


def _parse_player_career_events(raw_list: list) -> list[PlayerCareerEvent]:
    events: list[PlayerCareerEvent] = []
    for item in raw_list or []:
        if not isinstance(item, dict) or "player_id" not in item:
            continue
        pid = str(item["player_id"]).lower().replace(" ", "-")
        if pid == "lebron-james":
            continue
        try:
            events.append(PlayerCareerEvent(
                player_id=pid,
                timestamp=str(item.get("timestamp", ""))[:10],
                title=str(item.get("title", ""))[:32],
                description=str(item.get("description", ""))[:280],
                vs_real_history=str(item.get("vs_real_history", ""))[:200],
            ))
        except (TypeError, ValueError):
            continue
    return events


def _fallback_career_events(
    event_data: dict,
    impacts: list[PlayerImpact],
) -> list[PlayerCareerEvent]:
    """Synthesize career events from impacts when LLM omits player_career_events."""
    ts = str(event_data.get("timestamp", "2011-01-01"))[:10]
    title = str(event_data.get("title", "平行宇宙事件"))
    desc = str(event_data.get("description", ""))[:200]
    out: list[PlayerCareerEvent] = []
    for imp in impacts[:3]:
        if imp.player_id == "lebron-james":
            continue
        out.append(PlayerCareerEvent(
            player_id=imp.player_id,
            timestamp=ts,
            title=imp.reason[:16] or title[:16],
            description=f"因「{title}」，{imp.reason}。{desc[:80]}",
            vs_real_history="真实历史线与此不同",
        ))
    return out


def _yield_event(
    event_data: dict,
    choice_id: str,
    yielded_count: int,
) -> tuple[GeneratedEvent | None, list[StatChange], list[PlayerImpact]]:
    """Build a GeneratedEvent + stat changes + player impacts from raw event dict."""
    try:
        impacts = _parse_player_impacts(event_data.get("player_impacts", []))
        career = _parse_player_career_events(event_data.get("player_career_events", []))
        if not career and impacts:
            career = _fallback_career_events(event_data, impacts)

        event = GeneratedEvent(
            event_id=f"gen_{choice_id}_{yielded_count:03d}",
            timestamp=event_data.get("timestamp", ""),
            title=event_data.get("title", ""),
            description=event_data.get("description", ""),
            teams_affected=event_data.get("teams_affected", []),
            key_players=event_data.get("key_players", []),
            confidence=event_data.get("confidence", 0.5),
            player_impacts=impacts,
            player_career_events=career,
        )
        stats = [
            StatChange(
                dimension=sc["dimension"],
                delta=sc["delta"],
                reason=sc["reason"],
            )
            for sc in event_data.get("stat_changes", [])
            if isinstance(sc, dict) and "dimension" in sc
        ]
        return event, stats, event.player_impacts
    except Exception:
        return None, [], []


async def generate_branch_stream(
    choice_id: str,
    decision: dict,
    real_history: dict,
    world_state_context: str = "",
    fork_id: str = "evt_lebron_2010",
) -> AsyncGenerator[GeneratedEvent | StatChange | SocialPost, None]:
    """
    Stream-generate an alternate timeline branch via DeepSeek API.
    Yields each event as soon as it's parsed from the streaming response.
    Retries up to 3 times on failure.
    """
    client = get_client()
    sim = decision.get("simulation_window", {})
    start_year = sim.get("start_year", 2010)
    end_year = sim.get("end_year", 2014)
    system_prompt = build_system_prompt(fork_id, start_year, end_year)
    user_prompt = build_user_prompt(
        choice_id, decision, real_history, world_state_context, fork_id,
    )

    max_retries = 3
    for attempt in range(max_retries):
        buffer = ""
        yielded_count = 0
        seen_keys: set[str] = set()
        raw_response = ""

        try:
            stream = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0.8,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    buffer += delta.content
                    raw_response += delta.content

                    events_data = _extract_events_from_buffer(buffer)
                    for event_data in events_data:
                        key = _event_key(event_data)
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        event, stats, _ = _yield_event(event_data, choice_id, yielded_count)
                        if event is None:
                            continue
                        yielded_count += 1
                        yield event
                        for sc in stats:
                            yield sc

            if yielded_count > 0:
                data = _parse_full_response(raw_response)
                events_list: list[GeneratedEvent] = []
                # Re-collect events for fallback posts (already yielded)
                if data and "events" in data:
                    for i, ed in enumerate(data["events"]):
                        ev, _, _ = _yield_event(ed, choice_id, i)
                        if ev:
                            events_list.append(ev)

                posts_yielded = 0
                if data and "social_posts" in data:
                    for sp in data["social_posts"]:
                        try:
                            if posts_yielded > 0:
                                await asyncio.sleep(0.45)
                            yield SocialPost(
                                username=sp.get("username", ""),
                                handle=sp.get("handle", ""),
                                avatar_color=sp.get("avatar_color", "#888"),
                                content=sp.get("content", ""),
                                sentiment=sp.get("sentiment", "excited"),
                            )
                            posts_yielded += 1
                        except Exception:
                            pass

                if posts_yielded == 0:
                    for i, fp in enumerate(_fallback_social_posts(choice_id, events_list)):
                        if i > 0:
                            await asyncio.sleep(0.45)
                        yield fp
                return

            # Fallback: parse full response
            if raw_response:
                data = _parse_full_response(raw_response)
                if data and "events" in data:
                    for event_data in data["events"]:
                        key = _event_key(event_data)
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        event, stats, _ = _yield_event(event_data, choice_id, yielded_count)
                        if event is None:
                            continue
                        yielded_count += 1
                        yield event
                        for sc in stats:
                            yield sc

                    for sp in data.get("social_posts", []):
                        try:
                            yield SocialPost(
                                username=sp.get("username", ""),
                                handle=sp.get("handle", ""),
                                avatar_color=sp.get("avatar_color", "#888"),
                                content=sp.get("content", ""),
                                sentiment=sp.get("sentiment", "excited"),
                            )
                        except Exception:
                            pass
                    # fallback if no posts in response
                    if not data.get("social_posts"):
                        evs = []
                        for i, ed in enumerate(data.get("events", [])):
                            ev, _, _ = _yield_event(ed, choice_id, i)
                            if ev:
                                evs.append(ev)
                        for fp in _fallback_social_posts(choice_id, evs):
                            yield fp

                if yielded_count > 0:
                    return

            if attempt < max_retries - 1:
                continue

        except Exception as e:
            if attempt < max_retries - 1:
                continue
            raise RuntimeError(
                f"LLM generation failed after {max_retries} attempts: {e}"
            )

    raise RuntimeError(
        f"Failed to generate valid events after {max_retries} attempts"
    )


async def generate_custom_branch_stream(
    choice_id: str,
    custom_text: str,
    decision: dict,
    real_history: dict,
    world_state_context: str = "",
    fork_id: str = "evt_lebron_2010",
    label_hint: str = "",
) -> AsyncGenerator[GeneratedEvent | StatChange | SocialPost, None]:
    """Stream-generate a branch from free-form player text."""
    client = get_client()
    sim = decision.get("simulation_window", {})
    start_year = sim.get("start_year", 2010)
    end_year = sim.get("end_year", 2014)
    system_prompt = build_system_prompt(fork_id, start_year, end_year)
    user_prompt = build_custom_user_prompt(
        custom_text,
        decision,
        real_history,
        world_state_context,
        fork_id,
        label_hint,
    )

    max_retries = 3
    for attempt in range(max_retries):
        buffer = ""
        yielded_count = 0
        seen_keys: set[str] = set()
        raw_response = ""

        try:
            stream = await client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=4096,
                temperature=0.8,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    buffer += delta.content
                    raw_response += delta.content

                    events_data = _extract_events_from_buffer(buffer)
                    for event_data in events_data:
                        key = _event_key(event_data)
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        event, stats, _ = _yield_event(event_data, choice_id, yielded_count)
                        if event is None:
                            continue
                        yielded_count += 1
                        yield event
                        for sc in stats:
                            yield sc

            if yielded_count > 0:
                data = _parse_full_response(raw_response)
                events_list: list[GeneratedEvent] = []
                if data and "events" in data:
                    for i, ed in enumerate(data["events"]):
                        ev, _, _ = _yield_event(ed, choice_id, i)
                        if ev:
                            events_list.append(ev)

                posts_yielded = 0
                if data and "social_posts" in data:
                    for sp in data["social_posts"]:
                        try:
                            if posts_yielded > 0:
                                await asyncio.sleep(0.45)
                            yield SocialPost(
                                username=sp.get("username", ""),
                                handle=sp.get("handle", ""),
                                avatar_color=sp.get("avatar_color", "#888"),
                                content=sp.get("content", ""),
                                sentiment=sp.get("sentiment", "excited"),
                            )
                            posts_yielded += 1
                        except Exception:
                            pass

                if posts_yielded == 0:
                    for i, fp in enumerate(_fallback_social_posts(choice_id, events_list)):
                        if i > 0:
                            await asyncio.sleep(0.45)
                        yield fp
                return

            if raw_response:
                data = _parse_full_response(raw_response)
                if data and "events" in data:
                    for event_data in data["events"]:
                        key = _event_key(event_data)
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)

                        event, stats, _ = _yield_event(event_data, choice_id, yielded_count)
                        if event is None:
                            continue
                        yielded_count += 1
                        yield event
                        for sc in stats:
                            yield sc

                    for sp in data.get("social_posts", []):
                        try:
                            yield SocialPost(
                                username=sp.get("username", ""),
                                handle=sp.get("handle", ""),
                                avatar_color=sp.get("avatar_color", "#888"),
                                content=sp.get("content", ""),
                                sentiment=sp.get("sentiment", "excited"),
                            )
                        except Exception:
                            pass
                    if not data.get("social_posts"):
                        evs = []
                        for i, ed in enumerate(data.get("events", [])):
                            ev, _, _ = _yield_event(ed, choice_id, i)
                            if ev:
                                evs.append(ev)
                        for fp in _fallback_social_posts(choice_id, evs):
                            yield fp

                if yielded_count > 0:
                    return

            if attempt < max_retries - 1:
                continue

        except Exception as e:
            if attempt < max_retries - 1:
                continue
            raise RuntimeError(
                f"LLM custom generation failed after {max_retries} attempts: {e}"
            )

    raise RuntimeError(
        f"Failed to generate valid custom events after {max_retries} attempts"
    )
