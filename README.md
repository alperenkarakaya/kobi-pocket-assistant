# KOBI Pocket Assistant

**AI-powered inventory management for agricultural cooperatives.**  
Built for the Tire Agricultural Cooperative (Tire Tarım Kooperatifi) — managers update stock by sending a WhatsApp/Telegram message or photo of an invoice, and the system handles the rest autonomously.

---

## What It Does

```
Manager sends WhatsApp/Telegram text or invoice photo
         │
         ▼
  Gemini 2.5 Flash (Vision + Text)
  Extracts: product name · quantity · in/out action
         │
         ▼
  FastAPI backend fuzzy-matches product → appends StockMovement
  (append-only ledger — full audit trail, no overwrites)
         │
         ▼
  Next.js Dashboard shows live KPIs + stock levels
         │
         ▼
  Manager clicks "AI Crew Analizi Başlat"
         │
         ▼
  ┌─────────────────────────────────────────┐
  │         CrewAI Multi-Agent Crew         │
  │                                         │
  │  [1] Stock Analyst                      │
  │      · Queries all stock levels         │
  │      · Checks consumption trends        │
  │      · Scores urgency: HIGH/MEDIUM/LOW  │
  │              ↓                          │
  │  [2] Supply Planner                     │
  │      · Calculates order quantities      │
  │      · Writes Turkish reasoning         │
  │      · Priority-sorts by urgency        │
  │              ↓                          │
  │  [3] Email Drafter                      │
  │      · Writes professional Turkish      │
  │        supplier emails per product      │
  └─────────────────────────────────────────┘
         │
         ▼
  Manager reviews AI drafts in dashboard
  Edits subject / body / recipient if needed
  Clicks "Onayla ve Gönder" → email sent
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI 0.115 · Python 3.11 |
| **Database** | SQLite (dev) → PostgreSQL (prod-ready) · SQLAlchemy 2.0 |
| **AI — Parsing** | Google Gemini 2.5 Flash (text + vision) |
| **AI — Agents** | CrewAI 1.x · 3-agent sequential crew |
| **Messaging** | Telegram Bot API (`python-telegram-bot` 21) |
| **Frontend** | Next.js 13 · TypeScript · Tailwind CSS |
| **Notifications** | Sonner toast library |
| **Containerization** | Docker · Docker Compose |

---

## Project Structure

```
yzta/
├── backend/
│   ├── main.py                    # FastAPI app + CORS + lifespan (Telegram bot start/stop)
│   ├── database.py                # SQLAlchemy engine + session factory
│   ├── models.py                  # ORM: Product · StockMovement · ActionApproval · Task
│   ├── schemas.py                 # Pydantic v2 request/response models
│   ├── crud.py                    # Database layer (append-only stock ledger)
│   ├── seed.py                    # Demo data seeder (5 products, 10 movements)
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   │
│   ├── routers/
│   │   ├── dashboard.py           # GET /api/dashboard — KPIs + stock + approvals
│   │   ├── webhook.py             # POST /api/webhook/message — AI stock update
│   │   ├── analysis.py            # POST /api/analyze-stocks — CrewAI trigger
│   │   ├── actions.py             # POST /api/actions/{id}/approve|reject
│   │   ├── stock.py               # CRUD /api/products + manual movements
│   │   └── tasks.py               # CRUD /api/tasks — Kanban board
│   │
│   └── services/
│       ├── ai_service.py          # Gemini calls: parse_text · parse_image · draft_supply_email
│       ├── crew_service.py        # CrewAI orchestration: run_crew() → list[dict]
│       ├── crew_tools.py          # @tool functions: stock status · consumption rate · history
│       ├── product_service.py     # Shared fuzzy product lookup (used by webhook + Telegram)
│       └── telegram_bot.py        # Telegram bot handlers: text · photo · /status
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + Navigation + Sonner Toaster
│   │   ├── page.tsx               # Main dashboard (KPIs · stock table · approval panel)
│   │   ├── kanban/page.tsx        # Drag-and-drop Kanban task board
│   │   ├── stock/page.tsx         # Stock management (add · remove · delete products)
│   │   └── globals.css            # Futuristic dark theme + grid background
│   │
│   └── components/ui/
│       ├── KpiCard.tsx            # Metric card with alert state + icon
│       ├── StockTable.tsx         # Live stock table with progress bars
│       └── ApprovalPanel.tsx      # AI approval cards with inline email editor
│
├── docker-compose.yml
└── README.md
```

---

## Database Design

### Append-Only Stock Ledger

Stock levels are **never stored directly**. Current stock = `SUM(StockMovement.quantity)` for each product. Every change leaves a permanent audit trail.

```
Product ─────────────── StockMovement (ledger)
  id                      id
  name                    product_id (FK)
  sku                     quantity  (+in / -out)
  unit                    type      (in / out / count)
  threshold               source    (whatsapp_text / invoice_photo / telegram_text / manual)
  created_at              notes
                          timestamp

