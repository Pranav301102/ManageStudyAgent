# Autonomous Voice-Native Career Advocate — Design Document

## 1. System Overview

An end-to-end autonomous agent that monitors the live job market, discovers matching roles, researches companies in real-time, maps skill gaps via a knowledge graph, and spins up a voice-based mock interview environment tailored to each discovered role — all without manual intervention.

### Core Loop (Fully Autonomous)

```
┌──────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS ORCHESTRATOR                       │
│                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────────┐  │
│  │ YUTORI  │───▶│ TAVILY   │───▶│ NEO4J    │───▶│ MODULATE   │  │
│  │ Scout   │    │ Research  │    │ Skill    │    │ Voice Mock │  │
│  │ + Browse│    │ Deep Dive │    │ Graph    │    │ Interview  │  │
│  └─────────┘    └──────────┘    └──────────┘    └────────────┘  │
│       │              │               │                │          │
│       ▼              ▼               ▼                ▼          │
│  Job Detected → Company Intel → Gap Analysis → Practice Ready   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. API Integration Details

### 2.1 Yutori API — Job Discovery & Extraction

**Scouting API** (`POST https://api.yutori.com/v1/scouting/tasks`)
- Creates persistent scouts that monitor career pages at configurable intervals (min 30 min)
- Webhook-driven: pushes results to our backend the moment a match is found
- Structured output via `output_schema` — extracts title, company, location, URL, posting date
- Auth: `X-API-Key` header

**Browsing API** (`POST https://api.yutori.com/v1/browsing/tasks`)
- Triggered when a scout finds a match — navigates to the actual job listing page
- Extracts full JD, required tech stack, qualifications, salary range, team info
- Uses `navigator-n1-latest` agent with structured `output_schema`
- Returns `task_id` for polling status via `GET /v1/browsing/tasks/{task_id}`

### 2.2 Tavily API — Real-Time Company Research

**Search** (`POST https://api.tavily.com/search`)
- Fired the instant a job is discovered
- Queries: `"{company} recent news product launches funding"`, `"{company} engineering culture tech stack"`
- Params: `search_depth: "advanced"`, `topic: "news"`, `include_answer: true`, `max_results: 10`
- Auth: `Authorization: Bearer tvly-{KEY}`

**Extract** (`POST https://api.tavily.com/extract`)
- Pulls clean content from company blog posts, press releases, Glassdoor reviews

### 2.3 Neo4j — Dynamic Skill Knowledge Graph

**Driver**: `neo4j` Python driver connecting to Neo4j Aura (cloud) or local instance

**Graph Schema**:
```
(:User {name, email, resume_summary})
(:Skill {name, category, proficiency_level})
(:Job {title, company, url, description, posted_date, status})
(:Company {name, industry, size, recent_news})
(:Concept {name, description, learning_resources})

(:User)-[:HAS_SKILL {level: 1-5, years: int}]->(:Skill)
(:Job)-[:REQUIRES_SKILL {importance: "required"|"preferred"}]->(:Skill)
(:Job)-[:AT_COMPANY]->(:Company)
(:Skill)-[:BRIDGES_TO]->(:Concept)
(:Concept)-[:TEACHES]->(:Skill)
(:User)-[:APPLIED_TO {date, status}]->(:Job)
(:User)-[:GAP]->(:Skill)  // computed edge: skills user lacks
```

**Key Queries**:
- Skill gap analysis: `MATCH (u:User)-[:HAS_SKILL]->(s) WITH collect(s) AS has MATCH (j:Job {id:$jid})-[:REQUIRES_SKILL]->(r) WHERE NOT r IN has RETURN r`
- Bridge path: `MATCH path = (u:User)-[:HAS_SKILL]->(:Skill)-[:BRIDGES_TO]->(:Concept)-[:TEACHES]->(gap:Skill)<-[:REQUIRES_SKILL]-(j:Job) RETURN path`

### 2.4 Modulate — Voice Intelligence for Mock Interviews

**Velma-2 API** — Ensemble Listening Model
- Analyzes voice conversations for sentiment, emotion, confidence, and speech patterns
- Processes audio streams to evaluate interview performance
- Detects nervousness, hesitation, clarity, and assertiveness in responses
- Provides real-time feedback on communication quality

