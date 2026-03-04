import { useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '../../store/uiSlice';

interface UseVoiceInputOptions {
  onFinalTranscript: (text: string) => void;
  silenceMs?: number;
}

export function useVoiceInput({ onFinalTranscript, silenceMs = 1500 }: UseVoiceInputOptions) {
  const { voiceStatus, setVoiceStatus, setInterimTranscript } = useUIStore();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef('');

  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceStatus('idle');
    setInterimTranscript('');
    accumulatedRef.current = '';
  }, [clearSilenceTimer, setVoiceStatus, setInterimTranscript]);

  const start = useCallback(() => {
    if (!isSupported) {
      setVoiceStatus('error');
      return;
    }
    if (voiceStatus === 'listening') { stop(); return; }

    const SpeechRecognitionImpl = window.SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;
    accumulatedRef.current = '';

    recognition.onstart = () => setVoiceStatus('listening');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalChunk) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalChunk.trim();
      }

      setInterimTranscript(accumulatedRef.current + (interim ? ' ' + interim : ''));

      // Reset silence timer on any speech activity
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        const text = accumulatedRef.current.trim();
        if (text) {
          onFinalTranscript(text);
          accumulatedRef.current = '';
          setInterimTranscript('');
        }
      }, silenceMs);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') setVoiceStatus('error');
    };

    recognition.onend = () => {
      // Auto-restart unless user explicitly stopped
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    recognition.start();
  }, [isSupported, voiceStatus, stop, silenceMs, clearSilenceTimer, onFinalTranscript, setVoiceStatus, setInterimTranscript]);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { start, stop, isSupported, isListening: voiceStatus === 'listening' };
}
