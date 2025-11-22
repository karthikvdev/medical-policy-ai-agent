import io
import re
import json
import base64
import tempfile
from typing import List, Tuple, Dict, Any, Optional
from dotenv import load_dotenv
import os
load_dotenv()  # Loads values from .env into environment variables


from PIL import Image
from datetime import datetime

# PDF rendering (optional)
try:
    import fitz  # PyMuPDF
    PYMUPDF_OK = True
except:
    PYMUPDF_OK = False

from elsai_model.openai import OpenAIConnector
from .prompts import SYSTEM_PROMPT
from elsai_ocr_extractors.visionai_extractor import VisionAIExtractor

# Optional elsAI extractors
try:
    from elsai_text_extractors.pypdfloader import PyPDFTextExtractor  # type: ignore
    ELSAI_PDF_OK = True
except Exception:
    PyPDFTextExtractor = None  # type: ignore
    ELSAI_PDF_OK = False

try:
    from elsai_text_extractors.csv_extractor import CSVFileExtractor  # type: ignore
    ELSAI_CSV_OK = True
except Exception:
    CSVFileExtractor = None  # type: ignore
    ELSAI_CSV_OK = False

try:
    from elsai_text_extractors.docx_extractor import DocxTextExtractor  # type: ignore
    ELSAI_DOCX_OK = True
except Exception:
    DocxTextExtractor = None  # type: ignore
    ELSAI_DOCX_OK = False



# ------------------------ LOAD POLICY ------------------------
def load_policy_data(path: str = "policy.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

_POLICY_CACHE: Optional[Dict[str, Any]] = None

def get_policy(path: str = "policy.json") -> Dict[str, Any]:
    global _POLICY_CACHE
    if _POLICY_CACHE is None:
        _POLICY_CACHE = load_policy_data(path)
    return _POLICY_CACHE

def list_insurers() -> List[str]:
    return sorted(list(get_policy().keys()))

def list_plans(insurer: str) -> List[str]:
    policy = get_policy()
    if insurer not in policy:
        return []
    return sorted(list(policy[insurer].keys()))


# ------------------------ OCR VIA LLM VISION ------------------------
def pil_to_data_url(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return f"data:image/{fmt.lower()};base64,{base64.b64encode(buf.getvalue()).decode()}"


def _resp_text(resp) -> str:
    """Normalize elsai / OpenAI response → clean assistant text."""
    try:
        if hasattr(resp, "choices") and resp.choices:
            ch = resp.choices[0]
            if hasattr(ch, "message") and hasattr(ch.message, "content"):
                return ch.message.content.strip()
            if hasattr(ch, "text"):
                return ch.text.strip()
        if isinstance(resp, dict) and "choices" in resp:
            ch = resp["choices"][0]
            if "message" in ch and isinstance(ch["message"], dict):
                return ch["message"].get("content", "").strip()
            if "text" in ch:
                return ch["text"].strip()
        if hasattr(resp, "content"):
            return resp.content.strip()
    except:
        pass
    return str(resp).strip()


def extract_text_from_image(img: Image.Image, vision_client: OpenAIConnector) -> str:
    data_url = pil_to_data_url(img)
    messages = [
        {"role": "system", "content": "Extract text exactly. Do NOT summarize."},
        {"role": "user", "content": [
            {"type": "text", "text": "Extract all text:"},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]}
    ]
    resp = vision_client.invoke(messages)
    return _resp_text(resp)

_CHAT_CLIENT: Optional[OpenAIConnector] = None
_VISION_CLIENT: Optional[OpenAIConnector] = None

def get_clients() -> Tuple[OpenAIConnector, OpenAIConnector]:
    global _CHAT_CLIENT, _VISION_CLIENT
    if _CHAT_CLIENT is None or _VISION_CLIENT is None:
        _CHAT_CLIENT, _VISION_CLIENT = build_clients()
    return _CHAT_CLIENT, _VISION_CLIENT

def ocr_image_from_inputs(image_data_url: Optional[str], image_base64: Optional[str]) -> str:
    _, vision = get_clients()
    raw_b64: Optional[str] = None
    if image_data_url and "," in image_data_url:
        raw_b64 = image_data_url.split(",", 1)[1]
    elif image_base64:
        raw_b64 = image_base64
    if not raw_b64:
        raise ValueError("No image data provided")
    try:
        img_bytes = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Invalid image data: {e}")
    return extract_text_from_image(img, vision)

def ocr_pdf_from_base64(pdf_base64: str) -> str:
    _, vision = get_clients()
    try:
        raw = pdf_base64.split(",", 1)[1] if "base64," in pdf_base64 else pdf_base64
        pdf_bytes = base64.b64decode(raw)
    except Exception as e:
        raise ValueError(f"Invalid pdf_base64: {e}")
    # Prefer elsAI PDF extractor if available
    if ELSAI_PDF_OK and PyPDFTextExtractor is not None:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
                tmp.write(pdf_bytes)
                tmp.flush()
                extractor = PyPDFTextExtractor(file_path=tmp.name)  # type: ignore
                text = extractor.extract_text_from_pdf()
                if isinstance(text, (list, tuple)):
                    text = "\n\n".join([str(t) for t in text])
                text = str(text or "").strip()
                if text:
                    return text
                print("[OCR] elsAI PDF extractor returned empty text, trying fallback")
        except Exception as e:
            print(f"[OCR] elsAI PDF extractor failed: {e}, trying fallback")
    if PYMUPDF_OK:
        try:
            text = extract_text_from_pdf(pdf_bytes, vision)
            if text and not text.startswith("PDF OCR requires"):
                print(f"[OCR] PyMuPDF fallback succeeded, extracted {len(text)} characters")
                return text
        except Exception as e:
            print(f"[OCR] PyMuPDF fallback failed: {e}")
    return "Unable to extract text from PDF. Please ensure the file is valid."

def extract_csv_from_base64(csv_base64: str) -> Any:
    if not (ELSAI_CSV_OK and CSVFileExtractor is not None):
        raise RuntimeError("CSV extractor not available")
    try:
        csv_bytes = base64.b64decode(csv_base64)
    except Exception as e:
        raise ValueError(f"Invalid csv_base64: {e}")
    try:
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=True) as tmp:
            tmp.write(csv_bytes)
            tmp.flush()
            extractor = CSVFileExtractor(file_path=tmp.name)  # type: ignore
            return extractor.load_from_csv()
    except Exception as e:
        raise RuntimeError(f"CSV extraction failed: {e}")

def extract_docx_from_base64(docx_base64: str) -> str:
    if not (ELSAI_DOCX_OK and DocxTextExtractor is not None):
        raise RuntimeError("DOCX extractor not available")
    try:
        docx_bytes = base64.b64decode(docx_base64)
    except Exception as e:
        raise ValueError(f"Invalid docx_base64: {e}")
    try:
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=True) as tmp:
            tmp.write(docx_bytes)
            tmp.flush()
            extractor = DocxTextExtractor(file_path=tmp.name)  # type: ignore
            text = extractor.extract_text_from_docx()
            return str(text or "")
    except Exception as e:
        raise RuntimeError(f"DOCX extraction failed: {e}")


