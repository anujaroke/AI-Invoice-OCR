import os
import io
import json
import base64
import re
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core import exceptions as g_exceptions
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
from PIL import Image
from pydantic import BaseModel
import uvicorn

load_dotenv()

def get_int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default

def get_csv_env(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [value.strip() for value in raw.split(',') if value.strip()]

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()
MAX_PDF_PAGES = max(1, get_int_env("MAX_PDF_PAGES", 15))
MAX_UPLOAD_SIZE_MB = max(1, get_int_env("MAX_UPLOAD_SIZE_MB", 10))

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_csv_env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_gemini_response(text: str) -> str:
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError("No valid JSON found in response")
    return text[start:end+1].strip()

def process_file_to_base64_images(file_bytes: bytes, filename: str, content_type: Optional[str]) -> List[str]:
    allowed_ext = {"pdf", "jpg", "jpeg", "png"}
    ext = filename.lower().split(".")[-1]
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail={"error": "Invalid file type. Please upload PDF, JPG, or PNG only"})

    if not file_bytes:
        raise HTTPException(status_code=400, detail={"error": "File appears to be empty or corrupted"})

    if ext == "pdf":
        try:
            poppler_path = os.getenv("POPPLER_PATH")
            pdf_info = pdfinfo_from_bytes(file_bytes, poppler_path=poppler_path)
            page_count = int(pdf_info.get("Pages") or 0)
            if page_count <= 0:
                raise ValueError("No pages found")

            if page_count > MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=400,
                    detail={"error": f"PDF has {page_count} pages. Maximum supported is {MAX_PDF_PAGES} pages"}
                )

            images = convert_from_bytes(file_bytes, poppler_path=poppler_path)
            if not images:
                raise ValueError("No pages found")

            encoded_pages: List[str] = []
            for image in images:
                rgb_image = image.convert("RGB")
                buffered = io.BytesIO()
                rgb_image.save(buffered, format="PNG")
                encoded_pages.append(base64.b64encode(buffered.getvalue()).decode("utf-8"))

            return encoded_pages
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=422, detail={"error": "Could not read PDF. Try uploading as JPG or PNG instead"})

    return [base64.b64encode(file_bytes).decode("utf-8")]

class ParseRequest(BaseModel):
    text: str

@app.post("/ocr")
async def extract_raw_text(file: UploadFile = File(...)):
    file_bytes = await file.read()
    max_size = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_bytes or b"") > max_size:
        raise HTTPException(status_code=400, detail={"error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE_MB}MB"})

    base64_images = process_file_to_base64_images(file_bytes, file.filename, file.content_type)

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        prompt = '''You are an expert Indian GST invoice data extraction engine.
    You will receive one or more invoice pages (for PDFs, all pages are provided in order).
    Treat all pages as part of the same invoice document.
    You must merge information across pages, including item tables that continue on later pages.

    The invoice pages could be:
- A printed/typed formal invoice
- A handwritten invoice
- A scanned or photographed bill
- A WhatsApp forwarded PDF
- A thermal printer receipt
- Any regional language mixed with English

Your job is to extract ALL fields regardless of where they 
appear on the invoice, what font is used, or how the layout 
is structured. Do not rely on fixed positions or labels.
Understand the semantic meaning of each field.

EXTRACTION RULES:

supplier.name:
- Look for company name, firm name, business name
- Usually at the top of the invoice in large text
- May say "M/s", "Messrs", "From:", or no label at all

supplier.gstin:
- 15 character alphanumeric code
- Labels: GSTIN, GST No, GSTIN No, Tax ID
- Format: 2 digits + 10 char PAN + 1 digit + 1 char + 1 char
- Validate format before returning

supplier.address:
- Full address including street, city, state, pincode
- May be split across multiple lines
- Combine all address lines into one string

supplier.phone:
- 10 digit mobile or landline number
- Labels: Phone, Mobile, Tel, Contact, Ph
- May have +91 prefix, remove it

invoice.invoice_number:
- Labels: Invoice No, Bill No, Inv No, Invoice #, Challan No
- May contain slashes like 54/25-26 or dashes

invoice.invoice_date:
- Labels: Date, Invoice Date, Bill Date, Dated
- Return in YYYY-MM-DD format always
- Convert any format like 20/01/2026 or 20-Jan-2026

invoice.place_of_supply:
- Labels: Place of Supply, Destination, Ship To State
- Usually a state name or city name

invoice.payment_terms:
- Labels: Terms, Payment Terms, Due Date, Credit Period
- Extract the full text value

items array:
- Find ALL line items in the invoice, not just the first one
- Each item row in a table is one item object
- item.name: product or service description
- item.hsn: HSN or SAC code, usually 4-8 digits
- item.qty: quantity as a number only
- item.uom: unit like pcs, mtr, kg, nos, box, set
  If not found or blank, set to null
- item.rate: price per unit as number
- item.amount: total for that line as number
- If invoice has 10 items, return all 10 in the array

tax.cgst: total CGST amount as number, 0 if not present
tax.sgst: total SGST amount as number, 0 if not present  
tax.igst: total IGST amount as number, 0 if not present

totals.sub_total: amount before tax
totals.tax_total: total tax amount
totals.grand_total: final payable amount

IMPORTANT RULES:
- Return ONLY the raw JSON object, no markdown, no explanation
- Never return empty string, use null for missing fields
- Numbers must be actual numbers not strings
- If you see multiple tax rows for same type, sum them
- If grand total is not explicitly stated, calculate it
- Do not skip any line item, extract every single row
- Even if invoice is blurry or low quality, extract what you can
- Handle both inter-state (IGST) and intra-state (CGST+SGST) invoices'''

        content_parts = [
            {"mime_type": "image/png", "data": image_data}
            for image_data in base64_images
        ]
        content_parts.append(prompt)

        response = model.generate_content(content_parts)

        if not response.text or not response.text.strip():
            raise HTTPException(status_code=422, detail={"error": "AI could not process this image. Try a clearer photo"})

        return {"raw_text": response.text.strip()}
    except g_exceptions.GoogleAPIError:
        raise HTTPException(status_code=503, detail={"error": "AI service unavailable. Check your API key"})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail={"error": "AI could not process this image. Try a clearer photo"})

