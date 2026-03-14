import { useRef, useEffect, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const VARIABLES = [
  { key: '{{guest_name}}',    label: 'Nombre huésped' },
  { key: '{{property_name}}', label: 'Nombre propiedad' },
];

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '280px' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);

  // Sync external value → editor (only when value changes from outside)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  }, []);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalChange.current = true;
    onChange(el.innerHTML);
  }, [onChange]);

  const insertVariable = (variable: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const span = document.createElement('span');
      span.style.cssText = 'background:#134e4a;color:#34d399;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;';
      span.textContent = variable;
      span.contentEditable = 'false';
      range.insertNode(span);
      range.setStartAfter(span);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.innerHTML += `<span style="background:#134e4a;color:#34d399;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;" contenteditable="false">${variable}</span>`;
    }
    handleInput();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('La imagen no puede superar 3MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      exec('insertImage', src);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Style images after insertion
  const handlePasteOrInput = () => {
    const el = editorRef.current;
    if (!el) return;
    el.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.margin = '8px 0';
    });
    handleInput();
  };

  const btnCls = 'px-2 py-1 rounded text-xs font-semibold hover:bg-slate-600 transition-colors text-slate-300 hover:text-white';

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-700 bg-slate-900">
        {/* Formato básico */}
        <button type="button" onClick={() => exec('bold')} className={btnCls} title="Negrita">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => exec('italic')} className={btnCls} title="Cursiva">
          <em>I</em>
        </button>
        <button type="button" onClick={() => exec('underline')} className={btnCls} title="Subrayado">
          <u>U</u>
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className={btnCls} title="Lista">
          ☰
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={btnCls} title="Lista numerada">
          1.
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button type="button" onClick={() => exec('formatBlock', '<h2>')} className={btnCls} title="Título">
          H2
        </button>
        <button type="button" onClick={() => exec('formatBlock', '<p>')} className={btnCls} title="Párrafo">
          ¶
        </button>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        {/* Imagen */}
        <button type="button" onClick={() => imageInputRef.current?.click()} className={btnCls} title="Insertar imagen">
          🖼
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <div className="w-px h-4 bg-slate-700 mx-1" />
        {/* Variables */}
        {VARIABLES.map(v => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition-colors border border-emerald-800/40"
            title={`Insertar ${v.key}`}
          >
            + {v.label}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handlePasteOrInput}
        onBlur={handlePasteOrInput}
        data-placeholder={placeholder}
        className="w-full px-4 py-3 text-sm text-white focus:outline-none leading-relaxed"
        style={{
          minHeight,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        // CSS for placeholder via CSS pseudo
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #475569;
          pointer-events: none;
        }
        [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        [contenteditable] h1, [contenteditable] h2, [contenteditable] h3 { color: #e2e8f0; margin: 12px 0 6px; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 20px; }
        [contenteditable] li { margin: 2px 0; }
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
      `}</style>
    </div>
  );
}
