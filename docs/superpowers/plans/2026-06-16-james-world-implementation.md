# 詹姆斯世界 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page 3D interactive app where users choose LeBron James' 2010 free agency destination, triggering particle animations, AI-generated alternate timelines, RPG stat shifts, and a fake social media waterfall.

**Architecture:** Zustand store (4 slices) as single source of truth → Three.js (3d-force-graph for physics, custom ShaderMaterials for particles) for 3D rendering, React DOM overlays for UI components, FastAPI SSE backend for streaming AI generation.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand, Three.js + 3d-force-graph + GSAP, FastAPI + Pydantic v2 + DeepSeek API + SSE

---

### Task 1: Extend Backend Models

**Files:**
- Modify: `nba-multiverse/backend/models.py`

- [ ] **Step 1: Add StatChange, SocialPost models**

Add after the `GeneratedBranch` class:

```python
from typing import Literal


class StatChange(BaseModel):
    """A single RPG stat dimension change triggered by an event."""
    dimension: Literal[
        "championships", "legacy", "media_favor",
        "fan_reputation", "cap_health", "physical_toll",
    ]
    delta: int
    reason: str  # ≤30 chars


class SocialPost(BaseModel):
    """A single AI-generated fake social media post."""
    username: str
    handle: str
    avatar_color: str
    content: str  # ≤140 chars
    sentiment: Literal["angry", "excited", "sarcastic", "shocked", "hate"]


class SSEContainer(BaseModel):
    """Wrapper for typed SSE events."""
    event_type: Literal["timeline_event", "stat_update", "social_post", "done", "error"]
    payload: dict
```

- [ ] **Step 2: Verify models parse correctly**

Run:
```bash
cd nba-multiverse/backend
python -c "from models import StatChange, SocialPost, SSEContainer; print('OK')"
```
Expected: `OK`

---

### Task 2: Create Entity Validator

**Files:**
- Create: `nba-multiverse/backend/entity_validator.py`

- [ ] **Step 1: Write the validator**

```python
"""Player name whitelist validator with Levenshtein fuzzy matching."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

# ---------------------------------------------------------------------------
# Load canonical names from players.json + extended whitelist
# ---------------------------------------------------------------------------
_EXTRA_PLAYERS = {
    # 2010-2014 starters / rotation players / notable rookies
    "kyrie-irving", "anthony-davis", "damian-lillard", "bradley-beal",
    "andre-drummond", "harrison-barnes", "draymond-green", "klay-thompson",
    "kawhi-leonard", "jimmy-butler", "isaiah-thomas", "rudy-gobert",
    "giannis-antetokounmpo", "victor-oladipo", "cj-mccollum",
    "steven-adams", "nerlens-noel", "michael-carter-williams",
    "rajon-rondo", "pau-gasol", "andrew-bynum", "lamar-odom",
    "ron-artest", "metta-world-peace", "kevin-garnett", "paul-pierce",
    "ray-allen", "tony-parker", "manu-ginobili", "tim-duncan",
    "russell-westbrook", "james-harden", "serge-ibaka", "kendrick-perkins",
    "jason-kidd", "vince-carter", "shawn-marion", "jason-terry",
    "tyson-chandler", "joe-johnson", "josh-smith", "al-horford",
    "jeff-teague", "brandon-jennings", "monta-ellis", "stephen-curry",
    "david-lee", "kevin-love", "ricky-rubio", "derrick-williams",
    "michael-beasley", "mario-chalmers", "udonis-haslem", "wilson-chandler",
    "tony-douglas", "antawn-jamison", "mo-williams", "anderson-varejao",
    "jj-hickson", "danilo-gallinari", "landry-fields", "andrew-bogut",
    "brandon-roy", "lamarcus-aldridge", "nicolas-batum", "wesley-matthews",
    "zach-randolph", "marc-gasol", "mike-conley", "rudy-gay",
    "tyreke-evans", "eric-gordon", "anthony-morrow", "chris-kaman",
    "blake-griffin", "deandre-jordan", "eric-bledsoe", "goran-dragic",
    "marcin-gortat", "luis-scola", "kevin-martin", "aaron-brooks",
    "kyle-lowry", "demar-derozan", "andrea-bargnani", "brook-lopez",
    "deron-williams", "gerald-wallace", "kris-humphries", "jarrett-jack",
    "carl-landry", "david-west", "roy-hibbert", "danny-granger",
    "george-hill", "j-r-smith", "kenneth-faried", "ty-lawson",
    "andre-iguodala", "thaddeus-young", "evan-turner", "jrue-holiday",
    "spencer-hawes", "elton-brand", "chris-bosh", "dwyane-wade",
    "lebron-james", "carmelo-anthony", "derrick-rose", "joakim-noah",
    "luol-deng", "carlos-boozer", "amare-stoudemire", "chris-paul",
    "dwight-howard", "dirk-nowitzki", "kevin-durant", "kobe-bryant",
    "paul-george", "john-wall", "demarcus-cousins", "gordon-hayward",
    "andrew-wiggins", "jabari-parker", "joel-embiid", "aaron-gordon",
    "marcus-smart", "julius-randle", "zach-lavine", "nikola-jokic",
    "clint-capela", "jae-crowder", "kelly-olynyk",
    "reggie-jackson", "dion-waiters", "tristan-thompson",
    "matthew-dellavedova", "iman-shumpert", "timofey-mozgov",
    "channing-frye", "richard-jefferson", "jr-smith",
    # trainers / execs (not players, but may appear in LLM output)
    "pat-riley", "erik-spoelstra", "mike-dantoni", "phil-jackson",
    "gregg-popovich", "doc-rivers", "tom-thibodeau",
}


def _load_canonical_names() -> set[str]:
    """Merge players.json keys with the extended whitelist."""
    names: set[str] = set()
    players_path = DATA_DIR / "players.json"
    if players_path.exists():
        with open(players_path, "r", encoding="utf-8") as f:
            names.update(json.load(f).keys())
    names.update(_EXTRA_PLAYERS)
    return names


CANONICAL_NAMES: set[str] = _load_canonical_names()


def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    curr = [0] * (len(s2) + 1)
    for i, c1 in enumerate(s1, 1):
        curr[0] = i
        for j, c2 in enumerate(s2, 1):
            curr[j] = min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + (0 if c1 == c2 else 1),
            )
        prev, curr = curr, prev
    return prev[len(s2)]


def fuzzy_match(name: str, threshold: int = 2) -> str | None:
    """Return canonical name if fuzzy match found within threshold, else None."""
    name_lower = name.lower().strip().replace(" ", "-")
    if name_lower in CANONICAL_NAMES:
        return name_lower
    for canonical in CANONICAL_NAMES:
        if levenshtein_distance(name_lower, canonical) <= threshold:
            return canonical
    return None


def extract_player_names(text: str) -> list[str]:
    """Extract potential player name strings from event text.

    Scans for known patterns like full names and returns them normalized.
    This is intentionally simple — it normalises to lowercase kebab-case
    and checks against the whitelist.
    """
    import re
    # Match capitalized words that look like names (2+ capitalized words in a row)
    candidates = re.findall(r'[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+', text)
    results = []
    for c in candidates:
        slug = c.lower().strip().replace(" ", "-")
        matched = fuzzy_match(slug)
        if matched:
            results.append(matched)
        else:
            results.append(slug)  # return raw so caller can flag as unknown
    return results


def validate_events(
    events: list[dict],
) -> tuple[list[dict], list[str]]:
    """Validate a list of AI-generated events against the player whitelist.

    Returns:
        (accepted_events, rejected_names) — events with unknown players
        are excluded; rejected_names lists the offending strings for
        injection into the retry prompt.
    """
    accepted: list[dict] = []
    rejected_names: list[str] = []

    for event in events:
        desc = event.get("description", "")
        title = event.get("title", "")
        key_players = event.get("key_players", [])

        # Check key_players list
        unknown = [p for p in key_players if p.lower().replace(" ", "-") not in CANONICAL_NAMES]

        # Check description for embedded names
        text_names = extract_player_names(f"{title} {desc}")
        for n in text_names:
            if n not in CANONICAL_NAMES and n not in unknown:
                unknown.append(n)

        if unknown:
            rejected_names.extend(unknown)
        else:
            accepted.append(event)

    return accepted, rejected_names
```