@app.post("/parse")
async def parse_text_to_json(request: ParseRequest):
        if not request.text or not request.text.strip():
                raise HTTPException(status_code=400, detail={"error": "No text provided for parsing"})

        try:
                model = genai.GenerativeModel('gemini-2.5-flash-lite')
                prompt = f'''You are an expert invoice data extraction system.
Analyze the following raw OCR text extracted from an invoice and convert it into a structured JSON object. 
Return ONLY a raw valid JSON object with no markdown formatting, no code blocks, no explanation. 
Use exactly this structure. For every value field, provide a "value" and a "confidence" score ("High", "Medium", or "Low").

{{
    "supplier": {{
        "name": {{"value": string or null, "confidence": string}},
        "gstin": {{"value": string or null, "confidence": string}},
        "address": {{"value": string or null, "confidence": string}},
        "phone": {{"value": string or null, "confidence": string}}
    }},
    "invoice": {{
        "invoice_number": {{"value": string or null, "confidence": string}},
        "invoice_date": {{"value": string or null, "confidence": string}},
        "place_of_supply": {{"value": string or null, "confidence": string}},
        "payment_terms": {{"value": string or null, "confidence": string}}
    }},
    "items": [
        {{
            "name": {{"value": string or null, "confidence": string}},
            "hsn": {{"value": string or null, "confidence": string}},
            "qty": {{"value": number or null, "confidence": string}},
            "uom": {{"value": string or null, "confidence": string}},
            "rate": {{"value": number or null, "confidence": string}},
            "amount": {{"value": number or null, "confidence": string}}
        }}
    ],
    "tax": {{
        "cgst": {{"value": number or null, "confidence": string}},
        "sgst": {{"value": number or null, "confidence": string}},
        "igst": {{"value": number or null, "confidence": string}}
    }},
    "totals": {{
        "sub_total": {{"value": number or null, "confidence": string}},
        "tax_total": {{"value": number or null, "confidence": string}},
        "grand_total": {{"value": number or null, "confidence": string}}
    }}
}}

Set the "value" to null if not found in the text.

RAW OCR TEXT:
{request.text}
'''

                response = model.generate_content(prompt)
                if not response.text or not response.text.strip():
                        raise HTTPException(status_code=422, detail={"error": "AI could not process this image. Try a clearer photo"})

                try:
                        clean_text = clean_gemini_response(response.text)
                except Exception:
                        raise HTTPException(status_code=422, detail={"error": "AI response was not structured correctly. Try again"})

                try:
                        parsed_data = json.loads(clean_text)
                except json.JSONDecodeError:
                        raise HTTPException(status_code=422, detail={"error": "AI response was not structured correctly. Try again"})

                return parsed_data

        except g_exceptions.GoogleAPIError as e:
                raise HTTPException(status_code=503, detail={"error": "AI service unavailable. Check your API key"}) from e
        except HTTPException:
                raise
        except Exception:
                raise HTTPException(status_code=422, detail={"error": "AI response was not structured correctly. Try again"})

@app.get("/")
def read_root():
    return {"status": "ok", "message": "OCR API Server Running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

