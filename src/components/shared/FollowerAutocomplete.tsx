import { useState, useRef, useEffect, useMemo } from 'react';
import { User, ChevronDown, X } from 'lucide-react';

export interface FollowerOption {
  name: string;
  bank: string;
  phone: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (option: FollowerOption) => void;
  options: FollowerOption[];
  placeholder?: string;
  id?: string;
}

export function FollowerAutocomplete({ value, onChange, onSelect, options, placeholder = 'Type follower name…', id }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const q = value.trim().toLowerCase();
    return options.filter(o =>
      o.name.toLowerCase().includes(q) ||
      o.bank.toLowerCase().includes(q) ||
      o.phone.includes(q)
    );
  }, [value, options]);

  /* close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (option: FollowerOption) => {
    onChange(option.name);
    onSelect(option);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0 && filtered[highlighted]) {
      e.preventDefault();
      handleSelect(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full h-10 pl-8 pr-16 border border-slate-200 rounded-lg text-sm focus:border-brand-green focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => { onChange(''); inputRef.current?.focus(); setOpen(true); }}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500 italic">
              <User size={13} className="text-slate-300" />
              <span>No matching follower — will be added as new record</span>
            </div>
          ) : (
            <ul>
              {filtered.map((opt, idx) => (
                <li
                  key={opt.name}
                  onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm select-none ${highlighted === idx ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                >
                  {/* Avatar circle */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${highlighted === idx ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {opt.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-900 truncate">{opt.name}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                      {opt.bank && (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold truncate max-w-[120px]">{opt.bank}</span>
                      )}
                      {opt.phone && (
                        <span className="text-slate-400">{opt.phone}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
