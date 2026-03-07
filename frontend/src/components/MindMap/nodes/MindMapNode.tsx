import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { useUIStore } from '../../../store/uiSlice';
import { useGraphStore } from '../../../store/graphSlice';
import { useNodeActions } from '../../../store/graphSlice';
import { useHistoryStore } from '../../../store/historySlice';
import type { NodeType } from '../../../types/graph';

interface MindMapNodeData {
  label: string;
  nodeType: NodeType;
  confidence?: number;
  collapsed?: boolean;
  childCount?: number;
  color?: string;
  hasNotes?: boolean;
  isSearchMatch?: boolean;
  isSearchActive?: boolean;
}

const NODE_COLORS = [
  { name: 'Default', value: null },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Cyan', value: '#0891b2' },
];

const TYPE_BASE: Record<NodeType, string> = {
  root:     'border-violet-400 text-violet-100 text-base font-bold shadow-[0_0_20px_rgba(167,139,250,0.3)]',
  topic:    'border-blue-400/70 text-blue-100 font-semibold',
  idea:     'border-gray-600/60 text-gray-200',
  question: 'border-amber-500/60 text-amber-200',
  action:   'border-emerald-500/60 text-emerald-200',
};

const TYPE_BG: Record<NodeType, string> = {
  root:     'bg-violet-900/80',
  topic:    'bg-blue-900/70',
  idea:     'bg-gray-800/90',
  question: 'bg-amber-900/60',
  action:   'bg-emerald-900/60',
};

const TYPE_ICONS: Record<NodeType, string> = {
  root: '◉', topic: '◈', idea: '◦', question: '?', action: '→',
};

