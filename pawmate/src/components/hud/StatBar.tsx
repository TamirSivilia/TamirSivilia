interface Props {
  label: string;
  value: number;
  max?: number;
  color: string;
  emoji: string;
}

export function StatBar({ label, value, max = 100, color, emoji }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const isDanger = pct < 30;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-4">{emoji}</span>
      <div className="flex-1 h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isDanger ? 'animate-pulse' : ''}`}
          style={{
            width: `${pct}%`,
            backgroundColor: isDanger ? '#ef4444' : color,
          }}
        />
      </div>
      <span className="text-xs text-gray-400 w-6 text-left ltr-num">{Math.round(value)}</span>
    </div>
  );
}
