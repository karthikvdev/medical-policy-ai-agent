from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .main import (
    get_policy,
    list_insurers,
    list_plans,
    get_clients,
    ocr_image_from_inputs,
    ocr_pdf_from_base64,
    extract_csv_from_base64,
    extract_docx_from_base64,
    chat_with_history,
    parse_total_amount,
    sum_non_payables,
)
from .database import get_db, init_db, close_db
from .models import Conversation, Message


app = FastAPI(
    title="Hospital Claim Transparency API",
    version="0.1.0",
    description=(
        "APIs for OCR (image/PDF), document text extraction (CSV/DOCX), "
        "policy discovery, and LLM-backed chat for claim transparency."
    ),
    contact={"name": "Hospital Bill Team"},
    license_info={"name": "Proprietary"},
    openapi_tags=[
        {"name": "Health", "description": "Service health and readiness."},
        {"name": "Policy", "description": "Policy and plan discovery APIs."},
        {"name": "OCR", "description": "OCR for images and PDFs."},
        {"name": "Extractors", "description": "Structured extractors for CSV and DOCX."},
        {"name": "Conversations", "description": "Conversation and chat history management."},
        {"name": "Chat", "description": "LLM chat with policy and bill context."},
        {"name": "Utilities", "description": "Helpers for parsing totals and non-payables."},
    ],
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    await init_db()


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown."""
    await close_db()


# Clients and policy cache are handled in main.py


@app.get("/health", tags=["Health"])
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/policy", tags=["Policy"])
def policy() -> Dict[str, Any]:
    return get_policy()


@app.get("/insurers", tags=["Policy"])
def insurers() -> List[str]:
    return list_insurers()


@app.get("/plans", tags=["Policy"])
def plans(insurer: str) -> List[str]:
    result = list_plans(insurer)
    if not result:
        raise HTTPException(status_code=404, detail=f"Unknown insurer '{insurer}'")
    return result


class OCRImageRequest(BaseModel):
    image_base64: Optional[str] = Field(default=None, description="Base64 of image bytes")
    image_data_url: Optional[str] = Field(default=None, description="Data URL: data:image/png;base64,...")
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "image_data_url": "data:image/png;base64,iVBORw0KGgoAAA...",
                    "image_base64": None,
                }
            ]
        }
    }


class OCRResponse(BaseModel):
    text: str


@app.post("/ocr/image", response_model=OCRResponse, tags=["OCR"])
def ocr_image(req: OCRImageRequest) -> OCRResponse:
    try:
        text = ocr_image_from_inputs(req.image_data_url, req.image_base64)
        return OCRResponse(text=text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR image failed: {e}")


class OCRPdfRequest(BaseModel):
    pdf_base64: str
    model_config = {
        "json_schema_extra": {
            "examples": [
                {"pdf_base64": "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr..."}
            ]
        }
    }


@app.post("/ocr/pdf", response_model=OCRResponse, tags=["OCR"])
def ocr_pdf(req: OCRPdfRequest) -> OCRResponse:
    try:
        text = ocr_pdf_from_base64(req.pdf_base64)
        return OCRResponse(text=text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR pdf failed: {e}")


# ---------- CSV extraction ----------
class CSVExtractRequest(BaseModel):
    csv_base64: str
    model_config = {
        "json_schema_extra": {
            "examples": [
                {"csv_base64": "YSxiCjEsMg=="}  # base64 for "a,b\n1,2"
            ]
        }
    }


class CSVExtractResponse(BaseModel):
    data: Any


@app.post("/extract/csv", response_model=CSVExtractResponse, tags=["Extractors"])
def extract_csv(req: CSVExtractRequest) -> CSVExtractResponse:
    try:
        data = extract_csv_from_base64(req.csv_base64)
        return CSVExtractResponse(data=data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV extraction failed: {e}")


# ---------- DOCX extraction ----------
class DocxExtractRequest(BaseModel):
    docx_base64: str
    model_config = {
        "json_schema_extra": {
            "examples": [
                {"docx_base64": "UEsDBBQABgAIAAAAIQAAAAAAAAAAAAAAAAAJAAAAd29yZC9fcmVscy8="}
            ]
        }
    }


class DocxExtractResponse(BaseModel):
    text: str


@app.post("/extract/docx", response_model=DocxExtractResponse, tags=["Extractors"])
def extract_docx(req: DocxExtractRequest) -> DocxExtractResponse:
    try:
        text = extract_docx_from_base64(req.docx_base64)
        return DocxExtractResponse(text=text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX extraction failed: {e}")


# ========== Conversation Management ==========

class CreateConversationRequest(BaseModel):
    insurer: str
    plan: str
    bill_text: Optional[str] = None
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "insurer": "HDFC",
                    "plan": "SILVER",
                    "bill_text": "Total: 350000\nRoom: Private"
                }
            ]
        }
    }


class ConversationResponse(BaseModel):
    id: int
    insurer: str
    plan: str
    bill_text: Optional[str]
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class ConversationDetailResponse(BaseModel):
    id: int
    insurer: str
    plan: str
    bill_text: Optional[str]
    created_at: str
    updated_at: str
    messages: List[MessageResponse]


@app.post("/conversations", response_model=ConversationResponse, tags=["Conversations"])
async def create_conversation(
    req: CreateConversationRequest,
    db: AsyncSession = Depends(get_db)
) -> ConversationResponse:
    """Create a new conversation."""
    conversation = Conversation(
        insurer=req.insurer,
        plan=req.plan,
        bill_text=req.bill_text
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)
    
    return ConversationResponse(
        id=conversation.id,
        insurer=conversation.insurer,
        plan=conversation.plan,
        bill_text=conversation.bill_text,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat()
    )


@app.get("/conversations", response_model=List[ConversationResponse], tags=["Conversations"])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0
) -> List[ConversationResponse]:
    """List all conversations."""
    result = await db.execute(
        select(Conversation)
        .order_by(desc(Conversation.updated_at))
        .limit(limit)
        .offset(offset)
    )
    conversations = result.scalars().all()
    
    return [
        ConversationResponse(
            id=conv.id,
            insurer=conv.insurer,
            plan=conv.plan,
            bill_text=conv.bill_text,
            created_at=conv.created_at.isoformat(),
            updated_at=conv.updated_at.isoformat()
        )
        for conv in conversations
    ]


@app.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse, tags=["Conversations"])
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
) -> ConversationDetailResponse:
    """Get a specific conversation with its messages."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return ConversationDetailResponse(
        id=conversation.id,
        insurer=conversation.insurer,
        plan=conversation.plan,
        bill_text=conversation.bill_text,
        created_at=conversation.created_at.isoformat(),
        updated_at=conversation.updated_at.isoformat(),
        messages=[
            MessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at.isoformat()
            )
            for msg in sorted(conversation.messages, key=lambda m: m.created_at)
        ]
    )


