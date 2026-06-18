# 🏀 NBA 多重宇宙 MVP — 单一分叉点可行性评估

> **MVP 定义**：一个页面，一个分叉点（2010 年詹姆斯决定），四个选项，AI 推演一条平行世界线。
>
> **评估日期**：2026-06-15
>
> **整体难度**：★★★★☆☆☆☆☆☆（4.5 / 10）
>
> **预计周期**：7-10 天（业余时间，每天 3-4 小时）

---

## 1. MVP 精确定义

### 1.1 这个 MVP 包含什么

```
用户打开页面 →

    看到一条金色时间线：
    2010 ─── ● 詹姆斯加盟热火 ─── ● 热火三巨头 ─── ● 2012总冠军 ─── ● 2013总冠军

    点击 2010 年那个发光的节点 →

    弹出抉择轮盘：
    ┌─────────────────────────────┐
    │   2010 年夏天                │
    │   勒布朗·詹姆斯的选择……       │
    │                             │
    │   ○ 迈阿密热火  ← 真实历史   │
    │   ○ 纽约尼克斯               │
    │   ○ 芝加哥公牛               │
    │   ○ 留守克利夫兰骑士         │
    │                             │
    │        [🔮 推演]             │
    └─────────────────────────────┘

    用户选择"纽约尼克斯" →

    金色时间线在 2010 处裂开 →
    一条橙色新线从裂口生长出来 →
    AI 逐个生成新节点，逐个渲染：

    2010 ──◆ 詹姆斯签约尼克斯
           │
           ◆ 波什留守猛龙（热火三巨头未能组建）
           │
           ◆ 韦德要求交易
           │
           ◆ 2011东决：尼克斯 vs 公牛
           │
           ◆ 2012：尼克斯交易得到甜瓜

    完成。用户看到两条并行的世界线：
    ═══ 金色 = 真实历史
    ─── 橙色 = 詹姆斯去尼克斯的平行宇宙
```

### 1.2 MVP 不包含什么

| 不包含 | 理由 |
|--------|------|
| 第二个分叉点 | MVP 只需要一个分叉点来验证整个流程 |
| 在 AI 生成的世界线上再次分叉 | 嵌套是 Phase 2 的事 |
| 多分支切换面板 | 只有两条线，不需要复杂的切换 |
| 全联盟 30 队状态 | 只需要精确建模 5 支球队 |
| 用户账户/持久化 | localStorage 就够了 |
| 移动端适配 | 桌面端优先 |

---

## 2. 技术实现拆解

### 2.1 整体架构

```
项目总共就 4 个层级，极其扁平：

┌──────────────────────────────────────────┐
│  前端：React + React Flow                 │
│  - 力导向图显示两条世界线                   │
│  - 抉择轮盘 UI                            │
│  - 流式接收 AI 生成的事件                  │
│  - localStorage 缓存（同一选项不重复生成）   │
├──────────────────────────────────────────┤
│  后端：FastAPI (Python)                    │
│  - 3 个 API endpoint                      │
│  - 1 个级联服务                            │
├──────────────────────────────────────────┤
│  AI：Claude API                           │
│  - 1 个 Prompt 模板                       │
│  - 流式返回 JSON                          │
├──────────────────────────────────────────┤
│  数据：3 个 JSON 文件                      │
│  - players.json                           │
│  - event_lebron_2010.json（分叉点定义）     │
│  - real_history.json（真实历史事件链）       │
└──────────────────────────────────────────┘
```

### 2.2 三个 API Endpoint

```python
# 整个后端的 API 就这么简单

GET  /api/timeline
  → 返回真实历史事件链 + 分叉点定义
  → 前端根据此渲染初始的金色时间线

POST /api/fork
  → Body: { "choice_id": "new_york_knicks" }
  → 如果该选项已经生成过 → 直接返回缓存
  → 如果未生成 → 触发 AI 推演，流式返回每个事件
  → SSE (Server-Sent Events) 流式推送

GET  /api/branch/{choice_id}
  → 获取已生成的分支（非流式，用于已经完成的缓存）
```

