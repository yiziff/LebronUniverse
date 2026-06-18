# 詹姆斯世界 — Design Spec

> **Date**: 2026-06-16
> **Status**: Approved — ready for implementation plan
> **Scope**: 3D star map + particle animation + 2010 fork point + hexagram radar + virtual social feed

---

## 1. Product Overview

A single-page 3D interactive web application. User sees a deep-space starfield with a golden timeline representing LeBron James' real career from 2010-2014. Clicking the pulsing 2010 fork point opens a choice wheel with 4 options (Miami/real, NYK, Chicago, Cleveland). Choosing a non-real option triggers:

1. **Particle dissolve** — the golden master timeline nodes shatter into scattering particles
2. **AI generation** — the backend streams a new alternate timeline via SSE
3. **Particle coalesce** — new orange branch nodes form from void particles
4. **RPG stat shifts** — the hexagram radar's 6 dimensions animate to new values
5. **Social waterfall** — 3-5 fake tweets slide in from the left sidebar

The demo is complete when a user can go from idle → choose → watch particles + stats + tweets → see both timelines. Target: 90 seconds of visual impact for an interviewer.

---

## 2. Architecture

### 2.1 Approach: Zustand + Three.js Hybrid (Approach C)

```
Zustand Store (single source of truth)
    │
    ├── graphSlice → ThreeCanvas (useEffect + rAF)
    ├── rpgSlice   → HexagramRadar (React SVG)
    ├── socialSlice→ SocialFeed (React DOM)
    └── uiSlice    → All components
```

**Rule**: Zustand is the only data source. Three.js reads from store via useEffect, runs its own animation loop via requestAnimationFrame, uses refs to avoid stale closure issues. React overlay components subscribe to store slices directly.

### 2.2 Component Tree

```
App.tsx
├── ThreeCanvas.tsx          ← fullscreen Three.js render target
│   ├── StarField.ts         ← 5000-particle star background
│   ├── DestinyGraph.ts      ← 3d-force-graph: nodes + edges
│   │   ├── ForkNode (pulsing sphere + torus ring)
│   │   ├── EventNode (small colored spheres)
│   │   └── EdgeLine (TubeGeometry + flow particles)
│   ├── ParticleSystem.ts    ← dissolve/coalesce/rollback buffer geometries
│   └── CameraController.ts  ← OrbitControls + GSAP fly-to
│
├── InputLockOverlay.tsx     ← transparent full-screen click blocker (phase=generating)
│
├── ChoiceWheel.tsx          ← HTML overlay on fork node click
│   └── ChoiceCard.tsx       ← single option with team color bar
│
├── HexagramRadar.tsx        ← bottom-right SVG radar chart
├── SocialFeed.tsx           ← left sidebar tweet waterfall
│   └── SocialPost.tsx       ← single tweet card
└── StatusBar.tsx            ← bottom-center loading text + cancel button
```

### 2.3 Project File Structure

```
nba-multiverse/
├── backend/
│   ├── main.py              ← add stat_update / social_post SSE types
│   ├── models.py            ← add StatChange, SocialPost, SSEEvent
│   ├── llm_engine.py        ← add generate_social_posts()
│   ├── prompt_templates.py  ← add stat rules + social character mix
│   ├── entity_validator.py  ← NEW: player whitelist check
│   ├── data_loader.py       ← unchanged
│   └── requirements.txt     ← unchanged

├── frontend/src/
│   ├── store/
│   │   └── index.ts         ← Zustand with 4 slices
│   ├── engine/
│   │   ├── ThreeCanvas.tsx
│   │   ├── StarField.ts
│   │   ├── DestinyGraph.ts
│   │   ├── ParticleSystem.ts
│   │   └── CameraController.ts
│   ├── components/
│   │   ├── ChoiceWheel.tsx
│   │   ├── ChoiceCard.tsx
│   │   ├── InputLockOverlay.tsx
│   │   ├── HexagramRadar.tsx
│   │   ├── SocialFeed.tsx
│   │   ├── SocialPost.tsx
│   │   └── StatusBar.tsx
│   ├── hooks/
│   │   └── useSSE.ts
│   └── types/
│       └── index.ts

└── data/                    ← unchanged from current
    ├── event_lebron_2010.json
    ├── players.json
    └── real_history.json
```

