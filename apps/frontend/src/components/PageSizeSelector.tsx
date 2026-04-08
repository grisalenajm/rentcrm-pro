import type React from 'react';

const PAGE_SIZES = [10, 25, 50, 100];

interface Props {
  listKey: string;
  value: number;
  onChange: (size: number) => void;
}

export default function PageSizeSelector({ listKey, value, onChange }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = parseInt(e.target.value, 10);
    localStorage.setItem(`pageSize:${listKey}`, String(size));
    onChange(size);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      title="Registros por página"
      className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-400 focus:outline-none focus:border-emerald-500 cursor-pointer"
    >
      {PAGE_SIZES.map(s => (
        <option key={s} value={s}>{s} / pág.</option>
      ))}
    </select>
  );
}

export function getStoredPageSize(listKey: string, defaultSize = 25): number {
  if (typeof window === 'undefined') return defaultSize;
  const stored = localStorage.getItem(`pageSize:${listKey}`);
  return stored ? parseInt(stored, 10) : defaultSize;
}