- [ ] **Step 2: Verify the validator loads and matches known players**

Run:
```bash
cd nba-multiverse/backend
python -c "
from entity_validator import CANONICAL_NAMES, fuzzy_match, validate_events
print(f'Whitelist size: {len(CANONICAL_NAMES)}')
assert fuzzy_match('Dwayne Wade') == 'dwyane-wade', 'fuzzy match failed'
assert fuzzy_match('Lebron James') == 'lebron-james', 'exact match failed'
print('Tests passed')
"
```
Expected: `Whitelist size: ~200+, Tests passed`

---

### Task 3: Upgrade Prompt Templates

**Files:**
- Modify: `nba-multiverse/backend/prompt_templates.py`

- [ ] **Step 1: Append RPG stat and social post instructions to SYSTEM_PROMPT**

Replace the last line (before `"""`) of `SYSTEM_PROMPT` — change:
```
生成 6-8 个事件，覆盖 2010 到 2014 年。事件按时间顺序排列。"""
```
to:
```
生成 6-8 个事件，覆盖 2010 到 2014 年。事件按时间顺序排列。

【RPG 状态变动规则】
对于你生成的每个事件，必须评估它对勒布朗·詹姆斯六维状态的影响，在事件 JSON 中添加 "stat_changes" 数组：

"stat_changes": [
  {"dimension": "media_favor", "delta": 25, "reason": "加盟全球最大市场"}
]

变动参考：
- 加盟大市场球队 → media_favor +20~30, fan_reputation +10~15
- 组建超级球队 → cap_health -15~25, legacy +5~10
- 季后赛走远 / 总决赛 → physical_toll +10~20
- 赢得总冠军 → championships +1, legacy +15~25
- 惨败 / 被横扫 → media_favor -10~20, fan_reputation -5~10
- 提出交易申请 → media_favor -5~15, fan_reputation -10~20

六维 ID: championships / legacy / media_favor / fan_reputation / cap_health / physical_toll

【虚拟社交舆论】
在 events 数组最后，额外返回一个 "social_posts" 数组，包含 3-5 条模拟推特：

角色配比：
- 1 条 NBA 名嘴（如 Stephen A. Smith / Skip Bayless 风格）
- 1 条极端球迷（被选球队死忠，极度亢奋 / 被弃球队球迷，极度愤怒）
- 1 条"詹黑"风格 — 使用经典梗：Who's your daddy? / LeBronto / Buster / 🐐❌ / 猩猩 / 没有大腿不会打球 / 决定1/2
- 0-1 条中立媒体
- 0-1 条恶搞 / 梗图风格

风格要求：
- 还原 NBA 推特火药味，中文 + 英文混用
- 每条 ≤ 140 字
- 情感标签: angry / excited / sarcastic / shocked / hate

格式:
"social_posts": [
  {
    "username": "Skip Bayless",
    "handle": "@RealSkipBayless",
    "avatar_color": "#E53E3E",
    "content": "LEBRON TO NEW YORK?! This is the biggest stage in basketball. But can he HANDLE the pressure of MSG? I have my doubts.",
    "sentiment": "sarcastic"
  }
]"""
```

- [ ] **Step 2: Update `build_user_prompt` to mention social posts and stats**

After the last line `请推演 2010 年夏天到 2014 年夏天之间，这个平行宇宙中发生的关键事件。` add:

```python
    prompt += """
\n【重要提醒】
1. 每个事件对象必须包含 "stat_changes" 数组（评估该事件对詹姆斯六维状态的影响）
2. 在 events 数组之后，额外返回 "social_posts" 数组（3-5 条虚拟社交媒体反应）
"""
    return prompt
```

Note: the `build_user_prompt` function currently ends with `return base`. Change `base` to `prompt` after the concatenation above.

- [ ] **Step 3: Verify the prompt loads without syntax errors**

Run:
```bash
cd nba-multiverse/backend
python -c "from prompt_templates import SYSTEM_PROMPT, build_user_prompt; print('Loaded OK, prompt length:', len(SYSTEM_PROMPT))"
```
Expected: `Loaded OK, prompt length: <number>`

---

### Task 4: Extend LLM Engine

**Files:**
- Modify: `nba-multiverse/backend/llm_engine.py`

- [ ] **Step 1: Add social post extraction from LLM response**

After the existing `_extract_events_from_full_response` function, add:

```python
def _extract_social_posts(raw: str) -> list[dict]:
    """Extract social_posts array from the full response JSON."""
    try:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(raw[start : end + 1])
            if isinstance(data, dict) and "social_posts" in data:
                return data["social_posts"]
    except json.JSONDecodeError:
        pass
    return []


def _extract_stat_changes(event_data: dict) -> list[dict]:
    """Extract stat_changes array from a single event dict."""
    return event_data.get("stat_changes", [])
```

- [ ] **Step 2: Update `generate_branch_stream` to yield stat updates and social posts**

Before `async def generate_branch_stream`, add to the top of the file:

```python
from entity_validator import validate_events
from models import StatChange, SocialPost
```

Change the `for chunk in stream:` section. After the fallback for full parsing, the function currently returns. The `events_buffer` is populated with `GeneratedEvent` objects. At the end (before caching), add logic to:

1. Validate events against the entity whitelist
2. Yield stat_updates interleaved with events
3. Yield social_posts after all events

The updated `generate_branch_stream` function signature stays the same. The changes are inside the generation loop where events are yielded.

Actual code changes — find the block:
```python
                    # Try to extract complete event objects from the buffer
                    events_data = _extract_events_from_buffer(buffer)
                    for event_data in events_data:
                        try:
                            event = GeneratedEvent(
                                event_id=f"gen_{choice_id}_{yielded_count:03d}",
                                timestamp=event_data.get("timestamp", ""),
                                ...
```

No change needed to this streaming extraction. The stat_changes and social_posts are extracted from the FULL response because they may come after all streaming events. Add at the very end of the `for chunk in stream:` block, after `raw_response += delta.content`, a call to check for stat_changes that exist as separate objects in the JSON:

Actually, let's keep it simpler. The LLM returns a single JSON blob with `events[]` and `social_posts[]` and each event has `stat_changes[]`. We already extract events during streaming. The stat_changes are nested inside each event data. We need to yield them right after each event.

Modify the event yielding block (inside `for event_data in events_data:`) to also yield stat updates:

```python
                    events_data = _extract_events_from_buffer(buffer)
                    for event_data in events_data:
                        try:
                            event = GeneratedEvent(
                                event_id=f"gen_{choice_id}_{yielded_count:03d}",
                                timestamp=event_data.get("timestamp", ""),
                                title=event_data.get("title", ""),
                                description=event_data.get("description", ""),
                                teams_affected=event_data.get("teams_affected", []),
                                key_players=event_data.get("key_players", []),
                                confidence=event_data.get("confidence", 0.5),
                            )
                            yielded_count += 1
                            yield event
                        except Exception:
                            pass  # Skip malformed events during streaming
```