---

## 3. Data Contracts

### 3.1 SSE Event Protocol

The frontend opens `POST /api/generate/{choice_id}` and receives a mixed SSE stream:

```
event: timeline_event → { event_id, timestamp, title, description,
                          teams_affected, key_players, confidence }

event: stat_update    → { dimension, delta, reason }

event: social_post    → { username, handle, avatar_color, content, sentiment }

event: done           → { status: "complete" }

event: error          → { message: "..." }
```

Stat updates and social posts may interleave with timeline events during streaming.

### 3.2 Zustand Store (TypeScript types in `types/index.ts`)

```ts
// ─── graphSlice ───
interface GraphNode {
  id: string
  type: 'fork' | 'event'
  label: string
  timestamp: string
  position: { x: number; y: number; z: number }
  color: string          // hex
  size: number           // 0.3..1.0, maps to sphere radius
  parentId?: string      // null for master, fork-event-id for branches
  isRealHistory: boolean
  isClickable: boolean
}

interface GraphEdge {
  id: string
  source: string         // node id
  target: string         // node id
  color: string
  thickness: number      // 0.02..0.08 in world units
  isParticleFlow: boolean
}

// ─── rpgSlice ───
type RPGSixDimensions = {
  championships: number      // 0..7
  legacy: number             // 0..100
  mediaFavor: number         // 0..100
  fanReputation: number      // 0..100
  capHealth: number          // 0..100
  physicalToll: number       // 0..100, higher = worse
}

interface StatDelta {
  dimension: keyof RPGSixDimensions
  delta: number
  reason: string
  eventId: string
}

// ─── socialSlice ───
type Sentiment = 'angry' | 'excited' | 'sarcastic' | 'shocked' | 'hate'

interface SocialPost {
  id: string
  username: string
  handle: string
  avatarColor: string
  content: string
  sentiment: Sentiment
  timestamp: number       // Date.now()
}

// ─── uiSlice ───
type AppPhase = 'idle' | 'choosing' | 'generating' | 'complete'

interface GenerationSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
  masterBrightness: number
  rpgStats: RPGSixDimensions
}

interface UIState {
  phase: AppPhase
  selectedChoiceId: string | null
  isWheelOpen: boolean
  inputLocked: boolean                        // blocks all clicks during generating
  errorMessage: string | null
  statusText: string
  generationSnapshot: GenerationSnapshot | null  // for atomic rollback
}
```

### 3.3 Backend Model Additions (Python `models.py`)

```python
class StatChange(BaseModel):
    dimension: Literal["championships", "legacy", "media_favor",
                        "fan_reputation", "cap_health", "physical_toll"]
    delta: int
    reason: str  # ≤30 chars

class SocialPost(BaseModel):
    username: str
    handle: str
    avatar_color: str
    content: str       # ≤100 chars
    sentiment: Literal["angry", "excited", "sarcastic", "shocked", "hate"]

class SSEEvent(BaseModel):
    event_type: Literal["timeline_event", "stat_update", "social_post", "done", "error"]
    payload: dict
```

---

## 4. Three.js Scene Design

### 4.1 Scene Hierarchy

```
Scene
├── starFieldGroup           ← 5000 Points, rotating slowly
├── ambientLight
├── pointLight × 2           ← warm gold + cool blue
├── graphGroup               ← nodes, edges, flow particles
│   ├── masterLineGroup      ← golden, anchored along X axis
│   ├── branchLineGroup      ← team-colored, offset along Z-
│   └── particleFlowGroup    ← flowing dots along edges
└── dissolveGroup            ← transient particles during animations
```

### 4.2 Force-Directed Layout (3d-force-graph)

**Use the `3d-force-graph` library for physics simulation and layout.** Do NOT write custom force algorithms. The library is built on Three.js and handles repulsion, spring forces, damping, and stabilization out of the box.

What we configure (not implement):

