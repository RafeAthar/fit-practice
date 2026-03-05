import { useRef, useEffect } from 'react';
import { useUIStore } from '../../store/uiSlice';
import { useGraphStore } from '../../store/graphSlice';

export function SearchBar() {
  const { searchQuery, setSearchQuery, setSearchOpen } = useUIStore();
  const { graph } = useGraphStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const matchCount = searchQuery
    ? Object.values(graph.nodes).filter((n) => n.label.toLowerCase().includes(searchQuery.toLowerCase())).length
    : 0;

  const close = () => { setSearchOpen(false); setSearchQuery(''); };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-2xl px-3 py-2 shadow-2xl w-80">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gray-500 shrink-0">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') close(); e.stopPropagation(); }}
        placeholder="Search nodes…"
        className="flex-1 bg-transparent outline-none text-sm text-gray-100 placeholder:text-gray-600"
      />
      {searchQuery && (
        <span className="text-xs text-gray-500 shrink-0">
          {matchCount} match{matchCount !== 1 ? 'es' : ''}
        </span>
      )}
      <button onClick={close} className="text-gray-600 hover:text-gray-300 text-lg leading-none transition-colors">×</button>
    </div>
  );
}
