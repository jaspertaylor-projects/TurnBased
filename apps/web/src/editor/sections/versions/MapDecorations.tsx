/**
 * FantasyMapDecorations renders the static hand-drawn terrain layer for the
 * version map: rolling hills, pine forests, a little lake, scattered flowers,
 * and a compass rose in the corner. It is purely decorative (aria-hidden, no
 * pointer events) so it never interferes with the draggable commit nodes or
 * the meeple that travel across the trail above it.
 *
 * Placement is deterministic (seeded from the element index, never
 * `Math.random`) so the scenery stays put across re-renders instead of
 * shuffling every time the user drags the meeple.
 */

/** Stable pseudo-random in [0,1) so scenery never jitters between renders. */
function seeded(seed: number): number {
  const value = Math.sin(seed * 99.13 + 17.31) * 43758.5453;
  return value - Math.floor(value);
}

/** A single stylized pine tree planted at (x, y) with a soft ground shadow. */
function PineTree({ x, y, scale }: { x: number; y: number; scale: number }) {
  const w = 26 * scale;
  const h = 40 * scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={h * 0.02} rx={w * 0.5} ry={w * 0.18} fill="rgba(6,78,59,0.16)" />
      <rect x={-w * 0.07} y={-h * 0.22} width={w * 0.14} height={h * 0.3} rx={w * 0.05} fill="#7c5a3a" />
      <polygon points={`0,${-h} ${w * 0.5},${-h * 0.42} ${-w * 0.5},${-h * 0.42}`} fill="#2f6b46" />
      <polygon points={`0,${-h * 0.78} ${w * 0.42},${-h * 0.2} ${-w * 0.42},${-h * 0.2}`} fill="#3f8f5d" />
      <polygon points={`0,${-h * 0.52} ${w * 0.34},${-h * 0.02} ${-w * 0.34},${-h * 0.02}`} fill="#4ca36b" />
    </g>
  );
}

/** A round leafy bush/tree for variety alongside the pines. */
function RoundTree({ x, y, scale }: { x: number; y: number; scale: number }) {
  const r = 15 * scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={r * 0.55} rx={r * 1.1} ry={r * 0.32} fill="rgba(6,78,59,0.16)" />
      <rect x={-r * 0.12} y={0} width={r * 0.24} height={r * 0.7} rx={r * 0.1} fill="#7c5a3a" />
      <circle cx={0} cy={-r * 0.3} r={r} fill="#3f8f5d" />
      <circle cx={-r * 0.55} cy={r * 0.05} r={r * 0.7} fill="#4ca36b" />
      <circle cx={r * 0.55} cy={r * 0.02} r={r * 0.62} fill="#57b079" />
      <circle cx={-r * 0.25} cy={-r * 0.55} r={r * 0.55} fill="#63bd86" />
    </g>
  );
}

/** A distant snow-capped mountain for the far horizon band. */
function Mountain({ x, y, scale }: { x: number; y: number; scale: number }) {
  const w = 96 * scale;
  const h = 64 * scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon points={`0,${-h} ${w * 0.5},0 ${-w * 0.5},0`} fill="#b9ad95" />
      <polygon points={`0,${-h} ${w * 0.16},${-h * 0.55} ${-w * 0.16},${-h * 0.55}`} fill="#f4efe2" />
      <polygon
        points={`${w * 0.16},${-h * 0.55} ${w * 0.06},${-h * 0.42} ${w * 0.0},${-h * 0.55} ${-w * 0.08},${-h * 0.42} ${-w * 0.16},${-h * 0.55} 0,${-h}`}
        fill="#fbf8f0"
      />
      <polygon points={`0,${-h} ${w * 0.5},0 ${w * 0.08},0`} fill="rgba(99,90,68,0.18)" />
    </g>
  );
}

