from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    history: List[ChatMessage] = Field(default_factory=list)
    policy: Dict[str, Any]
    bill_text: str
    user_input: str
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "history": [{"role": "system", "content": "You are helpful."}],
                    "policy": {"HDFC": {"SILVER": {"sum_insured": 300000}}},
                    "bill_text": "Total: 350000\nRoom: Private",
                    "user_input": "What will insurance pay?",
                }
            ]
        }
    }


class ChatResponse(BaseModel):
    reply: str
    history: List[ChatMessage]


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
def chat(req: ChatRequest) -> ChatResponse:
    history_dicts = [m.model_dump() for m in req.history]
    chat_client, _ = get_clients()
    reply = chat_with_history(chat_client, history_dicts, req.policy, req.bill_text, req.user_input)
    # history_dicts mutated in-place by chat_with_history; convert back
    history_models = [ChatMessage(**m) for m in history_dicts]
    return ChatResponse(reply=reply, history=history_models)


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

