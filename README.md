# KOBI Pocket Assistant

**AI-powered inventory management for agricultural cooperatives.**  
Built for the Tire Agricultural Cooperative (Tire Tarım Kooperatifi) — managers update stock by sending a Telegram message or invoice photo, and a 3-agent AI crew autonomously drafts supplier emails for manager approval.

---

## Demo Flow

```
Manager logs in (JWT auth) → Dashboard
         │
         ▼
  Types natural language into AI Copilot Sidebar
  OR sends Telegram text / invoice photo
         │
         ▼
  Gemini 2.5 Flash (Vision + Text)
  ├─ Stock command detected → Extracts: product name · quantity · in/out
  └─ General message → Conversational Turkish reply (chat mode)
         │
         ▼
  FastAPI backend fuzzy-matches product → appends StockMovement
  (append-only ledger — full audit trail, no overwrites)
         │
         ▼
  Next.js Dashboard:
  · KPI cards · Critical alert banner
  · Stock table (2/3) + Mail Önerileri panel (1/3) side-by-side
  · 7-day Giriş / Çıkış / Hareket summary cards
         │
         ▼
  Manager clicks "Tedarik Analizi Yap"
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
  "Mail Önerileri" panel shows up to 2 cards (expandable):
  · Urgency badge (🔴 Kritik / 🟡 Orta / 🟢 Düşük)
  · Recommended order quantity + AI reasoning
  · Full email preview (collapsible, editable, tone regeneration)
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
| **AI — Chat** | Gemini 2.5 Flash (conversational fallback) |
| **AI — Agents** | CrewAI 1.x · 3-agent sequential crew |
| **Auth** | JWT (python-jose) · HTTP-only cookie · Next.js middleware |
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
│   │                              #   · 15-min proactive stock monitor
│   ├── database.py                # SQLAlchemy engine + session factory
│   ├── models.py                  # ORM: Product · StockMovement · ActionApproval
│   │                              #       Task · Supplier · Notification · User
│   ├── schemas.py                 # Pydantic v2 request/response models
│   ├── crud.py                    # Database layer (append-only stock ledger)
│   ├── seed.py                    # Demo data seeder
│   ├── requirements.txt
│   ├── Dockerfile
│   │
│   ├── routers/
│   │   ├── auth.py                # POST /api/auth/login → JWT cookie
│   │   ├── dashboard.py           # GET /api/dashboard — KPIs + stock + approvals
│   │   ├── webhook.py             # POST /api/webhook/message — AI stock or chat reply
│   │   ├── analysis.py            # POST /api/analyze-stocks — CrewAI trigger
│   │   ├── actions.py             # POST /api/actions/{id}/approve|reject|regenerate
│   │   ├── stock.py               # CRUD /api/products + /api/stock/movement
│   │   │                          #       GET /api/stock/movements (history ledger)
│   │   ├── suppliers.py           # CRUD /api/suppliers
│   │   ├── tasks.py               # CRUD /api/tasks — Kanban board
│   │   ├── analytics.py           # GET /api/analytics/trends + daily-history
│   │   └── notifications.py       # GET /api/notifications + PATCH /{id}/read
│   │
│   └── services/
│       ├── ai_service.py          # Gemini: parse_text · parse_image · chat_reply
│       │                          #         draft_supply_email · regenerate_email_tone
│       ├── crew_service.py        # CrewAI orchestration: run_crew() → list[dict]
│       ├── crew_tools.py          # @tool: get_all_stock_status · get_consumption_rate
│       │                          #         get_movement_history (deterministic urgency)
│       ├── email_service.py       # Gmail API OAuth2 sender
│       ├── product_service.py     # Shared fuzzy product lookup
│       └── telegram_bot.py        # Telegram handlers + morning briefing
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout: Navigation · CopilotSidebar · CopilotFAB
│   │   │                          #              CopilotProvider · Toaster
│   │   ├── globals.css            # Design system tokens
│   │   ├── login/page.tsx         # JWT login form
│   │   ├── page.tsx               # Dashboard: KPIs · alert banner · StockTable (2/3)
│   │   │                          #             Mail Önerileri (1/3) · 7-day stat cards
│   │   ├── stock/page.tsx         # Stock management: Products · Analytics · Hareket Geçmişi tabs
│   │   ├── kanban/page.tsx        # Drag-and-drop Kanban board
│   │   └── suppliers/page.tsx     # Supplier directory
│   │
│   ├── middleware.ts               # Route protection: redirects to /login if no JWT cookie
│   │
│   └── components/
│       ├── ConditionalNavigation.tsx  # Hides nav on /login route
│       ├── Navigation.tsx             # Top nav: page links · notification bell · logout
│       ├── NotificationBar.tsx        # Bell icon + live notification dropdown
│       ├── CopilotContext.tsx         # Global state: isOpen · pendingCount · toggle
│       ├── ui/
│       │   ├── CopilotFAB.tsx         # Fixed vertical pull-tab on right edge (< AI Sohbet)
│       │   ├── CopilotSidebar.tsx     # Slide-out chat drawer: stock commands + free chat
│       │   ├── KpiCard.tsx            # Metric card with alert state + icon
│       │   ├── StockTable.tsx         # Live stock table with progress bars + Kritik/Dikkat/Normal
│       │   ├── ApprovalPanel.tsx      # "Mail Önerileri" — top 2 cards + expand button
│       │   │                          #   AgentInsightStrip · inline email editor · tone regen
│       │   └── StockCharts.tsx        # DaysToEmptyChart + WeeklyFlowChart (used in /stock)
│       └── stock/
│           ├── StockTabs.tsx          # Products / Analiz / Hareket Geçmişi tab switcher
│           ├── StockProductsTab.tsx   # Product table: filters · supplier cell · CSV export
│           ├── StockAnalyticsTab.tsx  # Analytics: risk list + consumption leaders + charts
│           ├── StockHistoryTab.tsx    # Append-only ledger UI: search · type filter · CSV export
│           │                          #   TypeBadge · SourceBadge (Telegram/WhatsApp/Manuel…)
│           ├── StockModals.tsx        # NewProduct · AddStock · RemoveStock · Delete modals
│           └── types.ts               # Shared TypeScript interfaces
│
├── docker-compose.yml
└── README.md
```