### 2.3 数据文件

这个 MVP 只需要三个 JSON 文件，全部进 Git：

```json
// data/players.json — 约 20 个球员
{
  "lebron-james": {
    "name": "LeBron James",
    "age_2010": 25,
    "rating_2010": 98,
    "position": "SF",
    "contract_status_2010": "unrestricted_free_agent"
  },
  "dwyane-wade": { "name": "Dwyane Wade", "age_2010": 28, "rating_2010": 95 },
  "chris-bosh": { "name": "Chris Bosh", "age_2010": 26, "rating_2010": 88 },
  "derrick-rose": { "name": "Derrick Rose", "age_2010": 21, "rating_2010": 85 },
  "amare-stoudemire": { "name": "Amar'e Stoudemire", "age_2010": 27, "rating_2010": 87 },
  "carmelo-anthony": { "name": "Carmelo Anthony", "age_2010": 26, "rating_2010": 90 }
  // ... 总共 15-20 个就够了
}
```

```json
// data/event_lebron_2010.json — 分叉点定义
{
  "event_id": "evt_lebron_2010",
  "timestamp": "2010-07-08",
  "type": "free_agency",
  "title": "勒布朗·詹姆斯：决定",
  "description": "2010年夏天，25岁的勒布朗·詹姆斯成为不受限制自由球员。他是两届MVP，正在寻找他的第一个总冠军。",
  "actor": "lebron-james",
  
  "choices": [
    {
      "choice_id": "miami_heat",
      "label": "迈阿密热火",
      "is_real_history": true,
      "pitch": "与韦德、波什组建超级球队，追逐总冠军。"
    },
    {
      "choice_id": "new_york_knicks",
      "label": "纽约尼克斯",
      "is_real_history": false,
      "pitch": "麦迪逊广场花园。全球最大市场。与小斯联手。"
    },
    {
      "choice_id": "chicago_bulls",
      "label": "芝加哥公牛",
      "is_real_history": false,
      "pitch": "联手22岁的德里克·罗斯，可能是未来十年东部最强后场。"
    },
    {
      "choice_id": "cleveland_cavaliers",
      "label": "留守克利夫兰骑士",
      "is_real_history": false,
      "pitch": "家乡英雄。骑士队承诺继续补强阵容。"
    }
  ],
  
  "context_for_ai": {
    "season": "2010-11",
    "salary_cap": 58044000,
    "luxury_tax_line": 70307000,
    "teams_involved": {
      "MIA": {
        "current_roster": ["dwyane-wade", "mario-chalmers", "michael-beasley"],
        "cap_space": 28000000,
        "gm_style": "Pat Riley: 追求超级巨星，擅长清理薪资空间，敢做大胆交易"
      },
      "NYK": {
        "current_roster": ["amare-stoudemire", "danilo-gallinari", "wilson-chandler"],
        "cap_space": 18000000,
        "gm_style": "Donnie Walsh: 重建尼克斯，清理了乱账，聚集了薪资空间"
      },
      "CHI": {
        "current_roster": ["derrick-rose", "joakim-noah", "luol-deng", "carlos-boozer"],
        "cap_space": 5000000,
        "gm_style": "Gar Forman: 保守，围绕罗斯建队，已有布泽尔"
      },
      "CLE": {
        "current_roster": ["antawn-jamison", "mo-williams", "anderson-varejao"],
        "cap_space": 32000000,
        "gm_style": "Chris Grant: 需要彻底重建，拥有大量薪资空间"
      }
    },
    "other_key_free_agents": ["dwyane-wade", "chris-bosh", "amare-stoudemire", "carlos-boozer", "joe-johnson", "dirk-nowitzki", "paul-pierce", "ray-allen"],
    "rookie_class_2010": ["john-wall", "evan-turner", "derrick-favors", "demarcus-cousins", "paul-george", "gordon-hayward"]
  }
}
```

