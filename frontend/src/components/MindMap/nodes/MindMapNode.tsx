import { useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useUIStore } from '../../../store/uiSlice';
import { useGraphStore } from '../../../store/graphSlice';
import type { NodeType } from '../../../types/graph';

interface MindMapNodeData {
  label: string;
  nodeType: NodeType;
  confidence?: number;
}

const TYPE_STYLES: Record<NodeType, string> = {
  root:     'bg-violet-900/80 border-violet-400 text-violet-100 text-base font-bold shadow-[0_0_20px_rgba(167,139,250,0.3)]',
  topic:    'bg-blue-900/70 border-blue-400/70 text-blue-100 font-semibold',
  idea:     'bg-gray-800/90 border-gray-600/60 text-gray-200',
  question: 'bg-amber-900/60 border-amber-500/60 text-amber-200',
  action:   'bg-emerald-900/60 border-emerald-500/60 text-emerald-200',
};

const TYPE_ICONS: Record<NodeType, string> = {
  root: '◉',
  topic: '◈',
  idea: '◦',
  question: '?',
  action: '→',
};

export function MindMapNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as MindMapNodeData;
  const { editingNodeId, setEditingNodeId } = useUIStore();
  const { updateNodeLabel } = useGraphStore();
  const isEditing = editingNodeId === id;
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const nodeType: NodeType = nodeData.nodeType ?? 'idea';
  const isLowConfidence = (nodeData.confidence ?? 1) < 0.7;

  const startEditing = () => {
    setEditValue(nodeData.label);
    setEditingNodeId(id);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== nodeData.label) {
      updateNodeLabel(id, trimmed);
    }
    setEditingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditingNodeId(null);
    e.stopPropagation();
  };

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return (
    <div
      className={`
        relative min-w-[120px] max-w-[200px] px-3 py-2 rounded-xl border text-sm
        cursor-pointer select-none transition-all duration-150
        hover:brightness-110 hover:scale-[1.02]
        ${TYPE_STYLES[nodeType]}
        ${isLowConfidence ? 'opacity-60 border-dashed' : ''}
      `}
      onDoubleClick={startEditing}
      title={isLowConfidence ? 'Low confidence — double-click to edit' : 'Double-click to edit'}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-500 !border-gray-400" />

      <div className="flex items-start gap-1.5">
        <span className="text-xs opacity-60 leading-5 shrink-0">{TYPE_ICONS[nodeType]}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-b border-white/40 outline-none text-sm w-full"
          />
        ) : (
          <span className="leading-snug break-words">{nodeData.label}</span>
        )}
      </div>

      {isLowConfidence && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-500 text-black rounded-full px-1 leading-4">?</span>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500 !border-gray-400" />
    </div>
  );
}
