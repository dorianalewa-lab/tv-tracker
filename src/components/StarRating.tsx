import { Star } from 'lucide-react';

type Props = {
  value: number | null;             // 0..max
  onChange: (v: number | null) => void;
  max?: number;                      // par défaut 10 (échelle IMDB)
  size?: number;
};

export function StarRating({ value, onChange, max = 10, size = 20 }: Props) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Note">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            role="radio"
            aria-checked={active}
            aria-label={`${n} / ${max}`}
            onClick={() => onChange(value === n ? null : n)}
            className="p-0.5 -m-0.5 active:scale-90 transition-transform"
          >
            <Star
              size={size}
              className={active ? 'text-accent' : 'text-muted'}
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
      {value != null && (
        <span className="ml-2 text-sm font-semibold text-accent">{value}<span className="text-muted text-xs">/{max}</span></span>
      )}
    </div>
  );
}