```json
// data/real_history.json — 真实历史事件链（热火宇宙）
{
  "branch_id": "master",
  "events": [
    {
      "event_id": "real_001",
      "timestamp": "2010-07-08",
      "title": "詹姆斯宣布加盟迈阿密热火",
      "description": "The Decision. 詹姆斯在ESPN特别节目中宣布加盟热火，与韦德、波什组成三巨头。",
      "teams_affected": ["MIA", "CLE"]
    },
    {
      "event_id": "real_002",
      "timestamp": "2010-07-10",
      "title": "波什加盟热火",
      "description": "波什通过先签后换加盟热火，猛龙得到两个首轮签。"
    },
    {
      "event_id": "real_003",
      "timestamp": "2011-06-12",
      "title": "热火总决赛2-4败给小牛",
      "description": "詹姆斯表现低迷，诺维茨基封神。"
    },
    {
      "event_id": "real_004",
      "timestamp": "2012-06-21",
      "title": "热火4-1雷霆，詹姆斯首冠",
      "description": "詹姆斯27+7+7，拿到生涯第一个总冠军和FMVP。"
    },
    {
      "event_id": "real_005",
      "timestamp": "2013-06-20",
      "title": "热火4-3马刺，两连冠",
      "description": "雷阿伦G6绝平三分拯救热火。詹姆斯连庄FMVP。"
    },
    {
      "event_id": "real_006",
      "timestamp": "2014-07-11",
      "title": "詹姆斯回归骑士",
      "description": "詹姆斯在体育画报发表公开信，宣布回归克利夫兰。"
    }
  ]
}
```

---

## 3. AI 推演引擎 — 核心实现

### 3.1 Prompt 设计

这是整个 MVP 中最重要的一段代码——Prompt 模板：

```python
SYSTEM_PROMPT = """
你是 NBA 平行宇宙推演引擎。2010年夏天，勒布朗·詹姆斯做出了与真实历史不同的选择。

【铁律】
1. 遵守 2010 年 NBA 劳资协议：薪资帽 $58M，奢侈税线 $70M。交易薪资需匹配 ±125%。
2. 球员的交易价值需基于其 2010 年当时的真实年龄、合同和表现。
3. 生成的具体交易必须在薪资上成立。如果不确定细节，标记 confidence 低于 0.7。
4. 考虑各队总经理在当时的真实风格（见上下文）。
5. 考虑 2011 和 2012 届新秀的真实名单和天赋水平。

【你需要做的事】
基于用户的选择，推演 2010 年夏天到 2014 年夏天之间发生的 5-7 个关键事件。
这些事件应包含：
- 自由球员签约（受影响的球队如何重新规划薪资空间）
- 交易（失去/获得球星的球队如何反应）
- 选秀（受影响的球队的战绩变化如何改变选秀权位置）
- 季后赛结果（新的力量格局下的季后赛走向）

【输出格式】
严格返回以下 JSON 格式。不要加任何解释文字。
{
  "branch_name": "简短的分支名称",
  "narrative_summary": "一段 100 字以内的整体叙事",
  "events": [
    {
      "timestamp": "YYYY-MM-DD",
      "title": "事件标题",
      "description": "2-3 句话描述发生了什么",
      "teams_affected": ["TEAM_CODE"],
      "confidence": 0.85,
      "cascade_effects": "简短描述这个事件引发的连锁反应"
    }
  ]
}
"""

def build_user_prompt(choice_id: str, context: dict) -> str:
    if choice_id == "new_york_knicks":
        return f"""
【用户的选择】
勒布朗·詹姆斯拒绝了迈阿密热火，选择签约纽约尼克斯（6年$110M）。
这意味着：
- 热火三巨头（詹姆斯+韦德+波什）不会组建
- 尼克斯组成了詹姆斯 + 小斯塔德迈尔的组合
- 骑士队失去詹姆斯，拥有 $32M 的薪资空间用于重建
- 波什、韦德的去向成为巨大未知数

【当前联盟状态（2010年7月）】
{json.dumps(context['teams_involved'], indent=2)}

【2010年自由球员市场】
{json.dumps(context['other_key_free_agents'], indent=2)}

【2010届新秀】
{json.dumps(context['rookie_class_2010'], indent=2)}

请推演接下来 4 年（2010-2014）的关键事件。
"""
    # 其他三个选项类似...
```

