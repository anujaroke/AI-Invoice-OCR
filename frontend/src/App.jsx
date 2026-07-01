import { useState, useEffect } from 'react';
import './App.css';
import UploadZone from './components/UploadZone';
import InvoiceDisplay from './components/InvoiceDisplay';
import JSONViewer from './components/JSONViewer';
import TextEditor from './components/TextEditor';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function unwrapValue(node) {
  if (node && typeof node === 'object' && 'value' in node) return node.value;
  return node;
}

function toDisplayLeaf(node) {
  if (node && typeof node === 'object' && 'value' in node) {
    return { value: node.value ?? null, confidence: node.confidence ?? null };
  }
  return { value: node ?? null, confidence: null };
}

function buildDisplayData(raw) {
  const src = raw || {};
  const items = Array.isArray(src.items) ? src.items : [];

  return {
    supplier: {
      name: toDisplayLeaf(src.supplier?.name),
      gstin: toDisplayLeaf(src.supplier?.gstin),
      address: toDisplayLeaf(src.supplier?.address),
      phone: toDisplayLeaf(src.supplier?.phone),
    },
    invoice: {
      invoice_number: toDisplayLeaf(src.invoice?.invoice_number),
      invoice_date: toDisplayLeaf(src.invoice?.invoice_date),
      place_of_supply: toDisplayLeaf(src.invoice?.place_of_supply),
      payment_terms: toDisplayLeaf(src.invoice?.payment_terms),
    },
    items: items.map((item) => ({
      name: toDisplayLeaf(item?.name),
      hsn: toDisplayLeaf(item?.hsn),
      qty: toDisplayLeaf(item?.qty),
      uom: toDisplayLeaf(item?.uom),
      rate: toDisplayLeaf(item?.rate),
      amount: toDisplayLeaf(item?.amount),
    })),
    tax: {
      cgst: toDisplayLeaf(src.tax?.cgst),
      sgst: toDisplayLeaf(src.tax?.sgst),
      igst: toDisplayLeaf(src.tax?.igst),
    },
    totals: {
      sub_total: toDisplayLeaf(src.totals?.sub_total),
      tax_total: toDisplayLeaf(src.totals?.tax_total),
      grand_total: toDisplayLeaf(src.totals?.grand_total),
    },
  };
}

function buildCleanJSON(raw) {
  const src = raw || {};
  const items = Array.isArray(src.items) ? src.items : [];

  return {
    supplier: {
      name: unwrapValue(src.supplier?.name) ?? null,
      gstin: unwrapValue(src.supplier?.gstin) ?? null,
      address: unwrapValue(src.supplier?.address) ?? null,
      phone: unwrapValue(src.supplier?.phone) ?? null,
    },
    invoice: {
      invoice_number: unwrapValue(src.invoice?.invoice_number) ?? null,
      invoice_date: unwrapValue(src.invoice?.invoice_date) ?? null,
      place_of_supply: unwrapValue(src.invoice?.place_of_supply) ?? null,
      payment_terms: unwrapValue(src.invoice?.payment_terms) ?? null,
    },
    items: items.map((item) => ({
      name: unwrapValue(item?.name) ?? null,
      hsn: unwrapValue(item?.hsn) ?? null,
      qty: unwrapValue(item?.qty) ?? null,
      uom: unwrapValue(item?.uom) ?? null,
      rate: unwrapValue(item?.rate) ?? null,
      amount: unwrapValue(item?.amount) ?? null,
    })),
    tax: {
      cgst: unwrapValue(src.tax?.cgst) ?? null,
      sgst: unwrapValue(src.tax?.sgst) ?? null,
      igst: unwrapValue(src.tax?.igst) ?? null,
    },
    totals: {
      sub_total: unwrapValue(src.totals?.sub_total) ?? null,
      tax_total: unwrapValue(src.totals?.tax_total) ?? null,
      grand_total: unwrapValue(src.totals?.grand_total) ?? null,
    },
  };
}