@app.delete("/conversations/{conversation_id}", tags=["Conversations"])
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, str]:
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    await db.delete(conversation)
    return {"status": "success", "message": "Conversation deleted"}


# ========== Chat ==========

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    conversation_id: int
    user_input: str
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "conversation_id": 1,
                    "user_input": "What will insurance pay?",
                }
            ]
        }
    }


class ChatResponse(BaseModel):
    reply: str
    conversation_id: int
    messages: List[MessageResponse]


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db)
) -> ChatResponse:
    """Send a message in a conversation and get a response."""
    # Get conversation
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == req.conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get policy
    policy_data = get_policy()
    if conversation.insurer not in policy_data:
        raise HTTPException(status_code=400, detail=f"Unknown insurer '{conversation.insurer}'")
    if conversation.plan not in policy_data[conversation.insurer]:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{conversation.plan}'")
    
    policy = policy_data[conversation.insurer][conversation.plan]
    
    # Build history from existing messages
    history_dicts = [
        {"role": msg.role, "content": msg.content}
        for msg in sorted(conversation.messages, key=lambda m: m.created_at)
    ]
    
    # Get response
    chat_client, _ = get_clients()
    reply = chat_with_history(
        chat_client,
        history_dicts,
        policy,
        conversation.bill_text or "",
        req.user_input
    )
    
    # Save user message and assistant reply
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=req.user_input
    )
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=reply
    )
    
    db.add(user_message)
    db.add(assistant_message)
    await db.flush()
    await db.refresh(user_message)
    await db.refresh(assistant_message)
    
    # Update conversation timestamp
    conversation.updated_at = assistant_message.created_at
    
    # Get all messages for response
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    all_messages = result.scalars().all()
    
    return ChatResponse(
        reply=reply,
        conversation_id=conversation.id,
        messages=[
            MessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at.isoformat()
            )
            for msg in all_messages
        ]
    )


class ParseTotalRequest(BaseModel):
    text: str
    model_config = {
        "json_schema_extra": {
            "examples": [{"text": "Grand Total: 12345.00 INR"}]
        }
    }


class ParseTotalResponse(BaseModel):
    total: Optional[float]


@app.post("/parse-total", response_model=ParseTotalResponse, tags=["Utilities"])
def parse_total(req: ParseTotalRequest) -> ParseTotalResponse:
    return ParseTotalResponse(total=parse_total_amount(req.text))


class SumNonPayablesRequest(BaseModel):
    text: str
    keywords: List[str]
    model_config = {
        "json_schema_extra": {
            "examples": [
                {"text": "consumables 500\nregistration_fee 300", "keywords": ["consumables", "registration_fee"]}
            ]
        }
    }


class SumNonPayablesResponse(BaseModel):
    total: float
    items: List[Tuple[str, float]]


@app.post("/sum-non-payables", response_model=SumNonPayablesResponse, tags=["Utilities"])
def sum_non_payables_api(req: SumNonPayablesRequest) -> SumNonPayablesResponse:
    total, items = sum_non_payables(req.text, req.keywords)
    return SumNonPayablesResponse(total=total, items=items)


def get_app() -> FastAPI:
    return app

