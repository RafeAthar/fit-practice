import { useUIStore } from '../../store/uiSlice';

export function TranscriptDisplay() {
  const { interimTranscript, aiThinking, voiceStatus } = useUIStore();

  if (!interimTranscript && !aiThinking) return null;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm max-w-xl w-full mx-auto">
      {interimTranscript && (
        <p className="text-gray-300 leading-snug">
          <span className="text-gray-500 text-xs mr-2">{voiceStatus === 'listening' ? 'Hearing:' : 'You said:'}</span>
          {interimTranscript}
        </p>
      )}
      {aiThinking && (
        <p className="text-violet-400 leading-snug text-xs italic">
          <span className="font-semibold not-italic mr-1">AI:</span>
          {aiThinking}
        </p>
      )}
    </div>
  );
}