### 3.2 流式生成

```python
import asyncio
from anthropic import AsyncAnthropic

async def generate_branch_stream(choice_id: str) -> AsyncGenerator[str, None]:
    """
    流式生成一个平行宇宙的事件链。
    每生成一个事件就 yield 出去，前端立即渲染。
    """
    client = AsyncAnthropic()
    prompt = build_user_prompt(choice_id, load_context())
    
    # 使用 SSE (Server-Sent Events) 流式返回
    # 每个事件用 "data: {json}\n\n" 格式推送
    async with client.messages.stream(
        model="claude-sonnet-4-6",  # 便宜且推理够用
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    ) as stream:
        buffer = ""
        async for text in stream.text_stream:
            buffer += text
            # 尝试解析 buffer 中是否已有完整的事件对象
            # 如果是，就 yield 出去
            events = try_extract_events(buffer)
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
```

---

## 4. 前端实现

### 4.1 组件树

```
App
├── TimelineCanvas          ← React Flow 力导向图
│   ├── MasterBranch        ← 金色真实历史线
│   ├── ForkNode            ← 2010 分叉点（脉动发光）
│   └── ParallelBranch      ← AI 生成的橙色世界线
│
├── ChoiceWheel             ← 抉择轮盘（只在点击分叉点时显示）
│   ├── ChoiceCard          ← 每个选项
│   └── LaunchButton        ← [🔮 推演]
│
└── StatusBar               ← 底部信息栏
    ├── EventCounter        ← "5/7 事件已生成"
    └── LoadingIndicator    ← "正在推演2012年东部格局……"
```

### 4.2 流式渲染逻辑

```typescript
// 前端流式接收 AI 生成的事件
const handleFork = async (choiceId: string) => {
  setStatus('generating');
  
  const response = await fetch('/api/fork', {
    method: 'POST',
    body: JSON.stringify({ choice_id: choiceId }),
  });
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const text = decoder.decode(value);
    // SSE 格式: "data: {json}\n\n"
    const events = parseSSE(text);
    
    for (const event of events) {
      // 每收到一个事件就立即添加一个节点
      // 新节点从分叉点处以动画形式"生长"出来
      addNodeToTimeline(event);
    }
  }
  
  setStatus('complete');
};
```

### 4.3 缓存策略

```typescript
// 简单但有效：localStorage 缓存已生成的分支
// 同一选项不重复调用 LLM

const loadOrGenerateBranch = async (choiceId: string) => {
  const cacheKey = `branch_${choiceId}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    // 直接渲染缓存，秒出
    return JSON.parse(cached);
  }
  
  // 首次生成
  const events = await streamGenerate(choiceId);
  localStorage.setItem(cacheKey, JSON.stringify(events));
  return events;
};
```

---

## 5. 逐日开发计划

### Day 1 — 数据层（3-4h）

```
上午/下午：
  [✓] 编写 data/players.json（15-20 个核心球员）
  [✓] 编写 data/event_lebron_2010.json（分叉点定义，含球队状态上下文）
  [✓] 编写 data/real_history.json（真实历史 6 个事件）
  [✓] Python Pydantic 模型定义
```

**验收**：三个 JSON 文件通过 schema 校验，`python -c "from models import DecisionEvent; DecisionEvent.parse_file(...)"` 不报错。

### Day 2 — FastAPI 骨架（3-4h）

```
上午/下午：
  [✓] FastAPI app 搭建
  [✓] GET /api/timeline — 返回真实历史 + 分叉点
  [✓] POST /api/fork/{choice_id} — SSE 流式返回
  [✓] GET /api/branch/{choice_id} — 返回缓存的分支
  [✓] CORS 配置
```

**验收**：`curl localhost:8000/api/timeline` 返回正确 JSON。

### Day 3 — LLM Prompt 调优（4-5h）

```
这是最关键的一天。

  [✓] 编写 System Prompt 模板
  [✓] 分别编写 4 个选项的 User Prompt
  [✓] 用 Claude API 测试每个选项
  [✓] 根据输出质量迭代 Prompt（至少 3 轮）
  [✓] 添加 JSON Schema 校验：解析失败的自动重试
  [✓] 添加实体校验：AI 不能发明不存在的球员