Replace with:

```python
                    for event_data in events_data:
                        try:
                            event = GeneratedEvent(
                                event_id=f"gen_{choice_id}_{yielded_count:03d}",
                                timestamp=event_data.get("timestamp", ""),
                                title=event_data.get("title", ""),
                                description=event_data.get("description", ""),
                                teams_affected=event_data.get("teams_affected", []),
                                key_players=event_data.get("key_players", []),
                                confidence=event_data.get("confidence", 0.5),
                            )
                            yielded_count += 1
                            yield event
                            # Yield stat changes if present
                            for sc in event_data.get("stat_changes", []):
                                yield StatChange(
                                    dimension=sc["dimension"],
                                    delta=sc["delta"],
                                    reason=sc["reason"],
                                )
                        except Exception:
                            pass
```

And after the fallback full response parsing, add social post extraction. In the fallback block (after `_extract_events_from_full_response`), add:

```python
                # Also try to extract social posts from the full response
                social_posts = _extract_social_posts(raw_response)
                for sp in social_posts:
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
```

- [ ] **Step 3: Verify the engine loads**

Run:
```bash
cd nba-multiverse/backend
python -c "from llm_engine import generate_branch_stream, _extract_social_posts; print('OK')"
```
Expected: `OK`

---

### Task 5: Extend SSE Endpoint

**Files:**
- Modify: `nba-multiverse/backend/main.py`

- [ ] **Step 1: Update the stream generator to handle StatChange and SocialPost yields**

In `main.py`, find the `stream()` async generator inside `generate_branch`. The current code does:

```python
            async for event in generate_branch_stream(...):
                events_buffer.append(event)
                yield f"data: {json.dumps(event.model_dump(), ensure_ascii=False)}\n\n"
```

Replace with:

```python
            async for item in generate_branch_stream(
                choice_id,
                decision.model_dump(),
                real.model_dump(),
            ):
                from models import GeneratedEvent, StatChange, SocialPost

                if isinstance(item, GeneratedEvent):
                    events_buffer.append(item)
                    yield f"event: timeline_event\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"
                elif isinstance(item, StatChange):
                    yield f"event: stat_update\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"
                elif isinstance(item, SocialPost):
                    yield f"event: social_post\ndata: {json.dumps(item.model_dump(), ensure_ascii=False)}\n\n"
```

- [ ] **Step 2: Add the import at the top of main.py**

```python
from models import DecisionEvent, GeneratedBranch, GeneratedEvent, RealHistory, StatChange, SocialPost
```

- [ ] **Step 3: Verify SSE endpoint returns correct event types**

Start the backend and test with curl:
```bash
cd nba-multiverse/backend
python main.py &
sleep 2
curl -s -N -X POST "http://localhost:8000/api/generate/new_york_knicks" 2>&1 | head -20
```
Expected: SSE stream with `event: timeline_event` and `event: stat_update` lines interleaved.

Kill the server after: `kill %1`

---

### Task 6: Create TypeScript Types

**Files:**
- Create: `nba-multiverse/frontend/src/types/index.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
// ─── Graph ───

export interface GraphNode {
  id: string
  type: 'fork' | 'event'
  label: string
  timestamp: string
  position: { x: number; y: number; z: number }
  color: string
  size: number           // 0.3 – 1.0 sphere radius
  parentId?: string
  isRealHistory: boolean
  isClickable: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  color: string
  thickness: number      // 0.02 – 0.08 world units
  isParticleFlow: boolean
}

// ─── RPG Stats ───

export interface RPGSixDimensions {
  championships: number   // 0-7
  legacy: number          // 0-100
  mediaFavor: number      // 0-100
  fanReputation: number   // 0-100
  capHealth: number       // 0-100
  physicalToll: number    // 0-100, higher = worse
}

export interface StatDelta {
  dimension: keyof RPGSixDimensions
  delta: number
  reason: string
}

// ─── Social ───

export type Sentiment = 'angry' | 'excited' | 'sarcastic' | 'shocked' | 'hate'

export interface SocialPost {
  id: string
  username: string
  handle: string
  avatarColor: string
  content: string
  sentiment: Sentiment
  timestamp: number
}

// ─── SSE Event Payloads ───

export interface TimelineEventPayload {
  event_id: string
  timestamp: string
  title: string
  description: string
  teams_affected: string[]
  key_players: string[]
  confidence: number
}

export interface StatUpdatePayload {
  dimension: keyof RPGSixDimensions
  delta: number
  reason: string
}

export interface SocialPostPayload {
  username: string
  handle: string
  avatar_color: string
  content: string
  sentiment: string
}

// ─── API Response ───

export interface TimelineAPIResponse {
  decision_event: DecisionEventData
  real_history: RealHistoryData
  cached_branches: string[]
}

export interface DecisionEventData {
  event_id: string
  timestamp: string
  type: string
  title: string
  subtitle: string
  description: string
  actor: Record<string, unknown>
  choices: ChoiceData[]
  context: Record<string, unknown>
}

export interface ChoiceData {
  choice_id: string
  label: string
  team_code: string
  team_color: string
  is_real_history: boolean
  pitch: string
  roster_before: string[]
  cap_space: number
}

export interface RealHistoryData {
  branch_id: string
  branch_name: string
  color: string
  parent_event_id: string
  parent_choice_id: string
  events: TimelineEventPayload[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```
Expected: No errors (may have unrelated warnings from existing scaffolding).

---

### Task 7: Create Zustand Store

**Files:**
- Create: `nba-multiverse/frontend/src/store/index.ts`

- [ ] **Step 1: Write the store with 4 slices**