---

## Key Features

### AI Copilot Sidebar
A slide-out chat drawer triggered by a fixed vertical pull-tab on the right edge of every page (`< AI Sohbet`). The AI determines intent automatically:
- **Stock command** (`"500 kg buğday teslim alındı"`) → parses with Gemini, records movement, returns confirmation
- **General message** (`"naber?"`, questions) → Gemini responds conversationally in Turkish (chat mode)

The tab shows a red badge with pending approval count. No navbar button — the tab is always accessible.

### Stock Movement History Ledger
The `/stock` page includes a **Hareket Geçmişi** tab showing the full append-only ledger:
- Search by product name, SKU, or notes
- Filter by type (Giriş / Çıkış / Tümü)
- Source badges: Telegram · Telegram (Fotoğraf) · WhatsApp · Web · Fatura · Manuel
- Total in/out summary chips
- CSV export with UTF-8 BOM (Turkish Excel compatible)

### CSV Export
Available in two places:
- **Products tab** (`/stock`) — exports current filtered inventory with status column
- **History tab** (`/stock`) — exports filtered movement log with source and notes

### Mail Önerileri Panel
Sits in the right 1/3 of the dashboard beside the stock table. Shows the top 2 AI-drafted supplier emails by default. A dashed **"Daha fazlası için tıklayınız +N"** button expands to reveal all. Each card includes:
- Urgency badge (Kritik / Orta / Düşük)
- AI reasoning from the crew (2-line strip)
- Collapsible email preview with inline editing
- Tone regeneration (Acil / Resmi / Samimi) via Gemini

### Priority Thresholds
Stock status uses three zones:
- **Kritik** — `current_stock < threshold`
- **Dikkat** — `threshold ≤ current_stock < threshold × 1.2`
- **Normal** — `current_stock ≥ threshold × 1.2`

The AI Crew pre-computes urgency deterministically in Python — the LLM is never allowed to override it.

### Authentication
JWT-based auth with an HTTP-only cookie (`kobi_token`). Next.js middleware blocks all routes except `/login` until authenticated. The dashboard includes a client-side guard that redirects on missing token.

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
  supplier_id (FK)                       whatsapp_text / webhook_image /
  created_at                             invoice_photo / manual)
                              notes
