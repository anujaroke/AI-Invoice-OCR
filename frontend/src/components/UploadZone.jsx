import { useState, useRef, useEffect } from 'react';

export default function UploadZone({ onUpload, isLoading, onError, resetKey }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const inputRef = useRef(null);

  const VALID_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
  const MAX_SIZE = 10 * 1024 * 1024;

  const validate = (f) => {
    if (!f) return { ok: false, msg: 'Only PDF, JPG, PNG allowed' };
    const ext = f.name.split('.').pop().toLowerCase();
    if (!VALID_EXT.includes(ext)) return { ok: false, msg: 'Only PDF, JPG, PNG allowed' };
    if (f.size > MAX_SIZE) return { ok: false, msg: 'File must be under 10MB' };
    return { ok: true };
  };

  useEffect(() => {
    setFile(null);
    setPreview('');
  }, [resetKey]);

  const generatePreview = (f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result || '');
    reader.readAsDataURL(f);
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
    if (!f) return;
    const res = validate(f);
    if (res.ok) {
      setFile(f);
      generatePreview(f);
      onError?.(null);
    } else {
      onError?.(res.msg);
      setFile(null);
      setPreview('');
    }
  };

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const res = validate(f);
    if (res.ok) {
      setFile(f);
      generatePreview(f);
      onError?.(null);
    } else {
      onError?.(res.msg);
      setFile(null);
      setPreview('');
    }
  };

  return (
    <div className="glass-panel upload-zone-card animate-in" style={{ animationDelay: '0.1s' }}>
      <div className="uz-label-row">
        <span className="uz-label">Invoice</span>
        <div className="uz-format-pills">
          <span className="uz-pill">PDF</span>
          <span className="uz-pill">JPG</span>
          <span className="uz-pill">PNG</span>
        </div>
      </div>

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
            <div className="loader-container">
              <div className="loader"></div>
            </div>
            <p className="drop-title">Extracting text from invoice...</p>
            <p className="drop-hint">Please wait, processing your document</p>
          </div>
        ) : !file ? (
          <div className="drop-inner">
            <div className="drop-icon">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="drop-content">
              <p className="drop-title">Drop your file here, or browse</p>
              <p className="drop-hint">Click anywhere in this box to choose a file</p>
            </div>
            <div className="drop-separator">or</div>
            <div className="drop-badges">
              <span className="file-badge">PDF</span>
              <span className="file-badge">JPG</span>
              <span className="file-badge">PNG</span>
            </div>
            <p className="drop-filesize">Max 10 MB</p>
          </div>
        ) : (
          <div className="drop-inner">
            <div className="drop-icon selected">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M10 13l4 4 4-4" strokeWidth="2.5"/>
              </svg>
            </div>
            <p className="drop-title">{file.name}</p>
            <p className="drop-hint">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready to extract</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      {file && !isLoading && (
        <div className="upload-actions">
          <button 
            className="btn btn-ghost" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setFile(null); 
              setPreview(''); 
              onError?.(null); 
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!file}
            onClick={(e) => {
              e.stopPropagation();
              const res = validate(file);
              if (!res.ok) {
                onError?.(res.msg);
                return;
              }
              onError?.(null);
              onUpload(file, preview, file.name);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 16 16 12 12 8"></polyline>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Extract Text
          </button>
        </div>
      )}

                  <style>{`
        .upload-zone-card {
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          padding: 1.25rem;
        }

        .uz-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.8rem;
          gap: 0.8rem;
        }

        .uz-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .uz-format-pills {
          display: inline-flex;
          gap: 0.35rem;
        }

        .uz-pill {
          font-size: 0.64rem;
          font-weight: 600;
          padding: 0.16rem 0.46rem;
          border-radius: 999px;
          background: var(--bg-3);
          border: 1px solid var(--input-border);
          color: var(--text-muted);
        }

        .drop-area {
          padding: 2rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 2px dashed var(--input-border);
          border-radius: 0.65rem;
          cursor: pointer;
          background: var(--input-bg);
          min-height: 250px;
          transition: all 0.2s ease;
        }

        .drop-area:hover {
          border-color: var(--text-muted);
        }

        .drop-area.drag-over {
          border-color: var(--accent);
          background: rgba(16, 185, 129, 0.08);
          transform: scale(1.01);
        }

        .drop-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
        }

        .loader {
          width: 40px;
          height: 40px;
          border: 2px solid var(--border);
          border-top-color: var(--blue);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .drop-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .drop-icon.selected {
          background: var(--accent);
          border-radius: 999px;
          color: white;
        }

        .drop-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .drop-hint {
          font-size: 0.84rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .drop-badges {
          display: flex;
          gap: 0.5rem;
        }

        .file-badge {
          padding: 0.3rem 0.6rem;
          background: var(--bg-2);
          color: var(--text-secondary);
          font-size: 0.72rem;
          border: 1px solid var(--input-border);
          border-radius: 0.35rem;
        }

        .drop-filesize {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .drop-separator {
          color: var(--text-muted);
          font-size: 0.74rem;
        }

        .upload-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 1rem 0 0;
        }

        @keyframes spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
</div>
  );
}
