import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../store/uiSlice';
import { useGraphStore } from '../../store/graphSlice';
import { useNodeActions } from '../../store/graphSlice';

export function NodeNotesPanel() {
  const { notesNodeId, setNotesNodeId } = useUIStore();
  const { graph } = useGraphStore();
  const { updateNodeNotes } = useNodeActions();
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const node = notesNodeId ? graph.nodes[notesNodeId] : null;

  useEffect(() => {
    if (node) { setDraft(node.notes ?? ''); setTimeout(() => textareaRef.current?.focus(), 50); }
  }, [notesNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save 500ms after typing stops
  useEffect(() => {
    if (!notesNodeId || !node) return;
    if (draft === (node.notes ?? '')) return;
    const t = setTimeout(() => updateNodeNotes(notesNodeId, draft), 500);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (notesNodeId && node) updateNodeNotes(notesNodeId, draft); // final save
    setNotesNodeId(null);
  };

  if (!node) return null;

  return (
    <div className="absolute right-0 top-0 h-full w-72 bg-gray-950 border-l border-white/8 flex flex-col z-30 shadow-2xl animate-in slide-in-from-right-4">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
        <span className="text-blue-400 text-sm">≡</span>
        <span className="text-sm font-medium text-gray-200 flex-1 truncate">{node.label || 'Untitled'}</span>
        <button onClick={close} className="text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors">×</button>
      </div>

      {/* Notes area */}
      <div className="flex-1 flex flex-col p-4 gap-2">
        <p className="text-[11px] text-gray-600">Notes for this node (auto-saved)</p>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add notes, references, or details…"
          className="
            flex-1 bg-white/4 border border-white/8 rounded-xl p-3 text-sm text-gray-200
            placeholder:text-gray-700 outline-none resize-none
            focus:border-blue-500/40 focus:bg-white/6 transition-all
          "
        />
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <button
          onClick={close}
          className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-medium transition-colors"
        >Done</button>
      </div>
    </div>
  );
}