Supplier                    timestamp
  id
  name                      ActionApproval
  email                       id
  phone                       type  (supply_email)
  product_category            payload  (JSON — see AI Crew section)
  notes                       status (pending / approved / rejected)
  created_at                  created_at / updated_at

Task (Kanban)               Notification
  id                          id
  title                       title / body
  status                      type  (alert / stock_update / ai_analysis)
  created_at                  is_read / created_at

User
  id / username / hashed_password
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate → set JWT cookie |
| `GET` | `/api/dashboard` | Live KPIs, stock levels, pending approvals |
| `POST` | `/api/analyze-stocks` | Trigger 3-agent CrewAI analysis (~30s) |
| `POST` | `/api/webhook/message` | AI stock update or chat reply (text or base64 image) |
| `POST` | `/api/actions/{id}/approve` | Approve + send supplier email |
| `POST` | `/api/actions/{id}/reject` | Reject AI-drafted action |
| `POST` | `/api/actions/{id}/regenerate` | Rewrite email with new tone (urgent/formal/friendly) |
| `GET` | `/api/products` | All products with live stock, threshold, supplier |
| `POST` | `/api/products` | Create new product |
| `PATCH` | `/api/products/{id}/supplier` | Assign or remove supplier |
| `DELETE` | `/api/products/{id}` | Delete product + all movements |
| `POST` | `/api/stock/movement` | Manual signed stock movement |
| `GET` | `/api/stock/movements` | Full movement history ledger (limit 300) |
| `GET` | `/api/analytics/trends` | 7-day consumption trends, days-to-empty |
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
| `/login` | JWT login form |
| `/` | Dashboard — KPI cards · critical alert banner · StockTable (2/3) + Mail Önerileri (1/3) · 7-day stat cards |
| `/stock` | Three tabs: **Ürünler** (catalog, CSV export) · **Analiz** (charts, trends) · **Hareket Geçmişi** (ledger, CSV export) |
| `/kanban` | Drag-and-drop task board — 4 columns (Sırada / Kabul Edildi / İşlemde / Tamamlandı) |
| `/suppliers` | Supplier directory — add, inline delete confirmation, category badges |

### Design System

The UI uses a Google 4-color palette mapped to Tailwind custom scales:

| Color | Hex | Usage |
|---|---|---|
| **brand** (Google Blue) | `#0057e7` | CTAs, links, interactive elements |
| **gsuccess** (Google Green) | `#008744` | Success, normal stock, inflow |
| **amber** | `#ffa700` | Warning, medium urgency, Dikkat zone |
| **red** | `#d62d20` | Critical, danger, Kritik zone |

---

## AI Crew — How It Works

When the manager clicks **"Tedarik Analizi Yap"**, a 3-agent sequential crew runs (~30 seconds):

### Agent 1 — Stock Analyst (`Stok Zeka Analisti`)
Has access to 3 live DB tools:
- `get_all_stock_status` — all products with stock_ratio, deficit, is_critical, **urgency (pre-computed deterministically)**
- `get_consumption_rate(product_id, days=7)` — daily avg outgoing movement
- `get_movement_history(product_id, limit=10)` — recent movement log

Urgency is computed in Python before the LLM sees it — the agent is instructed never to override it:
- **HIGH** — `current_stock < threshold`
- **MEDIUM** — `threshold ≤ stock < threshold × 1.2`
- **LOW** — `stock ≥ threshold × 1.2`

### Agent 2 — Supply Planner (`Tedarik Stratejisti`)
Reads Analyst output (no tools — pure reasoning). Calculates:
- `recommended_order_qty = (threshold × 2) − current_stock`
- Writes Turkish reasoning per product
- Priority-sorts by urgency

### Agent 3 — Email Drafter (`Türkçe İş Yazışmaları Uzmanı`)
Reads Planner output. Drafts professional Turkish supplier emails. Returns strict JSON array.

