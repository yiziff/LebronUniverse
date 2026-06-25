<div align="center">  
  
# 🏀 LebronUniverse  
  
### NBA Parallel Universe Simulation Engine  
  
*What if LeBron James had made different choices? Rewrite NBA history with AI.*  
  
[**中文文档**](./README.zh-CN.md) · [Live Demo](#) · [Report Bug](https://github.com/yiziff/LebronUniverse/issues) · [Request Feature](https://github.com/yiziff/LebronUniverse/issues)  
  
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)  
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)  
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript)  
![Three.js](https://img.shields.io/badge/Three.js-0.184-black?style=flat-square&logo=threedotjs)  
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)  
  
<!-- Add a GIF or screenshot here -->  
<!-- ![Demo](./assets/demo.gif) -->  
  
</div>  
  
---  
  
## What is this?  
  
LebronUniverse is an AI-powered NBA alternate history simulator. It takes four pivotal decision points in LeBron James' career and lets you explore what would have happened if he had chosen differently — generating a full narrative timeline in real time using an LLM.  
  
Each parallel universe includes:  
- **6–8 key events** covering the simulated time window  
- **Butterfly effects** on Wade, Durant, George, and Curry  
- **RPG-style stat changes** for LeBron across 6 dimensions  
- **Simulated social media reactions** from fans and media  
  
---  
  
## Features  
  
- **4 Historical Fork Points** — 2010 The Decision, 2014 Free Agency, 2017 Extension, 2018 Lakers  
- **Real-time LLM Streaming** — Events stream in via SSE as the AI generates them  
- **Dual Butterfly Engine** — Deterministic rules fire instantly; LLM handles deep narrative  
- **Star Fate Linkage** — Wade, Durant, George, Curry's careers shift with every LeBron choice  
- **LeBron RPG Stats** — Track `championships`, `legacy`, `media_favor`, `fan_reputation`, `cap_health`, `physical_toll`  
- **Virtual Twitter Feed** — 3–5 simulated tweets per timeline with sentiment tags  
- **3D Constellation View** — Player relationship network built with Three.js  
- **Prerequisite System** — Later fork options depend on earlier choices  
  
---  
  
## Tech Stack  
  
| Layer | Technologies |  
|-------|-------------|  
| Frontend | React 19, TypeScript 6, Vite 8, Zustand 5 |  
| Visualization | Three.js 0.184, 3d-force-graph, Framer Motion, GSAP |  
| Backend | FastAPI 0.115, Pydantic v2, uvicorn |  
| AI | OpenAI API (GPT-4o recommended), SSE streaming |  
| Data | JSON-based fork/rule/milestone data files |  
  
---  
  
## Getting Started  
  
### Prerequisites  
  
- Python 3.11+  
- Node.js 20+  
- An OpenAI API key (GPT-4o or GPT-4-turbo)  
  
### Installation  
  
**1. Clone the repository**  
  
```bash  
git clone https://github.com/yiziff/LebronUniverse.git  
cd LebronUniverse  
```  
  
**2. Set up the backend**  
  
```bash  
cd backend  
pip install -r requirements.txt  
  
cp .env.example .env  
# Open .env and set your API key:  [header-1](#header-1)
# OPENAI_API_KEY=sk-...  [header-2](#header-2)
  
python main.py  
# Server starts at http://localhost:8000  [header-3](#header-3)
```  
  
**3. Set up the frontend**  
  
```bash  
cd frontend  
npm install  
npm run dev  
# App starts at http://localhost:5173  [header-4](#header-4)
```  
  
Open `http://localhost:5173` and start rewriting history.  
  
---  
  
## Project Structure  
  
```  
LebronUniverse/  
├── backend/  
│   ├── main.py                # FastAPI entry point & routes  
│   ├── llm_engine.py          # LLM streaming engine  
│   ├── prompt_templates.py    # Prompt templates with NBA rules constraints  
│   ├── world_state.py         # Global universe state management  
│   ├── cross_impact.py        # Deterministic butterfly effect engine  
│   ├── entity_validator.py    # Player entity validation (anti-hallucination)  
│   ├── data_loader.py         # JSON data loader  
│   └── models.py              # Pydantic data models  
├── data/  
│   ├── event_lebron_2010.json          # The Decision fork data  
│   ├── event_lebron_2014.json          # 2014 free agency fork data  
│   ├── event_lebron_2017.json          # 2017 extension fork data  
│   ├── event_lebron_2018.json          # 2018 Lakers fork data  
│   ├── cross_impact_rules.json         # Butterfly effect rules  
│   ├── player_career_milestones.json   # Real career milestones (for contrast)  
│   └── master_timeline.json            # Master timeline reference  
└── frontend/  
    └── src/  
        ├── components/    # UI components  
        ├── store/         # Zustand state management  
        ├── engine/        # Client-side simulation logic  
        ├── hooks/         # Custom React hooks  
        └── types/         # TypeScript type definitions  
```  
  
---  
  
## How It Works  
  
```  
User picks a fork choice  
        │  
        ▼  
cross_impact.py ──► Immediate stat deltas (deterministic, instant)  
        │  
        ▼  
llm_engine.py ───► SSE stream → 6-8 narrative events  
        │           (LLM constrained by NBA salary rules,  
        │            real player pool, prior world state)  
        ▼  
world_state.py ──► Accumulated universe state injected into  
                   next fork's prompt for narrative consistency  
```  
  
The prompt enforces hard constraints ("Iron Rules"): salary cap compliance, no invented players, no independent decision forks for NPCs — their fates are consequences of LeBron's choices only.  
  
---  
  
## API Reference  
  
Full Swagger docs available at `http://localhost:8000/docs` after starting the backend.  
  
| Method | Endpoint | Description |  
|--------|----------|-------------|  
| `GET` | `/api/universe` | Get current universe state and available forks |  
| `POST` | `/api/universe/choice` | Record a LeBron choice |  
| `POST` | `/api/universe/reset` | Reset universe to 2010 initial state |  
| `GET` | `/api/generate/{fork_id}/{choice_id}` | SSE stream: generate parallel timeline |  
| `GET` | `/health` | Health check |  
  
---  
  
## LeBron's 6 RPG Dimensions  
  
| Dimension | Description |  
|-----------|-------------|  
| `championships` | Total rings won |  
| `legacy` | Historical standing |  
| `media_favor` | Media sentiment score |  
| `fan_reputation` | Fan base loyalty |  
| `cap_health` | Team salary cap flexibility |  
| `physical_toll` | Cumulative physical wear |  
  
---  
  
## Contributing  
  
Contributions are welcome! Some ideas to get started:  
  
- Add new fork points (2003 Draft, 2019 Extension, etc.)  
- Expand the NPC player pool beyond the current 4  
- Add database persistence for multi-session support  
- Write unit tests for the validation and engine layers  
- Add English-language prompt support  
  
Please open an issue first to discuss major changes.  
  
---  
  
## License  
  
[MIT](./LICENSE)  
  
---  
  
<div align="center">  
Made with ☕ and too many hours watching NBA highlights  
</div>
