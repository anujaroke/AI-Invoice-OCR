import { useEffect, useState } from 'react';

export default function InvoiceDisplay({ data, onDataChange }) {
  if (!data) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [toast, setToast] = useState(null);

  const clone = (val) => (val === null || val === undefined ? val : JSON.parse(JSON.stringify(val)));

  useEffect(() => {
    setOriginalData(clone(data));
    setEditedData(clone(data));
    setIsEditing(false);
    setToast(null);
  }, [data]);

  const unwrap = (obj) => {
    if (obj && typeof obj === 'object' && 'value' in obj) return obj;
    return { value: obj, confidence: null };
  };

  const labelize = (key) => key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

  const isSimpleValue = (raw) => {
    const { value } = unwrap(raw);
    return (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  };

  const baseConfidence = (value) => {
    if (value === null || value === undefined || value === '') return { level: 'LOW', color: 'var(--danger)' };
    if (typeof value === 'string' && value.trim().length < 3) return { level: 'MEDIUM', color: 'var(--warning)' };
    if (typeof value === 'number' && value === 0) return { level: 'MEDIUM', color: 'var(--warning)' };
    return { level: 'HIGH', color: 'var(--success)' };
  };

  const medium = { level: 'MEDIUM', color: 'var(--warning)' };

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

  const setPathValue = (target, pathArr, newVal) => {
    if (pathArr.length === 0) return newVal;
    const [head, ...rest] = pathArr;
    const isIndex = typeof head === 'number' || /^[0-9]+$/.test(String(head));
    const key = isIndex ? Number(head) : head;
    const container = isIndex
      ? (Array.isArray(target) ? [...target] : [])
      : { ...(target || {}) };

    const existing = container[key];

    if (rest.length === 0) {
      container[key] = (existing && typeof existing === 'object' && 'value' in existing)
        ? { ...existing, value: newVal }
        : newVal;
      return container;
    }

    container[key] = setPathValue(existing, rest, newVal);
    return container;
  };

  const updateEditedData = (pathArr, newVal) => {
    setEditedData((prev) => setPathValue(prev, pathArr, newVal));
  };

  const handleCancel = () => {
    setEditedData(clone(originalData));
    setIsEditing(false);
  };

  const handleSave = () => {
    if (onDataChange) onDataChange(clone(editedData));
    setOriginalData(clone(editedData));
    setIsEditing(false);
    setToast('Changes saved — JSON updated');
    setTimeout(() => setToast(null), 2200);
  };

  const ConfidencePill = ({ level, color }) => (
    <span className="confidence-pill" style={{ color, borderColor: color }}>
      <span className="confidence-dot" style={{ background: color }} />
      <span className="confidence-text">{level[0] + level.slice(1).toLowerCase()}</span>
    </span>
  );

  const Val = ({ d, currency, path, pathArr, itemCtx, className }) => {
    const { value } = unwrap(d);
    const conf = getConfidence(d, path, itemCtx);

    if (isEditing) {
      const inputVal = value === null || value === undefined ? '' : value;
      const handleInputChange = (e) => {
        let nextVal = e.target.value;
        if (typeof value === 'number') {
          const num = Number(nextVal);
          nextVal = nextVal === '' ? '' : (Number.isFinite(num) ? num : nextVal);
        }
        updateEditedData(pathArr, nextVal);
      };

      return (
        <span className="val-text">
          <input
            className={`edit-input ${className || ''}`.trim()}
            value={inputVal}
            onChange={handleInputChange}
          />
          <ConfidencePill level={conf.level} color={conf.color} />
        </span>
      );
    }

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

  const Field = ({ label, d, currency, path, pathArr }) => (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value"><Val d={d} currency={currency} path={path} pathArr={pathArr} /></span>
    </div>
  );

  const renderDynamicFields = (obj, basePathArr, basePathStr) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([, v]) => isSimpleValue(v));
    if (!entries.length) return null;
    return entries.map(([key, val]) => (
      <Field
        key={`${basePathStr}.${key}`}
        label={labelize(key)}
        d={val}
        path={`${basePathStr}.${key}`}
        pathArr={[...basePathArr, key]}
      />
    ));
  };

  const activeData = isEditing ? editedData : originalData;
  const { supplier, invoice, items, tax, totals } = activeData || {};
  const itemsList = Array.isArray(items) ? items : [];
  const recipient = invoice?.recipient || invoice?.customer || invoice?.bill_to || invoice?.consignee || invoice?.ship_to;
  const extraSections = Object.entries(activeData || {}).filter(([key, val]) => (
    !['supplier', 'invoice', 'items', 'tax', 'totals'].includes(key) &&
    val && typeof val === 'object' && !Array.isArray(val)
  ));

  return (
    <div className="invoice-display">
      <div className="results-bar">
        <div className="results-spacer" />
        {!isEditing ? (
          <button className="edit-btn" onClick={() => setIsEditing(true)}>Edit</button>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>Save Changes</button>
            <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="cards-grid">
        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="card-header"><span className="card-title">Supplier</span></div>
          <div className="card-body">
            <Field label="Name" d={supplier?.name} path="supplier.name" pathArr={["supplier", "name"]} />
            <Field label="GSTIN" d={supplier?.gstin} path="supplier.gstin" pathArr={["supplier", "gstin"]} />
            <Field label="Address" d={supplier?.address} path="supplier.address" pathArr={["supplier", "address"]} />
            <Field label="Phone" d={supplier?.phone} path="supplier.phone" pathArr={["supplier", "phone"]} />
          </div>
        </div>

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.2s' }}>
          <div className="card-header"><span className="card-title">Invoice</span></div>
          <div className="card-body">
            <Field label="Number" d={invoice?.invoice_number} path="invoice.invoice_number" pathArr={["invoice", "invoice_number"]} />
            <Field label="Date" d={invoice?.invoice_date} path="invoice.invoice_date" pathArr={["invoice", "invoice_date"]} />
            <Field label="Place of Supply" d={invoice?.place_of_supply} path="invoice.place_of_supply" pathArr={["invoice", "place_of_supply"]} />
            <Field label="Payment Terms" d={invoice?.payment_terms} path="invoice.payment_terms" pathArr={["invoice", "payment_terms"]} />
            {renderDynamicFields(invoice, ["invoice"], "invoice")}
          </div>
        </div>

        {recipient && (
          <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.3s' }}>
            <div className="card-header"><span className="card-title">Recipient</span></div>
            <div className="card-body">
              {renderDynamicFields(recipient, ["invoice", "recipient"], "invoice.recipient")}
            </div>
          </div>
        )}

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.4s' }}>
          <div className="card-header"><span className="card-title">Tax Breakdown</span></div>
          <div className="card-body">
            <Field label="CGST" d={tax?.cgst} currency path="tax.cgst" pathArr={["tax", "cgst"]} />
            <Field label="SGST" d={tax?.sgst} currency path="tax.sgst" pathArr={["tax", "sgst"]} />
            <Field label="IGST" d={tax?.igst} currency path="tax.igst" pathArr={["tax", "igst"]} />
          </div>
        </div>

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.5s' }}>
          <div className="card-header"><span className="card-title">Totals</span></div>
          <div className="card-body">
            <Field label="Sub Total" d={totals?.sub_total} currency path="totals.sub_total" pathArr={["totals", "sub_total"]} />
            <Field label="Tax Total" d={totals?.tax_total} currency path="totals.tax_total" pathArr={["totals", "tax_total"]} />
            <div className="grand-total-row">
              <span className="field-label">Grand Total</span>
              <span className="grand-total-value">
                <Val d={totals?.grand_total} currency path="totals.grand_total" pathArr={["totals", "grand_total"]} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {extraSections.length > 0 && (
        <div className="glass-panel animate-in" style={{ animationDelay: '0.6s' }}>
          <div className="card-header"><span className="card-title">Additional Details</span></div>
          <div className="card-body extra-sections">
            {extraSections.map(([key, val]) => (
              <div className="extra-card" key={key}>
                <div className="extra-title">{labelize(key)}</div>
                <div className="extra-grid">
                  {renderDynamicFields(val, [key], key) || <span className="muted">No simple fields</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="glass-panel animate-in" style={{ animationDelay: '0.7s' }}>
        <div className="card-header">
          <span className="card-title">Line Items</span>
          <div className="confidence-legend">
            <span><i style={{ background: 'var(--success)' }} />High</span>
            <span><i style={{ background: 'var(--warning)' }} />Medium</span>
            <span><i style={{ background: 'var(--danger)' }} />Low</span>
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
              {itemsList.length === 0 ? (
                <tr><td colSpan="6" className="empty-row">No items found</td></tr>
              ) : itemsList.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="text-left item-name"><Val d={item?.name} path="items.name" pathArr={["items", i, "name"]} itemCtx={item} /></td>
                  <td className="text-left"><Val d={item?.hsn} path="items.hsn" pathArr={["items", i, "hsn"]} itemCtx={item} /></td>
                  <td className="text-right"><Val d={item?.qty} path="items.qty" pathArr={["items", i, "qty"]} itemCtx={item} className="align-right" /></td>
                  <td className="text-center"><Val d={item?.uom} path="items.uom" pathArr={["items", i, "uom"]} itemCtx={item} className="align-center" /></td>
                  <td className="text-right"><Val d={item?.rate} currency path="items.rate" pathArr={["items", i, "rate"]} itemCtx={item} className="align-right" /></td>
                  <td className="text-right font-medium"><Val d={item?.amount} currency path="items.amount" pathArr={["items", i, "amount"]} itemCtx={item} className="align-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <style>{`
        .invoice-display {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .results-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.8rem;
        }

        .results-spacer { flex: 1; }

        .edit-btn, .save-btn, .cancel-btn {
          border: 1px solid var(--border);
          padding: 0.5rem 0.8rem;
          font-weight: bold;
          font-size: 11px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .edit-btn {
          background: var(--bg-2);
          color: var(--text-light);
        }

        .edit-actions { display: flex; gap: 0.4rem; }

        .save-btn {
          background: var(--green);
          color: white;
          border-color: var(--green);
        }

        .cancel-btn {
          background: transparent;
          color: var(--red);
          border-color: var(--red);
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        @media (max-width: 1024px) {
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .cards-grid { grid-template-columns: 1fr; }
        }

        .info-card {
          border: 1px solid var(--border);
          background: var(--bg);
        }

        .info-card .card-body {
          padding: 1rem;
          flex: 1;
        }

        .card-header {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .card-title {
          font-size: 11px;
          font-weight: bold;
          color: var(--blue);
          margin: 0;
        }

        .field-row {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border);
        }

        .field-row:last-child { border: none; padding-bottom: 0; }

        .field-label {
          font-size: 11px;
          font-weight: bold;
          color: var(--text-light);
        }

        .field-value {
          font-size: 14px;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .val-text {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          flex-wrap: wrap;
        }

        .edit-input {
          background: var(--bg-2);
          border: 1px solid var(--blue);
          color: var(--text);
          padding: 0.3rem 0.5rem;
          font-size: 12px;
          font-family: monospace;
        }

        .null-badge {
          font-size: 10px;
          padding: 0.2rem 0.4rem;
          background: transparent;
          color: var(--red);
          border: 1px solid var(--red);
        }

        .confidence-pill {
          font-size: 10px;
          padding: 0.2rem 0.4rem;
          border: 1px solid currentColor;
          background: transparent;
        }

        .grand-total-row {
          margin: 0;
          padding: 1rem 0;
          border-top: 1px solid var(--border);
        }

        .grand-total-value {
          font-size: 20px;
          font-weight: bold;
          color: var(--blue);
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .items-table th {
          padding: 0.8rem;
          font-size: 11px;
          font-weight: bold;
          color: var(--text-light);
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          text-align: left;
        }

        .items-table td {
          padding: 0.8rem;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        .items-table .font-medium {
          font-weight: bold;
          color: var(--blue);
        }

        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .empty-row {
          text-align: center;
          padding: 2rem !important;
          color: var(--text-light);
        }

        .toast {
          position: fixed;
          right: 1rem;
          bottom: 1rem;
          background: var(--green);
          color: white;
          padding: 0.6rem 1rem;
          font-size: 12px;
          font-weight: bold;
          z-index: 100;
          border: 1px solid var(--green);
        }

        .extra-sections { padding: 1rem; }
        .extra-card { margin-bottom: 1rem; }
        .extra-title {
          font-size: 12px;
          font-weight: bold;
          color: var(--text-light);
          margin-bottom: 0.8rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
