import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── seeded random ── */
function seeded(s: number) {
  return () => { s = Math.sin(s) * 10000; return s - Math.floor(s); };
}

/* ── lerp helper ── */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpColor(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
}

/* ══════════════════════════════════════════════ */
/*  3D PRIMITIVES                                  */
/* ══════════════════════════════════════════════ */

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.2, 6]} />
        <meshStandardMaterial color="#8B5E3C" />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <coneGeometry args={[0.6, 1.2, 6]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <coneGeometry args={[0.45, 1.0, 6]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <coneGeometry args={[0.3, 0.8, 6]} />
        <meshStandardMaterial color="#15803d" />
      </mesh>
    </group>
  );
}

function Meeple({ position, color = '#e85d04', scale = 1, bobSpeed = 1.2 }: { position: [number, number, number]; color?: string; scale?: number; bobSpeed?: number }) {
  const ref = useRef<THREE.Group>(null!);
  const baseY = position[1];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.3;
    ref.current.position.y = baseY + Math.sin(clock.getElapsedTime() * bobSpeed) * 0.08;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 0.7, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.25, 0.5, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.28, 0.08, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.25, 0.5, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.28, 0.08, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Dice({ position, color = '#fef3c7', scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const baseY = position[1];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.x = t * 0.5;
    ref.current.rotation.z = t * 0.3;
    ref.current.position.y = baseY + Math.sin(t * 0.9) * 0.1;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function HexTile({ position, color = '#065f46', scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  return (
    <mesh position={position} scale={scale} rotation={[-Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.5, 0.5, 0.08, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function CardStack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[0, 0.04, 0.08, 0.12].map((y, i) => (
        <mesh key={i} position={[i * 0.02, y, i * 0.01]} rotation={[0, i * 0.08, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.7]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#fef9c3' : '#ecfdf5'} />
        </mesh>
      ))}
    </group>
  );
}

function Fireflies({ count = 80 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const rng = seeded(42);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rng() - 0.5) * 60;
      arr[i * 3 + 1] = rng() * 5 + 0.5;
      arr[i * 3 + 2] = (rng() - 0.5) * 60;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const p = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) p[i * 3 + 1] += Math.sin(t * 0.8 + i) * 0.002;
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#facc15" transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}




/* ══════════════════════════════════════════════ */
/*  SCROLL-DRIVEN CAMERA                          */
/* ══════════════════════════════════════════════ */

/* Camera path: we define waypoints along the Z axis.
   As the user scrolls, the camera moves from waypoint 0 → N,
   smoothly interpolating position, lookAt, and lighting. */

const WAYPOINTS = [
  { pos: [8, 5.5, 10], look: [0, 1.2, 2], fogNear: 8, fogFar: 26 },   // Hero – clearing (higher, more open)
  { pos: [5, 3, -8], look: [0, 0.8, -14], fogNear: 6, fogFar: 20 },   // Features – hex field
  { pos: [-4, 3.5, -24], look: [0, 0.6, -28], fogNear: 7, fogFar: 22 },   // How it works – board path
  { pos: [5, 4.5, -40], look: [0, 1.5, -44], fogNear: 5, fogFar: 18 },   // CTA – golden grove
] as const;

const BG_COLORS = [
  new THREE.Color('#e8f5e9'),
  new THREE.Color('#ecfdf5'),
  new THREE.Color('#f0fdf4'),
  new THREE.Color('#fefce8'),
];

function ScrollCamera({ scrollProgress }: { scrollProgress: number }) {
  const { scene } = useThree();
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const t = scrollProgress * (WAYPOINTS.length - 1);
    const idx = Math.min(Math.floor(t), WAYPOINTS.length - 2);
    const frac = t - idx;
    const smooth = frac * frac * (3 - 2 * frac); // smoothstep

    const a = WAYPOINTS[idx];
    const b = WAYPOINTS[idx + 1];

    camera.position.set(
      lerp(a.pos[0], b.pos[0], smooth),
      lerp(a.pos[1], b.pos[1], smooth),
      lerp(a.pos[2], b.pos[2], smooth),
    );

    lookTarget.set(
      lerp(a.look[0], b.look[0], smooth),
      lerp(a.look[1], b.look[1], smooth),
      lerp(a.look[2], b.look[2], smooth),
    );
    camera.lookAt(lookTarget);

    // Background + fog color
    lerpColor(BG_COLORS[idx], BG_COLORS[Math.min(idx + 1, BG_COLORS.length - 1)], smooth, tmpColor);
    scene.background = tmpColor.clone();
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(tmpColor);
      scene.fog.near = lerp(a.fogNear, b.fogNear, smooth);
      scene.fog.far = lerp(a.fogFar, b.fogFar, smooth);
    }
  });

  return null;
}

/* ══════════════════════════════════════════════ */
/*  THE CONTINUOUS WORLD                          */
/* ══════════════════════════════════════════════ */

function ContinuousWorld({ scrollProgress }: { scrollProgress: number }) {
  const rng1 = seeded(7);
  const rng2 = seeded(22);
  const rng3 = seeded(55);
  const rng4 = seeded(99);

  /* Zone 1: Hero clearing (z ≈ 0) — meeple circle */
  const zone1Trees = useMemo(() => {
    const list: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const a = rng1() * Math.PI * 2;
      const r = 5 + rng1() * 6;
      list.push({ pos: [Math.cos(a) * r, 0, Math.sin(a) * r], s: 0.6 + rng1() * 0.6 });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const meepleColors = ['#e85d04', '#0891b2', '#7c3aed', '#db2777', '#16a34a'];

  /* Zone 2: Feature hex field (z ≈ -14) */
  const zone2Trees = useMemo(() => {
    const list: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const a = rng2() * Math.PI * 2;
      const r = 4 + rng2() * 5;
      list.push({ pos: [Math.cos(a) * r, 0, -14 + Math.sin(a) * r], s: 0.5 + rng2() * 0.5 });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Zone 3: Board path (z ≈ -28) */
  const zone3Trees = useMemo(() => {
    const list: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const a = rng3() * Math.PI * 2;
      const r = 5 + rng3() * 5;
      list.push({ pos: [Math.cos(a) * r, 0, -28 + Math.sin(a) * r], s: 0.5 + rng3() * 0.5 });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Zone 4: Golden grove (z ≈ -44) */
  const zone4Trees = useMemo(() => {
    const list: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const a = rng4() * Math.PI * 2;
      const r = 4 + rng4() * 7;
      list.push({ pos: [Math.cos(a) * r, 0, -44 + Math.sin(a) * r], s: 0.7 + rng4() * 0.7 });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Connector trees between zones */
  const connectorTrees = useMemo(() => {
    const cRng = seeded(333);
    const list: { pos: [number, number, number]; s: number }[] = [];
    for (let z = -5; z > -42; z -= 1.5) {
      const x = (cRng() - 0.5) * 12;
      list.push({ pos: [x, 0, z], s: 0.4 + cRng() * 0.5 });
    }
    return list;
  }, []);

  return (
    <>
      <ScrollCamera scrollProgress={scrollProgress} />

      {/* Lighting (warm sunlit) */}
      <ambientLight intensity={0.55} color="#fffde7" />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#fff8e1" />
      <pointLight position={[0, 4, 0]} intensity={0.7} color="#fef08a" distance={16} />
      <pointLight position={[0, 4, -14]} intensity={0.6} color="#fef08a" distance={16} />
      <pointLight position={[0, 4, -28]} intensity={0.6} color="#d4f8e0" distance={16} />
      <pointLight position={[0, 5, -44]} intensity={1.0} color="#facc15" distance={16} />

      {/* Ground — one large plane spanning the whole world */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -22]} receiveShadow>
        <planeGeometry args={[60, 100]} />
        <meshStandardMaterial color="#3a7d44" />
      </mesh>


      {/* ── Zone 1: Hero – Meeple Clearing ── */}
      {zone1Trees.map((t, i) => <Tree key={`z1-${i}`} position={t.pos} scale={t.s} />)}
      {meepleColors.map((c, i) => {
        const a = (i / meepleColors.length) * Math.PI * 2;
        return <Meeple key={`m1-${i}`} position={[6 + Math.cos(a) * 1.5, 0, -6 + Math.sin(a) * 1.5]} color={c} scale={0.8} bobSpeed={1.0 + i * 0.15} />;
      })}

      {/* ── Zone 2: Features – Hex Tiles + Dice ── */}
      {zone2Trees.map((t, i) => <Tree key={`z2-${i}`} position={t.pos} scale={t.s} />)}
      {['#065f46', '#166534', '#14532d', '#047857', '#059669'].map((c, i) => (
        <HexTile key={`h-${i}`} position={[(i - 2) * 1.1, 0.12, -14 + Math.sin(i) * 0.8]} color={c} scale={1.2} />
      ))}
      <Dice position={[-1.5, 0.5, -12.5]} color="#fde68a" scale={0.7} />
      <Dice position={[2, 0.5, -15]} color="#bfdbfe" scale={0.6} />

      {/* ── Zone 3: Workflow – Board Path ── */}
      {zone3Trees.map((t, i) => <Tree key={`z3-${i}`} position={t.pos} scale={t.s} />)}
      <CardStack position={[-1.2, 0, -27.5]} />
      <CardStack position={[1.5, 0, -28.3]} />
      <Meeple position={[-0.5, 0, -29]} color="#0891b2" scale={0.7} />
      <Meeple position={[0.5, 0, -27]} color="#e85d04" scale={0.7} />
      <Meeple position={[1.8, 0, -28.8]} color="#7c3aed" scale={0.6} />
      {[-2, -1, 0, 1, 2].map((x, i) => (
        <HexTile key={`hp-${i}`} position={[x * 1.0, 0.02, -28.2 + Math.sin(i) * 0.5]} color={i % 2 === 0 ? '#065f46' : '#059669'} scale={0.9} />
      ))}
      <Dice position={[0, 0.5, -26]} color="#fef3c7" scale={0.5} />

      {/* ── Zone 4: CTA – Golden Grove + Giant Meeple ── */}
      {zone4Trees.map((t, i) => <Tree key={`z4-${i}`} position={t.pos} scale={t.s} />)}
      <Meeple position={[0, 0, -44]} color="#b45309" scale={1.8} bobSpeed={0.6} />
      <Dice position={[-2, 0.4, -43]} color="#fde68a" scale={0.5} />
      <Dice position={[2.2, 0.4, -44.8]} color="#c4b5fd" scale={0.5} />
      <Dice position={[0.5, 0.4, -41.5]} color="#a7f3d0" scale={0.4} />

      {/* ── Connector trees (fill gaps between zones) ── */}
      {connectorTrees.map((t, i) => <Tree key={`ct-${i}`} position={t.pos} scale={t.s} />)}

      {/* Fireflies everywhere */}
      <Fireflies count={120} />
    </>
  );
}

/* ══════════════════════════════════════════════ */
/*  EXPORTED COMPONENT                            */
/* ══════════════════════════════════════════════ */

export function ForestWorld({ scrollProgress, onReady }: { scrollProgress: number; onReady?: () => void }) {
  return (
    <Canvas
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      camera={{ position: [8, 5.5, 10], fov: 50 }}
      gl={{ antialias: true }}
      onCreated={() => { if (onReady) onReady(); }}
    >
      <fog attach="fog" args={['#e8f5e9', 8, 26]} />
      <ContinuousWorld scrollProgress={scrollProgress} />
    </Canvas>
  );
}
