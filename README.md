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
  Next.js Dashboard shows live KPIs + stock levels + critical alert banner
  Manager can also type natural language directly into the dashboard
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
  Clicks "Onayla ve Gönder" → email sent via Gmail API
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | FastAPI 0.115 · Python 3.11 |
| **Database** | SQLite (dev) → PostgreSQL (prod-ready) · SQLAlchemy 2.0 |
| **AI — Parsing** | Google Gemini 2.5 Flash (text + vision) |
| **AI — Agents** | CrewAI 1.x · 3-agent sequential crew |
| **Email** | Gmail API (OAuth2) via `google-auth` |
| **Messaging** | Telegram Bot API (`python-telegram-bot` 21) |
| **Frontend** | Next.js 14 · TypeScript · Tailwind CSS |
| **Charts** | Recharts |
| **Drag & Drop** | @hello-pangea/dnd |
| **Notifications** | Sonner toast |
| **Containerization** | Docker · Docker Compose |

---

## Project Structure

```
yzta/
├── backend/
│   ├── main.py                    # FastAPI app + CORS + lifespan
│   │                              #   · Telegram bot start/stop
│   │                              #   · 08:00 daily morning briefing loop
│   │                              #   · 15-min proactive stock monitor (Telegram alert + notification)
│   ├── database.py                # SQLAlchemy engine + session factory
│   ├── models.py                  # ORM: Product · StockMovement · ActionApproval · Task
│   │                              #       Supplier · Notification
│   ├── schemas.py                 # Pydantic v2 request/response models
│   ├── crud.py                    # Database layer (append-only stock ledger)
│   ├── seed.py                    # Demo data seeder (products, movements, suppliers)
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── routers/
│   │   ├── dashboard.py           # GET /api/dashboard — KPIs + stock + approvals
│   │   ├── webhook.py             # POST /api/webhook/message — AI stock update (text or base64 image)
│   │   ├── analysis.py            # POST /api/analyze-stocks — CrewAI trigger
│   │   ├── actions.py             # POST /api/actions/{id}/approve|reject
│   │   ├── stock.py               # CRUD /api/products + /api/stock/movement + supplier assign
│   │   ├── suppliers.py           # CRUD /api/suppliers
│   │   ├── tasks.py               # CRUD /api/tasks — Kanban board
│   │   ├── analytics.py           # GET /api/analytics/trends + /api/analytics/daily-history
│   │   └── notifications.py       # GET /api/notifications + PATCH /{id}/read
│   │
│   └── services/
│       ├── ai_service.py          # Gemini: parse_text · parse_image · draft_supply_email
│       ├── crew_service.py        # CrewAI orchestration: run_crew() → list[dict]
│       ├── crew_tools.py          # @tool: get_all_stock_status · get_consumption_rate · get_movement_history
│       ├── email_service.py       # Gmail API OAuth2 sender
│       ├── product_service.py     # Shared fuzzy product lookup (webhook + Telegram)
│       └── telegram_bot.py        # Telegram handlers: text · photo · /status · morning briefing
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + Navigation + NotificationBar + Sonner Toaster
│   │   ├── globals.css            # Design system: btn-primary/secondary/danger · form-input · card · badge-*
│   │   ├── page.tsx               # Dashboard: KPI cards · CriticalAlertBanner · StockTable
│   │   │                          #             QuickStockEntry (natural language) · AI ApprovalPanel
│   │   ├── stock/page.tsx         # Stock management: products · add/remove/delete with undo toast
│   │   │                          #                   supplier assignment · analytics tab with charts
│   │   ├── kanban/page.tsx        # Drag-and-drop Kanban board (4 status columns)
│   │   └── suppliers/page.tsx     # Supplier directory: add · inline delete confirm · category badges
│   │
│   └── components/
│       ├── Navigation.tsx          # Top nav with page links
│       ├── NotificationBar.tsx     # Bell icon + dropdown: live notification feed
│       ├── ui/
│       │   ├── KpiCard.tsx         # Metric card with alert state + icon
│       │   ├── StockTable.tsx      # Live stock table with progress bars
│       │   ├── ApprovalPanel.tsx   # AI approval cards with AgentInsightBar + inline editor
│       │   └── StockCharts.tsx     # DaysToEmptyChart + WeeklyFlowChart (Recharts)
│       └── stock/
│           ├── StockTabs.tsx       # Products / Analytics tab switcher
│           ├── StockProductsTab.tsx # Product table with filters + supplier cell + stock bar
│           ├── StockAnalyticsTab.tsx# Analytics summary cards + risk list + consumption leaders
│           ├── StockModals.tsx     # NewProductModal · AddStockModal · RemoveStockModal · DeleteModal
│           └── types.ts            # Shared TypeScript interfaces
│
├── docker-compose.yml
└── README.md
```

