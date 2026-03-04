import { useState, useRef, useEffect } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CommandBar({ onSubmit, disabled, placeholder = 'Type a thought or command...' }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue('');
  };

  // Focus on '/' shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full max-w-xl mx-auto">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="
          flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100
          placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8
          disabled:opacity-40 transition-all
        "
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="
          px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white
          hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors
        "
      >
        Send
      </button>
    </form>
  );
}
