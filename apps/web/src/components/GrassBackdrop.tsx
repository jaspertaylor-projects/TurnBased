import { useMemo, type CSSProperties } from 'react';

/**
 * Stationary swaying grass band that lives at the bottom of the editor
 * viewport. Persists across every section (Rules, Art, Component Editor,
 * Versions, App Layout) per Rule 4: the editor frame is stationary, the
 * contents inside scroll.
 *
 * Pure CSS, no framer-motion — the blades use a single keyframe animation
 * (`grassIdleSway` in index.css) with per-blade delays so the rows look
 * windswept instead of in lockstep.
 */

function bladeStyle(i: number, total: number, palette: BladePalette): CSSProperties {
  const x = (i / total) * 100;
  const height = palette.heightBase + ((i * 37) % palette.heightVar);
  // Width scales with the layer's median height so short blades stay slender
  // instead of going stubby. (heightBase + heightVar/2) / 6 keeps tall layers
  // at ~9-13px wide and short layers at ~3-5px wide.
  const medianHeight = palette.heightBase + palette.heightVar / 2;
  const widthBase = Math.max(2, Math.round(medianHeight / 8));
  const widthVar = Math.max(2, Math.round(medianHeight / 5));
  const width = widthBase + ((i * 11) % widthVar);
  const lean = -22 + ((i * 29) % 45);
  const hue = palette.hue + ((i * 13) % palette.hueRange);
  const light = palette.light + ((i * 7) % palette.lightRange);
  const delay = -((i * 0.073) % 1.8);
  const duration = 1.8 + ((i * 17) % 28) / 10;
  const z = i % 4;

  return {
    position: 'absolute',
    bottom: '2px',
    left: `${x}%`,
    height: `${height}px`,
    width: `${width}px`,
    zIndex: z,
    background: `linear-gradient(90deg, hsl(${hue} 64% ${light - 8}%), hsl(${hue + 8} 78% ${light + 8}%), hsl(${hue} 62% ${light - 4}%))`,
    // CSS custom property — the grassIdleSway keyframe reads --blade-lean
    // to keep each blade rotating around its own resting angle.
    ['--blade-lean' as string]: `${lean}deg`,
    transform: `translateX(-50%) rotate(${lean}deg)`,
    transformOrigin: 'bottom center',
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    opacity: 0.78 + (i % 5) * 0.04,
    borderRadius: '999px 999px 10px 10px',
    clipPath: 'polygon(50% 0%, 88% 30%, 100% 100%, 0% 100%, 12% 30%)',
    boxShadow: '0 1px 2px rgba(6,78,59,0.18)',
    animationName: 'grassIdleSway',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    willChange: 'transform',
  };
}

interface BladePalette {
  hue: number;
  hueRange: number;
  light: number;
  lightRange: number;
  heightBase: number;
  heightVar: number;
}

function GrassLayer({
  count,
  opacity,
  scaleY = 1,
  blur = 0,
  palette,
}: {
  count: number;
  opacity: number;
  scaleY?: number;
  blur?: number;
  palette: BladePalette;
}) {
  const blades = useMemo(() => Array.from({ length: count }), [count]);
  return (
    <div
      data-layout="grassLayer"
      /* one parallax row of blades */
      style={{
        position: 'absolute',
        inset: 'auto 0 0 0',
        height: '100%',
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        transform: scaleY === 1 ? undefined : `scaleY(${scaleY})`,
        transformOrigin: 'bottom center',
      }}
    >
      <div style={{ position: 'absolute', inset: 'auto -3% 0 -3%', height: '100%' }}>
        {blades.map((_, i) => (
          <span key={i} style={bladeStyle(i, count, palette)} />
        ))}
      </div>
    </div>
  );
}

export function GrassBackdrop({ height = 55 }: { height?: number }) {
  // Cozy-forest palette — deeper, softer greens than the user's reference
  // lime so the band reads as part of the magical forest aesthetic. Blade
  // heights are tuned so the tallest front blade still fits inside `height`
  // with a small safety margin.
  const backPalette: BladePalette = { hue: 132, hueRange: 14, light: 30, lightRange: 14, heightBase: 12, heightVar: 16 };
  const midPalette: BladePalette = { hue: 138, hueRange: 18, light: 36, lightRange: 16, heightBase: 16, heightVar: 22 };
  const frontPalette: BladePalette = { hue: 142, hueRange: 22, light: 40, lightRange: 18, heightBase: 20, heightVar: 28 };

  return (
    <div
      data-layout="grassBackdrop"
      /* stationary band anchored to the bottom of the editor viewport — see
         goldenrules Rule 4. Editor-viewport reserves matching paddingBottom
         so section content sits above this band rather than under it. */
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: `${height}px`,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {/* soft soil shadow at the very bottom — anchors the blades */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          height: '10px',
          background: 'linear-gradient(to top, rgba(6,78,59,0.45) 0%, rgba(6,78,59,0.08) 60%, transparent 100%)',
        }}
      />

      <GrassLayer count={70} opacity={0.55} scaleY={0.9} blur={0.6} palette={backPalette} />
      <GrassLayer count={100} opacity={0.85} scaleY={1.0} palette={midPalette} />
      <GrassLayer count={130} opacity={1.0} scaleY={1.08} palette={frontPalette} />
    </div>
  );
}