Each `ActionApproval` payload:
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
  "generated_by": "crewai_v1"
}
```

---

## Conversational AI

The `/api/webhook/message` endpoint handles two modes automatically:

| Input | Behaviour |
|---|---|
| Stock command (`"500 kg buğday teslim alındı"`) | Gemini extracts JSON → movement recorded → `status: "success"` |
| Product not found | `status: "warning"` with list of known products |
| General message (`"naber?"`, questions) | `AIParsingError` caught → `chat_reply()` called → `status: "chat"` |
| Image | Gemini Vision → multi-item parse; parse failure returns 422 |

The frontend renders `status: "chat"` responses as plain gray bubbles (no green success tint), making the conversation feel natural.

---

## Telegram Bot

Runs inside FastAPI's asyncio lifespan — no separate process needed.

| Input | Action |
|---|---|
| `/status` | Lists all products with 🟢/🔴 indicators and fill % |
| Text message | Gemini parses → fuzzy match → StockMovement appended |
| Photo (invoice) | Gemini Vision reads all line items → batch movements |

### Background Tasks (in `main.py` lifespan)

| Task | Schedule | Description |
|---|---|---|
| Morning briefing | Daily 08:00 | Full stock status summary to all registered chats |
| Proactive stock monitor | Every 15 minutes | Detects newly-critical products → Telegram alert + notification |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- **Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- **Telegram Bot token** — from [@BotFather](https://t.me/BotFather) *(optional)*
- **Gmail OAuth credentials** — for email sending *(optional)*

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — set GEMINI_API_KEY (and optionally TELEGRAM_BOT_TOKEN)

uvicorn main:app --reload --port 8000

python seed.py   # optional: loads demo products, movements, and a default user
```

API at **http://localhost:8000** · Swagger at **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard at **http://localhost:3000** (redirects to `/login` automatically)

Default credentials (after `seed.py`): `admin` / `admin123`

### 3. Docker

```bash
git clone <repo-url>
cd yzta
cp backend/.env.example backend/.env
# Edit backend/.env — add GEMINI_API_KEY

docker-compose up --build
docker-compose exec backend python seed.py
```

---

## Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Auth
SECRET_KEY=change_me_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=480

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

### Natural-language stock update
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "250 kg buğday teslim alındı"}'
```

### Conversational message
```bash
curl -X POST http://localhost:8000/api/webhook/message \
  -H "Content-Type: application/json" \
  -d '{"text": "merhaba, nasılsın?"}'
# Returns: {"status": "chat", "message": "Merhaba! ..."}
```

### Trigger AI Crew Analysis
```bash
curl -X POST http://localhost:8000/api/analyze-stocks
# ~30 seconds — watch terminal for agent verbose output
```

### Stock movement history
```bash
curl http://localhost:8000/api/stock/movements?limit=50
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
| Append-only stock ledger | Full audit trail; undo = compensating movement, never overwrite |
| Deterministic urgency in Python | LLM was overriding urgency based on raw numbers; pre-computing in the tool removes ambiguity |
| `chat_reply()` fallback in webhook | Single endpoint handles both stock commands and free conversation — no routing complexity on the frontend |
| Vertical pull-tab trigger (not navbar button) | Always visible on every page without nav clutter; the handle communicates affordance naturally |
| 2/3 + 1/3 dashboard layout | Stock table is the primary surface; mail suggestions are secondary but immediately visible without a modal |
| Top-2 default in Mail Önerileri | Keeps the panel compact; most operations are one or two products; full list behind a single click |
| `response_mime_type="application/json"` on Gemini | Eliminates markdown wrapping, forces structured output for stock parsing |
| CrewAI sequential process | Each agent builds on the previous one's context |
| `max_rpm=8` on Crew | Stays under Gemini free-tier rate limit (10 req/min) |
| Human-in-the-loop approvals | Manager can edit subject / body / recipient before any email sends |
| Dikkat zone at 120% of threshold | Gives managers early warning before stock actually goes critical |
| UTF-8 BOM in CSV exports | Required for Turkish characters (ü, ğ, ş) to display correctly in Excel |

---

## Powered By

- [Google Gemini 2.5 Flash](https://deepmind.google/technologies/gemini/) — AI text/image parsing, email drafting, conversational chat
- [CrewAI](https://crewai.com) — Multi-agent orchestration
- [FastAPI](https://fastapi.tiangolo.com) — Backend API
- [Next.js 14](https://nextjs.org) — Frontend dashboard
- [python-telegram-bot](https://python-telegram-bot.org) — Telegram integration
- [Gmail API](https://developers.google.com/gmail/api) — Email delivery
- [Recharts](https://recharts.org) — Stock analytics charts
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) — Kanban drag-and-drop