function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [appState, setAppState] = useState('idle');
  const [rawText, setRawText] = useState('');
  const [displayData, setDisplayData] = useState(null);
  const [cleanJSON, setCleanJSON] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [uploadResetKey, setUploadResetKey] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleFileUpload = async (file) => {
    if (!file) return;
    setAppState('extracting_text');
    setErrorMessage(null);
    setRawText('');
    setDisplayData(null);
    setCleanJSON(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/ocr`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const backendError = errorData.error || errorData.detail;
        throw new Error(backendError || `Server returned ${response.status}`);
      }
      const data = await response.json();
      setRawText(data.raw_text);
      setAppState('review_text');
    } catch (error) {
      const msg = (error.message && error.message.includes('Failed to fetch'))
        ? 'Could not connect to server. Make sure backend is running'
        : (error.message || 'An error occurred during text extraction.');
      setErrorMessage(msg);
      setAppState('idle');
    }
  };

  const handleGenerateJSON = async (finalText) => {
    setAppState('parsing_json');
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: finalText }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const backendError = errorData.error || errorData.detail;
        throw new Error(backendError || `Server returned ${response.status}`);
      }
      const data = await response.json();
      const nextDisplayData = buildDisplayData(data);
      setDisplayData(nextDisplayData);
      setCleanJSON(buildCleanJSON(nextDisplayData));
      setAppState('results');
    } catch (error) {
      const msg = (error.message && error.message.includes('Failed to fetch'))
        ? 'Could not connect to server. Make sure backend is running'
        : (error.message || 'An error occurred during JSON structuring.');
      setErrorMessage(msg);
      setAppState('review_text');
    }
  };

  const handleReset = () => {
    setAppState('idle');
    setRawText('');
    setDisplayData(null);
    setCleanJSON(null);
    setErrorMessage(null);
    setUploadResetKey((n) => n + 1);
  };

  const handleDisplayDataChange = (nextDisplayData) => {
    setDisplayData(nextDisplayData);
    setCleanJSON(buildCleanJSON(nextDisplayData));
  };

  const ErrorBanner = ({ message, onDismiss, onRetry }) => (
    <div className="error-banner fancy">
      <div className="error-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
      </div>
      <div className="error-text">{message}</div>
      <div className="error-actions">
        <button className="error-btn" onClick={onRetry}>Try Again</button>
        <button className="error-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
    </div>
  );

  const steps = [
    { key: 'upload', label: 'Upload', done: appState !== 'idle' },
    { key: 'ocr', label: 'OCR Extract', done: ['review_text', 'parsing_json', 'results'].includes(appState), active: appState === 'extracting_text' },
    { key: 'review', label: 'Review Text', done: ['parsing_json', 'results'].includes(appState), active: appState === 'review_text' },
    { key: 'results', label: 'Results', done: appState === 'results', active: appState === 'parsing_json' },
  ];

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="logo-group">
            <div className="logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <span className="logo-text">InvoiceAI</span>
          </div>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className="theme-toggle-knob">
                {theme === 'dark' ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                )}
              </span>
            </button>
            {appState !== 'idle' && (
              <button onClick={handleReset} className="nav-reset-btn">
                New Scan
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        {appState === 'idle' && (
          <div className="hero-section">
            <h1 className="hero-title">
              Extract Data from <span className="hero-highlight">Invoice </span>
            </h1>
            <p className="hero-subtitle">
              Automate your accounting data entry. Drop a PDF, photo, or scan, and let AI instantaneously convert it into perfectly structured JSON.
            </p>
          </div>
        )}

        {/* Stepper */}
        <div className="stepper">
          {steps.map((step, i) => (
            <div key={step.key} className="step-item">
              <div className={`step-dot ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                {step.done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`step-label ${step.done || step.active ? 'highlight' : ''}`}>{step.label}</span>
              {i < steps.length - 1 && <div className={`step-line ${step.done ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Error */}
        {errorMessage && (
          <ErrorBanner
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
            onRetry={handleReset}
          />
        )}

        {/* Upload */}
        {['idle', 'extracting_text', 'results'].includes(appState) && (
          <section className={`section-upload ${appState === 'results' ? 'compact' : ''}`}>
            <UploadZone
              onUpload={handleFileUpload}
              isLoading={appState === 'extracting_text'}
              onError={setErrorMessage}
              resetKey={uploadResetKey}
            />
          </section>
        )}

        {/* Text Review */}
        {['review_text', 'parsing_json'].includes(appState) && (
          <section className="section-editor">
            <TextEditor
              initialText={rawText}
              isLoading={appState === 'parsing_json'}
              onGenerate={handleGenerateJSON}
              onCancel={handleReset}
            />
          </section>
        )}

        {/* Results */}
        {appState === 'results' && displayData && (
          <section className="section-results">
            <InvoiceDisplay data={displayData} onDataChange={handleDisplayDataChange} />
            <JSONViewer data={cleanJSON} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        AI OCR workspace built with FastAPI, Gemini, and Vite.
      </footer>
    </div>
  );
}

export default App;
