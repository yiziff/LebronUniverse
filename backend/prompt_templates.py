"""Prompt templates for the LLM alternate timeline generator. DeepSeek edition."""

import json

FORK_CONTEXT = {
    "evt_lebron_2010": {
        "era": "2010-2014",
        "intro": "2010年夏天，勒布朗·詹姆斯做出了与真实历史不同的选择。",
        "default_end": 2014,
    },
    "evt_lebron_2014": {
        "era": "2014-2018",
        "intro": "2014年夏天，勒布朗·詹姆斯在总决赛失利后做出与真实历史不同的选择。",
        "default_end": 2018,
    },
    "evt_lebron_2017": {
        "era": "2017-2018",
        "intro": "2017年休赛期，骑士面对欧文交易危机，勒布朗·詹姆斯与管理层做出不同抉择。",
        "default_end": 2018,
    },
    "evt_lebron_2018": {
        "era": "2018-2021",
        "intro": "2018年夏天，勒布朗·詹姆斯在总决赛被横扫后，做出与真实历史不同的自由球员选择。",
        "default_end": 2021,
    },
}


def build_system_prompt(fork_id: str, start_year: int, end_year: int) -> str:
    ctx = FORK_CONTEXT.get(fork_id, FORK_CONTEXT["evt_lebron_2010"])
    return f"""你是 NBA 平行宇宙推演引擎。

{ctx['intro']}你需要基于这个新选择，推演接下来发生的关键篮球事件（{start_year}-{end_year}）。

【铁律】
1. 遵守该时期 NBA 劳资协议的薪资规则。
2. 交易必须薪资匹配（±125%规则）。如果无法精确计算薪资，标记 confidence < 0.7。
3. 球员交易价值需反映其当时的年龄、合同、真实表现和伤病史。
4. 跨年份叙事必须自洽。如果一支球队打进了东决，它不可能同时拥有乐透签。
5. 不要发明不存在的球员。只使用当时存在的 NBA 球员。
6. **其他球星不得出现独立决策分叉**——韦德、杜兰特、罗斯等人的命运只能是勒布朗·詹姆斯选择的后果。

【你需要推演的事件类型】
- 自由球员签约、重磅交易、选秀、季后赛结果
- 连锁反应：詹姆斯的决定如何影响韦德、波什、杜兰特、罗斯等其他球星

【输出格式】
严格返回以下 JSON 格式。不要有任何解释文字。只返回 JSON。

{{
  "branch_name": "简短的分支名称（10字以内）",
  "narrative_summary": "一段150字以内的整体叙事",
  "events": [
    {{
      "timestamp": "YYYY-MM-DD",
      "title": "事件标题（15字以内）",
      "description": "2-3句话描述发生了什么",
      "teams_affected": ["TEAM_CODE"],
      "key_players": ["player-id"],
      "confidence": 0.85,
      "stat_changes": [...],
      "player_impacts": [...],
      "player_career_events": [...]
    }}
  ],
  "social_posts": [...]
}}

生成 6-8 个事件，覆盖 {start_year} 到 {end_year} 年。事件按时间顺序排列。

【RPG 状态变动 — 仅勒布朗·詹姆斯】
"stat_changes": [{{"dimension": "media_favor", "delta": 25, "reason": "原因"}}]
六维 ID: championships / legacy / media_favor / fan_reputation / cap_health / physical_toll

【球星命运联动 — 必须，不可省略】
每个 timeline 事件必须包含 2-4 条 player_impacts。player_id 必须使用以下小写连字符 ID 之一：
dwyane-wade, kevin-durant, paul-george, stephen-curry
每条 impact 需含 legacy / ring_chance / media_heat / team_fit 整数 delta 与 reason。

【其他球星平行生涯事件 — 必须，不可省略】
每个 timeline 事件必须包含至少 2 条、最多 4 条 player_career_events。
- 只写上述 4 位 NPC，禁止写 lebron-james
- 每条含 player_id, timestamp, title, description, vs_real_history（与真实历史对比，必填）
- vs_real_history 必须引用该球员真实里程碑中的具体事件标题（如「热火首冠」「加盟勇士」），说明平行宇宙如何不同
- timestamp 必须在 simulation_window 内按时间递增，不可重复

【虚拟社交舆论】
social_posts 数组 3-5 条模拟推特，sentiment: angry/excited/sarcastic/shocked/hate"""


SYSTEM_PROMPT = build_system_prompt("evt_lebron_2010", 2010, 2014)


def build_user_prompt(
    choice_id: str,
    decision: dict,
    real_history: dict,
    world_state_context: str = "",
    fork_id: str = "evt_lebron_2010",
) -> str:
    """Assemble a user prompt for a specific choice."""
    choices = decision.get("choices", [])
    choice = next((c for c in choices if c["choice_id"] == choice_id), choices[0])
    real_events = real_history.get("events", [])

    sim = decision.get("simulation_window", {})
    start_year = sim.get("start_year", 2010)
    end_year = sim.get("end_year", 2014)

    real_summary = "\n".join(
        f"- {e['timestamp']}: {e['title']}" for e in real_events
    )

    ws_block = ""
    if world_state_context:
        ws_block = f"\n{world_state_context}\n"

    base = f"""【用户的选择 — {decision.get('title', '分叉点')}】
勒布朗·詹姆斯选择了：{choice['label']}

{choice['pitch']}

【真实历史对照（本段平行宇宙中可能不再发生）】
{real_summary}

【被选球队 — {choice['label']}（{choice.get('team_code', '?')}）】
现有阵容：{', '.join(choice.get('roster_before', []))}
薪资空间：${choice.get('cap_space', 0):,}
{ws_block}
请推演 {start_year} 年到 {end_year} 年之间，这个平行宇宙中发生的关键事件。"""

    prompt = base + """
\n【重要提醒】
1. 每个事件必须包含 stat_changes（詹姆斯六维）、player_impacts（2-4条，不可为空）、player_career_events（至少2条，不可为空）
2. player_career_events 的 vs_real_history 必须引用真实里程碑标题，用于前端展示平行 vs 真实对照
3. 在 events 之后返回 social_posts（3-5条）
4. 必须与前述 Global World State 中的詹姆斯选择链和球星命运偏移保持一致
5. 每个 timeline 事件至少覆盖 2 位不同 NPC 的平行生涯变化
"""
    return prompt
