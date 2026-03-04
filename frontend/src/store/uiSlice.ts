import { create } from 'zustand';
import type { PendingOperation } from '../types/graph';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error';

interface UIStore {
  voiceStatus: VoiceStatus;
  interimTranscript: string;
  finalTranscript: string;
  aiThinking: string;
  pendingOps: PendingOperation[];
  editingNodeId: string | null;

  setVoiceStatus: (s: VoiceStatus) => void;
  setInterimTranscript: (t: string) => void;
  setFinalTranscript: (t: string) => void;
  setAiThinking: (t: string) => void;
  setPendingOps: (ops: PendingOperation[]) => void;
  confirmPendingOp: (id: string) => void;
  rejectPendingOp: (id: string) => void;
  setEditingNodeId: (id: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  voiceStatus: 'idle',
  interimTranscript: '',
  finalTranscript: '',
  aiThinking: '',
  pendingOps: [],
  editingNodeId: null,

  setVoiceStatus: (voiceStatus) => set({ voiceStatus }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  setFinalTranscript: (finalTranscript) => set({ finalTranscript }),
  setAiThinking: (aiThinking) => set({ aiThinking }),
  setPendingOps: (pendingOps) => set({ pendingOps }),
  confirmPendingOp: (id) =>
    set((s) => ({ pendingOps: s.pendingOps.filter((p) => p.id !== id) })),
  rejectPendingOp: (id) =>
    set((s) => ({ pendingOps: s.pendingOps.filter((p) => p.id !== id) })),
  setEditingNodeId: (editingNodeId) => set({ editingNodeId }),
}));
