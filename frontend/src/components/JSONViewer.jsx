import { useState } from 'react';

export default function JSONViewer({ data }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!data) return;
    const esc = (v) => {
      const clean = (v === null || v === undefined || v === '') ? 'NOT FOUND' : String(v);
      return (clean.includes(',') || clean.includes('"') || clean.includes('\n'))
        ? `"${clean.replace(/"/g, '""')}"`
        : clean;
    };

    const lines = [];
    lines.push('INVOICE SUMMARY');
    lines.push(`Invoice No,${esc(data.invoice?.invoice_number)}`);
    lines.push(`Invoice Date,${esc(data.invoice?.invoice_date)}`);
    lines.push(`Place of Supply,${esc(data.invoice?.place_of_supply)}`);
    lines.push(`Payment Terms,${esc(data.invoice?.payment_terms)}`);
    lines.push('');
    lines.push('SUPPLIER DETAILS');
    lines.push(`Name,${esc(data.supplier?.name)}`);
    lines.push(`GSTIN,${esc(data.supplier?.gstin)}`);
    lines.push(`Address,${esc(data.supplier?.address)}`);
    lines.push(`Phone,${esc(data.supplier?.phone)}`);
    lines.push('');
    lines.push('LINE ITEMS');
    lines.push('Item Name,HSN,Qty,UOM,Rate,Amount');
    if (data.items?.length) {
      data.items.forEach((i) => {
        lines.push(`${esc(i?.name)},${esc(i?.hsn)},${esc(i?.qty)},${esc(i?.uom)},${esc(i?.rate)},${esc(i?.amount)}`);
      });
    } else {
      lines.push('NOT FOUND,NOT FOUND,NOT FOUND,NOT FOUND,NOT FOUND,NOT FOUND');
    }
    lines.push('');
    lines.push('TAX BREAKDOWN');
    lines.push(`CGST,${esc(data.tax?.cgst)}`);
    lines.push(`SGST,${esc(data.tax?.sgst)}`);
    lines.push(`IGST,${esc(data.tax?.igst)}`);
    lines.push('');
    lines.push('TOTALS');
    lines.push(`Sub Total,${esc(data.totals?.sub_total)}`);
    lines.push(`Tax Total,${esc(data.totals?.tax_total)}`);
    lines.push(`Grand Total,${esc(data.totals?.grand_total)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="json-viewer animate-in" style={{ animationDelay: '0.3s' }}>
      <div className="glass-panel">
        <div className="card-header jv-header">
          <div className="jv-title-group">
            <div className="mac-controls">
              <span className="mac-dot close"></span>
              <span className="mac-dot minimize"></span>
              <span className="mac-dot expand"></span>
            </div>
            <h3 className="card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Structured JSON Output
            </h3>
          </div>
          <div className="jv-actions">
            <button className="btn btn-subtle" onClick={handleCopy} title="Copy to clipboard">
              {copied ? (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span></>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span></>
              )}
            </button>
            <button className="btn btn-subtle" onClick={handleDownloadJSON} title="Download as JSON">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>JSON</span>
            </button>
            <button className="btn btn-primary jv-csv-btn" onClick={handleDownloadCSV} title="Download as CSV">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="jv-code-area">
          <pre><code>{data ? JSON.stringify(data, null, 2) : '{}'}</code></pre>
        </div>
      </div>

      <style>{`
        .json-viewer {
          animation: fadeScaleIn 0.3s ease-out;
        }

        .json-viewer .glass-panel {
          display: flex;
          flex-direction: column;
          min-height: 400px;
          border: 1px solid var(--border);
          background: var(--bg);
        }

        .json-viewer .jv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .json-viewer .jv-title-group {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .mac-controls {
          display: flex;
          gap: 5px;
          padding-right: 0.6rem;
          border-right: 1px solid var(--border);
        }

        .mac-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }

        .mac-dot.close { background: #da3633; }
        .mac-dot.minimize { background: #d29922; }
        .mac-dot.expand { background: #3fb950; }

        .json-viewer .card-title {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 13px;
          font-weight: bold;
          color: var(--text);
          margin: 0;
        }

        .json-viewer .card-title svg {
          color: var(--blue);
        }

        .jv-actions {
          display: flex;
          gap: 0.3rem;
        }

        .jv-actions .btn {
          font-size: 11px;
          padding: 0.4rem 0.7rem;
        }

        .jv-code-area {
          flex: 1;
          background: var(--bg);
          overflow: auto;
          border-radius: 0;
        }

        .jv-code-area pre {
          margin: 0;
          padding: 1rem;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.6;
          color: var(--text);
          white-space: pre;
          tab-size: 2;
        }

        @keyframes fadeScaleIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
