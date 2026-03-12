import os
import io
import json
import base64
import re
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
from pdf2image import convert_from_bytes
from PIL import Image

# Load environment variables
load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_file_to_base64(file_bytes: bytes, filename: str) -> str:
    #Converts uploaded PDF or Image to base64 string.
    ext = filename.lower().split(".")[-1]
    
    if ext == "pdf":
        try:
            # We assume poppler logic is in PATH, or user configured it.
            # Usually convert_from_bytes handles single pdfs well
            poppler_path = r"D:\Anuj\Projects\AI-OCR\poppler-25.12.0\Library\bin"
            images = convert_from_bytes(file_bytes, first_page=1, last_page=1, poppler_path=poppler_path)
            if not images:
                raise Exception("No pages found in PDF")
            image = images[0].convert("RGB")
            
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            return base64.b64encode(buffered.getvalue()).decode("utf-8")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"PDF conversion failed: {str(e)}")
            
    elif ext in ["jpg", "jpeg", "png"]:
        return base64.b64encode(file_bytes).decode("utf-8")
    else:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF, JPG, JPEG, and PNG are supported.")

from pydantic import BaseModel

def clean_gemini_response(text: str) -> str:
    # Remove markdown code blocks
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    # Remove any text before the first {
    start = text.find('{')
    # Remove any text after the last }
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError("No valid JSON found in response")
    return text[start:end+1].strip()

class ParseRequest(BaseModel):
    text: str

@app.post("/ocr")
async def extract_raw_text(file: UploadFile = File(...)):
    # 1. Read file bytes
    file_bytes = await file.read()
    
    # 2. Get base64 string
    base64_image = process_file_to_base64(file_bytes, file.filename)
    
    # 3. Call Gemini to get ONLY raw text (Acting as OCR)
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = '''You are an expert Indian GST invoice data extraction engine.
You will receive an invoice image that could be:
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

        response = model.generate_content([
            {"mime_type": "image/png", "data": base64_image},
            prompt
        ])
        
        return {"raw_text": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {str(e)}")


@app.post("/parse")
async def parse_text_to_json(request: ParseRequest):
    # 1. Call Gemini to parse raw text into JSON
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
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
        
        # 2. Clean and parse response
        clean_text = clean_gemini_response(response.text)
        
        # Parse JSON
        parsed_data = json.loads(clean_text)
        return parsed_data
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Gemini parse fail: Could not parse response to JSON. Response text: {clean_text}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Gemini call failed: {str(e)}")

# Add basic root point
@app.get("/")
def read_root():
    return {"status": "ok", "message": "OCR API Server Running"}
