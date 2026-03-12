# AI Invoice OCR

A full-stack web application that extracts structured data from invoice images using Google's Gemini AI.

## Project Structure

```
AI-OCR/
├── backend/          # FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/         # React + Vite frontend
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── main.jsx
    │   ├── index.css
    │   └── components/
    │       ├── UploadZone.jsx
    │       ├── InvoiceDisplay.jsx
    │       └── JSONViewer.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

## Features

- 📄 Upload PDF or image files (JPG, PNG)
- 🤖 AI-powered data extraction using Gemini 2.0
- 📊 Structured JSON output with invoice details
- 💼 Extract supplier info, line items, taxes, totals
- 📋 Copy JSON or download as JSON/CSV
- 🎨 Modern dark UI with Tailwind CSS
- ✅ Highlights missing fields with "NOT FOUND" badges

## Prerequisites

- Python 3.8+
- Node.js 16+
- Google Gemini API key
- Poppler (for PDF processing)

### Installing Poppler (Required for PDF support)

**Windows:**
1. Download Poppler from: https://github.com/oschwartz10612/poppler-windows/releases
2. Extract and add the `bin` folder to your PATH

**macOS:**
```bash
brew install poppler
```

**Linux:**
```bash
sudo apt-get install poppler-utils
```

## Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from example:
```bash
copy .env.example .env  # Windows
# cp .env.example .env  # macOS/Linux
```

5. Add your Gemini API key to `.env`:
```
GEMINI_API_KEY=your_actual_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

6. Start the backend server:
```bash
python main.py
```

The API will run at `http://localhost:8000`

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Usage

1. Make sure both backend and frontend servers are running
2. Open `http://localhost:5173` in your browser
3. Drag and drop an invoice file or click to browse
4. Click "Extract Invoice Data"
5. View extracted data in structured cards and table
6. Download results as JSON or CSV

## API Endpoint

### POST /extract

Upload an invoice file for data extraction.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: file (PDF, JPG, JPEG, PNG)

**Response:**
```json
{
  "supplier": {
    "name": "string",
    "gstin": "string",
    "address": "string",
    "phone": "string"
  },
  "invoice": {
    "invoice_number": "string",
    "invoice_date": "string",
    "place_of_supply": "string",
    "payment_terms": "string"
  },
  "items": [
    {
      "name": "string",
      "hsn": "string",
      "qty": number,
      "uom": "string",
      "rate": number,
      "amount": number
    }
  ],
  "tax": {
    "cgst": number,
    "sgst": number,
    "igst": number
  },
  "totals": {
    "sub_total": number,
    "tax_total": number,
    "grand_total": number
  }
}
```

## Technologies Used

**Backend:**
- FastAPI - Modern Python web framework
- Google Generative AI (Gemini) - AI model for data extraction
- pdf2image - PDF to image conversion
- Pillow - Image processing
- python-dotenv - Environment variable management

**Frontend:**
- React 18 - UI library
- Vite - Build tool and dev server
- Tailwind CSS - Utility-first CSS framework
- Native Fetch API - HTTP requests

## Color Theme

- Background: `#0F1B35` (Navy)
- Cards: `#162040` (Dark Card)
- Accent: `#06B6D4` (Cyan)
- Text: White, `#94A3B8` (Slate Gray)

## Troubleshooting

**PDF conversion fails:**
- Ensure Poppler is installed and in your PATH
- Try restarting your terminal after installing Poppler

**API key errors:**
- Verify your Gemini API key is correct in `.env`
- Check you have API quota remaining

**CORS errors:**
- Ensure backend is running on port 8000
- Ensure frontend is running on port 5173

**Gemini API errors:**
- The model name might need updating (currently using `gemini-2.0-flash-exp`)
- Check Google's documentation for the latest available models

## License

MIT
