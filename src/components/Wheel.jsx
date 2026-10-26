import { SPIN_MS } from "../lib/roulette.js";

const R = 98;

const point = (deg, r) => {
  const rad = (deg * Math.PI) / 180;
  return [r * Math.sin(rad), -r * Math.cos(rad)];
};

function slicePath(start, size) {
  const [x0, y0] = point(start, R);
  const [x1, y1] = point(start + size, R);
  const large = size > 180 ? 1 : 0;
  return `M0 0 L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function Wheel({ segments, rotation, animate }) {
  return (
    <div className="wheel-wrap">
      <div className="pointer" aria-hidden="true" />
      <svg
        className="wheel"
        viewBox="-100 -100 200 200"
        role="img"
        aria-label="점심 메뉴 룰렛"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : "none",
        }}
      >
        {segments.length === 0 && <circle r={R} fill="#eadccf" />}
        {segments.map((s) => (
          <g key={s.id}>
            {s.size >= 359.99 ? (
              <circle r={R} fill={s.color} />
            ) : (
              <path d={slicePath(s.start, s.size)} fill={s.color} stroke="#fff" strokeWidth="1.2" />
            )}
            {/* 너무 좁은 칸은 글자를 생략 */}
            {s.size >= 12 && (
              <text
                transform={`rotate(${s.start + s.size / 2 - 90})`}
                x="88"
                textAnchor="end"
                dominantBaseline="central"
                fontSize={s.size >= 30 ? 10.5 : 8.5}
              >
                {s.name.length > 6 ? s.name.slice(0, 5) + "…" : s.name}
              </text>
            )}
          </g>
        ))}
        <circle r={R} fill="none" stroke="#2b2118" strokeWidth="3" />
      </svg>
      <div className="hub" aria-hidden="true">🍴</div>
    </div>
  );
}