ActionApproval                    Task (Kanban)
  id                               id
  type  (supply_email)             title
  payload  (JSON)                  status (pending → accepted → in_progress → completed)
  status (pending/approved/rejected) created_at
  created_at / updated_at
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Live KPIs, stock levels, pending approvals |
| `POST` | `/api/analyze-stocks` | Trigger 3-agent CrewAI analysis (~30s) |
| `POST` | `/api/webhook/message` | AI stock update from text or base64 image |
| `POST` | `/api/actions/{id}/approve` | Approve + send supplier email (editable) |
| `POST` | `/api/actions/{id}/reject` | Reject AI-drafted action |
| `GET` | `/api/products` | All products with live stock |
| `POST` | `/api/products` | Create new product |
| `DELETE` | `/api/products/{id}` | Delete product + all movements |
| `POST` | `/api/stock/movement` | Manual signed stock movement |
| `GET/POST/PATCH/DELETE` | `/api/tasks` | Kanban task CRUD |

Interactive docs: **http://localhost:8000/docs**

---

## Frontend Pages

| Route | Page |
|---|---|
| `/` | Main dashboard — KPI cards, live stock table, AI approval panel |
| `/kanban` | Drag-and-drop task board (4 columns) |
| `/stock` | Stock management — add/remove/delete products with undo toast |

---

## AI Crew — How It Works

When the manager clicks **"AI Crew Analizi Başlat"**, a 3-agent sequential crew runs:

### Agent 1 — Stock Analyst (`Stok Zeka Analisti`)
- Has access to 3 DB tools: `get_all_stock_status`, `get_consumption_rate`, `get_movement_history`
- Queries all products, finds critical ones, analyses 7-day consumption trends
- Assigns urgency: **HIGH** (stock < 30% threshold) · **MEDIUM** (< 60%) · **LOW** (< 100%)

### Agent 2 — Supply Planner (`Tedarik Stratejisti`)
- Reads Analyst's output (no tools — pure reasoning)
- Calculates recommended order quantity: `(threshold × 2) − current_stock`, scaled by consumption rate
- Writes Turkish reasoning per product, priority-sorted by urgency

### Agent 3 — Email Drafter (`Türkçe İş Yazışmaları Uzmanı`)
- Reads Planner's output
- Drafts professional Turkish supplier restock emails
- Returns a strict JSON array — one object per critical product

Each `ActionApproval` record stores the full agent analysis in its `payload`:
```json
{
  "email_subject": "...",
  "email_body": "...",
  "agent_analysis": {
    "urgency_level": "HIGH",
    "urgency_label": "Kritik",
    "stock_ratio": 0.42,
    "recommended_order_qty": 15.5,
    "reasoning": "Arpa stoğu kritik seviyede..."
  }
}
```

---

## Telegram Bot

The bot runs inside FastAPI's asyncio lifespan — no separate process needed.

| Input | Action |
|---|---|
| Text message | Gemini parses → fuzzy product match → StockMovement appended |
| Photo | Gemini Vision reads invoice → same flow |
| `/status` | Returns all products with 🟢/🔴 stock indicators |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A **Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com))
- (Optional) A **Telegram Bot token** from [@BotFather](https://t.me/BotFather)

### 1. Backend

```powershell
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows PowerShell

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# → Edit .env: set GEMINI_API_KEY and (optionally) TELEGRAM_BOT_TOKEN

# Start API server
uvicorn main:app --reload --port 8000

# (Optional) Load demo data
python seed.py
```

API available at **http://localhost:8000** · Docs at **http://localhost:8000/docs**

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Dashboard at **http://localhost:3000**

### 3. Docker (Full Stack)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

docker-compose up --build
docker-compose exec backend python seed.py
```

---

## Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Optional — Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Database (default: SQLite)
DATABASE_URL=sqlite:///./kobi_assistant.db
```

---

## Testing the AI Features

### Webhook (simulates WhatsApp/Telegram text)
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "250 kg buğday teslim alındı"}'
```

### AI Crew Analysis
```bash
curl -X POST http://localhost:8000/api/analyze-stocks
# Takes ~30 seconds — watch the terminal for agent verbose output
```

### Approve an action (with optional edits)
```bash
curl -X POST http://localhost:8000/api/actions/1/approve \
  -H "Content-Type: application/json" \
  -d '{"email_subject": "Acil Buğday Tedarik Talebi", "recipient": "supplier@example.com"}'
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Append-only stock ledger | Full audit trail, no data loss, supports undo |
| Gemini `response_mime_type="application/json"` | Eliminates prompt hacking, forces structured output |
| CrewAI sequential process | Each agent builds on the previous one's reasoning — Planner sees Analyst's trend data, Drafter writes contextually accurate emails |
| Telegram over Twilio | No approval process, free, instant setup for demos |
| `NEXT_PUBLIC_API_URL` env var | Bypasses broken Next.js proxy rewrites, works in both dev and Docker |
| Human-in-the-loop approvals | Manager reviews and can edit every AI-drafted email before it sends |

---

## Powered By

- [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) — AI parsing and email drafting  
- [CrewAI](https://crewai.com) — Multi-agent orchestration  
- [FastAPI](https://fastapi.tiangolo.com) — Backend API  
- [Next.js](https://nextjs.org) — Frontend dashboard  
- [python-telegram-bot](https://python-telegram-bot.org) — Telegram integration