**Integration Approach**:
- Browser captures user audio via Web Speech API (STT) + MediaRecorder
- Audio chunks sent to Modulate's Velma-2 for analysis (sentiment, emotion, confidence scoring)
- LLM generates interviewer questions from job data + Tavily research
- TTS (Web Speech Synthesis API) delivers interviewer questions
- Modulate provides real-time voice quality feedback panel during mock interview

**Real-Time Skill Evaluation via Modulate**:
- Voice analysis results are included in the interview analyzer's LLM prompt alongside content scores
- Modulate metrics tracked per-question: confidence (35% weight), clarity (30%), pace (20%), filler count (15%)
- Low confidence/clarity scores contribute to post-interview weakness identification
- `computeVoiceScore()` produces a weighted composite score for each response
- Study plan adaptation considers voice/communication weaknesses alongside technical gaps

---

## 3. Dashboard Design

### 3.1 Layout — Single Page Application (Next.js)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◉ CareerAdvocate    [Dashboard] [Skill Graph] [Interviews] [⚙]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐ │
│  │    ACTIVE SCOUTS (Live)     │  │     SYSTEM STATUS            │ │
│  │  ┌───────────────────────┐  │  │  ● Orchestrator: Running     │ │
│  │  │ 🔍 SWE Intern Monitor │  │  │  ● Yutori Scouts: 4 active  │ │
│  │  │    Parallel, Modular,  │  │  │  ● Neo4j: Connected         │ │
│  │  │    Concora Credit      │  │  │  ● Last scan: 2 min ago     │ │
│  │  │    ⏱ Every 30 min      │  │  │                              │ │
│  │  └───────────────────────┘  │  │  Jobs Found: 12              │ │
│  │  ┌───────────────────────┐  │  │  Interviews Ready: 3         │ │
│  │  │ 🔍 ML Engineer Monitor│  │  │  Skill Gaps Identified: 7    │ │
│  │  │    Startup focus       │  │  │                              │ │
│  │  │    ⏱ Every 1 hour      │  │  └──────────────────────────────┘ │
│  │  └───────────────────────┘  │                                    │
│  │  [+ Add Scout]              │                                    │
│  └─────────────────────────────┘                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    DISCOVERED JOBS FEED                       │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │ ★ SWE Intern — Parallel                      NEW     │    │   │
│  │  │   San Francisco, CA | Posted 15 min ago              │    │   │
│  │  │   Match Score: 87% | Skills Gap: 2                   │    │   │
│  │  │   ┌──────────┐ ┌────────────┐ ┌───────────────┐     │    │   │
│  │  │   │ View JD  │ │ Skill Gap  │ │ Mock Interview│     │    │   │
│  │  │   └──────────┘ └────────────┘ └───────────────┘     │    │   │
│  │  │   Company Intel: Series B, 50 engineers, Rust stack  │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │   ML Platform Intern — Modular               2h ago  │    │   │
│  │  │   Remote | Match Score: 72% | Skills Gap: 4          │    │   │
│  │  │   ┌──────────┐ ┌────────────┐ ┌───────────────┐     │    │   │
│  │  │   │ View JD  │ │ Skill Gap  │ │ Mock Interview│     │    │   │
│  │  │   └──────────┘ └────────────┘ └───────────────┘     │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    SKILL GRAPH VISUALIZATION                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │         [Python]───[ML]───[PyTorch]                          │   │
│  │            │         │        ╲                              │   │
│  │         [FastAPI]   [NLP]    [CUDA] ← GAP                   │   │
│  │            │                    ╲                            │   │
│  │         [REST]──────[GraphQL]   [Triton] ← GAP              │   │
│  │                                                              │   │
│  │  Legend: ● Has Skill  ○ Gap  ─ Related  ═ Learning Path     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    MOCK INTERVIEW PANEL                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Role: SWE Intern @ Parallel                                │   │
│  │  ┌──────────────────────────┐ ┌──────────────────────────┐  │   │
│  │  │   INTERVIEWER (AI)       │ │   VOICE ANALYTICS        │  │   │
│  │  │                          │ │   Confidence: ████░ 78%   │  │   │
│  │  │   "Tell me about your   │ │   Clarity:    █████ 92%   │  │   │
│  │  │    experience with       │ │   Pace:      ███░░ 65%   │  │   │
│  │  │    distributed systems"  │ │   Filler Words: 3        │  │   │
│  │  │                          │ │   Sentiment: Positive     │  │   │
│  │  └──────────────────────────┘ │   Emotion: Engaged        │  │   │
│  │                               └──────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  🎤 [Start Speaking] [Skip] [End Interview]          │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  Transcript:                                                │   │
│  │  Q1: Tell me about your experience with distributed systems │   │
│  │  A1: "I worked on a microservices architecture at..."       │   │
│  │      Score: 4/5 | Feedback: Strong example, add metrics     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Pages & Components

