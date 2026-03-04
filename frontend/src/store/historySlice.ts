import { create } from 'zustand';
import type { GraphState } from '../types/graph';

const MAX_HISTORY = 50;

interface HistoryStore {
  past: GraphState[];
  future: GraphState[];
  snapshot: (state: GraphState) => void;
  undo: (current: GraphState) => GraphState | null;
  redo: (current: GraphState) => GraphState | null;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  snapshot: (state) =>
    set(({ past }) => ({
      past: [...past.slice(-MAX_HISTORY + 1), state],
      future: [],
    })),

  undo: (current) => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const prev = past[past.length - 1];
    set({ past: past.slice(0, -1), future: [current, ...future] });
    return prev;
  },

  redo: (current) => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set({ past: [...past, current], future: future.slice(1) });
    return next;
  },

  clear: () => set({ past: [], future: [] }),
}));
