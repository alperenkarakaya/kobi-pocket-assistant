# KOBI Pocket Assistant

**AI-powered inventory management for agricultural cooperatives.**  
Built for the Tire Agricultural Cooperative (Tire Tarım Kooperatifi) — managers update stock by sending a Telegram message or invoice photo, and a 3-agent AI crew autonomously drafts supplier emails for manager approval.

---

## Demo Flow

```
Manager sends Telegram text or invoice photo
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
  │      · Queries all stock via DB tools   │
  │      · Checks 7-day consumption trends  │
  │      · Scores urgency: HIGH/MEDIUM/LOW  │
  │              ↓                          │
  │  [2] Supply Planner                     │
  │      · Calculates recommended qty       │
  │      · Writes Turkish reasoning         │
  │      · Priority-sorts by urgency        │
  │              ↓                          │
  │  [3] Email Drafter                      │
  │      · Writes professional Turkish      │
  │        supplier emails per product      │
  └─────────────────────────────────────────┘
         │
         ▼
  Dashboard shows AI Crew cards with:
  · Urgency badge (🔴 Kritik / 🟡 Orta / 🟢 Düşük)
  · Recommended order quantity
  · Agent reasoning (2-line summary)
  · Full email preview (collapsible, editable)
         │
         ▼
  Manager edits subject / body / recipient if needed
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
│   ├── main.py                    # FastAPI app + CORS + lifespan (Telegram start/stop)
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
│       ├── ai_service.py          # Gemini: parse_text · parse_image · draft_supply_email
│       ├── crew_service.py        # CrewAI orchestration: run_crew() → list[dict]
│       ├── crew_tools.py          # @tool: get_all_stock_status · get_consumption_rate · get_movement_history
│       ├── product_service.py     # Shared fuzzy product lookup (webhook + Telegram)
│       └── telegram_bot.py        # Telegram handlers: text · photo · /status command
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + Navigation + Sonner Toaster
│   │   ├── page.tsx               # Dashboard: KPI cards · stock table · AI approval panel
│   │   ├── kanban/page.tsx        # Drag-and-drop Kanban task board
│   │   ├── stock/page.tsx         # Stock management: add/remove/delete with undo toast
│   │   └── globals.css            # Futuristic dark theme + grid background
│   │
│   └── components/ui/
│       ├── KpiCard.tsx            # Metric card with alert state + icon
│       ├── StockTable.tsx         # Live stock table with progress bars
│       └── ApprovalPanel.tsx      # AI approval cards with AgentInsightBar + inline editor
│
├── docker-compose.yml
└── README.md
```

---

## Database Design

### Append-Only Stock Ledger

Stock levels are **never stored directly**. `current_stock = SUM(StockMovement.quantity)` for each product. Every change is permanent and auditable.

