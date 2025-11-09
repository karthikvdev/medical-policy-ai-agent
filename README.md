# Hospital Claim Transparency (elsAI CORE)

Agent system for transparent cashless insurance claims. Backend is FastAPI + elsai-model; frontend is Vite React. Includes OCR (images/PDF), CSV/DOCX extractors, and an LLM chat grounded on a policy JSON + bill text.

## Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ (only if running frontend locally)
- Docker + Docker Compose (optional, recommended for all-in-one run)
- Environment variables:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_MODEL_NAME` (default: `gpt-4o-mini`)
  - `OPENAI_TEMPERATURE` (default: `0.1`)

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
- `pymupdf` for OCR fallback when extractor isn’t applicable

## Run with Docker (frontend + backend)

```bash
cd /home/pc/projects/ai-agents/hospital-bill
export OPENAI_API_KEY=your_openai_api_key
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Hot reload is enabled for both services via bind mounts and `--reload` / Vite HMR.

## Run backend locally (without Docker)

```bash
cd /home/pc/projects/ai-agents/hospital-bill
source .venv/bin/activate
uvicorn backend.api:app --reload --host 0.0.0.0 --port 8080
```

API docs:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc
- OpenAPI JSON: http://localhost:8080/openapi.json

## Run frontend locally (without Docker)

```bash
cd /home/pc/projects/ai-agents/hospital-bill/frontend
npm install
VITE_API_URL=http://localhost:8080 npm run dev -- --host 0.0.0.0 --port 5173
```

Open http://localhost:5173

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
- Chat:
  - `POST /chat` — `{ history, policy, bill_text, user_input }`
- Utilities:
  - `POST /parse-total` — `{ text }`
  - `POST /sum-non-payables` — `{ text, keywords }`

All endpoints have live examples in Swagger UI (/docs).

## Notes

- PDF text flow:
  - Tries `elsai-text-extractors` PyPDF first (0.1.1 extracts all pages)
  - Falls back to PyMuPDF + vision OCR if needed
- System prompt enforces:
  - Single-value questions: one short sentence (e.g., “Your total bill is ₹12,345.00.”)
  - Detailed breakdown only when explicitly requested (“breakdown”, “split up”, “details”)
- Frontend reads insurer/plan via the backend (`/insurers`, `/plans`) and sends OCR + chat calls to the backend.
