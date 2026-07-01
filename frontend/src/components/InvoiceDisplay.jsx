import { useEffect, useState } from 'react';

export default function InvoiceDisplay({ data, onDataChange }) {
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

  if (!data) return null;

  const unwrap = (obj) => {
    if (obj && typeof obj === 'object' && 'value' in obj) return obj;
    return { value: obj, confidence: null };
  };

  const isMissingValue = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '' || ['not found', 'n/a', 'na', 'none', 'null', '-'].includes(normalized);
  };

  const normalizeText = (value) => String(value).replace(/\s+/g, ' ').trim();

  const normalizeOcrFragments = (text) => (
    text
      .replace(/([A-Z]{4,})\s+([A-Z]{1,2})(?=[,\s]|$)/g, '$1$2')
      .replace(/\s+,/g, ',')
      .replace(/,+/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );

  const toTitleCase = (text) => text.replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));

  const packPartsIntoLines = (parts, maxLength = 30) => {
    const grouped = [];
    let current = '';

    parts.forEach((part) => {
      const cleanPart = part.trim();
      if (!cleanPart) return;

      const candidate = current ? `${current}, ${cleanPart}` : cleanPart;
      if (!current || candidate.length <= maxLength) {
        current = candidate;
        return;
      }

      grouped.push(current);
      current = cleanPart;
    });

    if (current) grouped.push(current);
    return grouped;
  };

  const formatDateValue = (value) => {
    const dateText = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return value;
    const d = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const parseNumericText = (raw) => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    if (raw === null || raw === undefined) return NaN;

    const input = String(raw).trim();
    if (!input) return NaN;

    // Handle OCR decimals like "3,4" while still supporting grouped amounts like "3,65,000".
    if (input.includes(',') && !input.includes('.')) {
      const commaCount = (input.match(/,/g) || []).length;
      if (commaCount === 1) {
        const [left, right] = input.split(',');
        if (/^\d+$/.test(left) && /^\d+$/.test(right) && right.length <= 2) {
          const parsed = Number(`${left}.${right}`);
          return Number.isFinite(parsed) ? parsed : NaN;
        }
      }
    }

    const normalized = input.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const formatFieldValue = (value, path, currency) => {
    if (isMissingValue(value)) return { missing: true, display: '', multiline: false };

    if (currency) {
      const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
      if (Number.isFinite(numeric)) {
        return { missing: false, display: numeric.toLocaleString('en-IN'), multiline: false };
      }
    }

    let display = normalizeOcrFragments(normalizeText(value));

    if (path.includes('invoice_date') || path.includes('payment_terms')) {
      display = formatDateValue(display);
    }

    if (path.includes('supplier.name') || path.includes('items.name') || path.includes('place_of_supply')) {
      display = toTitleCase(display);
    }

    if (path.includes('supplier.address')) {
      const lines = display.split(',').map((part) => part.trim()).filter(Boolean);
      if (lines.length > 1) {
        return { missing: false, display: packPartsIntoLines(lines, 26), multiline: true };
      }
    }

    if (path.includes('place_of_supply')) {
      const lines = display.split(',').map((part) => part.trim()).filter(Boolean);
      if (lines.length > 1) {
        return { missing: false, display: packPartsIntoLines(lines, 24), multiline: true };
      }
    }

    return { missing: false, display, multiline: false };
  };

  const baseConfidence = (value) => {
    if (value === null || value === undefined || value === '') return { level: 'LOW', color: 'var(--danger)' };
    if (typeof value === 'string' && value.trim().length < 3) return { level: 'MEDIUM', color: 'var(--warning)' };
    if (typeof value === 'number' && value === 0) return { level: 'MEDIUM', color: 'var(--warning)' };
    return { level: 'HIGH', color: 'var(--success)' };
  };

  const medium = { level: 'MEDIUM', color: 'var(--warning)' };

  const getConfidence = (raw, path, itemCtx) => {
    const { value, confidence } = unwrap(raw);

    if (confidence) {
      const normalized = String(confidence).toUpperCase();
      if (normalized === 'HIGH') return { level: 'HIGH', color: 'var(--success)' };
      if (normalized === 'MEDIUM') return { level: 'MEDIUM', color: 'var(--warning)' };
      if (normalized === 'LOW') return { level: 'LOW', color: 'var(--danger)' };
    }

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

  const ConfidenceDot = ({ level, color }) => (
    <span
      className="confidence-dot-indicator"
      style={{ background: color }}
      title={level[0] + level.slice(1).toLowerCase()}
      aria-label={`Confidence ${level[0] + level.slice(1).toLowerCase()}`}
    />
  );

  const Val = ({ d, currency, path, pathArr, itemCtx, className, showConfidence = true }) => {
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
          {showConfidence ? <ConfidenceDot level={conf.level} color={conf.color} /> : null}
        </span>
      );
    }

    const formatted = formatFieldValue(value, path, currency);

    if (formatted.missing) {
      return (
        <span className="val-text">
          <span className="null-badge">NOT FOUND</span>
        </span>
      );
    }

    return (
      <span className={`val-text${formatted.multiline ? ' is-multiline' : ''}`}>
        {formatted.multiline ? (
          <span className="value-multiline">
            {formatted.display.map((line, idx) => <span key={idx}>{line}</span>)}
          </span>
        ) : (
          <span>{formatted.display}</span>
        )}
        {showConfidence ? <ConfidenceDot level={conf.level} color={conf.color} /> : null}
      </span>
    );
  };

  const Field = ({ label, d, currency, path, pathArr }) => (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value"><Val d={d} currency={currency} path={path} pathArr={pathArr} /></span>
    </div>
  );

  const activeData = isEditing ? editedData : originalData;
  const { supplier, invoice, items, tax, totals } = activeData || {};
  const itemsList = Array.isArray(items) ? items : [];
  const itemsTotal = itemsList.reduce((sum, item) => {
    const amount = item?.amount?.value ?? item?.amount;
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);

  const confidenceRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  const getRowConfidence = (item) => {
    const checks = [
      getConfidence(item?.name, 'items.name', item),
      getConfidence(item?.hsn, 'items.hsn', item),
      getConfidence(item?.qty, 'items.qty', item),
      getConfidence(item?.uom, 'items.uom', item),
      getConfidence(item?.rate, 'items.rate', item),
      getConfidence(item?.amount, 'items.amount', item),
    ];

    return checks.reduce((worst, next) => (
      confidenceRank[next.level] < confidenceRank[worst.level] ? next : worst
    ), checks[0] || { level: 'HIGH', color: 'var(--success)' });
  };

  const getNumericValue = (raw) => {
    const value = raw?.value ?? raw;
    const parsed = parseNumericText(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getItemAmountConfidence = (item) => {
    const amountConf = getConfidence(item?.amount, 'items.amount', item);
    if (amountConf.level === 'LOW') return amountConf;

    const qty = parseNumericText(item?.qty?.value ?? item?.qty);
    const rate = parseNumericText(item?.rate?.value ?? item?.rate);
    const amount = parseNumericText(item?.amount?.value ?? item?.amount);

    if ([qty, rate, amount].every(Number.isFinite) && qty > 0 && rate > 0 && amount > 0) {
      const diff = Math.abs(qty * rate - amount);
      const tolerance = Math.max(1, amount * 0.01);
      if (diff <= tolerance) return { level: 'HIGH', color: 'var(--success)' };
      return { level: 'MEDIUM', color: 'var(--warning)' };
    }

    return amountConf;
  };

  const cgstVal = getNumericValue(tax?.cgst);
  const sgstVal = getNumericValue(tax?.sgst);
  const igstVal = getNumericValue(tax?.igst);
  const showIgstNote = igstVal > 0 && cgstVal === 0 && sgstVal === 0;

  return (
    <div className="invoice-display-wrap">
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
          <div className="card-header"><span className="card-title">SUPPLIER</span></div>
          <div className="card-body">
            <Field label="Name" d={supplier?.name} path="supplier.name" pathArr={["supplier", "name"]} />
            <Field label="GSTIN" d={supplier?.gstin} path="supplier.gstin" pathArr={["supplier", "gstin"]} />
            <Field label="Address" d={supplier?.address} path="supplier.address" pathArr={["supplier", "address"]} />
            <Field label="Phone" d={supplier?.phone} path="supplier.phone" pathArr={["supplier", "phone"]} />
          </div>
        </div>

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.2s' }}>
          <div className="card-header"><span className="card-title">INVOICE</span></div>
          <div className="card-body">
            <Field label="Invoice Number" d={invoice?.invoice_number} path="invoice.invoice_number" pathArr={["invoice", "invoice_number"]} />
            <Field label="Invoice Date" d={invoice?.invoice_date} path="invoice.invoice_date" pathArr={["invoice", "invoice_date"]} />
            <Field label="Place of Supply" d={invoice?.place_of_supply} path="invoice.place_of_supply" pathArr={["invoice", "place_of_supply"]} />
            <Field label="Payment Terms" d={invoice?.payment_terms} path="invoice.payment_terms" pathArr={["invoice", "payment_terms"]} />
          </div>
        </div>

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.3s' }}>
          <div className="card-header"><span className="card-title">TAX BREAKDOWN</span></div>
          <div className="card-body">
            <Field label="CGST" d={tax?.cgst} currency path="tax.cgst" pathArr={["tax", "cgst"]} />
            <Field label="SGST" d={tax?.sgst} currency path="tax.sgst" pathArr={["tax", "sgst"]} />
            <Field label="IGST" d={tax?.igst} currency path="tax.igst" pathArr={["tax", "igst"]} />
            {showIgstNote && <div className="tax-note">Inter-state supply — IGST applicable</div>}
          </div>
        </div>

        <div className="glass-panel info-card animate-in" style={{ animationDelay: '0.4s' }}>
          <div className="card-header"><span className="card-title">TOTALS</span></div>
          <div className="card-body">
            <Field label="Sub Total" d={totals?.sub_total} currency path="totals.sub_total" pathArr={["totals", "sub_total"]} />
            <Field label="Tax Total" d={totals?.tax_total} currency path="totals.tax_total" pathArr={["totals", "tax_total"]} />
            <div className="grand-total-row">
              <span className="grand-total-label">Grand Total</span>
              <span className="grand-total-value">
                <Val d={totals?.grand_total} currency path="totals.grand_total" pathArr={["totals", "grand_total"]} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="line-items-section animate-in" style={{ animationDelay: '0.7s' }}>
        <div className="card-header line-items-header">
          <span className="card-title line-items-title">LINE ITEMS</span>
          <div className="confidence-legend">
            <span className="legend-label">Confidence</span>
            <span className="legend-item high"><i />High</span>
            <span className="legend-item medium"><i />Medium</span>
            <span className="legend-item low"><i />Low</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="items-table">
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-left">Item Name</th>
                <th className="text-left">HSN</th>
                <th className="text-right">Qty</th>
                <th className="text-center">UOM</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {itemsList.length === 0 ? (
                <tr><td colSpan="7" className="empty-row">No items found</td></tr>
              ) : itemsList.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'row-odd' : 'row-even'}>
                  <td className="text-left item-name"><Val d={item?.name} path="items.name" pathArr={["items", i, "name"]} itemCtx={item} showConfidence={false} /></td>
                  <td className="text-left"><Val d={item?.hsn} path="items.hsn" pathArr={["items", i, "hsn"]} itemCtx={item} showConfidence={false} /></td>
                  <td className="text-right"><Val d={item?.qty} path="items.qty" pathArr={["items", i, "qty"]} itemCtx={item} className="align-right" showConfidence={false} /></td>
                  <td className="text-center"><Val d={item?.uom} path="items.uom" pathArr={["items", i, "uom"]} itemCtx={item} className="align-center" showConfidence={false} /></td>
                  <td className="text-right"><Val d={item?.rate} currency path="items.rate" pathArr={["items", i, "rate"]} itemCtx={item} className="align-right" showConfidence={false} /></td>
                  <td className="text-right amount-cell"><Val d={item?.amount} currency path="items.amount" pathArr={["items", i, "amount"]} itemCtx={item} className="align-right" showConfidence={false} /></td>
                  <td className="text-center confidence-col">
                    <ConfidenceDot level={getItemAmountConfidence(item).level} color={getItemAmountConfidence(item).color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="items-footer-row">
            <span>{itemsList.length} items extracted</span>
            <span className="items-total">Total: ₹{itemsTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

    </div>

      <style>{`
        .invoice-display-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .invoice-display {
          display: flex;
          flex-direction: column;
          gap: 18px;
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
          gap: 16px;
          align-items: stretch;
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
          border-radius: 12px;
          box-shadow: none;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .info-card .card-body {
          padding: 18px 20px;
          flex: 1;
        }

        .card-header {
          padding: 20px 20px 10px;
          border-bottom: 1px solid var(--border);
          background: transparent;
        }

        .card-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--blue);
          margin: 0 0 16px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .field-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }

        .field-row:last-child { border-bottom: none; }

        .field-label {
          font-size: 11px;
          font-weight: 400;
          color: var(--text-light);
          min-width: 102px;
          line-height: 1.4;
          padding-top: 1px;
        }

        .field-value {
          font-size: 13px;
          color: var(--text);
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          gap: 6px;
          font-weight: 500;
          text-align: right;
          width: 100%;
          line-height: 1.36;
        }

        .val-text {
          display: inline-flex;
          align-items: flex-start;
          gap: 0.3rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          text-align: right;
          width: 100%;
        }

        .field-value .val-text {
          width: auto;
          max-width: 100%;
        }

        .field-value .val-text.is-multiline {
          width: 100%;
          max-width: 290px;
          margin-left: auto;
          justify-content: flex-start;
          text-align: left;
        }

        .value-multiline {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.38;
          gap: 2px;
          max-width: 100%;
          word-break: normal;
          overflow-wrap: break-word;
        }

        .value-multiline span {
          display: block;
          white-space: normal;
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
          padding: 2px 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid #ef4444;
          border-radius: 4px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .confidence-dot-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          cursor: help;
        }

        .grand-total-row {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .grand-total-label {
          font-size: 12px;
          color: var(--text-light);
          display: block;
          margin-bottom: 4px;
        }

        .grand-total-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--blue);
        }

        .tax-note {
          margin-top: 8px;
          font-size: 10px;
          color: var(--text-light);
          font-style: italic;
        }

        .line-items-section {
          margin-top: 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .line-items-header {
          background: var(--bg-2);
          padding: 13px 16px;
          border-radius: 12px 12px 0 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: none;
          border-bottom: none;
        }

        .line-items-title {
          color: var(--blue);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .items-table th {
          padding: 12px 16px;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-light);
          background: var(--bg-2);
          border-bottom: 1px solid var(--border);
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .items-table td {
          padding: 14px 16px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          line-height: 1.4;
        }

        .items-table td .val-text {
          width: auto;
          justify-content: flex-start;
          text-align: left;
        }

        .items-table td.text-right .val-text {
          width: 100%;
          justify-content: flex-end;
          text-align: right;
        }

        .items-table td.text-center .val-text {
          width: 100%;
          justify-content: center;
          text-align: center;
        }

        .items-table .null-badge {
          font-size: 9px;
          padding: 1px 6px;
          letter-spacing: 0.01em;
        }

        .items-table tbody tr:last-child td {
          border-bottom: none;
        }

        .items-table tbody tr {
          transition: background-color 0.2s ease;
        }

        .items-table .row-even {
          background: var(--bg);
        }

        .items-table .row-odd {
          background: var(--bg-2);
        }

        .items-table tbody tr:hover {
          background: var(--bg-3);
        }

        .items-table .font-medium {
          font-weight: bold;
          color: var(--blue);
        }

        .amount-cell {
          color: var(--blue);
          font-weight: 600;
        }

        .confidence-col {
          text-align: center;
          vertical-align: middle;
        }

        .confidence-legend {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          font-size: 11px;
          margin-left: auto;
          white-space: nowrap;
        }

        .legend-label {
          color: var(--text-light);
          font-weight: 500;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 500;
          color: var(--text-light);
        }

        .legend-item i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .legend-item.high i { background: #10B981; }
        .legend-item.medium i { background: #F59E0B; }
        .legend-item.low i { background: #EF4444; }

        .items-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-2);
          color: var(--text-light);
          font-size: 11px;
          padding: 11px 16px;
          border-top: 1px solid var(--border);
          border-radius: 0 0 12px 12px;
        }

        .items-total {
          color: var(--blue);
          font-size: 13px;
          font-weight: 600;
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

        @media (max-width: 768px) {
          .invoice-display-wrap {
            padding: 0 12px;
          }
        }
      `}</style>
    </div>
  );
}