| Concern | 3d-force-graph config |
|---------|----------------------|
| Node positions | `graphData()` → library runs d3-force internally |
| Stabilization | `onEngineTick` → stop simulation after N ticks |
| Master line anchor | Set `fx, fy, fz` on master nodes to pin along X axis |
| Branch offset | Set initial `z` on branch nodes; library maintains layout |
| Visual rendering | Override `nodeThreeObject()` and `linkMaterial()` for custom Three.js meshes |

**Integration with our particle system**: 3d-force-graph exposes the underlying Three.js `scene`. We inject our custom `StarField`, `ParticleSystem`, and `CameraController` directly into that scene. The library owns the graph nodes/edges; we own everything else.

**Why not custom**: Debugging a custom 3D force simulator (exploding nodes, perpetual jitter, edge clipping) is a known time-sink that contributes zero demo value. The library solves it in hours instead of days.

### 4.3 Particle Dissolve

Triggered when user selects a non-real choice:

1. Clone the geometry of nodes after the fork point on the master line
2. Convert to BufferGeometry with 200-500 points per node
3. Custom ShaderMaterial: position scatters from origin in random directions, opacity 1→0
4. GSAP timeline: stagger 150ms per node, each dissolves in 800ms
5. After completion: dispose original meshes + particle groups

### 4.4 Particle Coalesce

Triggered as each SSE `timeline_event` arrives:

1. Create particle cloud at random positions on a shell around the target position
2. Custom ShaderMaterial: particles move from scattered → target geometry, opacity 0→1
3. Duration: 1000ms (slightly longer than dissolve for dramatic effect)
4. Last frame: swap particle group for real node mesh (seamless handoff)

### 4.5 Camera

- Default: 30° top-down, distance 8 units
- **OrbitControls**: scroll zoom (2-20), left-drag rotate (full 360° horizontal, 15°-75° vertical), right-drag pan, damping enabled
- **Fly-to**: GSAP camera position + target on node click. Double-click resets.
- **Frustum cull**: skip nodes > 15 units away

---

## 5. UI Overlays

### 5.1 Hexagram Radar (SVG, bottom-right)

- 6 axes at 60° intervals: 🏆Championships / 👑Legacy / 📺Media / ❤️Fans / 💰Cap Health / ⚡Physical Toll
- Current values form a filled hexagon (semi-transparent team color)
- GSAP elasticOut animation when values change (duration 0.6s)
- Each vertex colored independently: green (>70) / yellow (40-70) / red (<40)
- Delta badges (+25 / -15) flash green/red beside the value, auto-hide after 1.5s

### 5.2 Social Feed (DOM, left sidebar)

- Posts slide in from left with 200ms stagger, translateX(-100% → 0), duration 0.4s
- Color-coded left border by sentiment: angry=red / excited=gold / sarcastic=purple / shocked=blue / hate=dark-red
- Max 5 visible posts; old posts auto-fade after 5s (unless hovered)
- Hover: slight scale-up + pause auto-scroll
- Footer disclaimer: "以上内容由 AI 生成，仅为娱乐效果"

### 5.3 Status Bar (DOM, bottom-center)

| Phase | Text (randomly cycled during generating) |
|-------|------|
| idle | "点击脉动的金色节点，改变 NBA 历史" |
| choosing | "选择勒布朗的命运……" |
| generating | "正在推演 2011 年东部格局……" / "正在计算韦德的下一站……" / "正在模拟 2012 年选秀大会……" |
| complete | "平行宇宙推演完成 · 2010-2014" |
| error | "⚠️ AI 推演出错 · 点击重试" |

---

## 6. AI Prompt Design

### 6.1 System Prompt Additions

Two new sections appended to the existing System Prompt:

**§RPG Stats** — For each generated event, evaluate impact on 6 dimensions with concrete delta ranges:
- Join big market → media_favor +20~30, fan_reputation +10~15
- Form superteam → cap_health -15~25, legacy +5~10
- Deep playoff run → physical_toll +10~20
- Win championship → championships +1, legacy +15~25
- Swept/embarrassed → media_favor -10~20, fan_reputation -5~10