---

## Database Design

### Append-Only Stock Ledger

Stock levels are **never stored directly**. `current_stock = SUM(StockMovement.quantity)` for each product. Every change is permanent and auditable — undo operations post a compensating movement, never overwrite.

```
Product                     StockMovement (ledger)
  id                          id
  name                        product_id (FK → Product)
  sku                         quantity  (+in / −out)
  unit                        type      (in / out / count)
  threshold                   source    (telegram_text / telegram_photo /
  supplier_id (FK)                       webhook_text / webhook_image / manual)
  created_at                  notes
                              timestamp

Supplier                    ActionApproval
  id                          id
  name                        type  (supply_email)
  email                       payload  (JSON — see AI Crew section)
  phone                       status (pending / approved / rejected)
  product_category            created_at / updated_at
  notes
  created_at                Task (Kanban)
                              id
Notification                  title
  id                          status (pending → accepted → in_progress → completed)
  title                       created_at
  body
  type  (alert / stock_update / info)
  is_read
  created_at
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Live KPIs, stock levels, pending approvals |
| `POST` | `/api/analyze-stocks` | Trigger 3-agent CrewAI analysis (~30s) |
| `POST` | `/api/webhook/message` | AI stock update from natural language text or base64 image |
| `POST` | `/api/actions/{id}/approve` | Approve + send supplier email (optional edits) |
| `POST` | `/api/actions/{id}/reject` | Reject AI-drafted action |
| `GET` | `/api/products` | All products with live stock, threshold, supplier |
| `POST` | `/api/products` | Create new product |
| `PATCH` | `/api/products/{id}/supplier` | Assign or remove supplier from product |
| `DELETE` | `/api/products/{id}` | Delete product + all movements |
| `POST` | `/api/stock/movement` | Manual signed stock movement |
| `GET` | `/api/analytics/trends` | 7-day consumption trends, days-to-empty per product |
| `GET` | `/api/analytics/daily-history` | Daily in/out totals for the past 7 days |
| `GET` | `/api/suppliers` | All suppliers |
| `POST` | `/api/suppliers` | Create supplier |
| `DELETE` | `/api/suppliers/{id}` | Delete supplier |
| `GET/POST/PATCH/DELETE` | `/api/tasks` | Kanban task CRUD |
| `GET` | `/api/notifications` | All notifications (newest first) |
| `PATCH` | `/api/notifications/{id}/read` | Mark notification as read |

Interactive docs: **http://localhost:8000/docs**

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Dashboard — KPI cards, critical alert banner, stock table, natural-language quick entry, AI approval panel |
| `/stock` | Product catalog with search/filter, supplier assignment, add/remove stock with 30s undo toast, analytics tab with Recharts |
| `/kanban` | Drag-and-drop task board — 4 columns (Sırada / Kabul Edildi / İşlemde / Tamamlandı) with timestamps |
| `/suppliers` | Supplier directory — add, inline delete confirmation, category badges, email links |

### Design System

The UI uses a Google 4-color palette mapped to Tailwind custom scales:

| Color | Hex | Usage |
|---|---|---|
| **brand** (Google Blue) | `#0057e7` | CTAs, links, interactive elements |
| **gsuccess** (Google Green) | `#008744` | Success, normal stock, inflow |
| **amber** | `#ffa700` | Warning, medium urgency, outflow |
| **red** | `#d62d20` | Critical, danger, error |

---

## AI Crew — How It Works

When the manager clicks **"AI Crew Analizi Başlat"**, a 3-agent sequential crew runs (~30 seconds):

### Agent 1 — Stock Analyst (`Stok Zeka Analisti`)
Has access to 3 live DB tools:
- `get_all_stock_status` — all products with stock_ratio, deficit, is_critical
- `get_consumption_rate(product_id, days=7)` — daily avg outgoing movement
- `get_movement_history(product_id, limit=10)` — recent movement log

Scores urgency: **HIGH** (stock < 30% of threshold) · **MEDIUM** (< 60%) · **LOW** (< 100%)

### Agent 2 — Supply Planner (`Tedarik Stratejisti`)
Reads Analyst output (no tools — pure reasoning). Calculates:
- `recommended_order_qty = (threshold × 2) − current_stock` (×1.5 if high consumption)
- Writes Turkish reasoning per product
- Priority-sorts by urgency

