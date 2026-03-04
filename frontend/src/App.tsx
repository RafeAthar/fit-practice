import { useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { MindMapCanvas } from './components/MindMap/MindMapCanvas';
import { VoiceButton } from './components/VoiceInput/VoiceButton';
import { TranscriptDisplay } from './components/VoiceInput/TranscriptDisplay';
import { CommandBar } from './components/TextInput/CommandBar';
import { MapToolbar } from './components/Toolbar/MapToolbar';
import { OperationConfirmModal } from './components/Confirmation/OperationConfirmModal';
import { useGraphStore } from './store/graphSlice';
import { useHistoryStore } from './store/historySlice';
import { useUIStore } from './store/uiSlice';
import { processInput } from './engine/aiEngine';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const { graph, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();
  const { voiceStatus, setVoiceStatus, setAiThinking, setFinalTranscript, setPendingOps, pendingOps } = useUIStore();

  const handleInput = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setFinalTranscript(text);
      setVoiceStatus('processing');
      setAiThinking('Analyzing your input...');

      try {
        const { ops, thinking, warnings } = await processInput(text, graph);
        setAiThinking(thinking);

        // Separate high-confidence ops from low-confidence ones
        const highConf: typeof ops = [];
        const lowConf: typeof ops = [];

        for (const op of ops) {
          const conf = op.type === 'ADD_NODE' ? (op.payload.confidence ?? 1) : 1;
          if (conf < 0.7) {
            lowConf.push(op);
          } else {
            highConf.push(op);
          }
        }

        if (highConf.length > 0) {
          snapshot(graph);
          applyOperations(highConf);
        }

        if (lowConf.length > 0) {
          setPendingOps([
            ...pendingOps,
            ...lowConf.map((op) => ({
              id: uuidv4(),
              operation: op,
              reason: 'Low confidence extraction — please confirm.',
            })),
          ]);
        }

        if (warnings.length > 0) {
          console.warn('[MindFlow] Operation warnings:', warnings);
        }
      } catch (e) {
        console.error('[MindFlow] AI processing error:', e);
        setAiThinking('');
      } finally {
        setVoiceStatus('idle');
        setTimeout(() => setAiThinking(''), 3000);
      }
    },
    [graph, applyOperations, snapshot, setVoiceStatus, setAiThinking, setFinalTranscript, setPendingOps, pendingOps]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('mindflow:undo'));
      }
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('mindflow:redo'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isProcessing = voiceStatus === 'processing';

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top toolbar */}
      <MapToolbar />

      {/* Main canvas — fills available height */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <MindMapCanvas />
        </ReactFlowProvider>
      </div>

      {/* Bottom input panel */}
      <div className="flex flex-col gap-2 p-3 pb-4 bg-gray-950/95 border-t border-white/5 backdrop-blur">
        <TranscriptDisplay />

        <div className="flex items-center gap-3 justify-center">
          <VoiceButton onFinalTranscript={handleInput} />

          <div className="text-gray-700 text-sm select-none">or</div>

          <div className="flex-1 max-w-md">
            <CommandBar
              onSubmit={handleInput}
              disabled={isProcessing}
              placeholder="Type a thought... (press / to focus)"
            />
          </div>
        </div>

        <p className="text-center text-xs text-gray-700">
          Speak or type your ideas — the map builds itself
        </p>
      </div>

      {/* Confirmation modal */}
      <OperationConfirmModal />
    </div>
  );
}
