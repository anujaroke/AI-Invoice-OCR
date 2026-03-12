import { useState } from 'react';

export default function TextEditor({ initialText, onGenerate, isLoading, onCancel }) {
  const [text, setText] = useState(initialText || '');

  return (
    <div className="text-editor">
      <div className="te-header">
        <div>
          <h3 className="te-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Review Extracted Text
          </h3>
          <p className="te-subtitle">Edit the raw OCR text below if the AI missed anything before structuring.</p>
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
              <div className="spinner" />
              <span>Structuring Data...</span>
            </div>
          </div>
        )}
      </div>

      <div className="te-footer">
        <button className="btn btn-ghost" onClick={onCancel} disabled={isLoading}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={() => onGenerate(text)}
          disabled={isLoading || !text.trim()}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Generate Structured JSON
        </button>
      </div>

      <style>{`
        .text-editor {
          display: flex;
          flex-direction: column;
          height: 600px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .te-header {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .te-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--cyan);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 0;
        }
        .te-subtitle {
          font-size: 0.76rem;
          color: var(--text-muted);
          margin: 0.35rem 0 0;
        }
        .te-body {
          flex: 1;
          position: relative;
          min-height: 0;
        }
        .te-textarea {
          width: 100%;
          height: 100%;
          padding: 1.25rem 1.5rem;
          background: var(--card);
          color: var(--text);
          border: none;
          outline: none;
          resize: none;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.82rem;
          line-height: 1.7;
        }
        .te-textarea:focus {
          box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cyan) 20%, transparent);
        }
        .te-textarea:disabled {
          opacity: 0.5;
        }
        .te-overlay {
          position: absolute;
          inset: 0;
          background: var(--overlay);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .te-overlay-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 1rem 1.75rem;
          border-radius: 10px;
          font-weight: 600;
          font-size: 1rem;
          color: var(--cyan);
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        }
        .te-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          border-top: 1px solid var(--border);
          background: var(--surface);
        }
        .te-footer .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
      `}</style>
    </div>
  );
}
