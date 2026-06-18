# 🏀 詹姆斯 2010 决定 — MVP 实施计划

> **目标**：7-10 天，一个页面，一个分叉点，四个选项，AI 推演平行世界线。
>
> **启动日期**：2026-06-15

---

## 目录

1. [最终效果预览](#1-最终效果预览)
2. [项目结构](#2-项目结构)
3. [技术栈](#3-技术栈)
4. [数据文件 — 开工前先写死这些](#4-数据文件--开工前先写死这些)
5. [后端实现](#5-后端实现)
6. [Prompt 工程](#6-prompt-工程)
7. [前端实现](#7-前端实现)
8. [逐日执行清单](#8-逐日执行清单)
9. [验收标准](#9-验收标准)

---

## 1. 最终效果预览

```
用户打开 localhost:5173 →

┌────────────────────────────────────────────────────────────┐
│                                                            │
│   屏幕中央，深色星空背景。                                    │
│                                                            │
│   一条金色时间线从左到右延伸：                                 │
│                                                            │
│   2010 ────●────●────●────●────●────●──── 2014             │
│          热火   三巨头 2012冠 2013冠 回骑士                   │
│          ✦     成立                                         │
│         (脉动)                                              │
│                                                            │
│   用户点击 2010 那个脉动的 ✦ 节点 →                           │
│                                                            │
│   ┌──────────────────────────────────┐                     │
│   │   2010 年夏天                     │                     │
│   │   勒布朗·詹姆斯的选择……            │                     │
│   │                                  │                     │
│   │   ○ 迈阿密热火  (真实历史)        │                     │
│   │   ○ 纽约尼克斯                    │                     │
│   │   ○ 芝加哥公牛                    │                     │
│   │   ○ 留守克利夫兰骑士              │                     │
│   │                                  │                     │
│   │        [ 🔮 推演平行世界 ]        │                     │
│   └──────────────────────────────────┘                     │
│                                                            │
│   用户选择"纽约尼克斯" →                                     │
│                                                            │
│   金色线在 2010 处裂开。                                     │
│   一条橙色新线从裂口向下生长出来：                              │
│                                                            │
│   2010 ────●────●────●────●────●────●  (金色，变暗)         │
│          ╱                                                  │
│         ◆────◆────◆────◆────◆────◆  (橙色，逐节点出现)      │
│        詹签约 波什  韦德  2011  2012                          │
│        尼克斯 留猛龙 交易  东决  交易甜瓜                       │
│                                                            │
│   [ 查看真实历史 ]  [ 重新选择 ]  [ 分享这个平行宇宙 ]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 2. 项目结构

```
nba-multiverse/
├── backend/
│   ├── main.py                    # FastAPI 入口，3 个 endpoint
│   ├── models.py                  # Pydantic 数据模型
│   ├── data_loader.py             # 读取 JSON 数据文件
│   ├── llm_engine.py              # Claude API 调用 + 流式生成
│   ├── prompt_templates.py        # System Prompt + User Prompt 模板
│   └── requirements.txt           # fastapi, anthropic, pydantic, uvicorn
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx               # 入口
│   │   ├── App.tsx                # 主组件，管理状态
│   │   ├── components/
│   │   │   ├── TimelineCanvas.tsx  # 力导向图主画布
│   │   │   ├── ForkNode.tsx        # 分叉点节点（脉动发光）
│   │   │   ├── EventNode.tsx       # 普通事件节点
│   │   │   ├── ChoiceWheel.tsx     # 抉择轮盘（弹出层）
│   │   │   ├── ChoiceCard.tsx      # 轮盘中的单个选项
│   │   │   ├── ParallelBranch.tsx  # AI 生成的橙色世界线
│   │   │   ├── MasterBranch.tsx    # 真实历史金色线
│   │   │   └── StatusBar.tsx       # 底部进度条
│   │   ├── hooks/
│   │   │   └── useSSE.ts           # SSE 流式接收 hook
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript 类型定义
│   │   └── styles/
│   │       └── globals.css         # 星空背景 + 颜色变量
│   └── tsconfig.json
│
├── data/
│   ├── players.json                # ~20 个核心球员
│   ├── event_lebron_2010.json      # 分叉点定义 + 球队上下文
│   └── real_history.json           # 真实历史事件链（金色线）
│
├── .env                            # ANTHROPIC_API_KEY=xxx
├── .gitignore
└── README.md
```

---

## 3. 技术栈

| 层级 | 选择 | 理由 |
|------|------|------|
| 后端框架 | **FastAPI** | 原生支持 SSE（Server-Sent Events），流式返回 AI 生成内容 |
| LLM SDK | **Anthropic Python SDK** | Claude 在结构化 JSON 输出上最稳定 |
| 前端框架 | **React 18 + TypeScript** | — |
| 构建工具 | **Vite** | 快 |
| 图可视化 | **React Flow** | 专门为 React 设计的节点图库 |
| 动画 | **Framer Motion** | 节点入场/退场动画 |
| 数据存储 | **JSON 文件 + localStorage** | MVP 零数据库 |
| 部署 | **Vercel (前端) + Railway (后端)** | 免费额度足够 |

---

## 4. 数据文件 — 开工前先写死这些

### 4.1 `data/players.json`

```json
{
  "lebron-james": {
    "id": "lebron-james",
    "name": "LeBron James",
    "age_2010": 25,
    "rating_2010": 98,
    "position": "SF",
    "contract_status_2010": "unrestricted_free_agent",
    "team_2010_before_decision": "CLE"
  },
  "dwyane-wade": {
    "id": "dwyane-wade",
    "name": "Dwyane Wade",
    "age_2010": 28,
    "rating_2010": 95,
    "position": "SG",
    "contract_status_2010": "unrestricted_free_agent",
    "team_2010_before_decision": "MIA"
  },
  "chris-bosh": {
    "id": "chris-bosh",
    "name": "Chris Bosh",
    "age_2010": 26,
    "rating_2010": 88,
    "position": "PF",
    "contract_status_2010": "unrestricted_free_agent",
    "team_2010_before_decision": "TOR"
  },
  "derrick-rose": {
    "id": "derrick-rose",
    "name": "Derrick Rose",
    "age_2010": 21,
    "rating_2010": 85,
    "position": "PG",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "CHI"
  },
  "amare-stoudemire": {
    "id": "amare-stoudemire",
    "name": "Amar'e Stoudemire",
    "age_2010": 27,
    "rating_2010": 87,
    "position": "PF",
    "contract_status_2010": "signed_with_nyk",
    "team_2010_before_decision": "NYK"
  },
  "carmelo-anthony": {
    "id": "carmelo-anthony",
    "name": "Carmelo Anthony",
    "age_2010": 26,
    "rating_2010": 90,
    "position": "SF",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "DEN"
  },
  "joakim-noah": {
    "id": "joakim-noah",
    "name": "Joakim Noah",
    "age_2010": 25,
    "rating_2010": 82,
    "position": "C",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "CHI"
  },
  "luol-deng": {
    "id": "luol-deng",
    "name": "Luol Deng",
    "age_2010": 25,
    "rating_2010": 83,
    "position": "SF",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "CHI"
  },
  "carlos-boozer": {
    "id": "carlos-boozer",
    "name": "Carlos Boozer",
    "age_2010": 28,
    "rating_2010": 84,
    "position": "PF",
    "contract_status_2010": "signed_with_chi",
    "team_2010_before_decision": "CHI"
  },
  "danilo-gallinari": {
    "id": "danilo-gallinari",
    "name": "Danilo Gallinari",
    "age_2010": 22,
    "rating_2010": 78,
    "position": "SF",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "NYK"
  },
  "chris-paul": {
    "id": "chris-paul",
    "name": "Chris Paul",
    "age_2010": 25,
    "rating_2010": 93,
    "position": "PG",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "NOH"
  },
  "dwight-howard": {
    "id": "dwight-howard",
    "name": "Dwight Howard",
    "age_2010": 24,
    "rating_2010": 91,
    "position": "C",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "ORL"
  },
  "dirk-nowitzki": {
    "id": "dirk-nowitzki",
    "name": "Dirk Nowitzki",
    "age_2010": 32,
    "rating_2010": 89,
    "position": "PF",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "DAL"
  },
  "kevin-durant": {
    "id": "kevin-durant",
    "name": "Kevin Durant",
    "age_2010": 21,
    "rating_2010": 92,
    "position": "SF",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "OKC"
  },
  "kobe-bryant": {
    "id": "kobe-bryant",
    "name": "Kobe Bryant",
    "age_2010": 31,
    "rating_2010": 96,
    "position": "SG",
    "contract_status_2010": "under_contract",
    "team_2010_before_decision": "LAL"
  },
  "paul-george": {
    "id": "paul-george",
    "name": "Paul George",
    "age_2010": 20,
    "rating_2010": 72,
    "position": "SF",
    "contract_status_2010": "rookie",
    "team_2010_before_decision": "IND"
  },
  "john-wall": {
    "id": "john-wall",
    "name": "John Wall",
    "age_2010": 20,
    "rating_2010": 81,
    "position": "PG",
    "contract_status_2010": "rookie",
    "team_2010_before_decision": "WAS"
  },
  "demarcus-cousins": {
    "id": "demarcus-cousins",
    "name": "DeMarcus Cousins",
    "age_2010": 20,
    "rating_2010": 79,
    "position": "C",
    "contract_status_2010": "rookie",
    "team_2010_before_decision": "SAC"
  },
  "gordon-hayward": {
    "id": "gordon-hayward",
    "name": "Gordon Hayward",
    "age_2010": 20,
    "rating_2010": 73,
    "position": "SF",
    "contract_status_2010": "rookie",
    "team_2010_before_decision": "UTA"
  }
}
```

### 4.2 `data/event_lebron_2010.json`

```json
{
  "event_id": "evt_lebron_2010",
  "timestamp": "2010-07-08",
  "type": "free_agency",
  "title": "The Decision",
  "subtitle": "勒布朗·詹姆斯的选择",
  "description": "2010年夏天，25岁的勒布朗·詹姆斯成为不受限制自由球员。两届MVP，正在寻找生涯第一个总冠军。整个联盟都在等待他的决定。",
  
  "actor": {
    "player_id": "lebron-james",
    "player_name": "LeBron James",
    "age": 25,
    "rating": 98,
    "accolades_at_time": ["2x MVP", "6x All-Star", "4x All-NBA First Team"]
  },
  
  "choices": [
    {
      "choice_id": "miami_heat",
      "label": "迈阿密热火",
      "team_code": "MIA",
      "team_color": "#98002E",
      "is_real_history": true,
      "pitch": "与德维恩·韦德、克里斯·波什组成超级球队。帕特·莱利提供冠军文化和没有州税的佛罗里达。",
      "roster_before": ["dwyane-wade", "mario-chalmers", "michael-beasley", "udonis-haslem"],
      "cap_space": 28000000
    },
    {
      "choice_id": "new_york_knicks",
      "label": "纽约尼克斯",
      "team_code": "NYK",
      "team_color": "#F58426",
      "is_real_history": false,
      "pitch": "麦迪逊广场花园。世界最大市场。与阿玛雷·斯塔德迈尔联手，在篮球圣殿打造王朝。",
      "roster_before": ["amare-stoudemire", "danilo-gallinari", "wilson-chandler", "tony-douglas"],
      "cap_space": 18000000
    },
    {
      "choice_id": "chicago_bulls",
      "label": "芝加哥公牛",
      "team_code": "CHI",
      "team_color": "#CE1141",
      "is_real_history": false,
      "pitch": "联手22岁的德里克·罗斯和乔金·诺阿。继承乔丹的遗产，公牛复兴就在此刻。",
      "roster_before": ["derrick-rose", "joakim-noah", "luol-deng", "carlos-boozer"],
      "cap_space": 5000000
    },
    {
      "choice_id": "cleveland_cavaliers",
      "label": "留守克利夫兰骑士",
      "team_code": "CLE",
      "team_color": "#860038",
      "is_real_history": false,
      "pitch": "家乡英雄。骑士承诺围绕你继续补强阵容。在克利夫兰夺冠的意义超过在任何其他地方。",
      "roster_before": ["antawn-jamison", "mo-williams", "anderson-varejao", "jj-hickson"],
      "cap_space": 32000000
    }
  ],
  
  "context": {
    "season": "2010-11",
    "salary_cap": 58044000,
    "luxury_tax_line": 70307000,
    "key_free_agents": [
      {"name": "Dwyane Wade", "team": "MIA", "status": "expected_to_re-sign"},
      {"name": "Chris Bosh", "team": "TOR", "status": "considering_heat_or_bulls"},
      {"name": "Amar'e Stoudemire", "team": "NYK", "status": "already_signed_5yr_100m"},
      {"name": "Carlos Boozer", "team": "CHI", "status": "already_signed_5yr_80m"},
      {"name": "Joe Johnson", "team": "ATL", "status": "expected_to_re-sign_max"},
      {"name": "Dirk Nowitzki", "team": "DAL", "status": "expected_to_re-sign"},
      {"name": "Paul Pierce", "team": "BOS", "status": "expected_to_re-sign"},
      {"name": "Ray Allen", "team": "BOS", "status": "expected_to_re-sign"}
    ],
    "rookie_class_2010_top10": [
      "John Wall (WAS, #1)", "Evan Turner (PHI, #2)", "Derrick Favors (NJN, #3)",
      "DeMarcus Cousins (SAC, #5)", "Greg Monroe (DET, #7)", 
      "Gordon Hayward (UTA, #9)", "Paul George (IND, #10)"
    ],
    "recent_champions": ["2008 BOS", "2009 LAL", "2010 LAL"],
    "top_teams_2010": ["LAL", "BOS", "ORL", "CLE", "DAL", "PHX"]
  }
}
```

### 4.3 `data/real_history.json`

```json
{
  "branch_id": "master",
  "branch_name": "真实历史",
  "color": "#D4A853",
  "parent_event_id": "evt_lebron_2010",
  "parent_choice_id": "miami_heat",
  "events": [
    {
      "event_id": "real_001",
      "timestamp": "2010-07-08",
      "title": "詹姆斯宣布加盟迈阿密热火",
      "description": "The Decision. 在ESPN全国直播中宣布：'我将把天赋带到南海岸。'与韦德、波什组成三巨头。",
      "teams_affected": ["MIA", "CLE"],
      "key_players": ["lebron-james"]
    },
    {
      "event_id": "real_002",
      "timestamp": "2010-07-10",
      "title": "波什先签后换加盟热火",
      "description": "猛龙送出波什，得到两个首轮签和一个交易特例。热火三巨头正式组建。",
      "teams_affected": ["MIA", "TOR"],
      "key_players": ["chris-bosh"]
    },
    {
      "event_id": "real_003",
      "timestamp": "2010-12-02",
      "title": "骑士26连败",
      "description": "失去詹姆斯后，骑士创造了北美职业体育最长的26连败纪录。",
      "teams_affected": ["CLE"],
      "key_players": []
    },
    {
      "event_id": "real_004",
      "timestamp": "2011-06-12",
      "title": "热火总决赛2-4败给小牛",
      "description": "三巨头首年杀入总决赛，但被诺维茨基率领的小牛击败。詹姆斯G4仅得8分。",
      "teams_affected": ["MIA", "DAL"],
      "key_players": ["lebron-james", "dirk-nowitzki"]
    },
    {
      "event_id": "real_005",
      "timestamp": "2012-06-21",
      "title": "热火4-1雷霆，詹姆斯首冠",
      "description": "詹姆斯场均28.6分10.2篮板7.4助攻，拿到生涯第一个总冠军和FMVP。",
      "teams_affected": ["MIA", "OKC"],
      "key_players": ["lebron-james", "kevin-durant"]
    },
    {
      "event_id": "real_006",
      "timestamp": "2013-06-20",
      "title": "热火4-3马刺，两连冠",
      "description": "雷·阿伦G6绝平三分拯救热火。詹姆斯G7砍下37分，连庄FMVP。",
      "teams_affected": ["MIA", "SAS"],
      "key_players": ["lebron-james"]
    },
    {
      "event_id": "real_007",
      "timestamp": "2014-06-15",
      "title": "热火1-4败马刺，三巨头时代终结",
      "description": "马刺复仇成功。伦纳德获FMVP。赛后詹姆斯成为自由球员。",
      "teams_affected": ["MIA", "SAS"],
      "key_players": ["lebron-james"]
    },
    {
      "event_id": "real_008",
      "timestamp": "2014-07-11",
      "title": "詹姆斯回归克利夫兰骑士",
      "description": "在《体育画报》发表公开信：'我回家了。'宣布回归骑士，与欧文、乐福组成新三巨头。",
      "teams_affected": ["CLE", "MIA"],
      "key_players": ["lebron-james"]
    }
  ]
}
```

---

## 5. 后端实现

### 5.1 `backend/models.py` — Pydantic 模型

```python
from pydantic import BaseModel
from typing import Optional
from datetime import date


class Player(BaseModel):
    id: str
    name: str
    age_2010: int
    rating_2010: int
    position: str
    contract_status_2010: str
    team_2010_before_decision: str


class Choice(BaseModel):
    choice_id: str
    label: str
    team_code: str
    team_color: str
    is_real_history: bool
    pitch: str
    roster_before: list[str]
    cap_space: int


class DecisionEvent(BaseModel):
    event_id: str
    timestamp: str
    type: str
    title: str
    subtitle: str
    description: str
    actor: dict
    choices: list[Choice]
    context: dict


class TimelineEvent(BaseModel):
    event_id: str
    timestamp: str
    title: str
    description: str
    teams_affected: list[str]
    key_players: list[str]


class RealHistory(BaseModel):
    branch_id: str
    branch_name: str
    color: str
    parent_event_id: str
    parent_choice_id: str
    events: list[TimelineEvent]


class GeneratedEvent(BaseModel):
    """LLM 生成的单个事件"""
    event_id: str
    timestamp: str
    title: str
    description: str
    teams_affected: list[str]
    key_players: list[str]
    confidence: float


class GeneratedBranch(BaseModel):
    """LLM 生成的完整分支"""
    branch_id: str
    branch_name: str
    parent_event_id: str
    parent_choice_id: str
    narrative_summary: str
    events: list[GeneratedEvent]
```

### 5.2 `backend/main.py` — API

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from data_loader import load_decision_event, load_real_history
from llm_engine import generate_branch_stream
from models import GeneratedBranch
import json

app = FastAPI(title="NBA Multiverse Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存缓存：已生成的分支不重复调 LLM
branch_cache: dict[str, GeneratedBranch] = {}


@app.get("/api/timeline")
async def get_timeline():
    """
    返回分叉点 + 真实历史事件链。
    前端首次加载时调用。
    """
    return {
        "decision_event": load_decision_event(),
        "real_history": load_real_history(),
        "cached_branches": list(branch_cache.keys()),  # 已缓存的选项ID
    }


@app.get("/api/branch/{choice_id}")
async def get_branch(choice_id: str):
    """
    获取已生成的分支（非流式）。
    如果未生成，返回 404。前端可用此检查缓存。
    """
    if choice_id in branch_cache:
        return branch_cache[choice_id]
    return {"status": "not_generated"}


@app.post("/api/generate/{choice_id}")
async def generate_branch(choice_id: str):
    """
    流式生成平行宇宙分支。
    使用 Server-Sent Events (SSE) 推送事件。
    """
    # 检查缓存
    if choice_id in branch_cache:
        # 已生成过，直接返回缓存（也用 SSE 逐个推送，保持一致）
        async def cached_stream():
            for event in branch_cache[choice_id].events:
                yield f"data: {json.dumps(event.model_dump())}\n\n"
            yield f"data: [DONE]\n\n"
        return StreamingResponse(cached_stream(), media_type="text/event-stream")
    
    # 首次生成
    decision = load_decision_event()
    real = load_real_history()
    
    async def stream():
        events_buffer = []
        async for event in generate_branch_stream(choice_id, decision, real):
            events_buffer.append(event)
            yield f"data: {json.dumps(event.model_dump())}\n\n"
        
        # 生成完成后存入缓存
        branch = GeneratedBranch(
            branch_id=f"branch_{choice_id}",
            branch_name=next(c.label for c in decision.choices if c.choice_id == choice_id),
            parent_event_id=decision.event_id,
            parent_choice_id=choice_id,
            narrative_summary="",
            events=events_buffer,
        )
        branch_cache[choice_id] = branch
        yield f"data: [DONE]\n\n"
    
    return StreamingResponse(stream(), media_type="text/event-stream")
```

### 5.3 `backend/llm_engine.py` — LLM 调用

```python
import asyncio
import json
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from models import GeneratedEvent, DecisionEvent, RealHistory
from prompt_templates import SYSTEM_PROMPT, build_user_prompt


async def generate_branch_stream(
    choice_id: str,
    decision: DecisionEvent,
    real_history: RealHistory,
) -> AsyncGenerator[GeneratedEvent, None]:
    """
    流式调用 Claude，逐个 yield 事件。
    每个事件生成完就立即返回，前端立即渲染。
    """
    client = AsyncAnthropic()
    
    user_prompt = build_user_prompt(choice_id, decision, real_history)
    
    async with client.messages.stream(
        model="claude-sonnet-4-6",  # 够用且便宜
        max_tokens=4096,
        temperature=0.8,            # 稍微提高随机性，不同次生成结果不同
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        buffer = ""
        async for text in stream.text_stream:
            buffer += text
            # 尝试从 buffer 中提取完整的 JSON 事件
            events = extract_complete_events(buffer)
            for event_data in events:
                try:
                    event = GeneratedEvent(**event_data)
                    yield event
                except Exception:
                    # Schema 不匹配的跳过，等 buffer 积累更多数据再试
                    pass


def extract_complete_events(buffer: str) -> list[dict]:
    """
    从流式文本 buffer 中提取完整的 JSON 对象。
    简单策略：检测闭合的大括号。
    """
    results = []
    depth = 0
    start = -1
    
    for i, ch in enumerate(buffer):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    obj = json.loads(buffer[start:i+1])
                    results.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1
    
    return results
```

### 5.4 `backend/data_loader.py`

```python
import json
from pathlib import Path
from models import DecisionEvent, RealHistory, Player
from functools import lru_cache

DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=1)
def load_players() -> dict[str, Player]:
    with open(DATA_DIR / "players.json", "r", encoding="utf-8") as f:
        raw = json.load(f)
    return {k: Player(**v) for k, v in raw.items()}


@lru_cache(maxsize=1)
def load_decision_event() -> DecisionEvent:
    with open(DATA_DIR / "event_lebron_2010.json", "r", encoding="utf-8") as f:
        return DecisionEvent(**json.load(f))


@lru_cache(maxsize=1)
def load_real_history() -> RealHistory:
    with open(DATA_DIR / "real_history.json", "r", encoding="utf-8") as f:
        return RealHistory(**json.load(f))
```

---

## 6. Prompt 工程

### 6.1 `backend/prompt_templates.py`

```python
SYSTEM_PROMPT = """你是 NBA 平行宇宙推演引擎。

2010年夏天，勒布朗·詹姆斯做出了与真实历史不同的选择。你需要基于这个新选择，推演接下来4年（2010-2014）发生的关键篮球事件。

【铁律】
1. 遵守 2010-2014 年 NBA 劳资协议的薪资规则。
2. 交易必须薪资匹配（±125%规则）。如果无法精确计算薪资，标记 confidence < 0.7。
3. 球员交易价值需反映其 2010 年当时的年龄、合同、真实表现和伤病史。
4. 各队总经理有其历史风格：
   - Pat Riley (MIA): 追求超级巨星，大胆交易，擅长清理薪资空间
   - Donnie Walsh (NYK): 重建尼克斯，清理乱账，有薪资空间
   - Gar Forman (CHI): 保守，围绕罗斯建队
   - Chris Grant (CLE): 需要彻底重建
   - Sam Presti (OKC): 极端偏好选秀权
   - Daryl Morey (HOU): 迷恋球星，数据分析驱动
   - Danny Ainge (BOS): 精于算计，最大化交易价值
5. 考虑 2011、2012、2013 届真实新秀的天赋分布。
6. 跨年份叙事必须自洽。如果一支球队打进了东决，它不可能同时拥有乐透签。
7. 不要发明不存在的球员。只使用 2010 年当时存在的 NBA 球员。

【你需要推演的事件类型】
- 自由球员签约：受影响的球队如何重新规划薪资空间
- 重磅交易：失去/获得球星的球队如何反应
- 选秀：球队战绩变化如何影响其选秀权位置
- 季后赛结果：新的力量格局下的季后赛走向
- 连锁反应：詹姆斯的决定如何影响韦德、波什等其他自由球员

【输出格式】
严格返回以下 JSON 格式。不要有任何解释文字。只返回 JSON。

{
  "branch_name": "简短的分支名称（10字以内）",
  "narrative_summary": "一段150字以内的整体叙事，描述这个平行宇宙的核心故事线",
  "events": [
    {
      "timestamp": "YYYY-MM-DD",
      "title": "事件标题（15字以内）",
      "description": "2-3句话描述发生了什么，包含具体的球队、球员和交易细节",
      "teams_affected": ["TEAM_CODE"],
      "key_players": ["player-id"],
      "confidence": 0.85
    }
  ]
}

生成 6-8 个事件，覆盖 2010 到 2014 年。事件按时间顺序排列。"""


def build_user_prompt(
    choice_id: str,
    decision: dict,
    real_history: dict,
) -> str:
    """组装特定选项的 User Prompt"""
    
    choice = next(c for c in decision["choices"] if c["choice_id"] == choice_id)
    real_events = real_history["events"]
    
    base = f"""【用户的选择】
勒布朗·詹姆斯拒绝了真实历史中的迈阿密热火，选择了：{choice["label"]}

{choice["pitch"]}

这意味着：
- 热火三巨头（詹姆斯+韦德+波什）将不会组建
- 被选球队的阵容和薪资空间将发生根本性变化
- 整个联盟的力量格局将被改写

【真实历史对照（这些事现在将不会发生）】
{chr(10).join(f"- {e['timestamp']}: {e['title']}" for e in real_events)}

【被选球队的状态 — {choice['label']}（{choice['team_code']}）】
现有阵容：{', '.join(choice['roster_before'])}
薪资空间：${choice['cap_space']:,}

【其他受影响球队】
- 迈阿密热火：失去詹姆斯，保留韦德，薪资空间$28M
- 克利夫兰骑士：失去詹姆斯，薪资空间$32M，需要彻底重建
- 多伦多猛龙：波什去向不明（真实历史中去热火组三巨头）
- 纽约尼克斯：已签约小斯（5年$100M），薪资空间$18M
- 芝加哥公牛：已签约布泽尔（5年$80M），拥有罗斯和诺阿

【2010年自由球员市场关键人物】
- Dwyane Wade (MIA, 预期续约)
- Chris Bosh (TOR, 考虑热火或公牛)
- Joe Johnson (ATL, 预期顶薪续约)
- Dirk Nowitzki (DAL, 预期续约)

【2010届新秀（已按真实顺位选中）】
#1 John Wall (WAS), #2 Evan Turner (PHI), #5 DeMarcus Cousins (SAC),
#9 Gordon Hayward (UTA), #10 Paul George (IND)

请推演 2010 年夏天到 2014 年夏天之间，这个平行宇宙中发生的关键事件。"""
    
    return base
```

---

## 7. 前端实现

### 7.1 关键组件大纲

```
App.tsx — 状态管理

  状态：
    timeline: TimelineData | null        ← 初始加载的数据
    activeBranch: GeneratedBranch | null ← 当前显示的 AI 生成分支
    selectedChoice: string | null        ← 用户选中的选项
    status: 'idle' | 'choosing' | 'generating' | 'complete'
    
  主要逻辑：
    1. 首次加载 → GET /api/timeline → 渲染金色线 + 分叉点
    2. 点击分叉点 → 显示 ChoiceWheel
    3. 用户选择 → POST /api/generate/{choice_id} → SSE 流式接收
    4. 每收到一个事件 → 在橙色线上新增一个节点
    5. 完成 → 缓存到 localStorage


TimelineCanvas.tsx — 力导向图主画布

  使用 React Flow：
    - MasterBranch: 金色节点链，从左到右排列
    - ForkNode: 2010 年的分叉点，脉动发光动画
    - ParallelBranch: 橙色节点链，从分叉点向下/向右生长
    - 节点之间的连线 (edges)


ForkNode.tsx — 分叉点

  视觉：
    - 比普通节点大 1.5 倍
    - 金色边框 + 内部光晕脉动（CSS animation: pulse 2s infinite）
    - 悬停时显示光标：pointer
    - 点击触发 onClick → 打开 ChoiceWheel


ChoiceWheel.tsx — 抉择轮盘

  视觉：
    - 全屏半透明黑色遮罩
    - 中央卡片，深色背景 + 金色边框
    - 标题："2010 年夏天" + "勒布朗·詹姆斯的选择……"
    - 4 个 ChoiceCard 垂直排列
    - 底部 [🔮 推演平行世界] 按钮
  
  逻辑：
    - 默认选中第一个非真实选项
    - 真实历史选项标记 ✓ 已发生
    - 选中后点"推演" → 关闭轮盘 → 开始生成


ChoiceCard.tsx — 单个选项

  视觉：
    - 左侧：球队色竖条
    - 中间：球队名称 + 一句话卖点 (pitch)
    - 右侧：如果是真实历史 → "✓ 真实历史" 标签
    - 已生成过的选项 → "已推演" 标记（可从缓存加载）
    - 选中态：边框发光 + 轻微缩放


ParallelBranch.tsx — AI 生成的世界线

  视觉：
    - 橙色节点，从分叉点处开始逐个出现
    - 新节点入场动画：从上一个节点的位置"生长"出来
      （Framer Motion: initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}）
    - 每个节点可用不同大小表示事件重要性
    - 连线颜色：橙色半透明
    - 每个事件节点悬停时显示详情卡片


StatusBar.tsx — 底部状态

  idle:          ""
  choosing:      "选择勒布朗的命运……"
  generating:    "正在推演 2012 年东部格局……" (动态文案)
  complete:      "平行宇宙推演完成 · 2010-2014"


useSSE.ts — SSE Hook

  function useSSE(url: string) {
    // 连接 SSE endpoint
    // 每收到一个事件 → callback(event)
    // 返回 { isConnected, isDone, error }
  }
```

---

## 8. 逐日执行清单

### Day 1：数据 + 后端骨架（3-4h）

```
□ 创建项目目录结构
□ 编写 data/players.json（复制上方内容）
□ 编写 data/event_lebron_2010.json（复制上方内容）
□ 编写 data/real_history.json（复制上方内容）
□ 编写 backend/models.py（复制上方内容）
□ 编写 backend/data_loader.py（复制上方内容）
□ 编写 backend/main.py 骨架（GET /api/timeline 先返回静态数据）
□ pip install fastapi anthropic pydantic uvicorn python-dotenv
□ uvicorn main:app --reload → curl 验证 GET /api/timeline 返回正确 JSON

验收：curl localhost:8000/api/timeline 返回完整 JSON，Pydantic 不报错。
```

### Day 2：Prompt 调优（4-5h）

```
□ 编写 backend/prompt_templates.py
□ 编写 backend/llm_engine.py
□ 补充 POST /api/generate/{choice_id} 的 SSE 逻辑
□ 用真实 API Key 测试 4 个选项的 Prompt
□ 每个选项生成 2-3 次，观察输出质量
□ 迭代 Prompt（这是今天最重要的活）：
  - 输出格式不对 → 加强 JSON 约束说明
  - 叙事不自洽 → 加一致性约束
  - 发明不存在的人 → 加强实体约束
  - 缺少具体细节 → 要求更具体的交易描述
□ 确定最终版 Prompt 模板

验收：4 个选项各自调用 1 次，每次输出结构正确，60%+ 事件看起来合理。
```

### Day 3：前端项目初始化 + 金色时间线（3-4h）

```
□ npm create vite@latest frontend -- --template react-ts
□ npm install reactflow framer-motion
□ 编写 TypeScript 类型定义 (types/index.ts)
□ 编写 TimelineCanvas 组件：
  - 用 React Flow 渲染金色节点链
  - 节点水平排列，从左到右
  - 简单样式（金色边框 + 暗色背景）
□ 编写 EventNode 组件（悬停显示详情）
□ 编写 MasterBranch 组件（连接真实历史数据）
□ App.tsx 首次加载逻辑：
  - fetch GET /api/timeline
  - 渲染 TimelineCanvas with 金色线

验收：打开浏览器 → 看到金色时间线从 2010 延伸到 2014，7-8 个节点。
```

### Day 4：分叉点 + 抉择轮盘（4-5h）

```
□ 编写 ForkNode 组件（脉动发光动画）
□ 编写 ChoiceWheel 组件（遮罩 + 卡片容器）
□ 编写 ChoiceCard 组件（球队色条 + 描述 + 选中态）
□ 交互逻辑：
  - 点击 ForkNode → ChoiceWheel 弹出
  - 点击遮罩空白处 → ChoiceWheel 关闭
  - 选择选项 → 高亮选中
  - 点击 [推演] → 关闭轮盘 → 进入生成状态
□ 动画调优（Framer Motion）：
  - 轮盘入场：scale 0.8→1.0 + opacity 0→1
  - 卡片选中：border glow + scale 1.02

验收：点击分叉点 → 轮盘弹出 → 选择尼克斯 → 点击推演 → 进入加载态。
```

### Day 5：流式渲染 + 橙色世界线（4-5h）

```
□ 编写 useSSE hook（连接 /api/generate/{choice_id}）
□ 编写 ParallelBranch 组件：
  - 接收 SSE 事件流
  - 每收到一个事件 → 在橙色线上新增一个节点
  - 新节点入场动画（scale + opacity + 从上一个节点位置滑入）
□ 双线同屏布局：
  - 金色线在分叉点之后变暗（opacity: 0.4）
  - 橙色线从分叉点下方生长
□ 编写 StatusBar 组件：
  - 轮播式加载文案
  - "正在推演2011年自由球员市场……"
  - "正在计算韦德的决定……"
  - "正在模拟2012年季后赛……"

验收：选择尼克斯 → 橙色节点逐个出现 → 金色线变暗 → 双线并行 → 完成。
```

### Day 6：缓存 + 错误处理 + 回看（3-4h）

```
□ localStorage 缓存：
  - 生成完成后缓存到 localStorage
  - 下次选同一选项 → 检查缓存 → 直接从缓存渲染（秒出）
  - 缓存 key: "branch_{choice_id}"
□ 已生成选项的标记：
  - ChoiceCard 上显示 "已推演" 标签
  - 点击"已推演"选项 → 直接从缓存加载，不调 LLM
□ "重新生成" 按钮（可选）：
  - 清除该选项缓存 → 重新调 LLM
□ 错误处理：
  - LLM API 挂了 → 显示友好错误 + "重试"按钮
  - 网络断了 → 显示连接错误
  - 生成超时（>60s）→ 显示超时提示
□ "查看真实历史" 按钮：
  - 在已经看橙色线的时候，可以一键切回金色线高亮

验收：选一个选项生成 → 刷新页面 → 再选同一选项 → 秒出（缓存命中）。
```

### Day 7：打磨 + 部署 + Demo 视频（4-5h）

```
□ 动画细节：
  - 分叉点脉动节奏
  - 节点生长速度（每个节点出现间隔 300-500ms）
  - 颜色过渡（金色→暗金，橙色线性生长）
□ 字体/排版：
  - 标题字体
  - 事件描述字号
  - 颜色一致性
□ 部署：
  - 后端 → Railway（或 Render）
  - 前端 → Vercel
  - 环境变量配置（ANTHROPIC_API_KEY）
□ 录 Demo 视频（90 秒以内）：
  0-10s   展示金色时间线
  10-20s  点击分叉点，轮盘弹出
  20-30s  选择"纽约尼克斯"
  30-50s  金色线裂开，橙色节点逐个生长（加速播放）
  50-70s  双线同屏展示（实时速度）
  70-90s  展示"重新选择"功能，选公牛，看另一条世界线
□ 写 GitHub README：
  - 顶部 GIF（demo 的精华 10 秒循环）
  - 一句话介绍
  - Live Demo 链接
  - 技术栈徽章
  - How it works 简要说明
  - 本地运行指南

验收：任何人打开 GitHub → 看 GIF → 点 Live Demo → 自己玩 → star。
```

---

## 9. 验收标准

| # | 标准 | 如何测试 |
|---|------|---------|
| 1 | 页面首次加载 2 秒内显示金色时间线 | 打开浏览器，计时 |
| 2 | 点击分叉点 → 轮盘在 300ms 内弹出 | 目测动画流畅 |
| 3 | 选择非真实选项 → 15 秒内第一个橙色节点出现 | 计时 |
| 4 | 生成完成后，橙色线上有 5-8 个事件节点 | 数节点 |
| 5 | 所有 AI 生成的事件中包含至少 2 个具体的交易或签约 | 读内容 |
| 6 | AI 没有发明不存在的球员 | 全文搜索 + 白名单比对 |
| 7 | 刷新页面后再次选同一选项 → 秒出（<1s） | 计时 |
| 8 | 金色线和橙色线在视觉上有明显区分 | 色盲测试：金色 vs 橙色 |
| 9 | Live Demo 链接在任何浏览器都能打开 | Chrome/Firefox/Safari |
| 10 | LLM API Key 不在前端代码中暴露 | 检查 Network 面板 |

---

## 附：做完这个 MVP 之后

```
这个 MVP 做完，你手里有：

  ✅ 一套可用的 NBA 球员/事件数据模型
  ✅ 一个 Claude API 流式调用管线
  ✅ 一个 React Flow 力导向图渲染框架
  ✅ 一套 Prompt 调优经验
  ✅ 一个双色时间线可视化系统

  接下来你可以选择：

  A. 加第二个分叉点（KD 2016、Kawhi 2019...）
     → 复用所有后端和前端框架
     → 只需要加数据文件 + 调整 Prompt

  B. 加"点击 × 取消任意事件"功能
     → 这就是 PG-SGA 的级联剪枝
     → 复用现有的 TimelineCanvas 和 EventNode
     → 加上 cascade_prune 算法就行

  C. 两者都做
     → 一个完整的 NBA 多重宇宙引擎
```

---

> **明天就开始 Day 1。三个 JSON 文件写完复制进去，后端跑通，第一天就结束了。这是整个项目最简单的一天，也是最没有借口推迟的一天。**