/** A small calm pond with a lighter shoreline ring. */
function Lake({ x, y, scale }: { x: number; y: number; scale: number }) {
  const rx = 64 * scale;
  const ry = 30 * scale;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <ellipse cx={0} cy={0} rx={rx + 7} ry={ry + 5} fill="rgba(132,204,168,0.45)" />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="#9fd6dd" />
      <ellipse cx={0} cy={-ry * 0.18} rx={rx * 0.82} ry={ry * 0.7} fill="#bde6ea" />
      <path d={`M ${-rx * 0.5} ${-ry * 0.1} q ${rx * 0.2} ${-ry * 0.25} ${rx * 0.42} 0`} stroke="rgba(255,255,255,0.7)" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d={`M ${rx * 0.04} ${ry * 0.28} q ${rx * 0.18} ${-ry * 0.22} ${rx * 0.38} 0`} stroke="rgba(255,255,255,0.6)" strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** A tiny flower cluster (three petals + center) used to dot the meadow. */
function Flower({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx={-3} cy={0} r={2.4} fill={color} />
      <circle cx={3} cy={0} r={2.4} fill={color} />
      <circle cx={0} cy={-3} r={2.4} fill={color} />
      <circle cx={0} cy={3} r={2.4} fill={color} />
      <circle cx={0} cy={0} r={1.8} fill="#f6d36b" />
    </g>
  );
}

/** Parchment compass rose anchored in a corner of the map. */
function CompassRose({ x, y }: { x: number; y: number }) {
  const r = 34;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx={0} cy={0} r={r + 4} fill="rgba(239,228,200,0.85)" stroke="rgba(107,88,54,0.5)" strokeWidth={1.5} />
      <circle cx={0} cy={0} r={r} fill="none" stroke="rgba(107,88,54,0.4)" strokeWidth={1} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1={0}
          y1={0}
          x2={Math.sin((deg * Math.PI) / 180) * r}
          y2={-Math.cos((deg * Math.PI) / 180) * r}
          stroke="rgba(107,88,54,0.3)"
          strokeWidth={deg % 90 === 0 ? 1.4 : 0.8}
        />
      ))}
      <polygon points={`0,${-r} 6,0 0,8 -6,0`} fill="#c0563b" />
      <polygon points={`0,${r} -6,0 0,-8 6,0`} fill="#6b5836" />
      <polygon points={`${r},0 0,6 -8,0 0,-6`} fill="#a98a52" />
      <polygon points={`${-r},0 0,-6 8,0 0,6`} fill="#8a6f44" />
      <circle cx={0} cy={0} r={3.4} fill="#efe4c8" stroke="#6b5836" strokeWidth={1} />
      <text x={0} y={-r - 9} textAnchor="middle" fontSize={11} fontWeight={800} fill="#6b5836">N</text>
    </g>
  );
}

export function FantasyMapDecorations({ width, height }: { width: number; height: number }) {
  // Distant mountains hug the very top horizon band.
  const mountains = Array.from({ length: Math.max(3, Math.round(width / 260)) }, (_, index) => ({
    x: 70 + seeded(index + 1) * (width - 140),
    y: 92 + seeded(index + 7) * 26,
    scale: 0.8 + seeded(index + 3) * 0.6,
  }));

  // Trees ring the meadow margins (top forest band + bottom border) so they
  // frame the journey without colliding with the central trail of nodes.
  const trees = Array.from({ length: Math.max(10, Math.round((width * height) / 26000)) }, (_, index) => {
    const topBand = seeded(index + 11) > 0.5;
    const x = 36 + seeded(index + 5) * (width - 72);
    const y = topBand
      ? 120 + seeded(index + 13) * 60
      : height - 36 - seeded(index + 17) * 70;
    return {
      x,
      y,
      scale: 0.7 + seeded(index + 23) * 0.7,
      pine: seeded(index + 29) > 0.45,
      key: index,
    };
  });

  // A scatter of meadow flowers for cozy texture across the lower field.
  const flowerPalette = ['#e9a6c0', '#f4b9d2', '#c4b0e6', '#f6d36b'];
  const flowers = Array.from({ length: Math.max(16, Math.round((width * height) / 14000)) }, (_, index) => ({
    x: 28 + seeded(index + 31) * (width - 56),
    y: 200 + seeded(index + 37) * (height - 260),
    color: flowerPalette[index % flowerPalette.length],
    key: index,
  }));

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* far horizon mountains */}
      {mountains.map((mountain, index) => (
        <Mountain key={`m-${index}`} x={mountain.x} y={mountain.y} scale={mountain.scale} />
      ))}

      {/* a calm lake tucked into the lower-left meadow */}
      <Lake x={width * 0.24} y={height * 0.74} scale={Math.min(1.1, width / 720)} />

      {/* meadow flowers dotted across the field */}
      {flowers.map((flower) => (
        <Flower key={`f-${flower.key}`} x={flower.x} y={flower.y} color={flower.color} />
      ))}

      {/* forest framing the journey, sorted by y so nearer trees overlap farther ones */}
      {trees
        .slice()
        .sort((left, right) => left.y - right.y)
        .map((tree) =>
          tree.pine ? (
            <PineTree key={`t-${tree.key}`} x={tree.x} y={tree.y} scale={tree.scale} />
          ) : (
            <RoundTree key={`t-${tree.key}`} x={tree.x} y={tree.y} scale={tree.scale} />
          ),
        )}

      {/* compass rose anchored in the top-right corner of the map */}
      <CompassRose x={width - 64} y={72} />
    </svg>
  );
}