```
Product                     StockMovement (ledger)
  id                          id
  name                        product_id (FK)
  sku                         quantity  (+in / -out)
  unit                        type      (in / out / count)
  threshold                   source    (whatsapp_text / invoice_photo /
  created_at                            telegram_text / telegram_photo / manual)
                              notes
                              timestamp

ActionApproval                Task (Kanban)
  id                          id
  type  (supply_email)        title
  payload  (JSON)             status (pending → accepted → in_progress → completed)
  status (pending/approved/   created_at
          rejected)
  created_at / updated_at
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Live KPIs, stock levels, pending approvals |
| `POST` | `/api/analyze-stocks` | Trigger 3-agent CrewAI analysis (~30s) |
| `POST` | `/api/webhook/message` | AI stock update from text or base64 image |
| `POST` | `/api/actions/{id}/approve` | Approve + send supplier email (with optional edits) |
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
| `/` | Main dashboard — KPI cards, live stock table, AI Crew approval panel |
| `/kanban` | Drag-and-drop task board (4 columns) |
| `/stock` | Stock management — add/remove/delete products with 30s undo toast |

---

## AI Crew — How It Works

When the manager clicks **"AI Crew Analizi Başlat"**, a 3-agent sequential crew runs (~30 seconds):

### Agent 1 — Stock Analyst (`Stok Zeka Analisti`)
Has access to 3 live DB tools:
- `get_all_stock_status` — all products with stock_ratio, deficit, is_critical
- `get_consumption_rate(product_id, days=7)` — daily avg outgoing movement
- `get_movement_history(product_id, limit=10)` — recent movement log

Scores urgency: **HIGH** (stock < 30% threshold) · **MEDIUM** (< 60%) · **LOW** (< 100%)

### Agent 2 — Supply Planner (`Tedarik Stratejisti`)
Reads Analyst output (no tools — pure reasoning). Calculates:
- `recommended_order_qty = (threshold × 2) − current_stock` (×1.5 if high consumption)
- Writes Turkish reasoning per product
- Priority-sorts by urgency

### Agent 3 — Email Drafter (`Türkçe İş Yazışmaları Uzmanı`)
Reads Planner output. Drafts professional Turkish supplier emails. Returns strict JSON array.

Each `ActionApproval` payload from the crew includes:
```json
{
  "email_subject": "...",
  "email_body": "...",
  "recipient": "tedarikci@example.com",
  "agent_analysis": {
    "urgency_level": "HIGH",
    "urgency_label": "Kritik",
    "stock_ratio": 0.40,
    "deficit": 120.0,
    "recommended_order_qty": 280.0,
    "reasoning": "Mazot stoğu kritik seviyede..."
  },
  "generated_by": "crewai_v1",
  "crew_run_id": "a3f12b8c"
}
```

The dashboard's `AgentInsightBar` component renders this data as a compact insight strip above each email card.

---

## Telegram Bot

Runs inside FastAPI's asyncio lifespan — no separate process needed.

| Input | Action |
|---|---|
| `/status` | Lists all products with 🟢/🔴 indicators and fill % |
| Text message | Gemini parses → fuzzy match → StockMovement appended → confirmation reply |
| Photo (invoice) | Gemini Vision reads → same flow → `📄 İrsaliye okundu!` reply |

Dashboard auto-refreshes every 30 seconds, so Telegram updates appear on screen within half a minute.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- **Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- **Telegram Bot token** — from [@BotFather](https://t.me/BotFather) (optional but recommended for demo)

### 1. Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

copy .env.example .env
# Edit .env: set GEMINI_API_KEY and TELEGRAM_BOT_TOKEN

uvicorn main:app --reload --port 8000
# You should see: 🤖 Telegram botu başlatıldı.

python seed.py   # optional: loads 5 demo products
```

API at **http://localhost:8000** · Swagger docs at **http://localhost:8000/docs**

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Dashboard at **http://localhost:3000**

### 3. Docker (clone and run)

```bash
git clone https://github.com/alperenkarakaya/kobi-pocket-assistant.git
cd kobi-pocket-assistant
cp backend/.env.example backend/.env
# Edit backend/.env — add GEMINI_API_KEY (and optionally TELEGRAM_BOT_TOKEN)

docker-compose up --build
docker-compose exec backend python seed.py
```

Both services start automatically. Dashboard at **http://localhost:3000**.

---

## Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Recommended for demo
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Database (default: SQLite for dev)
DATABASE_URL=sqlite:///./kobi_assistant.db
```

---

## Testing the AI Features

### Simulate a WhatsApp/Telegram text message (API)
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "250 kg buğday teslim alındı"}'
```

### Trigger AI Crew Analysis
```bash
curl -X POST http://localhost:8000/api/analyze-stocks
# Takes ~30 seconds — watch terminal for agent verbose output
```

### Approve with optional edits
```bash
curl -X POST http://localhost:8000/api/actions/1/approve \
  -H "Content-Type: application/json" \
  -d '{"email_subject": "Acil Buğday Talebi", "recipient": "supplier@example.com"}'
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Append-only stock ledger | Full audit trail, no data loss, supports compensating undo movements |
| `response_mime_type="application/json"` on Gemini | Eliminates prompt injection, forces structured output |
| CrewAI sequential process | Each agent builds on the previous one's context — Planner sees Analyst's trend data, Drafter emails reference actual deficit numbers |
| Telegram over Twilio | No approval process, free, instant setup, better for live demos |
| `max_rpm=8` on Crew | Stays under Gemini free-tier rate limit (10 req/min) with headroom |
| Human-in-the-loop approvals | Manager can edit subject/body/recipient before every email sends |
| `NEXT_PUBLIC_API_URL` as Docker build arg | Next.js bakes env vars at build time; must pass as `ARG` not runtime `ENV` |

---

## Powered By

- [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) — AI parsing and email drafting
- [CrewAI](https://crewai.com) — Multi-agent orchestration
- [FastAPI](https://fastapi.tiangolo.com) — Backend API
- [Next.js](https://nextjs.org) — Frontend dashboard
- [python-telegram-bot](https://python-telegram-bot.org) — Telegram integration