| Page | Components | Purpose |
|------|-----------|---------|
| **Dashboard** | ScoutStatusCards, JobFeed, SystemHealth, QuickStats | Command center — everything at a glance |
| **Skill Graph** | Neo4jVisualization, SkillEditor, GapAnalysis, LearningPaths | Interactive graph of skills vs. requirements |
| **Interviews** | VoiceRecorder, TranscriptPanel, VoiceAnalytics, QuestionQueue | Real-time voice mock interview environment |
| **Settings** | APIKeyManager, ScoutConfig, ProfileEditor, ResumeUpload | Configuration and user profile |

### 3.3 Color Scheme & Visual Language

- **Primary**: `#6366F1` (Indigo) — trust, professionalism
- **Success/Match**: `#10B981` (Emerald) — high match scores, connected skills
- **Warning/Gap**: `#F59E0B` (Amber) — skill gaps, action needed
- **Danger/Critical**: `#EF4444` (Red) — missing critical skills
- **Background**: `#0F172A` (Slate 900) — dark mode default
- **Surface**: `#1E293B` (Slate 800) — card backgrounds
- **Text**: `#F8FAFC` (Slate 50) — primary text

---

## 4. Architecture

### 4.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 + React + Tailwind CSS | SSR, API routes, fast iteration |
| **Backend** | Python FastAPI | Async, WebSocket support, ML-friendly |
| **Database** | Neo4j Aura | Graph-native skill relationships |
| **State** | SQLite (via SQLAlchemy) | Job listings, interview history, config |
| **Voice STT** | Web Speech API | Browser-native, zero-latency |
| **Voice TTS** | Web Speech Synthesis | Browser-native delivery |
| **Voice Analysis** | Modulate Velma API | Sentiment, emotion, confidence scoring |
| **Job Monitoring** | Yutori Scouting API | Continuous career page monitoring |
| **Job Extraction** | Yutori Browsing API | Full JD navigation & extraction |
| **Company Research** | Tavily Search API | Real-time news, culture, tech stack |
| **NER / Entity Extraction** | Pioneer GLiNER-2 (cloud, primary) + local GLiNER (fallback) | Zero-shot NER via cloud API; local Python sidecar as fallback |
| **Fine-Tuning / MLOps** | Pioneer Felix Platform | Dataset management, model training, evaluation, deployment |
| **Resume Alignment** | Pioneer + Gemini 2.5 Flash | Auto-ATS optimization with entity extraction + LLM rewriting |
| **LLM** | Gemini 2.5 Flash (primary) / GPT-4 | Question generation, resume rewriting, gap analysis |

### 4.2 Data Flow

```
1. SCOUT CREATION (on startup)
   User profile + target companies → Yutori Scouting API (webhook configured)

2. JOB DETECTED (webhook fires)
   Yutori webhook → FastAPI /webhook/yutori
   ├── Yutori Browsing API → extract full JD + tech stack
   ├── Tavily Search → company news, culture, recent launches
   ├── Neo4j → compute skill gaps, match score
   └── Store job + analysis in SQLite

3. INTERVIEW PREP (auto or manual trigger)
   Job data + Tavily intel + skill gaps → LLM prompt
   ├── Generate role-specific questions
   ├── Create scoring rubric
   └── Ready mock interview environment

4. MOCK INTERVIEW (user enters voice session)
   Browser mic → Web Speech API (STT) → user response text
   Browser mic → MediaRecorder → Modulate Velma (voice analysis)
   ├── LLM evaluates response content
   ├── Modulate evaluates delivery (confidence, emotion, pace)
   └── Combined feedback displayed in real-time
```