```

**验收**：4 个选项各自生成 3 次，每次输出的 JSON 结构正确，置信度 > 0.6 的事件占 80% 以上。

### Day 4 — React Flow 力导向图（4-5h）

```
上午/下午：
  [✓] Vite + React + TypeScript 项目初始化
  [✓] 安装 React Flow、Framer Motion
  [✓] 实现 TimelineCanvas 组件
      - 金色线渲染真实历史
      - 分叉节点渲染为脉动发光圆形
  [✓] 实现节点悬停 → 弹出事件详情卡片
```

**验收**：页面显示金色时间线，2010 节点脉动发光。

### Day 5 — 抉择轮盘 UI（3-4h）

```
上午/下午：
  [✓] 实现 ChoiceWheel 组件
      - 点击分叉节点 → 轮盘弹出（Framer Motion 动画）
      - 4 个选项卡片 → 悬停高亮
  [✓] 实现 LaunchButton → 点击触发 AI 推演
  [✓] 处理真实历史选项（miami_heat）→ 直接展开金色线，不调 AI
```

**验收**：点击分叉节点 → 轮盘弹出 → 点击非现实选项 → 进入加载态。

### Day 6 — 流式渲染（4-5h）

```
上午/下午：
  [✓] 前端 SSE 接收逻辑
  [✓] 新节点逐个以动画形式"生长"出来
  [✓] 橙色世界线和金色世界线并行显示
  [✓] 加载态：底部显示进度文案
  [✓] 完成态：缓存到 localStorage
```

**验收**：选择一个非现实选项 → 橙色节点逐个出现 → 两条世界线并行显示 → 刷新页面后秒开（缓存命中）。

### Day 7 — 打磨（3-4h）

```
上午/下午：
  [✓] 动画调优（节点出现速度、颜色过渡）
  [✓] 错误处理（LLM API 挂了怎么办？→ 重试 + 友好报错）
  [✓] 在橙色世界线的每个节点上添加悬停详情
  [✓] 真实历史和 AI 生成历史的视觉区分（金色 vs 橙色 + 标签）
  [✓] 部署到 Vercel / Railway
```

**验收**：录一个 90 秒的 demo 视频，发布到 GitHub。

---

## 6. 需要手工录入的数据量

这是一个关键问题。好消息是：**MVP 的数据量极小。**

| 数据类型 | 数量 | 工作量 | 说明 |
|---------|:--:|:--:|------|
| 球员基础信息 | 15-20 个 | 30 分钟 | 只需姓名、年龄、评分、合同状态 |
| 球队状态（2010年夏） | 5 支球队 | 1-2 小时 | MIA/NYK/CHI/CLE/TOR 的阵容和薪资 |
| 分叉点定义 | 1 个 | 30 分钟 | 詹姆斯的 4 个选项 + 文案 |
| 真实历史事件链 | 6-8 个 | 1 小时 | 2010-2014 年的关键事件 |
| 2010 自由球员名单 | 10-15 个 | 15 分钟 | 从 Wikipedia 复制 |
| 2010 届新秀名单 | 10-15 个 | 15 分钟 | 从 Basketball Reference 复制 |
| **总计** | — | **约 4 小时** | — |

**不需要录入的**：选秀权保护条件、薪资帽逐年变化、三方交易细节。MVP 阶段只做最粗略的建模，让 AI 去做这些精细的计算。

---

## 7. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|:--:|------|------|
| **LLM 生成不稳定** | 🟡 中 | 输出不合格时要重新生成 | 最多自动重试 3 次；降低标准，能用就行 |
| **LLM 发明不存在的球员** | 🟡 中 | "詹姆斯交易得到不存在的人" | 实体白名单过滤 + Post-processing 自动删除 |
| **生成延迟太长（>30s）** | 🟢 低 | 用户等得不耐烦 | 流式渲染，每 3-5 秒出一个节点，有进度感 |
| **AI 生成的叙事前后矛盾** | 🟡 中 | "尼克斯进东决" 和 "尼克斯有乐透签" 同时出现 | Post-processing 简单校验：战绩好的球队不可能有高顺位签 |
| **LLM API 费用** | 🟢 低 | 每次推演约 $0.02-0.05 | 4 个选项全部生成一遍约 $0.20，可以忽略不计 |
| **React Flow 性能** | 🟢 低 | MVP 总共不到 20 个节点 | 完全不会卡顿 |

---

## 8. 为什么这个 MVP 就够了

### 8.1 对于 150 star 目标

```
一个分叉点 + 四条世界线 + 抉择轮盘 + 双色时空线图

