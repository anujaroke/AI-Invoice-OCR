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
      if (v === null || v === undefined) return '';
      const s = String(v);
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [];
    lines.push('INVOICE HEADER');
    lines.push(`Invoice Number,${esc(data.invoice?.invoice_number)}`);
    lines.push(`Date,${esc(data.invoice?.invoice_date)}`);
    lines.push(`Place of Supply,${esc(data.invoice?.place_of_supply)}`);
    lines.push(`Payment Terms,${esc(data.invoice?.payment_terms)}`);
    lines.push('');
    lines.push('SUPPLIER INFO');
    lines.push(`Name,${esc(data.supplier?.name)}`);
    lines.push(`GSTIN,${esc(data.supplier?.gstin)}`);
    lines.push(`Address,${esc(data.supplier?.address)}`);
    lines.push(`Phone,${esc(data.supplier?.phone)}`);
    lines.push('');
    lines.push('LINE ITEMS');
    lines.push('Item Name,HSN,Qty,UOM,Rate,Amount');
    if (data.items?.length) {
      data.items.forEach(i => lines.push(`${esc(i.name)},${esc(i.hsn)},${esc(i.qty)},${esc(i.uom)},${esc(i.rate)},${esc(i.amount)}`));
    } else {
      lines.push('No items found');
    }
    lines.push('');
    lines.push('TAX & TOTALS');
    lines.push(`CGST,${esc(data.tax?.cgst)}`);
    lines.push(`SGST,${esc(data.tax?.sgst)}`);
    lines.push(`IGST,${esc(data.tax?.igst)}`);
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
    <div className="json-viewer">
      <div className="card">
        <div className="card-header jv-header">
          <span className="card-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Raw JSON
          </span>
          <div className="jv-actions">
            <button className="btn btn-subtle" onClick={handleCopy}>
              {copied ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy</>
              )}
            </button>
            <button className="btn btn-subtle" onClick={handleDownloadJSON}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              JSON
            </button>
            <button className="btn btn-primary jv-csv-btn" onClick={handleDownloadCSV}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              CSV
            </button>
          </div>
        </div>

        <div className="jv-code-area">
          <pre><code>{data ? JSON.stringify(data, null, 2) : '{}'}</code></pre>
        </div>
      </div>

      <style>{`
        .json-viewer .jv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .json-viewer .card-title {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .jv-actions {
          display: flex;
          gap: 0.5rem;
        }
        .jv-actions .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.78rem;
          padding: 0.4rem 0.85rem;
        }
        .jv-csv-btn {
          padding: 0.4rem 1rem !important;
        }
        .jv-code-area {
          background: var(--code-bg);
          max-height: 480px;
          overflow: auto;
          border-top: 1px solid var(--border);
        }
        .jv-code-area pre {
          margin: 0;
          padding: 1.25rem 1.5rem;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.8rem;
          line-height: 1.7;
          color: var(--cyan);
          white-space: pre;
          tab-size: 2;
        }
        .jv-code-area code {
          color: inherit;
        }
      `}</style>
    </div>
  );
}