### 4.3 File Structure

```
ManageStudy/
├── backend/
│   ├── main.py                    # FastAPI app entry
│   ├── config.py                  # API keys, settings
│   ├── orchestrator.py            # Autonomous pipeline controller
│   ├── models/
│   │   ├── database.py            # SQLAlchemy models
│   │   └── schemas.py             # Pydantic schemas
│   ├── services/
│   │   ├── yutori_service.py      # Scouting + Browsing API
│   │   ├── tavily_service.py      # Search + Extract API
│   │   ├── neo4j_service.py       # Graph operations
│   │   ├── modulate_service.py    # Voice analysis API
│   │   ├── llm_service.py         # OpenAI integration
│   │   └── interview_service.py   # Interview generation
│   ├── routers/
│   │   ├── jobs.py                # Job CRUD endpoints
│   │   ├── scouts.py              # Scout management
│   │   ├── skills.py              # Skill graph endpoints
│   │   ├── interviews.py          # Interview session endpoints
│   │   └── webhooks.py            # Yutori webhook receiver
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── skills/page.tsx    # Skill graph
│   │   │   ├── interviews/page.tsx # Mock interviews
│   │   │   └── settings/page.tsx  # Settings
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── ScoutCards.tsx
│   │   │   │   ├── JobFeed.tsx
│   │   │   │   ├── SystemHealth.tsx
│   │   │   │   └── QuickStats.tsx
│   │   │   ├── skills/
│   │   │   │   ├── SkillGraph.tsx
│   │   │   │   ├── GapAnalysis.tsx
│   │   │   │   └── LearningPath.tsx
│   │   │   ├── interviews/
│   │   │   │   ├── VoiceRecorder.tsx
│   │   │   │   ├── InterviewPanel.tsx
│   │   │   │   ├── VoiceAnalytics.tsx
│   │   │   │   └── TranscriptView.tsx
│   │   │   └── settings/
│   │   │       ├── ApiKeyManager.tsx
│   │   │       └── ProfileEditor.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useVoice.ts
│   │   │   └── useSkillGraph.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   └── styles/
│   │       └── globals.css
│   └── public/
├── services/
│   └── gliner/                    # GLiNER microservice (Python)
│       ├── main.py                # FastAPI app — /predict, /batch, /health
│       ├── requirements.txt       # gliner, fastapi, uvicorn, torch
│       ├── Dockerfile             # Container build with model pre-download
│       └── README.md              # Service docs & usage
├── DESIGN_DOC.md
└── README.md
```

---

## 5. Autonomy Flow (Zero-Intervention)

```
                    ┌─────────────────┐
                    │   App Starts    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Load User       │
                    │ Profile + Skills│
                    │ from Neo4j      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Create Yutori   │
                    │ Scouts for each │
                    │ target company  │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │     AUTONOMOUS LOOP          │
              │  (webhook-driven, 24/7)      │
              │                              │
              │  ┌────────────────────────┐  │
              │  │ Yutori Scout fires     │  │
              │  │ → job match webhook    │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ Yutori Browsing API    │  │
              │  │ → full JD extraction   │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ Tavily Search API      │  │
              │  │ → company deep dive    │  │
              │  │ → recent news/launches │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ Neo4j Skill Graph      │  │
              │  │ → compute match score  │  │
              │  │ → identify skill gaps  │  │
              │  │ → find learning paths  │  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ LLM generates tailored │  │
              │  │ interview questions    │  │
              │  │ using ALL gathered data│  │
              │  └───────────┬────────────┘  │
              │              │               │
              │  ┌───────────▼────────────┐  │
              │  │ Dashboard pushes       │  │
              │  │ notification via WS    │  │
              │  │ "Interview Ready!"     │  │
              │  └────────────────────────┘  │
              └──────────────────────────────┘
```

---

## 6. Mock Interview — Voice Flow Detail