```typescript
import { create } from 'zustand'
import type {
  GraphNode, GraphEdge, RPGSixDimensions, StatDelta,
  SocialPost, Sentiment,
} from '../types'

// ─── Types ───

type AppPhase = 'idle' | 'choosing' | 'generating' | 'complete'

interface GenerationSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
  masterBrightness: number
  rpgStats: RPGSixDimensions
}

// ─── Initial RPG stats (2010 baseline) ───

const INITIAL_RPG: RPGSixDimensions = {
  championships: 0,
  legacy: 50,
  mediaFavor: 50,
  fanReputation: 50,
  capHealth: 50,
  physicalToll: 0,
}

// ─── Store ───

export interface AppStore {
  // graphSlice
  nodes: GraphNode[]
  edges: GraphEdge[]
  masterBrightness: number
  activeBranchId: string | null

  addNode: (node: GraphNode) => void
  addEdge: (edge: GraphEdge) => void
  setMasterBrightness: (b: number) => void
  resetGraph: () => void
  deleteBranchNodes: (branchId: string) => void

  // rpgSlice
  rpgStats: RPGSixDimensions
  statHistory: StatDelta[]

  applyStatDelta: (d: StatDelta) => void
  resetStats: () => void
  restoreStats: (s: RPGSixDimensions) => void

  // socialSlice
  posts: SocialPost[]
  isStreaming: boolean

  pushPost: (p: SocialPost) => void
  clearPosts: () => void

  // uiSlice
  phase: AppPhase
  selectedChoiceId: string | null
  isWheelOpen: boolean
  inputLocked: boolean
  errorMessage: string | null
  statusText: string
  generationSnapshot: GenerationSnapshot | null

  setPhase: (p: AppPhase) => void
  openWheel: () => void
  closeWheel: () => void
  setInputLocked: (locked: boolean) => void
  setError: (msg: string | null) => void
  setStatusText: (t: string) => void
  takeSnapshot: () => void
  triggerRollback: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  // ─── graphSlice ───
  nodes: [],
  edges: [],
  masterBrightness: 1.0,
  activeBranchId: null,

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  setMasterBrightness: (b) => set({ masterBrightness: b }),
  resetGraph: () => set({ nodes: [], edges: [], masterBrightness: 1.0, activeBranchId: null }),
  deleteBranchNodes: (branchId) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.parentId !== branchId),
      edges: s.edges.filter((e) => !e.id.startsWith(branchId)),
    })),

  // ─── rpgSlice ───
  rpgStats: { ...INITIAL_RPG },
  statHistory: [],

  applyStatDelta: (d) =>
    set((s) => {
      const clamped = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      const key = d.dimension
      return {
        rpgStats: { ...s.rpgStats, [key]: clamped(s.rpgStats[key] + d.delta, 0, 100) },
        statHistory: [...s.statHistory, d],
      }
    }),
  resetStats: () => set({ rpgStats: { ...INITIAL_RPG }, statHistory: [] }),
  restoreStats: (stats) => set({ rpgStats: { ...stats } }),

  // ─── socialSlice ───
  posts: [],
  isStreaming: false,

  pushPost: (p) => set((s) => ({ posts: [...s.posts, p] })),
  clearPosts: () => set({ posts: [], isStreaming: false }),

  // ─── uiSlice ───
  phase: 'idle',
  selectedChoiceId: null,
  isWheelOpen: false,
  inputLocked: false,
  errorMessage: null,
  statusText: '点击脉动的金色节点，改变 NBA 历史',
  generationSnapshot: null,

  setPhase: (p) => set({ phase: p }),
  openWheel: () => set({ isWheelOpen: true, phase: 'choosing' }),
  closeWheel: () => set({ isWheelOpen: false, phase: 'idle' }),
  setInputLocked: (locked) => set({ inputLocked: locked }),
  setError: (msg) => set({ errorMessage: msg }),
  setStatusText: (t) => set({ statusText: t }),

  takeSnapshot: () => {
    const { nodes, edges, masterBrightness, rpgStats } = get()
    set({
      generationSnapshot: {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        masterBrightness,
        rpgStats: { ...rpgStats },
      },
    })
  },

  triggerRollback: () => {
    const snap = get().generationSnapshot
    if (!snap) return
    set({
      nodes: snap.nodes,
      edges: snap.edges,
      masterBrightness: snap.masterBrightness,
      rpgStats: { ...snap.rpgStats },
      posts: [],
      isStreaming: false,
      phase: 'idle',
      inputLocked: false,
      errorMessage: '⚠️ 时间线崩塌 · 点击重试',
      statusText: '⚠️ 时间线崩塌 · 点击重试',
      activeBranchId: null,
    })
  },
}))
```

- [ ] **Step 2: Verify store compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```
Expected: No new errors from store.

---

### Task 8: Create useSSE Hook

**Files:**
- Create: `nba-multiverse/frontend/src/hooks/useSSE.ts`

- [ ] **Step 1: Write the SSE hook**

```typescript
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type {
  TimelineEventPayload, StatUpdatePayload, SocialPostPayload,
  GraphNode, SocialPost,
} from '../types'

const GENERATING_TEXTS = [
  '正在推演 2011 年东部格局……',
  '正在计算韦德的下一站……',
  '正在模拟 2012 年选秀大会……',
  '正在推演自由球员市场……',
  '正在生成新的世界线……',
  '正在计算蝴蝶效应……',
  '正在模拟联盟力量对比……',
]

let textIdx = 0
function nextStatusText(): string {
  const t = GENERATING_TEXTS[textIdx % GENERATING_TEXTS.length]
  textIdx++
  return t
}

export function useSSE() {
  const esRef = useRef<EventSource | null>(null)
  const nodeCounter = useRef(0)

  const addNode = useStore((s) => s.addNode)
  const addEdge = useStore((s) => s.addEdge)
  const setMasterBrightness = useStore((s) => s.setMasterBrightness)
  const applyStatDelta = useStore((s) => s.applyStatDelta)
  const pushPost = useStore((s) => s.pushPost)
  const setPhase = useStore((s) => s.setPhase)
  const setInputLocked = useStore((s) => s.setInputLocked)
  const setStatusText = useStore((s) => s.setStatusText)
  const takeSnapshot = useStore((s) => s.takeSnapshot)
  const triggerRollback = useStore((s) => s.triggerRollback)
  const nodes = useStore((s) => s.nodes)

  const API_BASE = 'http://localhost:8000'

  const generate = (choiceId: string, teamColor: string) => {
    // Close any existing connection
    if (esRef.current) {
      esRef.current.close()
    }

    // Snapshot + lock
    takeSnapshot()
    setMasterBrightness(0.25)
    setPhase('generating')
    setInputLocked(true)
    nodeCounter.current = 0

    const es = new EventSource(`${API_BASE}/api/generate/${choiceId}`)
    esRef.current = es

    let lastNodeId: string | null = null

    es.addEventListener('timeline_event', (e: MessageEvent) => {
      const data: TimelineEventPayload = JSON.parse(e.data)
      const nodeId = data.event_id
      nodeCounter.current++

      // Determine position: branch nodes offset from fork along Z-
      const existing = useStore.getState().nodes
      const forkNode = existing.find((n) => n.type === 'fork')
      const fx = forkNode?.position.x ?? 0
      const fy = forkNode?.position.y ?? 0
      const fz = forkNode?.position.z ?? 0

      const newNode: GraphNode = {
        id: nodeId,
        type: 'event',
        label: data.title,
        timestamp: data.timestamp,
        position: {
          x: fx + nodeCounter.current * 0.8,
          y: fy - 0.5 - nodeCounter.current * 0.15,
          z: fz - 1.0 - nodeCounter.current * 0.5,
        },
        color: teamColor,
        size: data.confidence > 0.8 ? 0.7 : 0.45,
        parentId: choiceId,
        isRealHistory: false,
        isClickable: false,
      }

      addNode(newNode)

      // Create edge from previous node or fork
      if (lastNodeId || forkNode) {
        addEdge({
          id: `edge_${lastNodeId ?? forkNode!.id}_${nodeId}`,
          source: lastNodeId ?? forkNode!.id,
          target: nodeId,
          color: teamColor,
          thickness: 0.03,
          isParticleFlow: true,
        })
      }

      lastNodeId = nodeId
      setStatusText(nextStatusText())
    })

    es.addEventListener('stat_update', (e: MessageEvent) => {
      const data: StatUpdatePayload = JSON.parse(e.data)
      applyStatDelta({
        dimension: data.dimension,
        delta: data.delta,
        reason: data.reason,
      })
    })

    es.addEventListener('social_post', (e: MessageEvent) => {
      const data: SocialPostPayload = JSON.parse(e.data)
      const post: SocialPost = {
        id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        username: data.username,
        handle: data.handle,
        avatarColor: data.avatar_color || '#888',
        content: data.content,
        sentiment: (data.sentiment as SocialPost['sentiment']) || 'excited',
        timestamp: Date.now(),
      }
      pushPost(post)
    })

    es.addEventListener('done', () => {
      es.close()
      esRef.current = null
      setPhase('complete')
      setInputLocked(false)
      setStatusText('平行宇宙推演完成 · 2010-2014')
    })

    es.addEventListener('error', () => {
      // If the stream closed cleanly via done, ignore
      if (es.readyState === EventSource.CLOSED && useStore.getState().phase === 'complete') {
        return
      }
      es.close()
      esRef.current = null
      // Trigger rollback - but wait for dissolve animation
      setStatusText('⚠️ 时间线崩塌 · 正在回滚……')
      setTimeout(() => {
        triggerRollback()
      }, 2000) // 2s matches the rollback animation duration in spec
    })
  }

  const cancel = () => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    triggerRollback()
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close()
      }
    }
  }, [])

  return { generate, cancel }
}
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```
Expected: No errors from useSSE.

---

### Task 9: Create ThreeCanvas Component

**Files:**
- Create: `nba-multiverse/frontend/src/engine/ThreeCanvas.tsx`
- Create: `nba-multiverse/frontend/src/engine/CameraController.ts`

- [ ] **Step 1: Write CameraController.ts**

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'

export class CameraController {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.controls = new OrbitControls(camera, domElement)

    camera.position.set(4, 6, 10)
    camera.lookAt(4, 0, 0)

    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 2
    this.controls.maxDistance = 20
    this.controls.maxPolarAngle = Math.PI * 0.65
    this.controls.target.set(4, 0, 0)
    this.controls.update()
  }

  flyTo(position: THREE.Vector3, lookAt: THREE.Vector3, duration = 1.2) {
    gsap.to(this.camera.position, {
      x: position.x,
      y: position.y,
      z: position.z,
      duration,
      ease: 'power2.inOut',
    })
    gsap.to(this.controls.target, {
      x: lookAt.x,
      y: lookAt.y,
      z: lookAt.z,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => this.controls.update(),
    })
  }

  resetView(duration = 1.0) {
    this.flyTo(
      new THREE.Vector3(4, 6, 10),
      new THREE.Vector3(4, 0, 0),
      duration,
    )
  }

  setEnabled(enabled: boolean) {
    this.controls.enabled = enabled
  }

  update() {
    this.controls.update()
  }

  dispose() {
    this.controls.dispose()
  }
}
```

