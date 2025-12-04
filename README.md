# Hospital Claim Transparency (elsAI CORE)

Agent system for transparent cashless insurance claims. Backend is FastAPI + elsai-model with PostgreSQL for chat history persistence; frontend is Vite React. Includes OCR (images/PDF), CSV/DOCX extractors, conversation management, and an LLM chat grounded on a policy JSON + bill text.

## Supported File Formats

- **PDF**: Hospital bills in PDF format (digital or scanned)
- **Images**: JPEG, PNG formats for scanned bills
- **CSV**: Structured bill data in CSV format
- **DOCX**: Microsoft Word documents (including .doc)

## Prerequisites

- **Docker + Docker Compose** (recommended for all-in-one run)
- **OpenAI API Key**
- **Python 3.10+** (3.11 recommended) - only if running backend locally
- **Node.js 18+** - only if running frontend locally
- **PostgreSQL 15+** - automatically provided via Docker Compose

### Required Environment Variables

**Must be set before running:**
```bash
BACKEND_PORT=8080
FRONTEND_PORT=5173
OPENAI_API_KEY=your_openai_api_key_here
```

## Run with Docker (frontend + backend + database)

### ⚠️ IMPORTANT: Set Environment Variables First

**Must be set before running:**
```bash
BACKEND_PORT=8080
FRONTEND_PORT=5173
OPENAI_API_KEY=your_openai_api_key_here
```

### Start the Application

```bash
docker compose up --build
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/docs
- PostgreSQL Database: localhost:5435

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

All endpoints have live examples in Swagger UI (/docs).

## Features

### Multi-Format Document Processing
- **PDF Processing**: Extracts text using elsai-text-extractors with PyMuPDF fallback
- **Image OCR**: Processes JPEG/PNG images using GPT-4o-mini Vision API
- **CSV Extraction**: Parses structured CSV data into readable format
- **DOCX Extraction**: Extracts text from Microsoft Word documents
- Smart file type detection and automatic routing to appropriate extractor

### Chat History Persistence
- All conversations and messages are stored in PostgreSQL database
- Each conversation is linked to a specific insurer, plan, and bill
- Messages are automatically saved with timestamps
- Complete conversation history is maintained and can be retrieved

### Conversation Management
- Click "New Chat" button to start a fresh conversation with a new bill
- Previous conversations are listed in the sidebar
- Click any previous conversation to view/continue that chat
- Delete conversations individually with confirmation dialog
- Each conversation maintains its own context and history

### Intelligent Coverage Estimation
- Real-time insurance coverage calculations based on policy rules
- Range-based estimates (conservative to optimistic)
- Transparent explanations for all deductions
- Room category analysis and proportionate deductions
- Co-payment calculations
- Timeline predictions for claim approvals

## Technical Details

### Document Processing Flow
- **PDF**: 
  - Tries `elsai-text-extractors` PyPDF first (extracts all pages)
  - Falls back to PyMuPDF + GPT-4o-mini vision OCR if PyPDF fails
- **Images**: 
  - Direct processing via GPT-4o-mini Vision API
  - Supports handwritten notes and complex layouts
- **CSV**: 
  - Uses `elsai-text-extractors` CSV loader
  - Converts to structured JSON format
- **DOCX**: 
  - Uses `elsai-text-extractors` DOCX extractor
  - Preserves formatting and structure

### AI Behavior
- System prompt enforces:
  - Single-value questions: one short sentence (e.g., "Your total bill is ₹12,345.00.")
  - Detailed breakdown only when explicitly requested ("breakdown", "split up", "details")
  - Intent-based routing for different query types (coverage, timeline, room analysis)
  - Grounded responses based on policy JSON and extracted bill text

### Architecture
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: FastAPI (async) + Python 3.11
- **Database**: PostgreSQL 15 with async SQLAlchemy ORM
- **AI**: OpenAI GPT-4o-mini (chat + vision)
- **elsAI Integration**: 
  - elsai-model for OpenAI connectivity
  - elsai-text-extractors for document processing

### Database Schema
- **conversations** table: 
  - Stores conversation metadata (insurer, plan, bill_text, policy_status)
  - Timestamps for created_at and updated_at
- **messages** table: 
  - Stores individual messages (role, content, timestamps)
  - Linked to conversations via foreign key
  - CASCADE delete ensures messages are removed when conversation is deleted

## Documentation

- **[Hackathon Report](https://docs.google.com/document/d/1oXkpSywrdVh8z85L9zAuEmW4e1C-s8f-qq-nrmAuAmY/edit?tab=t.0#heading=h.5wti5n6z2xvr)**: Complete technical specification
- **[Architecture Diagram](https://drive.google.com/file/d/1R2cAsI1ky3wEii3Q2pI1BVtRbNEMUD_F/view)**: Visual architecture diagrams