= 一个 90 秒的 demo 视频，展示：
  1. 金色历史线（"这个大家都知道"）
  2. 点击 2010 节点，轮盘弹出（"有意思"）
  3. 选择"尼克斯"，金色线裂开（"卧槽"）
  4. 橙色新线从裂缝中生长出来（"这什么神仙项目"）
  5. AI 逐个生成节点——波什去哪了、韦德去哪了、骑士怎么重建（"我也要玩"）
  6. 双线并行同屏展示（"star 了"）
```

这个 demo 的传播力来自于一个简单但强大的东西：**它把一个所有篮球迷都讨论过的假设，变成了一个可交互的视觉体验。**

"如果詹姆斯 2010 年去了尼克斯" 这个话题在 Reddit r/nba 上有数百个帖子。你给了一个可视化的答案。

### 8.2 对于面试

面试官打开网站 → 自己选了一个选项 → 看着 AI 生成的世界线 → 玩了 5 分钟 → 关掉 → 记下你的名字。

他不需要理解 DAG 或状态机。他只需要知道：**这个人在做一个市面上没有的东西，而且做出来了。**

---

## 9. 最终判定

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   🏀 MVP: 詹姆斯 2010 单一分叉点                                │
│                                                              │
│   整体难度     ★★★★☆☆☆☆☆☆ (4.5/10)                            │
│              — 对于一个有后端经验的开发者，这是"周末项目+"级别     │
│              — 最复杂的部分是 Prompt 调优，不是代码               │
│                                                              │
│   数据工作量   4 小时（手工录入）                                 │
│   代码工作量   7 天（业余时间）                                  │
│   LLM 费用    < $1（整个开发周期）                              │
│                                                              │
│   最大风险     LLM 输出质量不稳定                                │
│   最大亮点     抉择轮盘 UI × AI 世界构建                          │
│                                                              │
│   一句话      "7天时间，一个分叉点，做出一个能拿 150 star 的项目"    │
│                                                              │
│   做完这个 MVP 之后：                                          │
│   - 如果效果好 → 加 4 个分叉点 → Phase 2（再 2 周）              │
│   - 如果效果一般 → 项目依然完整，依然可以挂简历                     │
│   - 没有任何沉没成本的风险                                       │
│                                                              │
│   建议：明天开始 Day 1。                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 附录：四个选项的具体影响预览

| 选项 | 对热火的影响 | 对骑士的影响 | 对其他球队的影响 |
|------|------------|------------|----------------|
| **真实历史：热火** | 三巨头组建，4年4进总决赛，2冠 | 失去詹姆斯，26连败，4年3状元签 | 波什离队猛龙，雷霆2012进总决赛 |
| **尼克斯** | 保留韦德，无法组建三巨头，退居二线 | 同上 | 波什可能留猛龙或去公牛。尼克斯瞬间成为东部豪强 |
| **公牛** | 同上 | 同上 | 詹姆斯+罗斯+诺阿+布泽尔，可能是历史级防守阵容 |
| **留守骑士** | 同上 | 保留詹姆斯，继续补强，冲击冠军 | 波什可能去热火和韦德联手。尼克斯围绕小斯建队 |

---

> *"The Decision" 是 NBA 历史上最著名的分叉点。将它作为你的 MVP，既是技术上的最小可行实现，也是传播上的最大话题入口。*