- [ ] **Step 2: Write ThreeCanvas.tsx**

```tsx
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import ForceGraph3D from '3d-force-graph'
import { useStore } from '../store'
import { CameraController } from './CameraController'
import { createStarField } from './StarField'
import { createParticleSystem } from './ParticleSystem'
import type { GraphNode } from '../types'

// ForceGraph3D extends Three.js objects — type workaround
type FGInstance = ReturnType<typeof ForceGraph3D>

export default function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<FGInstance | null>(null)
  const camRef = useRef<CameraController | null>(null)
  const particleRef = useRef<ReturnType<typeof createParticleSystem> | null>(null)

  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const masterBrightness = useStore((s) => s.masterBrightness)
  const inputLocked = useStore((s) => s.inputLocked)

  // ─── Init ───
  useEffect(() => {
    if (!containerRef.current) return

    const fg = ForceGraph3D()(containerRef.current) as FGInstance
    fgRef.current = fg

    // Access the internal Three.js scene
    const scene = (fg as any).scene() as THREE.Scene
    const camera = (fg as any).camera() as THREE.PerspectiveCamera
    const renderer = (fg as any).renderer() as THREE.WebGLRenderer

    renderer.setClearColor(0x050510)

    // Star field background
    createStarField(scene)

    // Particle system
    particleRef.current = createParticleSystem(scene)

    // Lights
    scene.add(new THREE.AmbientLight(0x333344, 2))
    const light1 = new THREE.PointLight(0xffccaa, 30, 30)
    light1.position.set(4, 4, 4)
    scene.add(light1)
    const light2 = new THREE.PointLight(0xaaccff, 20, 30)
    light2.position.set(4, -2, -4)
    scene.add(light2)

    // Camera
    const ctrl = new CameraController(camera, renderer.domElement)
    camRef.current = ctrl

    // Graph config
    fg.graphData({ nodes: [], links: [] })
    fg.nodeThreeObject((node: any) => {
      const data = node as GraphNode
      const geo = new THREE.SphereGeometry(data.size * 0.6, 32, 32)
      const mat = new THREE.MeshStandardMaterial({
        color: data.color,
        emissive: data.color,
        emissiveIntensity: data.type === 'fork' ? 1.5 : 0.4,
        roughness: 0.3,
      })
      const mesh = new THREE.Mesh(geo, mat)
      // Fork nodes get a glowing torus ring
      if (data.type === 'fork') {
        const ringGeo = new THREE.TorusGeometry(data.size * 0.9, 0.06, 16, 64)
        const ringMat = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.6 })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.name = 'forkRing'
        mesh.add(ring)
      }
      return mesh
    })
    fg.linkWidth(0.04)
    fg.linkDirectionalParticles(2)
    fg.linkDirectionalParticleWidth(0.8)

    // Animation loop: update camera + particles
    const animate = () => {
      requestAnimationFrame(animate)
      ctrl.update()
      if (particleRef.current) particleRef.current.update()
    }
    animate()

    return () => {
      ctrl.dispose()
      // 3d-force-graph cleanup
      if (fgRef.current) {
        const el = containerRef.current
        if (el) el.innerHTML = ''
      }
    }
  }, [])

  // ─── Sync graph data from store ───
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    const graphData = {
      nodes: nodes.map((n) => ({
        ...n,
        // Pin master nodes on X axis via fx/fy/fz
        fx: n.isRealHistory ? n.position.x : undefined,
        fy: n.isRealHistory ? n.position.y : undefined,
        fz: n.isRealHistory ? n.position.z : undefined,
      })),
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        color: e.color,
      })),
    }
    fg.graphData(graphData)

    // Adjust master line opacity via material override
    // (implemented via nodeThreeObject color brightness)
  }, [nodes, edges])

  // ─── Master brightness ───
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    // Re-apply node colors with adjusted brightness
    fg.nodeColor((node: any) => {
      const n = node as GraphNode
      if (n.isRealHistory) {
        return dimColor(n.color, masterBrightness)
      }
      return n.color
    })
    fg.linkColor((link: any) => {
      const l = link as any
      // Dim master links
      const sourceNode = nodes.find((n) => n.id === l.source)
      if (sourceNode?.isRealHistory) {
        return dimColor(l.color || '#D4A853', masterBrightness)
      }
      return l.color || '#D4A853'
    })
  }, [masterBrightness, nodes])

  // ─── Input lock ───
  useEffect(() => {
    if (camRef.current) {
      camRef.current.setEnabled(!inputLocked)
    }
  }, [inputLocked])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
      }}
    />
  )
}

function dimColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dim = (v: number) => Math.round(v * factor)
  return `#${dim(r).toString(16).padStart(2, '0')}${dim(g).toString(16).padStart(2, '0')}${dim(b).toString(16).padStart(2, '0')}`
}
```

- [ ] **Step 3: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```
Expected: No errors.

---

### Task 10: Create StarField

**Files:**
- Create: `nba-multiverse/frontend/src/engine/StarField.ts`

- [ ] **Step 1: Write the star field**

