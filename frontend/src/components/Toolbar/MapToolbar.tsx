import { useCallback } from 'react';
import { toPng } from 'html-to-image';
import { useGraphStore } from '../../store/graphSlice';
import { useHistoryStore } from '../../store/historySlice';

export function MapToolbar() {
  const { graph, reset, loadGraph } = useGraphStore();
  const { undo, redo, snapshot } = useHistoryStore();

  const handleUndo = useCallback(() => {
    const prev = undo(graph);
    if (prev) loadGraph(prev);
  }, [graph, undo, loadGraph]);

  const handleRedo = useCallback(() => {
    const next = redo(graph);
    if (next) loadGraph(next);
  }, [graph, redo, loadGraph]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph]);

  const handleExportPNG = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#030712', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `mindmap-${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.error('PNG export failed', e);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!confirm('Start a new mind map? This will clear the current one.')) return;
    snapshot(graph);
    reset();
  }, [graph, snapshot, reset]);

  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.keys(graph.edges).length;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 border-b border-white/5 backdrop-blur">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3">
        <span className="text-violet-400 text-lg">◉</span>
        <span className="font-semibold text-white text-sm">MindFlow</span>
      </div>

      <div className="h-4 w-px bg-white/10" />

      {/* Undo/Redo */}
      <button onClick={handleUndo} title="Undo (Ctrl+Z)" className={toolbarBtn}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
      </button>
      <button onClick={handleRedo} title="Redo (Ctrl+Y)" className={toolbarBtn}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 15.7a8.01 8.01 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 15.5h9v-9l-3.6 4.1z"/></svg>
      </button>

      <div className="h-4 w-px bg-white/10" />

      {/* Export */}
      <button onClick={handleExportJSON} title="Export as JSON" className={toolbarBtn}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
        <span className="text-xs">JSON</span>
      </button>
      <button onClick={handleExportPNG} title="Export as PNG" className={toolbarBtn}>
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
        <span className="text-xs">PNG</span>
      </button>

      <div className="flex-1" />

      {/* Stats */}
      <span className="text-xs text-gray-600">{nodeCount} nodes · {edgeCount} edges</span>

      <div className="h-4 w-px bg-white/10" />

      {/* New */}
      <button onClick={handleReset} className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1">
        New map
      </button>
    </div>
  );
}

const toolbarBtn = 'flex items-center gap-1 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors';
