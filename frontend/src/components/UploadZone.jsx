import { useState, useRef } from 'react';

export default function UploadZone({ onUpload, isLoading }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  const VALID_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

  const isValid = (f) => {
    if (!f) return false;
    const ext = f.name.split('.').pop().toLowerCase();
    return VALID_EXT.includes(ext);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f && isValid(f)) setFile(f);
  };

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f && isValid(f)) setFile(f);
  };

  return (
    <div className="card">
      {/* Drop area */}
      <div
        className={`drop-area ${dragActive ? 'drag-over' : ''} ${isLoading ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={isLoading ? undefined : handleDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />

        {isLoading ? (
          <div className="drop-inner">
            <svg className="spinner" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: 'var(--cyan)' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
              <path d="M12 2v4" />
            </svg>
            <p className="drop-title">Extracting text from invoice...</p>
            <p className="drop-hint">This may take a few seconds</p>
          </div>
        ) : !file ? (
          <div className="drop-inner">
            <div className="drop-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="drop-title">Drop your invoice here</p>
            <p className="drop-hint">or click to browse</p>
            <div className="drop-badges">
              <span className="file-badge">PDF</span>
              <span className="file-badge">JPG</span>
              <span className="file-badge">PNG</span>
            </div>
          </div>
        ) : (
          <div className="drop-inner">
            <div className="drop-icon selected">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="drop-title">{file.name}</p>
            <p className="drop-hint">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      {file && !isLoading && (
        <div className="upload-actions">
          <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
            Remove
          </button>
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); onUpload(file); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Extract Data
          </button>
        </div>
      )}

      <style>{`
        .drop-area {
          padding: 3rem 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid var(--border);
        }
        .drop-area:hover {
          background: var(--cyan-subtle);
        }
        .drop-area.drag-over {
          background: var(--cyan-subtle);
          outline: 2px dashed var(--cyan);
          outline-offset: -6px;
        }
        .drop-area.disabled {
          cursor: default;
        }
        .drop-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          text-align: center;
        }
        .drop-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: var(--surface);
          border: 1.5px dashed var(--border-light);
          display: grid;
          place-items: center;
          color: var(--cyan);
          margin-bottom: 0.35rem;
          transition: all 0.2s;
        }
        .drop-area:hover .drop-icon:not(.selected) {
          border-color: var(--cyan);
          background: var(--cyan-subtle);
        }
        .drop-icon.selected {
          border-style: solid;
          border-color: var(--cyan);
          background: var(--cyan-subtle);
        }
        .drop-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
        }
        .drop-hint {
          font-size: 0.8rem;
          color: var(--text-faint);
        }
        .drop-badges {
          display: flex;
          gap: 0.4rem;
          margin-top: 0.5rem;
        }
        .file-badge {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 0.2rem 0.55rem;
          border-radius: 4px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-faint);
        }
        .upload-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.65rem;
          padding: 0.75rem 1.15rem;
        }
      `}</style>
    </div>
  );
}
