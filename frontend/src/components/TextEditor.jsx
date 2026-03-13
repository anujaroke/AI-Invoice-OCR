import { useState } from 'react';

export default function TextEditor({ initialText, onGenerate, isLoading, onCancel }) {
  const [text, setText] = useState(initialText || '');

  return (
    <div className="glass-panel text-editor animate-in" style={{ animationDelay: '0.2s' }}>
      <div className="te-header">
        <div className="te-header-content">
          <h3 className="te-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span className="gradient-text">Review & Edit</span>
          </h3>
          <p className="te-subtitle">The AI has extracted the invoice text. Review and make any corrections before generating the structured data.</p>
        </div>
      </div>

      <div className="te-body">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          className="te-textarea"
          placeholder="Extracted text will appear here..."
          spellCheck={false}
        />
        {isLoading && (
          <div className="te-overlay">
            <div className="te-overlay-content">
              <div className="te-loader">
                <div className="te-loader-spinner"></div>
              </div>
              <div className="te-overlay-text">
                <p className="te-overlay-title">Structuring Invoice Data</p>
                <p className="te-overlay-hint">Processing with AI...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="te-footer">
        <button className="btn btn-ghost" onClick={onCancel} disabled={isLoading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onGenerate(text)}
          disabled={isLoading || !text.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 16 16 12 12 8"></polyline>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Generate JSON
        </button>
      </div>

      <style>{`
        .text-editor {
          display: flex;
          flex-direction: column;
          min-height: 500px;
          border: 1px solid var(--border);
          background: var(--bg);
        }

        .te-header {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .te-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 14px;
          font-weight: bold;
          color: var(--text);
          margin: 0 0 0.5rem 0;
        }

        .te-title svg {
          color: var(--blue);
        }

        .te-subtitle {
          font-size: 12px;
          color: var(--text-light);
          margin: 0;
        }

        .te-body {
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .te-textarea {
          flex: 1;
          padding: 1rem;
          background: var(--bg);
          color: var(--text);
          border: none;
          outline: none;
          resize: none;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.6;
        }

        .te-textarea::placeholder {
          color: var(--text-light);
        }

        .te-textarea:focus {
          background: var(--bg-2);
        }

        .te-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 18, 24, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .te-overlay-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--bg);
          border: 1px solid var(--border);
          padding: 1rem;
        }

        .te-loader-spinner {
          width: 30px;
          height: 30px;
          border: 2px solid var(--border);
          border-top-color: var(--blue);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .te-overlay-title {
          font-weight: bold;
          font-size: 14px;
          color: var(--text);
          margin: 0;
        }

        .te-overlay-hint {
          font-size: 12px;
          color: var(--text-light);
          margin: 0;
        }

        .te-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 1rem;
          border-top: 1px solid var(--border);
          background: var(--bg);
        }

        @keyframes spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