export function MindMapNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as unknown as MindMapNodeData;
  const { editingNodeId, setEditingNodeId, setNotesNodeId } = useUIStore();
  const { graph, updateNodeLabel, applyOperations } = useGraphStore();
  const { toggleCollapse, setNodeColor } = useNodeActions();
  const { snapshot } = useHistoryStore();

  const isEditing = editingNodeId === id;
  const isFreshNode = nodeData.label === '';
  const nodeType: NodeType = nodeData.nodeType ?? 'idea';
  const isRoot = nodeType === 'root';
  const isLowConfidence = (nodeData.confidence ?? 1) < 0.7;
  const hasChildren = nodeData.childCount !== undefined ? nodeData.childCount > 0
    : Object.values(graph.edges).some((e) => e.source === id);

  const [editValue, setEditValue] = useState('');
  const [hovered, setHovered] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

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

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (!colorPickerRef.current?.contains(e.target as Node)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  // Keyboard shortcuts when hovered (not editing)
  useEffect(() => {
    if (!hovered || isEditing) return;
    const handler = (e: KeyboardEvent) => {
      // Don't fire if user is typing in another input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddChild(); }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleAddSibling(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isRoot) { e.preventDefault(); handleDelete(); }
      if (e.key === 'F2') { e.preventDefault(); startEditing(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, isEditing, isRoot, hasChildren]);

  const startEditing = () => { setEditValue(nodeData.label); setEditingNodeId(id); };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: false } }]);
      setEditingNodeId(null);
      return;
    }
    if (trimmed !== nodeData.label) updateNodeLabel(id, trimmed);
    setEditingNodeId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') {
      if (isFreshNode) applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: false } }]);
      setEditingNodeId(null);
    }
    e.stopPropagation();
  };

  const handleDelete = useCallback(() => {
    if (isRoot) return;
    const confirmed = hasChildren ? confirm(`Delete "${nodeData.label}" and all its children?`) : true;
    if (!confirmed) return;
    snapshot(graph);
    applyOperations([{ type: 'DELETE_NODE', payload: { nodeId: id, deleteChildren: hasChildren } }]);
  }, [isRoot, hasChildren, nodeData.label, id, graph, snapshot, applyOperations]);

  const handleAddChild = useCallback(() => {
    const newId = uuidv4();
    snapshot(graph);
    applyOperations([{ type: 'ADD_NODE', payload: { id: newId, label: '', parentId: id, source: 'text' } }]);
  }, [id, graph, snapshot, applyOperations]);

  const handleAddSibling = useCallback(() => {
    // Find parent of current node
    const parentEdge = Object.values(graph.edges).find((e) => e.target === id);
    const parentId = parentEdge?.source ?? graph.rootNodeId;
    const newId = uuidv4();
    snapshot(graph);
    applyOperations([{ type: 'ADD_NODE', payload: { id: newId, label: '', parentId, source: 'text' } }]);
  }, [id, graph, snapshot, applyOperations]);

  // Derive background: custom color overrides type default
  const bgStyle = nodeData.color
    ? { backgroundColor: nodeData.color + '33', borderColor: nodeData.color }
    : {};

  const dimmed = nodeData.isSearchActive && !nodeData.isSearchMatch;
  const highlighted = nodeData.isSearchActive && nodeData.isSearchMatch;

  return (
    <div
      className={`
        relative min-w-[120px] max-w-[200px] px-3 py-2 rounded-xl border text-sm
        cursor-pointer select-none transition-all duration-150
        ${nodeData.color ? '' : TYPE_BG[nodeType]}
        ${TYPE_BASE[nodeType]}
        ${isLowConfidence ? 'opacity-60 border-dashed' : ''}
        ${dimmed ? '!opacity-20' : ''}
        ${highlighted ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-950' : ''}
        hover:brightness-110 hover:scale-[1.02]
      `}
      style={bgStyle}
      onDoubleClick={startEditing}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowColorPicker(false); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowColorPicker((v) => !v); }}
      title="Double-click to edit · Right-click for colors · Hover: Enter=child, Shift+Enter=sibling, Del=delete"
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
            {nodeData.collapsed
              ? <span className="opacity-70">{nodeData.label} <span className="text-[10px] bg-white/10 rounded px-1">{nodeData.childCount}</span></span>
              : (nodeData.label || <span className="opacity-30 italic">empty</span>)
            }
          </span>
        )}
      </div>

      {/* Notes indicator */}
      {nodeData.hasNotes && !isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); setNotesNodeId(id); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -top-2 left-2 text-[10px] bg-blue-500/80 text-white rounded-full px-1.5 leading-4 hover:bg-blue-400"
          title="Has notes — click to view"
        >📝</button>
      )}

      {isLowConfidence && !isFreshNode && (
        <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-amber-500 text-black rounded-full px-1 leading-4">?</span>
      )}

      {/* Collapse/expand toggle — shown when node has children */}
      {hasChildren && !isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleCollapse(id); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute top-1/2 -translate-y-1/2 -right-5 w-4 h-4 rounded-full bg-gray-700 hover:bg-gray-500 text-gray-300 text-[9px] flex items-center justify-center transition-colors z-10"
          title={nodeData.collapsed ? 'Expand subtree' : 'Collapse subtree'}
        >
          {nodeData.collapsed ? '▶' : '◀'}
        </button>
      )}

      {/* Hover action buttons */}
      {hovered && !isEditing && (
        <>
          {!isRoot && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-[11px] leading-none shadow-md transition-colors z-10"
              title="Delete node (Del)"
            >✕</button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleAddChild(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center text-[13px] leading-none shadow-md transition-colors z-10"
            title="Add child (Enter)"
          >+</button>
          {/* Notes button */}
          <button
            onClick={(e) => { e.stopPropagation(); setNotesNodeId(id); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-2.5 left-1 w-5 h-5 rounded-full bg-blue-700 hover:bg-blue-500 text-white flex items-center justify-center text-[10px] leading-none shadow-md transition-colors z-10"
            title="Edit notes"
          >≡</button>
        </>
      )}

      {/* Color picker popover (right-click) */}
      {showColorPicker && (
        <div
          ref={colorPickerRef}
          className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl p-2 shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-gray-500 mb-1.5 px-0.5">Node color</p>
          <div className="flex gap-1.5 flex-wrap w-[120px]">
            {NODE_COLORS.map((c) => (
              <button
                key={c.name}
                title={c.name}
                onClick={() => { setNodeColor(id, c.value); setShowColorPicker(false); }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  c.value === null ? 'bg-gray-600 border-gray-400' : 'border-transparent'
                } ${nodeData.color === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
                style={c.value ? { backgroundColor: c.value } : {}}
              />
            ))}
          </div>
          <button
            onClick={() => { setNotesNodeId(id); setShowColorPicker(false); }}
            className="mt-2 w-full text-left text-[11px] text-gray-400 hover:text-gray-200 px-0.5 py-0.5 transition-colors"
          >
            ≡ Edit note…
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500 !border-gray-400" />
    </div>
  );
}
