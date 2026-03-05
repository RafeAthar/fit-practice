import { useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { useUIStore } from '../../../store/uiSlice';
import { useGraphStore } from '../../../store/graphSlice';
import { useHistoryStore } from '../../../store/historySlice';
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
  root: '◉', topic: '◈', idea: '◦', question: '?', action: '→',
};

export function MindMapNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as MindMapNodeData;
  const { editingNodeId, setEditingNodeId } = useUIStore();
  const { graph, updateNodeLabel, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();
  const isEditing = editingNodeId === id;
  const isFreshNode = nodeData.label === '';          // just created, never saved
  const [editValue, setEditValue] = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nodeType: NodeType = nodeData.nodeType ?? 'idea';
  const isRoot = nodeType === 'root';
  const isLowConfidence = (nodeData.confidence ?? 1) < 0.7;
  const hasChildren = Object.values(graph.edges).some((e) => e.source === id);

  // Auto-enter edit mode for freshly created nodes
  useEffect(() => {
    if (isFreshNode && editingNodeId !== id) {
      setEditValue('');
      setEditingNodeId(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(nodeData.label);
    setEditingNodeId(id);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      // Empty → discard the node (user pressed Escape or blurred without typing)
      applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: false } }]);
      setEditingNodeId(null);
      return;
    }
    if (trimmed !== nodeData.label) updateNodeLabel(id, trimmed);
    setEditingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') {
      if (isFreshNode) {
        // Discard fresh node on Escape
        applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: false } }]);
      }
      setEditingNodeId(null);
    }
    e.stopPropagation();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRoot) return;
    const confirmed = hasChildren
      ? confirm(`Delete "${nodeData.label}" and all its children?`)
      : true;
    if (!confirmed) return;
    snapshot(graph);
    applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: hasChildren } }]);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = uuidv4();
    snapshot(graph);
    // Create with empty label + pre-supplied id so the node enters edit mode automatically
    applyOperations([{ type: 'ADD_NODE', payload: { id: newId, label: '', parentId: id, source: 'text' } }]);
    // editingNodeId will be set by the new node's useEffect above on mount
  };

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Double-click to edit"
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
            placeholder="Type label..."
            className="flex-1 bg-transparent border-b border-white/40 outline-none text-sm w-full placeholder:text-white/30 min-w-[80px]"
          />
        ) : (
          <span className="leading-snug break-words">
            {nodeData.label || <span className="opacity-30 italic">empty</span>}
          </span>
        )}
      </div>

      {isLowConfidence && !isFreshNode && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-500 text-black rounded-full px-1 leading-4">?</span>
      )}

      {hovered && !isEditing && (
        <>
          {!isRoot && (
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-[11px] leading-none shadow-md transition-colors z-10"
              title={hasChildren ? 'Delete node and children' : 'Delete node'}
            >✕</button>
          )}
          <button
            onClick={handleAddChild}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center text-[13px] leading-none shadow-md transition-colors z-10"
            title="Add child node"
          >+</button>
        </>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500 !border-gray-400" />
    </div>
  );
}
