<div align="center">  
  
# 🏀 LebronUniverse — NBA 平行宇宙推演引擎  
  
*如果 LeBron James 当年做了不同的选择，NBA 历史会如何改写？*  
  
[**English**](./README.md) · [在线演示](#) · [提交 Bug](https://github.com/yiziff/LebronUniverse/issues) · [功能建议](https://github.com/yiziff/LebronUniverse/issues)  
  
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)  
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)  
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript)  
![Three.js](https://img.shields.io/badge/Three.js-0.184-black?style=flat-square&logo=threedotjs)  
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)  
  
</div>  
  
---  
  
## 这是什么？  
  
LebronUniverse 是一个 AI 驱动的 NBA 平行历史模拟器。以勒布朗·詹姆斯职业生涯的四个关键节点为分叉，由 LLM 实时推演每一条平行时间线——包括球星命运联动、虚拟社交舆论，以及 RPG 式的属性成长系统。  
  
---  
  
## 核心功能  
  
- **四大历史分叉节点**：2010 The Decision、2014 回归骑士、2017 续约、2018 加盟湖人  
- **LLM 实时流式推演**：通过 SSE 流式输出 6-8 个关键事件  
- **蝴蝶效应双引擎**：确定性规则引擎（即时生效）+ LLM 叙事引擎（深度推演）  
- **球星命运联动**：Wade、Durant、George、Curry 的命运随 LeBron 的选择实时变化  
- **RPG 六维属性**：championships / legacy / media_favor / fan_reputation / cap_health / physical_toll  
- **虚拟社交舆论**：每条时间线附带 3-5 条模拟推特  
- **3D 星座可视化**：基于 Three.js 的球星关系网络图  
- **先决条件系统**：后续分叉的可用选项受前序选择影响  
  
---  
  
## 快速开始  
  
### 环境要求  
  
- Python 3.11+  
- Node.js 20+  
- OpenAI API Key（推荐 GPT-4o 或 GPT-4-turbo）  
  
### 安装步骤  
  
**1. 克隆仓库**  
  
```bash  
git clone https://github.com/yiziff/LebronUniverse.git  
cd LebronUniverse  
```  
  
**2. 启动后端**  
  
```bash  
cd backend  
pip install -r requirements.txt  
  
cp .env.example .env  
# 编辑 .env，填入你的 API Key：  [header-5](#header-5)
# OPENAI_API_KEY=sk-...  [header-6](#header-6)
  
python main.py  
# 服务启动在 http://localhost:8000  [header-7](#header-7)
```  
  
**3. 启动前端**  
  
```bash  
cd frontend  
npm install  
npm run dev  
# 应用启动在 http://localhost:5173  [header-8](#header-8)
```  
  
打开浏览器访问 `http://localhost:5173` 开始推演。  
  
---  
  
## 工作原理  
  
```  
用户选择分叉选项  
        │  
        ▼  
cross_impact.py ──► 即时属性变化（确定性规则，立即生效）  
        │  
        ▼  
llm_engine.py ───► SSE 流式输出 → 6-8 个叙事事件  
        │           （LLM 受薪资规则、真实球员库、  
        │            历史宇宙状态约束）  
        ▼  
world_state.py ──► 累积的宇宙状态注入下一次分叉的 Prompt  
                   保证跨分叉叙事自洽  
```  
  
Prompt 中内置"铁律"约束：遵守薪资帽规则、禁止发明不存在的球员、NPC 球星不得出现独立决策分叉——他们的命运只能是 LeBron 选择的后果。  
  
---  
  
## 项目结构  
  
```  
LebronUniverse/  
├── backend/  
│   ├── main.py                # FastAPI 入口与路由  
│   ├── llm_engine.py          # LLM 流式生成引擎  
│   ├── prompt_templates.py    # Prompt 模板（含铁律约束）  
│   ├── world_state.py         # 全局宇宙状态管理  
│   ├── cross_impact.py        # 确定性蝴蝶效应规则引擎  
│   ├── entity_validator.py    # 球员实体验证（防 LLM 幻觉）  
│   ├── data_loader.py         # JSON 数据加载器  
│   └── models.py              # Pydantic 数据模型  
├── data/  
│   ├── event_lebron_2010.json          # The Decision 分叉数据  
│   ├── event_lebron_2014.json          # 2014 自由球员分叉数据  
│   ├── event_lebron_2017.json          # 2017 续约分叉数据  
│   ├── event_lebron_2018.json          # 2018 湖人分叉数据  
│   ├── cross_impact_rules.json         # 蝴蝶效应规则  
│   ├── player_career_milestones.json   # 球星真实生涯里程碑  
│   └── master_timeline.json            # 主时间线参考  
└── frontend/  
    └── src/  
        ├── components/    # UI 组件  
        ├── store/         # Zustand 状态管理  
        ├── engine/        # 前端推演逻辑  
        ├── hooks/         # 自定义 Hooks  
        └── types/         # TypeScript 类型定义  
```  
  
---  
  
## API 文档  
  
后端启动后访问 `http://localhost:8000/docs` 查看完整 Swagger 文档。  
  
| 方法 | 路径 | 说明 |  
|------|------|------|  
| `GET` | `/api/universe` | 获取当前宇宙状态与可用分叉 |  
| `POST` | `/api/universe/choice` | 记录一次 LeBron 的选择 |  
| `POST` | `/api/universe/reset` | 重置宇宙到 2010 初始状态 |  
| `GET` | `/api/generate/{fork_id}/{choice_id}` | SSE 流式生成平行时间线 |  
| `GET` | `/health` | 健康检查 |  
  
---  
  
## 参与贡献  
  
欢迎提交 PR！可以从以下方向入手：  
  
- 新增分叉节点（2003 选秀、2019 续约等）  
- 扩展 NPC 球星池  
- 添加数据库持久化支持  
- 补充单元测试  
  
请先开 Issue 讨论较大的改动。  
  
---  
  
## License  
  
[MIT](./LICENSE)