```
┌─────────────────────────────────────────────────────────────┐
│                    VOICE SESSION                             │
│                                                             │
│  1. System reads question aloud (Web Speech Synthesis TTS)  │
│                                                             │
│  2. User speaks answer (captured two ways):                 │
│     a. Web Speech API → real-time transcription             │
│     b. MediaRecorder → audio blob → Modulate Velma API     │
│                                                             │
│  3. Parallel evaluation:                                    │
│     ┌─────────────────┐    ┌──────────────────────┐        │
│     │ LLM evaluates   │    │ Modulate evaluates   │        │
│     │ content quality  │    │ voice delivery       │        │
│     │ - relevance      │    │ - confidence level   │        │
│     │ - STAR method    │    │ - emotional tone     │        │
│     │ - technical depth│    │ - speech clarity     │        │
│     │ - specificity    │    │ - pace/rhythm        │        │
│     └────────┬────────┘    └──────────┬───────────┘        │
│              │                        │                     │
│              └────────────┬───────────┘                     │
│                           │                                 │
│              ┌────────────▼───────────┐                     │
│              │ Combined Feedback      │                     │
│              │ Content: 4/5           │                     │
│              │ Delivery: 3.5/5        │                     │
│              │ Overall: 3.75/5        │                     │
│              │ Tips: "Add metrics..." │                     │
│              └────────────────────────┘                     │
│                                                             │
│  4. Next question (loop until session ends)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. API Endpoints (Backend)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scouts` | Create a new Yutori scout |
| `GET` | `/api/scouts` | List all active scouts |
| `DELETE` | `/api/scouts/{id}` | Remove a scout |
| `POST` | `/api/webhooks/yutori` | Receive Yutori scout results |
| `GET` | `/api/jobs` | List discovered jobs |
| `GET` | `/api/jobs/{id}` | Get job with full analysis |
| `POST` | `/api/jobs/{id}/research` | Trigger Tavily deep dive |
| `GET` | `/api/skills/graph` | Get user skill graph data |
| `POST` | `/api/skills` | Add/update user skills |
| `GET` | `/api/skills/gaps/{job_id}` | Get skill gaps for a job |
| `POST` | `/api/interviews/start/{job_id}` | Start mock interview session |
| `POST` | `/api/interviews/{id}/respond` | Submit voice response |
| `POST` | `/api/interviews/{id}/analyze-voice` | Send audio to Modulate |
| `GET` | `/api/interviews/{id}/feedback` | Get interview feedback |
| `WS` | `/ws/dashboard` | Real-time dashboard updates |
| `WS` | `/ws/interview/{id}` | Real-time interview session |
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update user profile |
| `GET` | `/api/system/health` | System health check |

---

## 8. Sponsor Technology Integration

### 8.1 Pioneer-Powered Memory & Code Evaluation (`fastino-service.ts`)

> **Pioneer cloud is the PRIMARY entity extraction backbone.** Every memory stored, response classified, and code snippet evaluated is enriched with Pioneer GLiNER-2 entities. When Pioneer is unreachable, the service degrades gracefully to local heuristics.

**Architecture**:
- In-memory session store enriched with Pioneer-extracted entities on every `storeMemory()` call
- Entity-aware relevance scoring: retrieval ranks results by keyword match + entity overlap
- Classification leverages Pioneer `classifyInterviewResponse()` to count entity hits against expected concepts
- Code evaluation uses Pioneer to extract algorithms, data structures, design patterns from source code

**Capabilities**:
| Function | Description |
|----------|-------------|
| `storeMemory()` | Enrich + store observations with Pioneer-extracted entities |
| `retrieveMemory()` | Entity-aware relevance retrieval (keyword + entity scoring) |
| `classifyResponse()` | Pioneer cloud-first classification against concept list (local fallback) |
| `evaluateCodeSnippet()` | Pioneer extracts algorithm/pattern entities from code; local complexity analysis |
| `getKnownWeaknesses()` | Pull from entity-tagged performance history for study planning |
| `getEntityAnalytics()` | Aggregate entity frequency, label distribution, topic trends across sessions |

### 8.2 Pioneer — GLiNER-2 Cloud Inference & Felix Fine-Tuning Platform