```typescript
import * as THREE from 'three'

export function createStarField(scene: THREE.Scene): THREE.Points {
  const STAR_COUNT = 5000
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    // Random positions in a large sphere
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const radius = 20 + Math.random() * 30
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius
    positions[i * 3 + 2] = Math.cos(phi) * radius

    // Slight color variation (cool blue-white to warm gold)
    const r = 0.6 + Math.random() * 0.4
    const g = 0.6 + Math.random() * 0.3
    const b = 0.7 + Math.random() * 0.3
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b

    sizes[i] = Math.random() * 2.5 + 0.5
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  })

  const stars = new THREE.Points(geo, mat)
  stars.name = 'starField'
  scene.add(stars)
  return stars
}
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 11: Create ParticleSystem

**Files:**
- Create: `nba-multiverse/frontend/src/engine/ParticleSystem.ts`

- [ ] **Step 1: Write the particle system**

```typescript
import * as THREE from 'three'

export interface ParticleGroup {
  points: THREE.Points
  targetPositions: Float32Array
  startPositions: Float32Array
  progress: number       // 0→1
  direction: 'dissolve' | 'coalesce' | 'rollback'
  duration: number
  elapsed: number
  onComplete?: () => void
}

export function createParticleSystem(scene: THREE.Scene) {
  const groups: ParticleGroup[] = []

  /**
   * Create a dissolve animation for nodes.
   * `meshes`: the Three.js meshes to dissolve into particles.
   */
  function dissolveMeshes(
    meshes: THREE.Object3D[],
    staggerMs: number,
    onAllComplete: () => void,
  ) {
    let completed = 0
    meshes.forEach((mesh, idx) => {
      setTimeout(() => {
        const geo = extractGeometry(mesh)
        if (!geo) {
          completed++
          if (completed === meshes.length) onAllComplete()
          return
        }

        const count = Math.min(geo.attributes.position.count, 300)
        const positions = new Float32Array(count * 3)
        const targets = new Float32Array(count * 3)

        // Sample positions from geometry and generate scatter targets
        for (let i = 0; i < count; i++) {
          const gi = Math.floor(Math.random() * geo.attributes.position.count)
          const px = geo.attributes.position.getX(gi)
          const py = geo.attributes.position.getY(gi)
          const pz = geo.attributes.position.getZ(gi)

          // Apply world matrix
          const wp = new THREE.Vector3(px, py, pz).applyMatrix4(mesh.matrixWorld)

          positions[i * 3] = wp.x
          positions[i * 3 + 1] = wp.y
          positions[i * 3 + 2] = wp.z

          // Random scatter direction
          const angle = Math.random() * Math.PI * 2
          const dist = 2 + Math.random() * 4
          targets[i * 3] = wp.x + Math.cos(angle) * dist
          targets[i * 3 + 1] = wp.y + (Math.random() - 0.5) * dist * 2
          targets[i * 3 + 2] = wp.z + Math.sin(angle) * dist
        }

        const points = createPoints(positions, mesh)
        scene.add(points)

        const group: ParticleGroup = {
          points,
          startPositions: new Float32Array(positions),
          targetPositions: targets,
          progress: 0,
          direction: 'dissolve',
          duration: 0.8,
          elapsed: 0,
          onComplete: () => {
            scene.remove(points)
            points.geometry.dispose()
            ;(points.material as THREE.Material).dispose()
            completed++
            if (completed === meshes.length) onAllComplete()
          },
        }
        groups.push(group)
      }, idx * staggerMs * 1000)
    })
  }

  /**
   * Create a coalesce animation — particles converge to form a new node.
   */
  function coalesceToPosition(
    targetPosition: THREE.Vector3,
    color: string,
    onComplete: () => void,
  ) {
    const count = 200
    const positions = new Float32Array(count * 3)
    const targets = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Start from random shell positions
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 2 + Math.random() * 3
      positions[i * 3] = targetPosition.x + Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = targetPosition.y + Math.sin(phi) * Math.sin(theta) * radius
      positions[i * 3 + 2] = targetPosition.z + Math.cos(phi) * radius

      targets[i * 3] = targetPosition.x
      targets[i * 3 + 1] = targetPosition.y
      targets[i * 3 + 2] = targetPosition.z
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.08,
      color: new THREE.Color(color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    const group: ParticleGroup = {
      points,
      startPositions: new Float32Array(positions),
      targetPositions: targets,
      progress: 0,
      direction: 'coalesce',
      duration: 1.0,
      elapsed: 0,
      onComplete: () => {
        scene.remove(points)
        geo.dispose()
        mat.dispose()
        onComplete()
      },
    }
    groups.push(group)
  }

  /**
   * Update all active particle groups (call each frame).
   */
  function update(deltaMs = 16) {
    const dt = deltaMs / 1000
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      g.elapsed += dt
      g.progress = Math.min(g.elapsed / g.duration, 1.0)

      const positions = g.points.geometry.attributes.position.array as Float32Array
      for (let j = 0; j < positions.length; j += 3) {
        positions[j] = g.startPositions[j] + (g.targetPositions[j] - g.startPositions[j]) * g.progress
        positions[j + 1] = g.startPositions[j + 1] + (g.targetPositions[j + 1] - g.startPositions[j + 1]) * g.progress
        positions[j + 2] = g.startPositions[j + 2] + (g.targetPositions[j + 2] - g.startPositions[j + 2]) * g.progress
      }
      g.points.geometry.attributes.position.needsUpdate = true

      if (g.direction === 'dissolve' || g.direction === 'rollback') {
        ;(g.points.material as THREE.PointsMaterial).opacity = 1 - g.progress
      } else {
        ;(g.points.material as THREE.PointsMaterial).opacity = g.progress
      }

      if (g.progress >= 1.0) {
        groups.splice(i, 1)
        g.onComplete?.()
      }
    }
  }

  return { dissolveMeshes, coalesceToPosition, update, groups }
}

// ─── Helpers ───

function createPoints(positions: Float32Array, source: THREE.Object3D): THREE.Points {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  let color = '#ffcc88'
  if ((source as THREE.Mesh).material) {
    const mat = (source as THREE.Mesh).material as THREE.MeshStandardMaterial
    if (mat.color) color = '#' + mat.color.getHexString()
  }

  const mat = new THREE.PointsMaterial({
    size: 0.06,
    color: new THREE.Color(color),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 1,
  })
  return new THREE.Points(geo, mat)
}

function extractGeometry(obj: THREE.Object3D): THREE.BufferGeometry | null {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).geometry) {
      return (child as THREE.Mesh).geometry as THREE.BufferGeometry
    }
  })
  return null
}
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 12: Create InputLockOverlay

**Files:**
- Create: `nba-multiverse/frontend/src/components/InputLockOverlay.tsx`

- [ ] **Step 1: Write the overlay**

```tsx
import { useStore } from '../store'

export default function InputLockOverlay() {
  const inputLocked = useStore((s) => s.inputLocked)

  if (!inputLocked) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'all',
        cursor: 'not-allowed',
      }}
      aria-hidden="true"
    />
  )
}
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 13: Create ChoiceWheel + ChoiceCard

**Files:**
- Create: `nba-multiverse/frontend/src/components/ChoiceWheel.tsx`
- Create: `nba-multiverse/frontend/src/components/ChoiceCard.tsx`

- [ ] **Step 1: Write ChoiceCard.tsx**

```tsx
import type { ChoiceData } from '../types'

interface Props {
  choice: ChoiceData
  isSelected: boolean
  isCached: boolean
  onSelect: () => void
}

