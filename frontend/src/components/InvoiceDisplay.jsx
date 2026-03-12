export default function InvoiceDisplay({ data }) {
  if (!data) return null;

  const { supplier, invoice, items, tax, totals } = data;

  const unwrap = (obj) => {
    if (obj && typeof obj === 'object' && 'value' in obj) return obj;
    return { value: obj, confidence: null };
  };

  const baseConfidence = (value) => {
    if (value === null || value === undefined || value === '') return { level: 'LOW', color: '#ef4444' };
    if (typeof value === 'string' && value.trim().length < 3) return { level: 'MEDIUM', color: '#eab308' };
    if (typeof value === 'number' && value === 0) return { level: 'MEDIUM', color: '#eab308' };
    return { level: 'HIGH', color: '#22c55e' };
  };

  const medium = { level: 'MEDIUM', color: '#eab308' };

  const getConfidence = (raw, path, itemCtx) => {
    const { value } = unwrap(raw);
    let conf = baseConfidence(value);

    if (conf.level === 'LOW') return conf;

    if (path === 'supplier.gstin' && value) {
      if (String(value).length !== 15) conf = medium;
    }

    if (path === 'invoice.invoice_date' && value) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
      if (!ok) conf = medium;
    }

    if (path === 'items.amount' && value !== null && value !== undefined) {
      const qty = Number(itemCtx?.qty);
      const rate = Number(itemCtx?.rate);
      const amt = Number(value);
      if ([qty, rate, amt].every(Number.isFinite)) {
        const diff = Math.abs(qty * rate - amt);
        if (diff > 0.01) conf = medium;
      }
    }

    return conf;
  };

  const ConfidencePill = ({ level, color }) => (
    <span className="confidence-pill" style={{ color, borderColor: color }}>
      <span className="confidence-dot" style={{ background: color }} />
      <span className="confidence-text">{level[0] + level.slice(1).toLowerCase()}</span>
    </span>
  );

  const Val = ({ d, currency, path, itemCtx }) => {
    const { value } = unwrap(d);
    const conf = getConfidence(d, path, itemCtx);

    if (value === null || value === undefined || value === '') {
      return (
        <span className="val-text">
          <span className="null-badge">NOT FOUND</span>
          <ConfidencePill level={conf.level} color={conf.color} />
        </span>
      );
    }

    let display = String(value);
    if (currency && typeof value === 'number') {
      display = value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    return (
      <span className="val-text">
        <span>{display}</span>
        <ConfidencePill level={conf.level} color={conf.color} />
      </span>
    );
  };

  const Field = ({ label, d, currency, path }) => (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value"><Val d={d} currency={currency} path={path} /></span>
    </div>
  );

  return (
    <div className="invoice-display">
      {/* Cards */}
      <div className="cards-grid">
        <div className="card info-card">
          <div className="card-header"><span className="card-title">Supplier</span></div>
          <div className="card-body">
            <Field label="Name" d={supplier?.name} path="supplier.name" />
            <Field label="GSTIN" d={supplier?.gstin} path="supplier.gstin" />
            <Field label="Address" d={supplier?.address} path="supplier.address" />
            <Field label="Phone" d={supplier?.phone} path="supplier.phone" />
          </div>
        </div>

        <div className="card info-card">
          <div className="card-header"><span className="card-title">Invoice</span></div>
          <div className="card-body">
            <Field label="Number" d={invoice?.invoice_number} path="invoice.invoice_number" />
            <Field label="Date" d={invoice?.invoice_date} path="invoice.invoice_date" />
            <Field label="Place of Supply" d={invoice?.place_of_supply} path="invoice.place_of_supply" />
            <Field label="Payment Terms" d={invoice?.payment_terms} path="invoice.payment_terms" />
          </div>
        </div>

        <div className="card info-card">
          <div className="card-header"><span className="card-title">Tax Breakdown</span></div>
          <div className="card-body">
            <Field label="CGST" d={tax?.cgst} currency path="tax.cgst" />
            <Field label="SGST" d={tax?.sgst} currency path="tax.sgst" />
            <Field label="IGST" d={tax?.igst} currency path="tax.igst" />
          </div>
        </div>

        <div className="card info-card">
          <div className="card-header"><span className="card-title">Totals</span></div>
          <div className="card-body">
            <Field label="Sub Total" d={totals?.sub_total} currency path="totals.sub_total" />
            <Field label="Tax Total" d={totals?.tax_total} currency path="totals.tax_total" />
            <div className="grand-total-row">
              <span className="field-label">Grand Total</span>
              <span className="grand-total-value">
                <Val d={totals?.grand_total} currency path="totals.grand_total" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Line Items</span>
          <div className="confidence-legend">
            <span><i style={{ background: '#22c55e' }} />High</span>
            <span><i style={{ background: '#eab308' }} />Medium</span>
            <span><i style={{ background: '#ef4444' }} />Low</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th className="text-left">Item Name</th>
                <th className="text-left">HSN</th>
                <th className="text-right">Qty</th>
                <th className="text-center">UOM</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(!items || items.length === 0) ? (
                <tr><td colSpan="6" className="empty-row">No items found</td></tr>
              ) : items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="text-left item-name"><Val d={item.name} path="items.name" itemCtx={item} /></td>
                  <td className="text-left"><Val d={item.hsn} path="items.hsn" itemCtx={item} /></td>
                  <td className="text-right"><Val d={item.qty} path="items.qty" itemCtx={item} /></td>
                  <td className="text-center"><Val d={item.uom} path="items.uom" itemCtx={item} /></td>
                  <td className="text-right"><Val d={item.rate} currency path="items.rate" itemCtx={item} /></td>
                  <td className="text-right font-medium"><Val d={item.amount} currency path="items.amount" itemCtx={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .invoice-display {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        @media (max-width: 1024px) {
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 540px) {
          .cards-grid { grid-template-columns: 1fr; }
        }
        .info-card .card-body {
          padding: 1rem 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }
        .field-row {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .field-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .field-value {
          font-size: 0.88rem;
          color: var(--text);
          word-break: break-word;
        }
        .val-text {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .null-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          background: color-mix(in srgb, var(--red) 10%, transparent);
          color: var(--red);
          border: 1px solid color-mix(in srgb, var(--red) 20%, transparent);
        }
        .confidence-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.1rem 0.45rem 0.1rem 0.35rem;
          border-radius: 999px;
          border: 1px solid currentColor;
          background: color-mix(in srgb, currentColor 10%, transparent);
        }
        .confidence-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .confidence-text {
          line-height: 1;
        }
        .grand-total-row {
          margin-top: 0.65rem;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .grand-total-value {
          font-size: 1.55rem;
          font-weight: 700;
          color: var(--cyan);
        }
        .grand-total-value .null-badge {
          font-size: 0.75rem;
        }
        .confidence-legend {
          display: flex;
          gap: 0.75rem;
          font-size: 0.68rem;
          color: var(--text-faint);
          align-items: center;
        }
        .confidence-legend i {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-right: 4px;
          vertical-align: middle;
        }
        .table-wrap {
          overflow-x: auto;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
          white-space: nowrap;
        }
        .items-table th {
          padding: 0.75rem 1rem;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .items-table td {
          padding: 0.7rem 1rem;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }
        .items-table .row-even { background: var(--card); }
        .items-table .row-odd  { background: var(--surface); }
        .items-table .item-name {
          white-space: normal;
          min-width: 200px;
        }
        .items-table .font-medium { font-weight: 600; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .empty-row {
          text-align: center;
          padding: 2rem !important;
          color: var(--text-faint);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
