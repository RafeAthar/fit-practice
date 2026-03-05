import { useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { MindMapCanvas } from './components/MindMap/MindMapCanvas';
import { VoiceButton } from './components/VoiceInput/VoiceButton';
import { TranscriptDisplay } from './components/VoiceInput/TranscriptDisplay';
import { CommandBar } from './components/TextInput/CommandBar';
import { MapToolbar } from './components/Toolbar/MapToolbar';
import { OperationConfirmModal } from './components/Confirmation/OperationConfirmModal';
import { SearchBar } from './components/Search/SearchBar';
import { NodeNotesPanel } from './components/Notes/NodeNotesPanel';
import { useGraphStore } from './store/graphSlice';
import { useHistoryStore } from './store/historySlice';
import { useUIStore } from './store/uiSlice';
import { processInput } from './engine/aiEngine';

export default function App() {
  const { graph, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();
  const {
    voiceStatus, setVoiceStatus, setAiThinking, setFinalTranscript,
    setPendingOps, pendingOps,
    isSearchOpen, setSearchOpen, setSearchQuery,
    notesNodeId,
  } = useUIStore();

  const handleInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setFinalTranscript(text);
    setVoiceStatus('processing');
    setAiThinking('Analyzing your input…');
    try {
      const { ops, thinking, warnings } = await processInput(text, graph);
      setAiThinking(thinking);
      const highConf = ops.filter((op) => op.type !== 'ADD_NODE' || (op.payload.confidence ?? 1) >= 0.7);
      const lowConf  = ops.filter((op) => op.type === 'ADD_NODE' && (op.payload.confidence ?? 1) < 0.7);
      if (highConf.length) { snapshot(graph); applyOperations(highConf); }
      if (lowConf.length) {
        setPendingOps([...pendingOps, ...lowConf.map((op) => ({ id: uuidv4(), operation: op, reason: 'Low confidence — confirm?' }))]);
      }
      if (warnings.length) console.warn('[MindFlow]', warnings);
    } catch (e) {
      console.error('[MindFlow] AI error:', e);
      setAiThinking('');
    } finally {
      setVoiceStatus('idle');
      setTimeout(() => setAiThinking(''), 3000);
    }
  }, [graph, applyOperations, snapshot, setVoiceStatus, setAiThinking, setFinalTranscript, setPendingOps, pendingOps]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); document.dispatchEvent(new CustomEvent('mindflow:undo')); }
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) { e.preventDefault(); document.dispatchEvent(new CustomEvent('mindflow:redo')); }
      if (ctrl && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (isSearchOpen) { setSearchOpen(false); setSearchQuery(''); } else setSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSearchOpen, setSearchOpen, setSearchQuery]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <MapToolbar />

      <div className="flex-1 relative overflow-hidden">
        <ReactFlowProvider>
          <MindMapCanvas />
        </ReactFlowProvider>

        {/* Search overlay */}
        {isSearchOpen && <SearchBar />}

        {/* Notes side panel */}
        {notesNodeId && <NodeNotesPanel />}
      </div>

      <div className="flex flex-col gap-2 p-3 pb-4 bg-gray-950/95 border-t border-white/5 backdrop-blur">
        <TranscriptDisplay />
        <div className="flex items-center gap-3 justify-center">
          <VoiceButton onFinalTranscript={handleInput} />
          <div className="text-gray-700 text-sm select-none">or</div>
          <div className="flex-1 max-w-md">
            <CommandBar onSubmit={handleInput} disabled={voiceStatus === 'processing'} placeholder="Type a thought… (/ to focus)" />
          </div>
        </div>
        <p className="text-center text-xs text-gray-700">Speak or type your ideas — the map builds itself</p>
      </div>

      <OperationConfirmModal />
    </div>
  );
}