export default function ChoiceCard({ choice, isSelected, isCached, onSelect }: Props) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: isSelected
          ? `2px solid ${choice.team_color}`
          : '1px solid rgba(255,255,255,0.1)',
        background: isSelected
          ? `${choice.team_color}22`
          : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Team color bar */}
      <div
        style={{
          width: 4,
          height: 36,
          borderRadius: 2,
          background: choice.team_color,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
          {choice.label}
          {choice.is_real_history && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: '#D4A853',
                background: 'rgba(212,168,83,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              真实历史
            </span>
          )}
          {isCached && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: '#60a5fa',
                background: 'rgba(96,165,250,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              已推演
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
          {choice.pitch}
        </div>
      </div>

      {/* Radio indicator */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `2px solid ${isSelected ? choice.team_color : 'rgba(255,255,255,0.3)'}`,
          background: isSelected ? choice.team_color : 'transparent',
          flexShrink: 0,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write ChoiceWheel.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useSSE } from '../hooks/useSSE'
import ChoiceCard from './ChoiceCard'
import type { ChoiceData } from '../types'

export default function ChoiceWheel() {
  const isWheelOpen = useStore((s) => s.isWheelOpen)
  const closeWheel = useStore((s) => s.closeWheel)
  const phase = useStore((s) => s.phase)
  const choices = useStore((s) => s.choices)
  const setChoices = useStore((s) => s.setChoices)
  const { generate } = useSSE()

  const [selected, setSelected] = useState<string | null>(null)
  const [cachedBranches, setCachedBranches] = useState<string[]>([])

  // Load choice data on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/timeline')
      .then((r) => r.json())
      .then((data) => {
        setChoices(data.decision_event.choices)
        setCachedBranches(data.cached_branches || [])
        // Pre-select first non-real choice
        const firstAlt = data.decision_event.choices.find(
          (c: ChoiceData) => !c.is_real_history,
        )
        if (firstAlt) setSelected(firstAlt.choice_id)
      })
      .catch(console.error)
  }, [])

  // Auto-select first non-real option
  useEffect(() => {
    if (isWheelOpen && choices.length > 0 && !selected) {
      const firstAlt = choices.find((c) => !c.is_real_history)
      if (firstAlt) setSelected(firstAlt.choice_id)
    }
  }, [isWheelOpen, choices, selected])

  if (!isWheelOpen) return null

  const handlePush = () => {
    if (!selected) return
    const choice = choices.find((c) => c.choice_id === selected)
    if (!choice) return
    closeWheel()
    generate(selected, choice.team_color)
  }

  const selectedChoice = choices.find((c) => c.choice_id === selected)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWheel()
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '90vw',
          background: 'rgba(10,10,30,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px 20px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#D4A853', margin: 0, fontSize: 18 }}>
            2010 年夏天
          </h2>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            勒布朗·詹姆斯的选择……
          </p>
        </div>

        {/* Choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {choices.map((c) => (
            <ChoiceCard
              key={c.choice_id}
              choice={c}
              isSelected={selected === c.choice_id}
              isCached={cachedBranches.includes(c.choice_id)}
              onSelect={() => setSelected(c.choice_id)}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={handlePush}
          disabled={!selected || phase === 'generating'}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '14px 0',
            border: 'none',
            borderRadius: 10,
            background: selectedChoice?.team_color ?? '#D4A853',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: !selected || phase === 'generating' ? 'not-allowed' : 'pointer',
            opacity: !selected || phase === 'generating' ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          🔮 推演这个平行世界
        </button>
      </div>
    </div>
  )
}
```

Note: Add missing `choices` and `setChoices` to the Zustand store uiSlice. In `store/index.ts`, add:
```typescript
  choices: [] as ChoiceData[],
  setChoices: (c: ChoiceData[]) => set({ choices: c }),
```

- [ ] **Step 3: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 14: Create HexagramRadar

**Files:**
- Create: `nba-multiverse/frontend/src/components/HexagramRadar.tsx`

- [ ] **Step 1: Write the radar**

```tsx
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { RPGSixDimensions } from '../types'
import gsap from 'gsap'

const DIMENSIONS: { key: keyof RPGSixDimensions; label: string; icon: string }[] = [
  { key: 'championships', label: '总冠军', icon: '🏆' },
  { key: 'legacy', label: '历史地位', icon: '👑' },
  { key: 'mediaFavor', label: '媒体好感', icon: '📺' },
  { key: 'fanReputation', label: '球迷口碑', icon: '❤️' },
  { key: 'capHealth', label: '薪资健康', icon: '💰' },
  { key: 'physicalToll', label: '体能透支', icon: '⚡' },
]

const CENTER = 120
const MAX_R = 90
const ANGLE_OFFSET = -Math.PI / 2 // Start from top

function getVertex(axisIndex: number, value: number): [number, number] {
  const angle = ANGLE_OFFSET + (axisIndex * Math.PI * 2) / 6
  const r = (value / 100) * MAX_R
  return [
    CENTER + Math.cos(angle) * r,
    CENTER + Math.sin(angle) * r,
  ]
}

function vertexColor(value: number): string {
  if (value > 70) return '#4ade80'
  if (value > 40) return '#facc15'
  return '#ef4444'
}

export default function HexagramRadar() {
  const rpgStats = useStore((s) => s.rpgStats)
  const svgRef = useRef<SVGSVGElement>(null)
  const polygonRef = useRef<SVGPolygonElement>(null)
  const prevValues = useRef<number[]>(DIMENSIONS.map((d) => rpgStats[d.key]))

  useEffect(() => {
    const newValues = DIMENSIONS.map((d) => rpgStats[d.key])
    const points = DIMENSIONS.map((_, i) => getVertex(i, newValues[i]))

    // Animate polygon vertices with GSAP
    const obj: Record<string, number> = {}
    DIMENSIONS.forEach((d, i) => {
      obj[d.key] = prevValues.current[i]
      prevValues.current[i] = newValues[i]
    })

    gsap.to(obj, {
      ...Object.fromEntries(DIMENSIONS.map((d) => [d.key, newValues[DIMENSIONS.findIndex((x) => x.key === d.key)]])),
      duration: 0.6,
      ease: 'elastic.out(1, 0.3)',
      onUpdate: () => {
        if (!polygonRef.current) return
        const pts = DIMENSIONS.map((d, i) => {
          const v = obj[d.key]
          return getVertex(i, v).join(',')
        }).join(' ')
        polygonRef.current.setAttribute('points', pts)
      },
    })
  }, [rpgStats])

  const currentPoints = DIMENSIONS.map((d, i) =>
    getVertex(i, rpgStats[d.key]).join(','),
  ).join(' ')

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 10,
        background: 'rgba(10,10,30,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        width: 260,
      }}
    >
      <svg ref={svgRef} viewBox="0 0 240 240" width="100%" height="auto">
        {/* Background hex grid */}
        {[0.25, 0.5, 0.75, 1.0].map((scale) => {
          const bgPts = DIMENSIONS.map((_, i) => {
            const [x, y] = getVertex(i, 100 * scale)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={scale}
              points={bgPts}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}

        {/* Axes */}
        {DIMENSIONS.map((_, i) => {
          const [cx, cy] = [CENTER, CENTER]
          const [ex, ey] = getVertex(i, 100)
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon */}
        <polygon
          ref={polygonRef}
          points={currentPoints}
          fill="rgba(212,168,83,0.2)"
          stroke="#D4A853"
          strokeWidth={2}
        />

        {/* Vertex dots */}
        {DIMENSIONS.map((d, i) => {
          const [x, y] = getVertex(i, rpgStats[d.key])
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={vertexColor(rpgStats[d.key])}
              stroke="#fff"
              strokeWidth={1}
            />
          )
        })}

        {/* Labels */}
        {DIMENSIONS.map((d, i) => {
          const [x, y] = getVertex(i, 110)
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#cbd5e1"
              fontSize={9}
            >
              {d.icon}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 15: Create SocialFeed + SocialPost

**Files:**
- Create: `nba-multiverse/frontend/src/components/SocialFeed.tsx`
- Create: `nba-multiverse/frontend/src/components/SocialPost.tsx`

- [ ] **Step 1: Write SocialPost.tsx**

```tsx
import type { SocialPost as SocialPostType } from '../types'

const SENTIMENT_COLORS: Record<string, string> = {
  angry: '#ef4444',
  excited: '#f59e0b',
  sarcastic: '#a855f7',
  shocked: '#3b82f6',
  hate: '#991b1b',
}

const SENTIMENT_LABELS: Record<string, string> = {
  angry: '😡 愤怒',
  excited: '🎉 兴奋',
  sarcastic: '😏 阴阳',
  shocked: '😱 震惊',
  hate: '💀 暴击',
}

export default function SocialPostCard({ post }: { post: SocialPostType }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderLeft: `3px solid ${SENTIMENT_COLORS[post.sentiment] ?? '#888'}`,
        background: 'rgba(15,15,35,0.9)',
        borderRadius: '0 8px 8px 0',
        marginBottom: 8,
        transition: 'transform 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
      }}
    >
      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: post.avatarColor,
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
          {post.username}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{post.handle}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: SENTIMENT_COLORS[post.sentiment],
            background: `${SENTIMENT_COLORS[post.sentiment]}22`,
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {SENTIMENT_LABELS[post.sentiment]}
        </span>
      </div>

      {/* Content */}
      <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        {post.content}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Write SocialFeed.tsx**

```tsx
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import SocialPostCard from './SocialPost'
import gsap from 'gsap'

export default function SocialFeed() {
  const posts = useStore((s) => s.posts)
  const feedRef = useRef<HTMLDivElement>(null)
  const prevPostCount = useRef(0)

  // Animate new posts sliding in
  useEffect(() => {
    if (posts.length > prevPostCount.current && feedRef.current) {
      const newCards = feedRef.current.querySelectorAll('.social-post-card')
      const latest = newCards[posts.length - 1] as HTMLElement
      if (latest) {
        gsap.fromTo(
          latest,
          { x: -300, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' },
        )
      }
    }
    prevPostCount.current = posts.length
  }, [posts.length])

  if (posts.length === 0) return null

  return (
    <div
      ref={feedRef}
      style={{
        position: 'fixed',
        left: 16,
        top: 80,
        zIndex: 10,
        width: 280,
        maxHeight: '60vh',
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {posts.map((post) => (
        <div key={post.id} className="social-post-card">
          <SocialPostCard post={post} />
        </div>
      ))}

      {/* Disclaimer */}
      <p
        style={{
          color: '#64748b',
          fontSize: 10,
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        以上内容由 AI 生成，仅为娱乐效果
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 16: Create StatusBar

**Files:**
- Create: `nba-multiverse/frontend/src/components/StatusBar.tsx`

- [ ] **Step 1: Write the status bar**

```tsx
import { useStore } from '../store'
import { useSSE } from '../hooks/useSSE'

export default function StatusBar() {
  const statusText = useStore((s) => s.statusText)
  const phase = useStore((s) => s.phase)
  const { cancel } = useSSE()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(10,10,30,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '8px 20px',
      }}
    >
      {phase === 'generating' && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#f59e0b',
            animation: 'pulse 1s infinite',
          }}
        />
      )}
      <span style={{ color: '#cbd5e1', fontSize: 13 }}>{statusText}</span>
      {phase === 'generating' && (
        <button
          onClick={cancel}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#94a3b8',
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          ✕ 取消
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add CSS animation for pulse**

In `frontend/src/styles/globals.css` (create if doesn't exist), add:
```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.5); }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #050510;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #fff;
}
```

- [ ] **Step 3: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 17: Create App.tsx + Update main.tsx

**Files:**
- Create/Modify: `nba-multiverse/frontend/src/App.tsx`
- Modify: `nba-multiverse/frontend/src/main.tsx`

- [ ] **Step 1: Write App.tsx**

```tsx
import ThreeCanvas from './engine/ThreeCanvas'
import ChoiceWheel from './components/ChoiceWheel'
import InputLockOverlay from './components/InputLockOverlay'
import HexagramRadar from './components/HexagramRadar'
import SocialFeed from './components/SocialFeed'
import StatusBar from './components/StatusBar'

export default function App() {
  return (
    <>
      <ThreeCanvas />
      <InputLockOverlay />
      <ChoiceWheel />
      <HexagramRadar />
      <SocialFeed />
      <StatusBar />
    </>
  )
}
```

- [ ] **Step 2: Update main.tsx**

Ensure `main.tsx` imports global CSS and mounts App:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Verify the app builds**

Run:
```bash
cd nba-multiverse/frontend
npm run build
```
Expected: Successful build.

---

### Task 18: Update Zustand Store with Missing Fields

**Files:**
- Modify: `nba-multiverse/frontend/src/store/index.ts`

- [ ] **Step 1: Add `choices` and `setChoices` to uiSlice**

In the store definition, add to the `uiSlice` section of the store interface and implementation:

```typescript
// In AppStore interface:
  choices: import('../types').ChoiceData[]
  setChoices: (c: import('../types').ChoiceData[]) => void

// In create():
  choices: [],
  setChoices: (c) => set({ choices: c }),
```

- [ ] **Step 2: Verify compiles**

Run:
```bash
cd nba-multiverse/frontend
npx tsc --noEmit
```

---

### Task 19: Install Dependencies & Integration Test

**Files:**
- Modify: `nba-multiverse/frontend/package.json` (add deps)

- [ ] **Step 1: Install frontend dependencies**

```bash
cd nba-multiverse/frontend
npm install three @types/three 3d-force-graph gsap zustand
```

- [ ] **Step 2: Install backend dependencies (verify)**

```bash
cd nba-multiverse/backend
pip install fastapi uvicorn pydantic python-dotenv openai
```

- [ ] **Step 3: Start backend and verify**

```bash
cd nba-multiverse/backend
python main.py &
sleep 2
curl -s http://localhost:8000/api/timeline | python -m json.tool | head -5
```
Expected: JSON response with `decision_event` and `real_history` keys.

- [ ] **Step 4: Start frontend and verify**

```bash
cd nba-multiverse/frontend
npm run dev
```

Open `http://localhost:5173` in a browser.

Expected:
- Deep space starfield visible
- Golden timeline with 8 nodes from 2010-2014
- Pulsing fork node at 2010
- Click fork → choice wheel appears
- Select NYK → particle dissolve animation → orange branch grows → hexagram values shift → social feed populates

- [ ] **Step 5: Commit all changes**

```bash
cd nba-multiverse
git add -A
git commit -m "feat: 詹姆斯世界 full implementation

- Extended backend models with StatChange, SocialPost
- Added entity_validator with 200-player whitelist + Levenshtein fuzzy match
- Upgraded prompts with RPG stats and social post generation
- Extended SSE to emit stat_update and social_post events
- Created Zustand store with graph/rpg/social/ui slices
- Implemented useSSE hook with state rollback support
- Built Three.js scene: StarField, 3d-force-graph, ParticleSystem
- Added CameraController with OrbitControls + GSAP fly-to
- Created ChoiceWheel, HexagramRadar, SocialFeed, StatusBar overlays
- Input lock overlay prevents race conditions during generation
- Atomic rollback on SSE failure with visual sequence"
```