def extract_text_from_pdf(file_bytes: bytes, vision_client: OpenAIConnector) -> str:
    if not PYMUPDF_OK:
        return "PDF OCR requires `pip install pymupdf`"

    pages = []
    try:
        print("extract_text_from_pdf")
        size = len(file_bytes)
        print(f"PDF bytes size: {size}")
    except Exception:
        pass
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            native = page.get_text()
            if native.strip():
                pages.append(native)
            else:
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                try:
                    pages.append(extract_text_from_image(img, vision_client))
                except Exception as e:
                    pages.append("")
                    print(f"Image OCR failed on a page: {e}")
    return "\n\n".join(pages)


def build_clients():
    api_key = os.getenv("OPENAI_API_KEY")
    chat = OpenAIConnector(model_name="gpt-4o-mini", openai_api_key=api_key)
    vision = OpenAIConnector(model_name="gpt-4o-mini", openai_api_key=api_key)
    return chat, vision



def chat_with_history(chat_client, history, policy, bill_text, policy_status, user_input):
    system_msg = SYSTEM_PROMPT + f"\n\nPOLICY:\n{json.dumps(policy)}\n\nBILL:\n{bill_text}\n\nCURRENT_DATETIME:\n{datetime.now().isoformat()}\n\nCLAIM_STATUS:\n{policy_status}\n"

    if not history or history[0]["role"] != "system":
        history.insert(0, {"role": "system", "content": system_msg})
    else:
        history[0]["content"] = system_msg

    history.append({"role": "user", "content": user_input})

    resp = chat_client.invoke(history)
    reply = _resp_text(resp)

    history.append({"role": "assistant", "content": reply})
    return reply


# ------------------------ NON-PAYABLE + TOTAL HELPERS ------------------------
def parse_total_amount(text: str):
    lines = text.splitlines()
    patterns = [
        r'net\s*payable', r'amount\s*payable',
        r'grand\s*total', r'\btotal\b'
    ]
    for p in patterns:
        for ln in reversed(lines):
            if re.search(p, ln, re.I):
                vals = re.findall(r'\b\d+(?:\.\d{1,2})?\b', ln)
                if vals:
                    return float(vals[-1])
    return None


def sum_non_payables(text: str, keywords: List[str]) -> Tuple[float, List[Tuple[str, float]]]:
    hits = []
    for kw in keywords:
        for ln in text.splitlines():
            if re.search(rf'\b{kw}\b', ln, re.I):
                nums = re.findall(r'\b\d+(?:\.\d{1,2})?\b', ln)
                if nums:
                    hits.append((kw, float(nums[-1])))
    return sum(v for _, v in hits), hits