> **Pioneer AI** (`api.pioneer.ai`) is used as the **PRIMARY cloud inference engine** throughout the application. It provides GLiNER-2 zero-shot NER inference and the **Felix platform** for dataset management, model fine-tuning, evaluation, and deployment.

**Full Pioneer API Client** (`pioneer-service.ts`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/inference` | POST | GLiNER-2 cloud NER — extract entities with custom label schemas |
| `/felix/datasets` | GET/POST | List & create training datasets (JSONL upload or HuggingFace import) |
| `/felix/training-jobs` | GET/POST | Start & monitor fine-tuning jobs on custom datasets |
| `/felix/evaluations` | GET/POST | Run evaluation comparing fine-tuned vs base GLiNER, LLMs |
| `/felix/deployments` | GET/POST | Deploy fine-tuned models to production inference endpoints |

**Auth**: `X-API-Key: {PIONEER_API_KEY}` header on all requests.

**Multi-Pass Extraction Pipeline** (for maximum F1):
1. **Pass 1** — Core tech skills: `programming_language`, `framework`, `library`, `database`, `cloud_service`, `tool`, `platform`
2. **Pass 2** — CS concepts: `algorithm`, `data_structure`, `design_pattern`, `architecture_pattern`, `protocol`, `methodology`
3. **Deduplicate** — Merge by `(text, label)` key, keep highest confidence scores
4. Result: ~20-30% higher recall vs single-pass, with no precision loss

**End-to-End Fine-Tuning Pipeline** (`runFineTuningPipeline()`):
1. Upload labeled training data → create dataset
2. Start fine-tuning job on Pioneer Felix
3. Monitor training progress to completion
4. Run evaluation against base GLiNER-2
5. If F1 improves → auto-deploy fine-tuned model
6. Return full metrics: precision, recall, F1, comparison

**Key Functions** in `pioneer-service.ts`:
| Function | Description |
|----------|-------------|
| `inference()` | Single-pass cloud NER extraction |
| `multiPassInference()` | Multi-schema multi-pass extraction with deduplication |
| `extractJDSkillsCloud()` | Structured JD extraction → `{required, preferred, allTech}` |
| `classifyInterviewResponse()` | Count entity matches against expected concept list |
| `buildTrainingSamples()` | Convert extraction results + corrections into JSONL training data |
| `runFineTuningPipeline()` | Full pipeline: dataset → train → evaluate → deploy |
| `checkHealth()` | Verify Pioneer cloud connectivity and model availability |

### 8.3 GLiNER Service — Cloud-First with Local Fallback (`gliner-service.ts`)

> **Three-tier extraction architecture**: Pioneer cloud (primary) → local GLiNER microservice (fallback) → regex pattern matching (last resort). Every extraction call tries Pioneer first.

**Extraction Flow**:
```
Request → Pioneer Cloud API ──[ok]──→ Return entities
              │ [fail]
              ▼
         Local GLiNER ──────[ok]──→ Return entities
           (port 8080)
              │ [fail]
              ▼
         Regex Fallback ──────────→ Return entities (score 0.7)
```

**Capabilities**:
| Function | Description |
|----------|-------------|
| `extractEntities()` | Cloud-first single extraction with 3-tier fallback |
| `extractEntitiesMultiPass()` | Multi-schema multi-pass for maximum F1 (tech skills + CS concepts) |
| `extractJDSkills()` | JD-optimized extraction with Pioneer structured parsing |
| `extractJDSkillsStructured()` | Returns `{required, preferred, allTech}` with context-based classification |
| `extractFromCode()` | Code-aware extraction (algorithms, patterns, libraries) |
| `extractFromTranscript()` | Per-question entity attribution across interview Q&A |
| `extractEntitiesBatch()` | Parallel batch extraction across multiple texts |
| `checkGlinerHealth()` | Reports backend type: `pioneer` / `local` / `fallback` |

**Local GLiNER Microservice** (fallback only):
- **Location**: `services/gliner/` (Dockerfile + FastAPI app)
- **Default URL**: `http://localhost:8080` (configurable via `GLINER_API_URL`)
- **Model**: `urchade/gliner_medium-v2.1`
- **Start**: `cd services/gliner && python main.py` or `docker run -p 8080:8080 gliner-service`

### 8.4 Auto Resume Alignment — Pioneer + Gemini Feedback Loop (`resume-alignment.ts`)

> Automatically aligns user resumes to job descriptions using Pioneer for entity extraction and Gemini for rewriting, then collects real-world feedback data to fine-tune Pioneer for better ATS optimization.

**Pipeline**:
1. **Extract** — Pioneer extracts entities from both resume and JD (skills, tools, certifications)
2. **Analyze** — Compute entity overlap score, identify missing skills, map matching skills
3. **Rewrite** — Gemini 2.5 Flash rewrites resume sections to incorporate missing JD keywords naturally
4. **Verify** — Pioneer re-extracts from rewritten resume to confirm entity coverage improved
5. **Collect** — Store `(resume, JD, aligned_resume, score)` as training data
6. **Fine-tune** — When 50+ samples accumulated, auto-trigger Pioneer fine-tuning pipeline

**Auto-Trigger Fine-Tuning**: The system automatically calls `pioneerService.runFineTuningPipeline()` once enough real-world alignment data has been collected. This creates a self-improving loop — the more resumes users align, the better the extraction model becomes at identifying ATS-critical entities.

**API Routes** (`api/resume/route.ts`):
| Action | Description |
|--------|-------------|
| `analyze` | ATS analysis — entity overlap, missing skills, match score |
| `align` | Full alignment pipeline — extract → rewrite → verify → collect |
| `align_all` | Bulk align resume to top 5 discovered jobs |
| `save_default_resume` | Store user's default resume for re-use across alignments |
| `get_default_resume` | Retrieve stored default resume |
| `get_alignments` | Get full alignment history with feedback status |
| `submit_feedback` | Rate alignment quality — feeds Pioneer fine-tuning loop |
| `feedback_stats` | Aggregate feedback stats (good/needs_improvement/bad counts) |
| `training_status` | Check accumulated training samples and fine-tune status |
| `trigger_finetune` | Manually trigger fine-tuning with collected data |

**Default Resume + Alignment History**:
- Users store one **default resume** as their base — used automatically for all alignment operations
- Every alignment is recorded in an **alignment history** with job title, company, ATS score, and timestamp
- Users can revisit past alignments, compare scores, and provide feedback

**Feedback-Driven Fine-Tuning**:
- After each alignment, users rate quality: **Good** / **Needs Work** / **Poor**
- Optional: text comment explaining what's wrong + manual edited version
- Feedback signal is injected into Pioneer training data:
  - **Good** → positive sample, reinforces current patterns
  - **Needs Improvement** → moderate signal, reduced weight
  - **Bad** → negative signal, if user provides `preferredVersion` → gold-standard training pair
- Auto-triggers Pioneer fine-tuning at 50 accumulated samples
- Creates a **self-improving loop**: user feedback → better extraction → better alignment → better feedback

### 8.4 Reka Vision API — Multimodal Whiteboard Analysis

**Video/Image Q&A** (`POST https://api.reka.ai/v1/vision/qa`)
- Upload whiteboard snapshots (Base64 PNG) every 5 seconds
- Ask contextual questions: "What architecture pattern is being drawn?"
- Returns structured analysis of system designs, diagrams, and flowcharts

**Use Cases**:
- Whiteboard snapshot → Reka → "User drew a microservices diagram but missing a cache layer"
- Feed Reka's analysis into the interviewer prompt for contextual follow-ups
- Optional: webcam frames for facial expression analysis (stress/confusion detection)

---

## 9. Live Session Features

### 9.1 Code Editor (Monaco Editor)

- Embedded in the Interview Panel as a tab alongside voice controls
- Supports syntax highlighting for Python, JavaScript, TypeScript, Java, C++
- Editor state synced to backend via API for AI analysis
- If user is idle >30 seconds, AI offers a hint based on the current code state
- GLiNER extracts entities from code comments and variable names in real-time

### 9.2 Interactive Whiteboard (Excalidraw)

- Embedded in the Interview Panel as a second tab
- Users draw system designs, flowcharts, and architecture diagrams
- Canvas exported as PNG snapshots every 5 seconds → sent to Reka Vision API
- Reka's analysis powers contextual interviewer questions about the design
- Supports both drawing and text annotations

### 9.3 Updated Interview Panel Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Mock Interview — SWE Intern @ Parallel                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [🎤 Voice] [💻 Code Editor] [📐 Whiteboard]              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                            │  │
│  │  ACTIVE TAB CONTENT:                                       │  │
│  │                                                            │  │
│  │  Voice:  Question + Mic + Transcript                       │  │
│  │  Code:   Monaco Editor + AI Hint Panel                     │  │
│  │  Board:  Excalidraw Canvas + Reka Analysis Sidebar         │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  VOICE ANALYTICS         │  │  AI INSIGHTS (Live)          │ │
│  │  Confidence / Clarity    │  │  Extracted Skills: [React,   │ │
│  │  Pace / Sentiment        │  │   Binary Search, O(log n)]   │ │
│  │  (from Modulate)         │  │  Whiteboard: "Missing DB"    │ │
│  │                          │  │  Code: "Edge case not         │ │
│  │                          │  │   handled for empty input"   │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Additional API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/interviews/{id}/analyze-code` | Send code editor content for AI evaluation |
| `POST` | `/api/interviews/{id}/analyze-whiteboard` | Send whiteboard snapshot to Reka Vision |
| `POST` | `/api/interviews/{id}/extract-entities` | Run GLiNER on transcript/code for skill extraction |
| `POST` | `/api/interviews/{id}/hint` | Request an AI hint based on current code/whiteboard state |
| `GET`  | `/api/interviews/{id}/live-insights` | Get aggregated AI insights (skills, code analysis, board analysis) |

---

## 11. Feedback Loops & Self-Improving Pipelines

### 11.1 Resume Alignment Feedback Loop

```
User pastes resume → Pioneer extracts entities → Gemini rewrites → Pioneer verifies
        ↓                                                                    ↓
 Alignment stored in                                              User rates: 👍 / ⚡ / 👎
 alignment history                                                      ↓
        ↓                                                    Feedback → training data
 Available for                                                (weight adjusted by rating)
 comparison                                                          ↓
                                                          50 samples → auto fine-tune
                                                                      ↓
                                                           Better Pioneer model deployed
```

### 11.2 Interview → Study Plan Adaptation Loop

```
Mock Interview completed → Modulate voice metrics + content scores
        ↓
Interview Analyzer (Gemini) → identifies weaknesses + skill deltas
        ↓
Study Planner receives PerformanceSnapshot
        ↓
Re-generates plan with failure-triggered blocks:
  - Blocks tagged with triggeredBy: "interview-failure"
  - failureReason attached (e.g., "binary search edge cases")
  - Priority auto-upgraded to "high" or "critical"
  - Uncovered weaknesses → injected as explicit skill-gap blocks
```

### 11.3 Voice-Communication Feedback into Study Planning

- Modulate Velma-2 metrics (confidence, clarity, pace, fillers, sentiment, emotion) are included in the post-interview LLM analysis prompt
- Communication weaknesses are treated like skill gaps: low confidence → study block for "Communication drills / confidence exercises"
- Filler word patterns tracked across interviews to show improvement trend

---

## 12. Sponsor Technology Branding

All sponsor technologies are attributed in the UI with "Powered by [Sponsor]" badges:

| Component | Sponsor Attribution |
|-----------|--------------------|
| AI Insights → Detected Skills | Powered by **Pioneer GLiNER-2** |
| AI Insights → Code Analysis | Powered by **Gemini** |
| AI Insights → Whiteboard | Powered by **Reka Vision** |
| Voice Analytics Panel | Powered by **Modulate** |
| InterviewPanel → VoiceMetrics | Powered by **Modulate Velma-2** |
| Whiteboard Analysis Panel | Powered by **Reka Vision** |
| Resume ATS Optimizer | Powered by **Pioneer GLiNER-2** + **Gemini 2.5 Flash** |
| Study Plan Generation | Powered by **Gemini** + **Pioneer** |
| Loading States | "Powered by Pioneer GLiNER-2" |

This ensures every sponsor gets visible attribution at the point of value delivery throughout the application.
