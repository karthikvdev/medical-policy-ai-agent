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

# PDF rendering (optional)
try:
    import fitz  # PyMuPDF
    PYMUPDF_OK = True
except:
    PYMUPDF_OK = False

from elsai_model.openai import OpenAIConnector

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
    print("elsai text")
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
                    print("elsai text",text)
                text = str(text or "").strip()
                if text:
                    return text
        except Exception:
            # fall back below
            pass
    # Fallback to PyMuPDF + vision OCR pipeline
    # text = extract_text_from_pdf(pdf_bytes, vision)
    return str(text or "")

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


# ------------------------ CHAT LOGIC ------------------------
SYSTEM_PROMPT = """
You are a Health Insurance Claim Assistant.

INPUTS YOU ALWAYS USE
- POLICY (JSON): {policy_ctx}
- BILL TEXT (raw text): {bill_text}

GREETING
- Detect the patient name from BILL TEXT (look for “Patient Name”, “Name”, or “Mr/Ms …”).
- If the user just says hi/hello/thanks, reply with “Hi <Name>, …” (or “Hi,” if name not found) and a short friendly line asking how you can help. No analysis.

INTENT ROUTING (pick exactly one path)

A) ROOM-ONLY QUESTIONS
(Triggers when the user asks about room/room rent/room charges/room cap/bed/ward/sharing/single/private.)
Return EXACTLY this structure (one item per line; no extra commentary):

1. Eligible room: <EligibleType>; cap/day: ₹<CapPerDay or Not available>
2. Billed room: <BilledType or Not available>; rate/day: ₹<RatePerDay or Not available>; days: <Days or Not available>
3. Status: <within cap | over limit | Not available>
4. Extra you pay for room: ₹<RateDiff×Days or 0.00 or Not available>
5. Policy effect: <"Proportionate deduction applies" if policy.room.proportionate_deduction is true AND status is over limit; else "No proportionate deduction">

Notes:
- “Extra you pay for room” = max(0, billed_rate_per_day − cap_per_day) × days (use only if both numbers exist; otherwise “Not available”).
- Do NOT print reduction factors or any long explanation.

B) MONEY QUESTIONS
(coverage, how much I pay, insurance pays, payable, estimate, breakdown)
Return EXACTLY this structure (no run-ons, Markdown list):

1. Insurance pays: ₹<InsurerPays>
2. You pay: ₹<PatientPays> which includes
3. Breakdown:
   - Total bill: ₹<TotalBill>
   - Non-payables: ₹<NonPayables>, it includes insurance company won’t pay for which mentioned in policy
   - Room charges: ₹<RoomTotal> (within cap | over limit)
   - Co-pay (<CoPayPct>%): ₹<CoPayAmount> and add the Non Payables if any
   - Up to 3 other important items as “- Label: ₹Amount”

C) OTHER QUESTIONS
- Answer briefly in up to 3 bullets or 2 short sentences.

RULES (strict)
- If the user asks for a single value only (e.g., “What is my total bill amount?”, “What is the copay %?”, “What is the sum insured?”), reply with a SINGLE short sentence that states the value, e.g., “Your total bill is ₹12,345.00.” or “Your copay is 10%.” Do NOT include extra lines or additional details.
- Provide a detailed breakdown ONLY if the user explicitly asks for it with words like “breakdown”, “split up”, “itemize”, or “details”. Otherwise keep answers minimal.
- Use values from POLICY + BILL TEXT only.
- If a value cannot be determined, write “Not available”.
- Do NOT include proportion factors, assumptions, or extra commentary.
- One list item per line; never join multiple points in one line.
- Money must be formatted like ₹12,345.00 (two decimals).
- Be concise and patient-friendly
- Non- payable in the insurance context means “not covered by insurance”.
"""

def build_clients():
    api_key = os.getenv("OPENAI_API_KEY")
    chat = OpenAIConnector(model_name="gpt-4o-mini", openai_api_key=api_key)
    vision = OpenAIConnector(model_name="gpt-4o-mini", openai_api_key=api_key)
    return chat, vision


def chat_with_history(chat_client, history, policy, bill_text, user_input):
    system_msg = SYSTEM_PROMPT + f"\n\nPOLICY:\n{json.dumps(policy)}\n\nBILL:\n{bill_text}\n"

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