### Agent 3 — Email Drafter (`Türkçe İş Yazışmaları Uzmanı`)
Reads Planner output. Drafts professional Turkish supplier emails. Returns strict JSON array.

Each `ActionApproval` payload includes:
```json
{
  "email_subject": "Acil Buğday Talebi — Tire Tarım Kooperatifi",
  "email_body": "Sayın ...",
  "recipient": "tedarikci@example.com",
  "agent_analysis": {
    "urgency_level": "HIGH",
    "urgency_label": "Kritik",
    "stock_ratio": 0.28,
    "deficit": 144.0,
    "recommended_order_qty": 280.0,
    "reasoning": "Buğday stoğu kritik seviyede. 7 günlük tüketim 12 kg/gün..."
  },
  "generated_by": "crewai_v1",
  "crew_run_id": "a3f12b8c"
}
```

The dashboard's `ApprovalPanel` + `AgentInsightBar` renders this as a compact insight strip with urgency badge, quantity, reasoning, and a collapsible editable email form.

---

## Telegram Bot

Runs inside FastAPI's asyncio lifespan — no separate process needed.

| Input | Action |
|---|---|
| `/status` | Lists all products with 🟢/🔴 indicators and fill % |
| Text message | Gemini parses → fuzzy match → StockMovement appended → confirmation reply |
| Photo (invoice) | Gemini Vision reads invoice → same flow → `📄 İrsaliye okundu!` reply |

### Background Tasks (in `main.py` lifespan)

| Task | Schedule | Description |
|---|---|---|
| Morning briefing | Daily 08:00 | Sends full stock status summary to all registered Telegram chats |
| Proactive stock monitor | Every 15 minutes | Detects products newly fallen below threshold → Telegram alert + in-app notification |

Dashboard auto-refreshes every 30 seconds, so Telegram updates appear within half a minute.

---

## Notification System

`NotificationBar` in the top nav shows a live bell icon with unread count. Notifications are created automatically by:
- The proactive stock monitor (when a product newly goes critical)
- The AI stock ingestion webhook (on successful stock updates)

Clicking a notification marks it as read via `PATCH /api/notifications/{id}/read`.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- **Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- **Telegram Bot token** — from [@BotFather](https://t.me/BotFather) *(optional but recommended for demo)*
- **Gmail OAuth credentials** — for email sending *(optional)*

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — set GEMINI_API_KEY and optionally TELEGRAM_BOT_TOKEN

uvicorn main:app --reload --port 8000
# Terminal shows: 🤖 Telegram botu başlatıldı.

python seed.py   # optional: loads demo products and movements
```

API at **http://localhost:8000** · Swagger docs at **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard at **http://localhost:3000**

### 3. Docker (clone and run)

```bash
git clone <repo-url>
cd yzta
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

# Email (Gmail OAuth2)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# Database (default: SQLite for dev)
DATABASE_URL=sqlite:///./kobi_assistant.db
```

---

## Testing the AI Features

### Simulate a natural-language stock update
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "250 kg buğday teslim alındı"}'
```

### Multi-item invoice text
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "Mazot 500 litre girdi, gübre 2 ton çıktı"}'
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
| Append-only stock ledger | Full audit trail, no data loss; undo = compensating movement, never overwrite |
| `response_mime_type="application/json"` on Gemini | Eliminates markdown wrapping, forces structured output |
| CrewAI sequential process | Each agent builds on the previous one's context — Planner sees Analyst's trend data, Drafter emails reference actual deficit numbers |
| Telegram over Twilio | No approval process, free tier, instant setup, better for live demos |
| `max_rpm=8` on Crew | Stays under Gemini free-tier rate limit (10 req/min) with headroom |
| Human-in-the-loop approvals | Manager can edit subject / body / recipient before every email sends |
| `NEXT_PUBLIC_API_URL` as Docker build arg | Next.js bakes env vars at build time; must pass as `ARG` not runtime `ENV` |
| Optimistic UI updates | All state changes apply immediately, restore on API failure — zero perceived latency |
| Proactive stock monitor in lifespan | No cron dependency; runs as asyncio task inside the same FastAPI process |

---

## Powered By

- [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) — AI text/image parsing and email drafting
- [CrewAI](https://crewai.com) — Multi-agent orchestration
- [FastAPI](https://fastapi.tiangolo.com) — Backend API
- [Next.js 14](https://nextjs.org) — Frontend dashboard
- [python-telegram-bot](https://python-telegram-bot.org) — Telegram integration
- [Gmail API](https://developers.google.com/gmail/api) — Email delivery
- [Recharts](https://recharts.org) — Stock analytics charts
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) — Kanban drag-and-drop
