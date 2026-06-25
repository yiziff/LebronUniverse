# 🏀 LebronUniverse — NBA 平行宇宙推演引擎  
  
> 如果 LeBron James 当年做了不同的选择，NBA 历史会如何改写？  
  
LebronUniverse 是一个 AI 驱动的 NBA 平行宇宙模拟器。以勒布朗·詹姆斯职业生涯的四个关键节点为分叉，由 LLM 实时推演每一条平行时间线——包括球星命运联动、虚拟社交舆论、以及 RPG 式的属性成长系统。  
  
![Tech Stack](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)  
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)  
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript)  
![Three.js](https://img.shields.io/badge/Three.js-0.184-black?style=flat-square&logo=threedotjs)  
  
---  
  
## ✨ 核心功能  
  
- **四大历史分叉节点**：2010 The Decision、2014 回归骑士、2017 续约、2018 加盟湖人，每个节点提供 3-4 个平行选择  
- **LLM 实时流式推演**：基于 OpenAI API，以 SSE 流式输出 6-8 个关键事件，覆盖对应年份区间  
- **蝴蝶效应双引擎**：确定性规则引擎（即时生效）+ LLM 叙事引擎（深度推演）  
- **球星命运联动**：Wade、Durant、George、Curry 的命运随 LeBron 的选择实时变化  
- **RPG 六维属性**：championships / legacy / media_favor / fan_reputation / cap_health / physical_toll  
- **虚拟社交舆论**：每条时间线附带 3-5 条模拟推特，还原真实舆论氛围  
- **3D 星座可视化**：基于 Three.js 的球星关系网络图  
  
---  
  
## 🏗️ 技术架构  
  
```  
┌─────────────────────────────────────────────────────┐  
│                     Frontend                        │  
│  React 19 + TypeScript 6 + Vite 8                  │  
│  Three.js · Framer Motion · GSAP · Zustand 5        │  
└──────────────────────┬──────────────────────────────┘  
                       │ SSE / REST  
┌──────────────────────▼──────────────────────────────┐  
│                     Backend                         │  
│  FastAPI 0.115 + Pydantic v2 + uvicorn              │  
│                                                     │  
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │  
│  │ cross_impact│  │  llm_engine  │  │world_state│  │  
│  │ 确定性规则  │  │  LLM 流式    │  │ 全局状态  │  │  
│  └─────────────┘  └──────────────┘  └───────────┘  │  
└──────────────────────┬──────────────────────────────┘  
                       │  
┌──────────────────────▼──────────────────────────────┐  
│                   Data Layer                        │  
│  JSON · event_lebron_2010/2014/2017/2018            │  
│  cross_impact_rules · player_career_milestones      │  
└─────────────────────────────────────────────────────┘  
```  
  
---  
  
## 🚀 快速开始  
  
### 环境要求  
  
- Python 3.11+  
- Node.js 20+  
- OpenAI API Key（支持 GPT-4o 或 GPT-4-turbo）  
  
### 1. 克隆仓库  
  
```bash  
git clone https://github.com/yiziff/LebronUniverse.git  
cd LebronUniverse  
```  
  
### 2. 启动后端  
  
```bash  
cd backend  
  
# 安装依赖  [header-1](#header-1)
pip install -r requirements.txt  
  
# 配置环境变量  [header-2](#header-2)
cp .env.example .env  
# 编辑 .env，填入你的 OpenAI API Key：  [header-3](#header-3)
# OPENAI_API_KEY=sk-...  [header-4](#header-4)
  
# 启动服务（默认端口 8000）  [header-5](#header-5)
python main.py  
```  
  
### 3. 启动前端  
  
```bash  
cd frontend  
  
# 安装依赖  [header-6](#header-6)
npm install  
  
# 启动开发服务器（默认端口 5173）  [header-7](#header-7)
npm run dev  
```  
  
打开浏览器访问 `http://localhost:5173` 即可开始推演。  
  
---  
  
## 📁 项目结构  
  
```  
LebronUniverse/  
├── backend/  
│   ├── main.py              # FastAPI 入口，路由定义  
│   ├── llm_engine.py        # LLM 流式生成引擎  
│   ├── prompt_templates.py  # Prompt 模板（含铁律约束）  
│   ├── world_state.py       # 全局宇宙状态管理  
│   ├── cross_impact.py      # 确定性蝴蝶效应规则引擎  
│   ├── entity_validator.py  # 球员实体验证（防 LLM 幻觉）  
│   ├── data_loader.py       # JSON 数据加载器  
│   ├── models.py            # Pydantic 数据模型  
│   └── requirements.txt  
├── data/  
│   ├── event_lebron_2010.json        # The Decision 分叉数据  
│   ├── event_lebron_2014.json        # 2014 回归分叉数据  
│   ├── event_lebron_2017.json        # 2017 续约分叉数据  
│   ├── event_lebron_2018.json        # 2018 湖人分叉数据  
│   ├── cross_impact_rules.json       # 蝴蝶效应规则  
│   ├── player_career_milestones.json # 球星真实生涯里程碑  
│   ├── real_history*.json            # 真实历史时间线  
│   └── master_timeline.json          # 主时间线  
└── frontend/  
    ├── src/  
    │   ├── components/   # UI 组件  
    │   ├── store/        # Zustand 状态管理  
    │   ├── engine/       # 前端推演逻辑  
    │   ├── hooks/        # 自定义 Hooks  
    │   └── types/        # TypeScript 类型定义  
    └── package.json  
```  
  
---  
  
## 🎮 核心机制  
  
### 分叉节点与选择  
  
| 年份 | 事件 | 可选择 |  
|------|------|--------|  
| 2010 | The Decision | 迈阿密热火 / 纽约尼克斯 / 芝加哥公牛 / 留守克利夫兰 |  
| 2014 | 自由球员 | 回归骑士 / 留守热火 / 其他 |  
| 2017 | 续约决策 | 多个选项 |  
| 2018 | 夏季去向 | 加盟湖人 / 其他 |  
  
后续分叉的可用选项会受前序选择影响（先决条件系统）。  
  
### LeBron RPG 属性  
  
每次推演结束后，LeBron 的六维属性会根据事件结果动态变化：  
  
| 属性 | 说明 |  
|------|------|  
| `championships` | 总冠军数 |  
| `legacy` | 历史地位 |  
| `media_favor` | 媒体好感度 |  
| `fan_reputation` | 球迷口碑 |  
| `cap_health` | 薪资空间健康度 |  
| `physical_toll` | 身体损耗 |  
  
### 球星命运联动  
  
每个时间线事件会触发对 Wade、Durant、George、Curry 四位 NPC 的影响，包含 `legacy` / `ring_chance` / `media_heat` / `team_fit` 四个维度的数值变化。  
  
---  
  
## 📡 API 文档  
  
后端启动后访问 `http://localhost:8000/docs` 查看完整 Swagger 文档。  
  
| 方法 | 路径 | 说明 |  
|------|------|------|  
| `GET` | `/api/universe` | 获取当前宇宙状态与可用分叉 |  
| `POST` | `/api/universe/choice` | 记录一次 James 的选择 |  
| `POST` | `/api/universe/reset` | 重置宇宙到 2010 初始状态 |  
| `GET` | `/api/generate/{fork_id}/{choice_id}` | SSE 流式生成平行时间线 |  
| `GET` | `/health` | 健康检查 |  
  
---  
  
## 🤝 贡献  
  
欢迎提交 PR！可以从以下方向入手：  
  
- 新增分叉节点（2003 选秀、2019 续约等）  
- 扩展 NPC 球星池  
- 添加持久化存储支持  
- 完善单元测试  
  
---  
  
## 📄 License  
  
MIT License
