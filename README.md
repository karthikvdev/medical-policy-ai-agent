# Hospital Claim Transparency (elsAI CORE)

Agent system for transparent cashless insurance claims. Backend is FastAPI + elsai-model with PostgreSQL for chat history persistence; frontend is Vite React. Includes OCR (images/PDF), CSV/DOCX extractors, conversation management, and an LLM chat grounded on a policy JSON + bill text.

## Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ (only if running frontend locally)
- Docker + Docker Compose (optional, recommended for all-in-one run)
- PostgreSQL 15+ (automatically provided via Docker Compose)
- Environment variables:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_MODEL_NAME` (default: `gpt-4o-mini`)
  - `OPENAI_TEMPERATURE` (default: `0.1`)
  - `DATABASE_URL` (default: `postgresql+asyncpg://hospital_user:hospital_pass@localhost:5435/hospital_bill`)
  - `POSTGRES_USER` (default: `hospital_user`)
  - `POSTGRES_PASSWORD` (default: `hospital_pass`)
  - `POSTGRES_DB` (default: `hospital_bill`)

## Installation (backend only, local)

```bash
cd /home/pc/projects/ai-agents/hospital-bill
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=your_openai_api_key
```

This installs:
- `elsai-model==1.2.1` from its custom index
- `elsai-text-extractors==0.1.1` for CSV/DOCX/PDF (PyPDF) extractors
- `pymupdf` for OCR fallback when extractor isn't applicable
- `sqlalchemy>=2.0.0`, `asyncpg>=0.29.0`, `alembic>=1.13.0` for PostgreSQL database support

## Run with Docker (frontend + backend + database)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- PostgreSQL Database: localhost:5435
- Hot reload is enabled for both services via bind mounts and `--reload` / Vite HMR.
- Database tables are automatically created on startup.

## Key API Endpoints (backend)

- Health: `GET /health`
- Policy:
  - `GET /policy` — returns `policy.json` (cached)
  - `GET /insurers` — list of insurers
  - `GET /plans?insurer=HDFC` — plans for an insurer
- OCR:
  - `POST /ocr/image` — body: `{ "image_data_url": "data:image/png;base64,..."}`
  - `POST /ocr/pdf` — body: `{ "pdf_base64": "data:application/pdf;base64,..."}`
- Extractors:
  - `POST /extract/csv` — body: `{ "csv_base64": "YSxiCjEsMg==" }`
  - `POST /extract/docx` — body: `{ "docx_base64": "<BASE64>" }`
- **Conversations** (NEW):
  - `POST /conversations` — Create new conversation: `{ "insurer": "HDFC", "plan": "SILVER", "bill_text": "..." }`
  - `GET /conversations` — List all conversations (sorted by most recent)
  - `GET /conversations/{id}` — Get conversation details with message history
  - `DELETE /conversations/{id}` — Delete a conversation and all its messages
- Chat:
  - `POST /chat` — Send message in conversation: `{ "conversation_id": 1, "user_input": "What will insurance pay?" }`
  - Returns reply and full message history
- Utilities:
  - `POST /parse-total` — `{ text }`
  - `POST /sum-non-payables` — `{ text, keywords }`

All endpoints have live examples in Swagger UI (/docs).

## Features

### Chat History Persistence
- All conversations and messages are stored in PostgreSQL database
- Each conversation is linked to a specific insurer, plan, and bill
- Messages are automatically saved with timestamps
- Complete conversation history is maintained and can be retrieved

### New Chat Feature
- Click "New Chat" button to start a fresh conversation with a new bill
- Previous conversations are listed in the sidebar
- Click any previous conversation to view/continue that chat
- Each conversation maintains its own context and history

## Notes

- PDF text flow:
  - Tries `elsai-text-extractors` PyPDF first (0.1.1 extracts all pages)
  - Falls back to PyMuPDF + vision OCR if needed
- System prompt enforces:
  - Single-value questions: one short sentence (e.g., "Your total bill is ₹12,345.00.")
  - Detailed breakdown only when explicitly requested ("breakdown", "split up", "details")
- Frontend reads insurer/plan via the backend (`/insurers`, `/plans`) and sends OCR + chat calls to the backend
- Database schema:
  - `conversations` table: stores conversation metadata (insurer, plan, bill_text, timestamps)
  - `messages` table: stores individual messages (role, content, timestamps) linked to conversations
  - Foreign key relationship with CASCADE delete ensures messages are deleted when conversation is deleted

## Database Management

### View Database
```bash
# Connect to PostgreSQL container
docker compose exec db psql -U hospital_user -d hospital_bill

# List tables
\dt

# View conversations
SELECT * FROM conversations;

# View messages
SELECT * FROM messages;

# Exit
\q
```

### Reset Database
```bash
# Stop containers
docker compose down

# Remove database volume
docker volume rm hospital-bill_postgres_data

# Start fresh
docker compose up --build
```
