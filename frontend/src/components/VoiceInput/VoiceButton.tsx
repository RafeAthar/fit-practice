import { useVoiceInput } from './useVoiceInput';
import { useUIStore } from '../../store/uiSlice';

interface Props {
  onFinalTranscript: (text: string) => void;
}

export function VoiceButton({ onFinalTranscript }: Props) {
  const { voiceStatus } = useUIStore();
  const { start, isSupported, isListening } = useVoiceInput({ onFinalTranscript });

  if (!isSupported) {
    return (
      <div className="text-xs text-amber-400 px-3 py-2 bg-amber-900/30 rounded-lg border border-amber-700/50">
        Voice not supported in this browser. Use text input.
      </div>
    );
  }

  return (
    <button
      onClick={start}
      title={isListening ? 'Stop listening (click or press Space)' : 'Start voice input (click or press Space)'}
      className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200
        ${isListening
          ? 'bg-red-500/20 border border-red-400/60 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
          : voiceStatus === 'processing'
          ? 'bg-violet-500/20 border border-violet-400/60 text-violet-300'
          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'}
      `}
    >
      {/* Mic icon */}
      <span className="relative">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Zm-1 16.93V21h2v-3.07A7.002 7.002 0 0 0 19 11h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6 6.93Z" />
        </svg>
        {isListening && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />
        )}
      </span>
      <span>
        {isListening ? 'Listening...' : voiceStatus === 'processing' ? 'Processing...' : 'Speak'}
      </span>
    </button>
  );
}
