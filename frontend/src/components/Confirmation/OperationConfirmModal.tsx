import { useUIStore } from '../../store/uiSlice';
import { useGraphStore } from '../../store/graphSlice';
import { useHistoryStore } from '../../store/historySlice';
import type { PendingOperation } from '../../types/graph';

export function OperationConfirmModal() {
  const { pendingOps, confirmPendingOp, rejectPendingOp } = useUIStore();
  const { graph, applyOperations } = useGraphStore();
  const { snapshot } = useHistoryStore();

  if (pendingOps.length === 0) return null;

  const op = pendingOps[0];

  const handleConfirm = () => {
    snapshot(graph);
    applyOperations([op.operation]);
    confirmPendingOp(op.id);
  };

  const handleReject = () => {
    rejectPendingOp(op.id);
  };

  const opLabel = getOpLabel(op);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none pb-32">
      <div className="pointer-events-auto mx-4 bg-gray-900 border border-amber-500/40 rounded-2xl p-4 shadow-xl max-w-sm w-full animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-lg mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-sm text-gray-200 font-medium mb-1">Low confidence suggestion</p>
            <p className="text-xs text-gray-400 mb-1">{op.reason}</p>
            <p className="text-xs text-amber-300/80 font-mono bg-amber-900/20 rounded px-2 py-1 border border-amber-700/30">
              {opLabel}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={handleReject}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-gray-700 transition-colors"
          >
            Ignore
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors"
          >
            Apply
          </button>
        </div>
        {pendingOps.length > 1 && (
          <p className="text-xs text-gray-600 mt-2 text-right">+{pendingOps.length - 1} more</p>
        )}
      </div>
    </div>
  );
}

function getOpLabel(pending: PendingOperation): string {
  const op = pending.operation;
  if (op.type === 'ADD_NODE') return `Add node: "${op.payload.label}"`;
  if (op.type === 'ADD_EDGE') return `Add edge: ${op.payload.sourceId} → ${op.payload.targetId}`;
  if (op.type === 'UPDATE_NODE') return `Update node ${op.payload.nodeId}: "${op.payload.label}"`;
  if (op.type === 'DELETE_NODE') return `Delete node ${op.payload.nodeId}`;
  return JSON.stringify(op);
}
