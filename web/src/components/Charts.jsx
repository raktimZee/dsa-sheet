// Dependency-free SVG charts, styled for the terminal-dark theme.

// Circular completion gauge.
export function Donut({ value, total, size = 150, stroke = 14, color = '#3FB950' }) {
  const pct = total ? value / total : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#21262D" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x={cx} y={cx - 6} textAnchor="middle" fill="#E6EDF3" fontSize="26" fontWeight="800" fontFamily="JetBrains Mono, monospace">
        {Math.round(pct * 100)}%
      </text>
      <text x={cx} y={cx + 16} textAnchor="middle" fill="#8B949E" fontSize="12" fontFamily="JetBrains Mono, monospace">
        {value}/{total}
      </text>
    </svg>
  );
}

// Activity area chart (daily solve counts). Stretches to container width.
export function AreaChart({ series, height = 130, color = '#3FB950' }) {
  const W = 600;
  const H = 140;
  const pad = 8;
  const n = series.length;
  const max = Math.max(1, ...series.map((d) => d.count));
  const x = (i) => (n <= 1 ? pad : pad + (i / (n - 1)) * (W - pad * 2));
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  const labels = series.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n / 2));

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {series.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.count)} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between mt-xs text-[11px] text-on-surface-variant font-mono">
        {labels.map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

// Vertical bars for difficulty (done out of total).
export function DifficultyBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex items-end justify-around gap-md h-40 pt-md">
      {data.map((d) => {
        const totalH = (d.total / max) * 100;
        const doneH = d.total ? (d.done / d.total) * totalH : 0;
        return (
          <div key={d.label} className="flex flex-col items-center gap-xs flex-1">
            <div className="text-body-sm font-mono text-on-surface">{d.done}/{d.total}</div>
            <div className="relative w-10 flex-1 flex items-end" style={{ minHeight: '120px' }}>
              <div className="absolute bottom-0 w-full rounded-t bg-surface-container-high" style={{ height: `${totalH}%` }} />
              <div className="absolute bottom-0 w-full rounded-t transition-all duration-500" style={{ height: `${doneH}%`, background: d.color }} />
            </div>
            <div className="text-label-caps uppercase text-on-surface-variant">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