**§Social Posts** — After all timeline events, generate 3-5 simulated tweets:
- 1 NBA pundit (Stephen A. Smith / Skip Bayless style)
- 1 die-hard fan of affected team
- 1 "LeBron hater" with classic trolling: "Who's your daddy?", "LeBronto", "Buster", "🐐❌", "猩猩", "没有大腿不会打球", "决定1/2/3/N"
- 0-1 neutral media/journalist
- 0-1 meme/parody style
- Chinese + English mixed, ≤140 chars each
- Sentiment tags: angry / excited / sarcastic / shocked / hate

### 6.2 Entity Validator

**Whitelist**: Expanded from 18 to **~200 players** covering the full 2010-2014 NBA landscape — all starters, key rotation players, notable rookies from 2011/2012/2013/2014 draft classes (Kyrie Irving, Anthony Davis, Damian Lillard, etc.), and frequently traded role players.

**Fuzzy matching**: Levenshtein distance ≤2 tolerance for common spelling variants and LLM transcription errors (e.g., "Dwayne Wade" → "Dwyane Wade"). If fuzzy match succeeds, the event is accepted with the canonical name silently substituted.

**Validation flow**: Runs before SSE push. Unknown player names (after fuzzy match) → event rejected → LLM retry with the banned name injected into the prompt (max 3 retries). After 3 failures, the entire generation is aborted and the frontend triggers state rollback (§7.2).

---

## 7. Error Handling & State Rollback

### 7.1 Validation Layers

| Layer | Scenario | Response |
|-------|----------|----------|
| L1 | LLM invents nonexistent player | Validator blocks (200-player whitelist + Levenshtein fuzzy match ≤2) → retry with ban list → max 3 attempts |
| L2 | LLM returns empty / malformed JSON | Fallback parser → retry → after 3 failures, **trigger rollback** (do NOT return partial events) |
| L3 | API down / SSE connection lost / timeout | SSE error event → frontend triggers rollback |

### 7.2 Atomic State Rollback (CRITICAL)

Partial events MUST never remain on screen. If the SSE stream fails mid-generation, the system performs an atomic rollback:

**Before generation starts:**
1. `uiSlice` takes a deep clone snapshot of `graphSlice` and `rpgSlice` current state
2. `uiSlice` sets `phase = 'generating'` and `inputLocked = true`

**On unrecoverable error (L2 exhausted or L3):**
1. SSE `error` event received → `useSSE` calls `uiSlice.triggerRollback()`
2. Visual sequence (staggered, ~2s total):
   - 0ms: Scene hue-shifts toward red (post-processing or overlay)
   - 200ms: Red "code rain" particles overlay the partial branch
   - 800ms: Partial branch nodes reverse-dissolve (coalesce shader run backwards)
   - 1400ms: All social posts fade out simultaneously
   - 1800ms: RPG stats snap back to pre-generation values
3. `graphSlice.revert(snapshot)` → nodes/edges restored to pre-generation state
4. `rpgSlice.revert(snapshot)` → stats restored
5. `socialSlice.clear()` → all posts removed
6. `uiSlice` sets `phase = 'idle'`, `inputLocked = false`, statusText = "⚠️ 时间线崩塌 · 点击重试"

### 7.3 Input Lock During Generation

When `phase === 'generating'`:
- A transparent full-screen overlay (`pointer-events: all, z-index: 100`) blocks all clicks on the 3D canvas
- ChoiceWheel is force-closed and its trigger button is disabled
- OrbitControls are frozen (`controls.enabled = false`)
- The only interactive element is an optional "✕ Cancel" button in the status bar

This prevents race conditions where the user clicks another fork point while SSE is still streaming.

---

## 8. Out of Scope (Explicitly Cut)

- ❌ Dual protagonist (Kevin Durant)
- ❌ Additional fork points (2014, 2017, 2018, 2021, KD 2016)
- ❌ Nested branching (forking from AI-generated events)
- ❌ Production deployment (local dev only)
- ❌ Mobile responsiveness
- ❌ Sound effects
- ❌ Caching in localStorage (nice-to-have, not in MVP)
