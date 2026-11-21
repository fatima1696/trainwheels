import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction, Composition, Folder, Sequence, Series, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {loadFont} from '@remotion/google-fonts/Poppins';

const {fontFamily} = loadFont('normal', {weights: ['500', '800', '900'], subsets: ['latin']});
const FONT = `${fontFamily}, Helvetica, Arial, sans-serif`;

/* =====================================================================
   STYLE: change the whole look here (colours only).
   ===================================================================== */
const S = {
  bg0: '#16283D', bg1: '#070C14',
  steelLight: '#E3ECF5', steelMid: '#9AABBD', steelDark: '#5B6C80',
  rail: '#7F93A8', railDark: '#44546A',
  amber: '#FFB547', amberHot: '#FFF1C9', cyan: '#4FD1C5',
  text: '#F4F7FA', ink: '#05080D', sleeper: '#2A3646', ballast: '#1B2634',
};

const FPS = 30;
const W = 1080;
const H = 1920;

/* =====================================================================
   SCRIPT: one entry per scene. sec = length in seconds.
   ===================================================================== */
const BEATS = [
  {id: 'Aerial', sec: 4, text: 'A train has no steering, yet it follows every curve.'},
  {id: 'Cone', sec: 7, text: 'The secret is the shape of its wheels. They are not flat. They are slightly cone-shaped.'},
  {id: 'Axle', sec: 5, text: 'Both wheels sit on one solid axle, so they turn together.'},
  {id: 'Drift', sec: 5, text: 'On a curve, the train drifts a little outward.'},
  {id: 'Radii', sec: 7, text: 'The outer wheel now rolls on its wider part. The inner wheel rolls on its narrower part.'},
  {id: 'Circles', sec: 5, text: 'A wider part covers more distance in each turn.'},
  {id: 'Yaw', sec: 6, text: 'So the outer wheel travels farther, and the axle turns with the curve.'},
  {id: 'Restore', sec: 6, text: 'If the train drifts too far, the shape pushes it back to the center.'},
  {id: 'Flange', sec: 5, text: 'The metal rim on the wheel, the flange, is only a backup.'},
  {id: 'Final', sec: 4, text: 'A simple cone shape does the steering.'},
];
const TOTAL = BEATS.reduce((n, b) => n + b.sec * FPS, 0);

/* ---------- small helpers ---------- */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const prog = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeInOutQuint = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
};
const deg = (r: number) => (r * 180) / Math.PI;

/* ---------- camera: zoom / look-at / roll keyframes ---------- */
type Key = {f: number; s: number; fx?: number; fy?: number; r?: number; ease?: (t: number) => number};

const camAt = (frame: number, keys: Key[]) => {
  let a = keys[0];
  let b = keys[0];
  let p = 0;
  const last = keys[keys.length - 1];
  if (frame >= last.f) {
    a = b = last;
  } else if (frame > keys[0].f) {
    for (let i = 0; i < keys.length - 1; i++) {
      if (frame <= keys[i + 1].f) {
        a = keys[i];
        b = keys[i + 1];
        p = (frame - a.f) / (b.f - a.f);
        break;
      }
    }
  }
  const e = (b.ease ?? easeInOut)(p);
  return {
    s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), e)),
    fx: lerp(a.fx ?? W / 2, b.fx ?? W / 2, e),
    fy: lerp(a.fy ?? H / 2, b.fy ?? H / 2, e),
    r: lerp(a.r ?? 0, b.r ?? 0, e),
  };
};

const Camera: React.FC<{frame: number; keys: Key[]; children: React.ReactNode}> = ({frame, keys, children}) => {
  const {s, fx, fy, r} = camAt(frame, keys);
  const rad = (r * Math.PI) / 180;
  const dx = fx - W / 2;
  const dy = fy - H / 2;
  const tx = -s * (Math.cos(rad) * dx - Math.sin(rad) * dy);
  const ty = -s * (Math.sin(rad) * dx + Math.cos(rad) * dy);
  return (
    <AbsoluteFill style={{transformOrigin: '50% 50%', transform: `translate(${tx}px, ${ty}px) rotate(${r}deg) scale(${s})`}}>
      {children}
    </AbsoluteFill>
  );
};

/* ---------- shell: background, vignette, drawing surface ---------- */
const Defs: React.FC = () => (
  <defs>
    <radialGradient id="bg" gradientUnits="userSpaceOnUse" cx="540" cy="960" r="1500">
      <stop offset="0" stopColor={S.bg0} />
      <stop offset="1" stopColor={S.bg1} />
    </radialGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={S.steelDark} />
      <stop offset="0.45" stopColor={S.steelLight} />
      <stop offset="1" stopColor={S.steelMid} />
    </linearGradient>
    <linearGradient id="steelV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={S.steelLight} />
      <stop offset="1" stopColor={S.railDark} />
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stopColor={S.amberHot} stopOpacity="1" />
      <stop offset="0.35" stopColor={S.amber} stopOpacity="0.75" />
      <stop offset="1" stopColor={S.amber} stopOpacity="0" />
    </radialGradient>
    <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stopColor={S.amber} stopOpacity="0.55" />
      <stop offset="1" stopColor={S.amber} stopOpacity="0" />
    </linearGradient>
    <pattern id="grid" width="90" height="90" patternUnits="userSpaceOnUse">
      <path d="M 90 0 L 0 0 0 90" fill="none" stroke="#9FB6CF" strokeWidth="1.5" opacity="0.07" />
    </pattern>
  </defs>
);

const Backdrop: React.FC = () => (
  <>
    <rect x={-9000} y={-9000} width={18000} height={18000} fill={S.bg1} />
    <rect x={-3200} y={-3200} width={7480} height={8320} fill="url(#bg)" />
    <rect x={-3200} y={-3200} width={7480} height={8320} fill="url(#grid)" />
  </>
);

const Shell: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{backgroundColor: S.bg1, overflow: 'hidden'}}>
    {children}
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      <defs>
        <radialGradient id="vig" cx="50%" cy="50%" r="75%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#vig)" />
    </svg>
  </AbsoluteFill>
);

const World: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <Defs />
    <Backdrop />
    {children}
  </svg>
);

const Pill: React.FC<{x: number; y: number; text: string; appear: number}> = ({x, y, text, appear}) => {
  const w = text.length * 27 + 70;
  const a = easeOut(clamp01(appear));
  return (
    <g transform={`translate(${x} ${y}) scale(${0.7 + 0.3 * a})`} opacity={a}>
      <rect x={-w / 2} y={-38} width={w} height={76} rx={38} fill={S.bg1} stroke={S.amber} strokeWidth={5} />
      <text textAnchor="middle" y={12} fontSize={34} fontWeight={800} fontFamily={FONT} fill={S.amber} letterSpacing={3}>
        {text}
      </text>
    </g>
  );
};

const Glow: React.FC<{x: number; y: number; r: number; o?: number}> = ({x, y, r, o = 1}) => (
  <g opacity={o}>
    <circle cx={x} cy={y} r={r} fill="url(#glow)" />
    <circle cx={x} cy={y} r={Math.max(5, r * 0.12)} fill={S.amberHot} />
  </g>
);

/* =====================================================================
   WHEELSET GEOMETRY (numbers are exaggerated so the cone is visible;
   real treads are far gentler)
   ===================================================================== */
const RAIL_Y = 1360; // top of the rail heads
const XL = 180; // left rail centre
const XR = 900; // right rail centre
const TREAD = 180; // width of the running surface
const FL = 44; // flange thickness
const FH = 34; // flange height
const R0 = 300; // wheel radius at the middle of the tread
const RH = 26; // half width of the rail head
const SLOPE = 0.26; // how fast the radius shrinks across the tread
const GAP = 64; // sideways play before the flange touches the rail

/* ---------- front view (looking along the track) ---------- */
const wheelGeom = (side: 1 | -1, d: number, slope: number) => {
  const xc = side === 1 ? XR : XL;
  const xm = xc + d; // middle of the tread
  const Rc = R0 + side * slope * d; // radius at the rail contact
  const cy = RAIL_Y - Rc; // axle height for this wheel
  const T2 = TREAD / 2;
  const r = (u: number) => R0 - slope * u; // u = distance outward from the tread middle
  const P = (u: number, dy: number) => `${(xm + side * u).toFixed(1)},${(cy + dy).toFixed(1)}`;
  const r1 = r(-T2);
  const r2 = r(T2);
  const pts = [
    P(-T2 - FL, r1 + FH), P(-T2, r1 + FH), P(-T2, r1), P(T2, r2),
    P(T2, -r2), P(-T2, -r1), P(-T2, -r1 - FH), P(-T2 - FL, -r1 - FH),
  ].join(' ');
  return {xc, xm, Rc, cy, pts, r, T2, side, r1};
};

const Rail: React.FC<{x: number}> = ({x}) => (
  <g>
    <rect x={x - 46} y={RAIL_Y + 104} width={92} height={16} rx={4} fill={S.railDark} />
    <rect x={x - 12} y={RAIL_Y + 30} width={24} height={78} fill={S.rail} />
    <rect x={x - RH} y={RAIL_Y} width={2 * RH} height={36} rx={14} fill="url(#steelV)" stroke={S.ink} strokeWidth={3} />
  </g>
);

type ElevProps = {
  d: number; slope: number; frame: number;
  taper?: number; radii?: number; glow?: number; flange?: number;
};

const Elevation: React.FC<ElevProps> = ({d, slope, frame, taper = 0, radii = 0, glow = 1, flange = 0}) => {
  const gR = wheelGeom(1, d, slope);
  const gL = wheelGeom(-1, d, slope);
  const pulse = 1 + 0.1 * Math.sin(frame * 0.25);
  const wheels = [gL, gR];
  return (
    <g>
      <rect x={-3200} y={RAIL_Y + 118} width={7480} height={4000} fill={S.ballast} />
      <rect x={20} y={RAIL_Y + 118} width={1040} height={64} fill={S.sleeper} stroke={S.ink} strokeWidth={4} />
      <Rail x={XL} />
      <Rail x={XR} />
      {/* axle */}
      <line x1={gL.xm} y1={gL.cy} x2={gR.xm} y2={gR.cy} stroke={S.steelDark} strokeWidth={46} strokeLinecap="round" />
      <line x1={gL.xm} y1={gL.cy - 10} x2={gR.xm} y2={gR.cy - 10} stroke={S.steelLight} strokeWidth={10} opacity={0.7} />
      {wheels.map((g) => {
        const xa = g.xm + g.side * (-g.T2 + 24);
        const xb = g.xm + g.side * (g.T2 - 24);
        return (
          <g key={g.side}>
            <polygon points={g.pts} fill="url(#steel)" stroke={S.ink} strokeWidth={4} strokeLinejoin="round" />
            <rect x={Math.min(xa, xb)} y={g.cy - (R0 - 80)} width={Math.abs(xb - xa)} height={2 * (R0 - 80)} rx={16}
              fill="none" stroke={S.cyan} strokeOpacity={0.35} strokeWidth={3} />
            <circle cx={g.xm} cy={g.cy} r={30} fill={S.steelMid} stroke={S.ink} strokeWidth={4} />
            {/* flange highlight */}
            {flange > 0 && (
              <>
                <rect x={Math.min(g.xm + g.side * (-g.T2 - FL), g.xm + g.side * -g.T2)} y={g.cy + g.r1} width={FL} height={FH} fill={S.amber} opacity={flange * 0.9} />
                <rect x={Math.min(g.xm + g.side * (-g.T2 - FL), g.xm + g.side * -g.T2)} y={g.cy - g.r1 - FH} width={FL} height={FH} fill={S.amber} opacity={flange * 0.9} />
              </>
            )}
            {/* the cone: tread line, slightly extended */}
            {taper > 0 && (
              <>
                <line x1={g.xm + g.side * -g.T2} y1={g.cy + g.r(-g.T2)} x2={g.xm + g.side * g.T2} y2={g.cy + g.r(g.T2)}
                  stroke={S.amber} strokeWidth={6} strokeLinecap="round" opacity={taper} />
                <line x1={g.xm + g.side * g.T2} y1={g.cy + g.r(g.T2)} x2={g.xm + g.side * (g.T2 + 110)} y2={g.cy + g.r(g.T2 + 110)}
                  stroke={S.amber} strokeWidth={4} strokeDasharray="12 10" opacity={taper * 0.8} />
              </>
            )}
            {/* radius: from the axle down to where the wheel touches the rail */}
            {radii > 0 && (
              <g opacity={radii}>
                <line x1={g.xc} y1={g.cy} x2={g.xc} y2={RAIL_Y} stroke={S.amber} strokeWidth={5} strokeDasharray="14 10" />
                <circle cx={g.xc} cy={g.cy} r={9} fill={S.cyan} />
              </g>
            )}
          </g>
        );
      })}
      {glow > 0 && wheels.map((g) => <Glow key={g.side} x={g.xc} y={RAIL_Y} r={64 * pulse} o={glow} />)}
      {flange > 0 && <Glow x={gR.xm - gR.T2} y={RAIL_Y + 18} r={110 * pulse} o={flange * prog(d, GAP - 8, GAP)} />}
    </g>
  );
};

/* ---------- top view ---------- */
const planPts = (side: 1 | -1) => {
  const T2 = TREAD / 2;
  const r1 = R0 + SLOPE * T2;
  const r2 = R0 - SLOPE * T2;
  const xm = side * 360;
  const X = (u: number) => xm + side * u;
  const q: [number, number][] = [
    [-T2 - FL, -(r1 + FH)], [-T2, -(r1 + FH)], [-T2, -r1], [T2, -r2],
    [T2, r2], [-T2, r1], [-T2, r1 + FH], [-T2 - FL, r1 + FH],
  ];
  return q.map(([u, y]) => `${X(u).toFixed(1)},${y.toFixed(1)}`).join(' ');
};

// A wheelset seen from above, drawn around (0, 0). phi = how far the wheels have turned.
const PlanWheelset: React.FC<{phi: number; frame: number; pulses?: boolean}> = ({phi, frame, pulses = true}) => {
  const T2 = TREAD / 2;
  const r1 = R0 + SLOPE * T2;
  const r2 = R0 - SLOPE * T2;
  const N = 14;
  const stripes: React.ReactNode[] = [];
  for (const side of [-1, 1] as const) {
    const xm = side * 360;
    for (let k = 0; k < N; k++) {
      const a = phi + (k * 2 * Math.PI) / N;
      const c = Math.cos(a);
      if (c < 0.05) continue;
      const sn = Math.sin(a);
      stripes.push(
        <line key={`${side}-${k}`} x1={xm - side * T2} y1={r1 * sn} x2={xm + side * T2} y2={r2 * sn}
          stroke={k === 0 ? S.amber : S.ink} strokeWidth={k === 0 ? 7 : 5} opacity={c * (k === 0 ? 1 : 0.55)} strokeLinecap="round" />,
      );
    }
  }
  const t = (frame * 0.035) % 1;
  return (
    <g>
      <rect x={-360} y={-22} width={720} height={44} rx={14} fill={S.steelMid} stroke={S.ink} strokeWidth={4} />
      <rect x={-360} y={-12} width={720} height={10} rx={5} fill={S.steelLight} opacity={0.7} />
      {[-1, 1].map((side) => (
        <polygon key={side} points={planPts(side as 1 | -1)} fill="url(#steel)" stroke={S.ink} strokeWidth={4} strokeLinejoin="round" />
      ))}
      {stripes}
      {pulses && (
        <>
          <Glow x={lerp(-226, 226, t)} y={0} r={46} />
          <Glow x={lerp(226, -226, t)} y={0} r={46} o={0.6} />
        </>
      )}
    </g>
  );
};

// Curved track made of circles around a centre. Rotate the whole group to make the track slide past.
const ArcTrack: React.FC<{cx: number; cy: number; rc: number; n?: number}> = ({cx, cy, rc, n = 90}) => {
  let sl = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    sl += `M ${(cx + (rc - 430) * c).toFixed(1)} ${(cy + (rc - 430) * s).toFixed(1)} L ${(cx + (rc + 430) * c).toFixed(1)} ${(cy + (rc + 430) * s).toFixed(1)} `;
  }
  return (
    <g>
      <path d={sl} stroke={S.sleeper} strokeWidth={30} fill="none" />
      {[-360, 360].map((o) => (
        <g key={o}>
          <circle cx={cx} cy={cy} r={rc + o} fill="none" stroke={S.railDark} strokeWidth={44} />
          <circle cx={cx} cy={cy} r={rc + o} fill="none" stroke={S.rail} strokeWidth={26} />
          <circle cx={cx} cy={cy} r={rc + o} fill="none" stroke={S.steelLight} strokeWidth={6} opacity={0.5} />
        </g>
      ))}
    </g>
  );
};

/* ---------- the train (top view), heading "up" when rotation = 0 ---------- */
const Car: React.FC<{head?: boolean}> = ({head}) => (
  <g>
    {[-100, 40].map((y) => [-104, 84].map((x) => <rect key={`${x}${y}`} x={x} y={y} width={20} height={60} rx={6} fill={S.ink} />))}
    {head && <polygon points="-40,-150 -170,-560 170,-560 40,-150" fill="url(#beam)" />}
    <rect x={-84} y={-150} width={168} height={300} rx={36} fill="url(#steel)" stroke={S.ink} strokeWidth={5} />
    <rect x={-58} y={-124} width={116} height={248} rx={24} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={3} />
    {[0, 1, 2, 3, 4, 5].map((k) => (
      <g key={k}>
        <rect x={-76} y={-112 + k * 40} width={13} height={26} rx={4} fill={S.bg1} opacity={0.8} />
        <rect x={63} y={-112 + k * 40} width={13} height={26} rx={4} fill={S.bg1} opacity={0.8} />
      </g>
    ))}
    <rect x={-84} y={-4} width={168} height={8} fill={S.amber} opacity={0.9} />
    {head && (
      <>
        <circle cx={-40} cy={-146} r={10} fill={S.amberHot} />
        <circle cx={40} cy={-146} r={10} fill={S.amberHot} />
      </>
    )}
  </g>
);

const AERIAL = {cx: -700, cy: 960, rc: 1240};
const Train: React.FC<{phiHead: number}> = ({phiHead}) => (
  <g>
    {[0, 1, 2, 3, 4, 5].map((i) => {
      const a = phiHead + (i + 0.5) * (324 / AERIAL.rc);
      const x = AERIAL.cx + AERIAL.rc * Math.cos(a);
      const y = AERIAL.cy + AERIAL.rc * Math.sin(a);
      return (
        <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg(a).toFixed(2)})`}>
          <Car head={i === 0} />
        </g>
      );
    })}
  </g>
);

/* =====================================================================
   SCENES
   ===================================================================== */

// 1. Hook: the whole train on a curve. Fast pull-out from the nose of the train.
const Scene1Aerial: React.FC = () => {
  const frame = useCurrentFrame();
  const keys: Key[] = [
    {f: 0, s: 3.4, fx: 538, fy: 760, r: 6},
    {f: 85, s: 0.62, fx: 150, fy: 900, r: -8, ease: easeOut},
    {f: 120, s: 0.66, fx: 120, fy: 880, r: -10},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <ArcTrack cx={AERIAL.cx} cy={AERIAL.cy} rc={AERIAL.rc} n={110} />
      <Train phiHead={-0.06 - frame * 0.0042} />
    </World></Camera></Shell>
  );
};

// 2. The cone: a flat wheel tilts into a cone. Push in on the tread, then pull back.
const Scene2Cone: React.FC = () => {
  const frame = useCurrentFrame();
  const slope = SLOPE * easeInOut(prog(frame, 70, 135));
  const keys: Key[] = [
    {f: 0, s: 2.8, fx: 900, fy: 1340, r: 0},
    {f: 70, s: 1.0, fx: 540, fy: 1100, r: 0, ease: easeOut},
    {f: 135, s: 1.8, fx: 810, fy: 1330, r: -3},
    {f: 210, s: 0.95, fx: 540, fy: 1100, r: 0, ease: easeOut},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <Elevation d={0} slope={slope} frame={frame} taper={prog(frame, 100, 140)} />
      <Pill x={540} y={RAIL_Y + 330} text="CONICAL TREAD" appear={prog(frame, 150, 170)} />
    </World></Camera></Shell>
  );
};

// 3. One solid axle: both wheels turn in step.
const Scene3Axle: React.FC = () => {
  const frame = useCurrentFrame();
  const speed = 0.07;
  const off = (frame * speed * R0) % 120;
  const keys: Key[] = [
    {f: 0, s: 1.5, fx: 540, fy: 960, r: -8},
    {f: 70, s: 0.95, fx: 540, fy: 960, r: 6},
    {f: 110, s: 1.3, fx: 380, fy: 900, r: 0},
    {f: 150, s: 0.8, fx: 540, fy: 960, r: 0, ease: easeOut},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <rect x={20} y={-3000} width={1040} height={8000} fill={S.ballast} opacity={0.6} />
      {Array.from({length: 40}, (_, i) => (
        <rect key={i} x={60} y={-1800 + i * 120 + off} width={960} height={30} rx={6} fill={S.sleeper} />
      ))}
      {[XL, XR].map((x) => (
        <g key={x}>
          <rect x={x - 22} y={-3000} width={44} height={8000} fill={S.railDark} />
          <rect x={x - 13} y={-3000} width={26} height={8000} fill={S.rail} />
        </g>
      ))}
      <g transform="translate(540 960)"><PlanWheelset phi={frame * speed} frame={frame} /></g>
    </World></Camera></Shell>
  );
};

// 4. On a curve the wheelset slides outward (to the right).
const Scene4Drift: React.FC = () => {
  const frame = useCurrentFrame();
  const RC = 1500;
  const c = {x: 540 - RC, y: 960};
  const e = 60 * easeInOut(prog(frame, 15, 110));
  const keys: Key[] = [
    {f: 0, s: 1.0, fx: 540, fy: 960, r: 0},
    {f: 75, s: 1.7, fx: 700, fy: 960, r: -10},
    {f: 150, s: 0.7, fx: 400, fy: 960, r: 8, ease: easeOut},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <g transform={`rotate(${deg(frame * 0.01)} ${c.x} ${c.y})`}>
        <ArcTrack cx={c.x} cy={c.y} rc={RC} n={78} />
        <circle cx={c.x} cy={c.y} r={RC} fill="none" stroke={S.amber} strokeWidth={4} strokeDasharray="26 22" opacity={0.7} />
      </g>
      <g transform={`translate(${540 + e} 960)`}>
        <PlanWheelset phi={frame * 0.05} frame={frame} pulses={false} />
        <Glow x={0} y={0} r={50} />
      </g>
    </World></Camera></Shell>
  );
};

// 5. Front view: outer wheel rides on its wide part, inner wheel on its narrow part.
const Scene5Radii: React.FC = () => {
  const frame = useCurrentFrame();
  const d = 60 * easeInOut(prog(frame, 10, 60));
  const keys: Key[] = [
    {f: 0, s: 1.0, fx: 540, fy: 1100, r: 0},
    {f: 70, s: 2.3, fx: 900, fy: 1200, r: 2},
    {f: 125, s: 2.3, fx: 180, fy: 1200, r: -2, ease: easeInOutQuint},
    {f: 170, s: 0.95, fx: 540, fy: 1100, r: 0, ease: easeOut},
    {f: 210, s: 1.0, fx: 540, fy: 1100, r: 0},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <Elevation d={d} slope={SLOPE} frame={frame} taper={0.55} radii={prog(frame, 60, 85)} />
    </World></Camera></Shell>
  );
};

// 6. A bigger circle covers more ground in one turn.
const Scene6Circles: React.FC = () => {
  const frame = useCurrentFrame();
  const theta = Math.PI * 2 * easeInOut(prog(frame, 15, 115));
  const rows = [{R: 130, y: 820, col: S.amber}, {R: 92, y: 1280, col: S.cyan}];
  const x0 = 120;
  const keys: Key[] = [
    {f: 0, s: 1.8, fx: 300, fy: 820, r: 0},
    {f: 60, s: 1.2, fx: 540, fy: 1040, r: 5},
    {f: 115, s: 0.9, fx: 540, fy: 1050, r: 0},
    {f: 150, s: 1.0, fx: 540, fy: 1050, r: 0},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      {rows.map(({R, y, col}) => {
        const cx = x0 + R * theta;
        const dx = x0 + 2 * Math.PI * R;
        const mx = cx + R * 0.85 * Math.sin(theta);
        const my = y - R + R * 0.85 * -Math.cos(theta);
        return (
          <g key={R}>
            <line x1={-600} y1={y} x2={1700} y2={y} stroke={S.steelDark} strokeWidth={8} />
            <line x1={x0} y1={y} x2={cx} y2={y} stroke={col} strokeWidth={14} strokeLinecap="round" />
            <line x1={x0} y1={y - 30} x2={x0} y2={y + 30} stroke={S.text} strokeWidth={5} />
            <line x1={dx} y1={y - 190} x2={dx} y2={y + 30} stroke={col} strokeWidth={4} strokeDasharray="10 10" opacity={prog(frame, 95, 120)} />
            <g transform={`translate(${cx} ${y - R}) rotate(${deg(theta)})`}>
              <circle r={R} fill="url(#steel)" stroke={S.ink} strokeWidth={5} />
              <circle r={R - 26} fill="none" stroke={S.cyan} strokeOpacity={0.35} strokeWidth={3} />
              {[0, 1, 2, 3, 4, 5].map((k) => (
                <line key={k} x1={0} y1={0} x2={(R - 26) * Math.cos((k * Math.PI) / 3)} y2={(R - 26) * Math.sin((k * Math.PI) / 3)}
                  stroke={S.steelDark} strokeWidth={5} />
              ))}
              <circle cx={R * 0.85} cy={0} r={11} fill={col} transform="rotate(-90)" />
              <circle r={14} fill={S.steelMid} stroke={S.ink} strokeWidth={3} />
            </g>
            <Glow x={cx} y={y} r={38} o={0.9} />
            <circle cx={mx} cy={my} r={0} />
          </g>
        );
      })}
    </World></Camera></Shell>
  );
};

// 7. Into the curve: the outer wheel travels farther and the axle turns with the track.
const Scene7Yaw: React.FC = () => {
  const frame = useCurrentFrame();
  const RC = 1400;
  const C = {x: 540 - RC, y: 960};
  const sAt = (f: number) => lerp(-450, 1000, easeInOut(prog(f, 0, 170)));
  const s = sAt(frame);
  const pos = (sv: number, off = 0) => {
    if (sv <= 0) return {x: 540 + off, y: 960 - sv, phi: 0};
    const phi = -sv / RC;
    return {x: C.x + (RC + off) * Math.cos(phi), y: C.y + (RC + off) * Math.sin(phi), phi};
  };
  const trail = (off: number) => {
    let d = '';
    for (let sv = -450; sv <= s; sv += 20) {
      const p = pos(sv, off);
      d += `${d ? ' L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
    return d;
  };
  const arcEnd = -1.5;
  const rail = (off: number) => {
    const x1 = C.x + (RC + off) * Math.cos(arcEnd);
    const y1 = C.y + (RC + off) * Math.sin(arcEnd);
    return `M ${540 + off} 3200 L ${540 + off} 960 A ${RC + off} ${RC + off} 0 0 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  let sl = '';
  for (let y = 3200; y > 960; y -= 110) sl += `M ${540 - 430} ${y} L ${540 + 430} ${y} `;
  for (let a = 0; a > arcEnd; a -= 110 / RC) {
    sl += `M ${(C.x + (RC - 430) * Math.cos(a)).toFixed(1)} ${(C.y + (RC - 430) * Math.sin(a)).toFixed(1)} L ${(C.x + (RC + 430) * Math.cos(a)).toFixed(1)} ${(C.y + (RC + 430) * Math.sin(a)).toFixed(1)} `;
  }
  const p = pos(s);
  const outer = pos(s, 360);
  const inner = pos(s, -360);
  const keys: Key[] = [
    {f: 0, s: 1.2, fx: 540, fy: 1350, r: 0},
    {f: 55, s: 1.0, fx: 520, fy: 800, r: -6},
    {f: 110, s: 0.85, fx: 300, fy: 330, r: -16},
    {f: 180, s: 0.42, fx: 100, fy: 560, r: -4, ease: easeOut},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <path d={sl} stroke={S.sleeper} strokeWidth={30} fill="none" />
      {[-360, 360].map((o) => (
        <g key={o}>
          <path d={rail(o)} fill="none" stroke={S.railDark} strokeWidth={44} />
          <path d={rail(o)} fill="none" stroke={S.rail} strokeWidth={26} />
        </g>
      ))}
      <path d={trail(360)} fill="none" stroke={S.amber} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <path d={trail(-360)} fill="none" stroke={S.cyan} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg(p.phi).toFixed(2)})`}>
        <PlanWheelset phi={frame * 0.05} frame={frame} pulses={false} />
      </g>
      <Glow x={outer.x} y={outer.y} r={40} />
      <Glow x={inner.x} y={inner.y} r={34} o={0.75} />
    </World></Camera></Shell>
  );
};

// 8. Too far out: the cone pushes the wheelset back to the middle (with a little overshoot).
const Scene8Restore: React.FC = () => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - 12);
  const d = 64 * Math.exp(-t / 26) * Math.cos(t * 0.17);
  const keys: Key[] = [
    {f: 0, s: 1.6, fx: 900, fy: 1250, r: 0},
    {f: 60, s: 1.0, fx: 540, fy: 1100, r: 0},
    {f: 120, s: 1.3, fx: 540, fy: 1150, r: -4},
    {f: 180, s: 0.95, fx: 540, fy: 1100, r: 0},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <Elevation d={d} slope={SLOPE} frame={frame} taper={0.4} radii={0.9} />
    </World></Camera></Shell>
  );
};

// 9. The flange only touches the rail at the extreme: a backup.
const Scene9Flange: React.FC = () => {
  const frame = useCurrentFrame();
  const d = GAP * easeInOut(prog(frame, 10, 50)) * (1 - easeInOut(prog(frame, 95, 135)));
  const hot = prog(frame, 40, 55) * (1 - prog(frame, 95, 115));
  const keys: Key[] = [
    {f: 0, s: 1.0, fx: 540, fy: 1100, r: 0},
    {f: 45, s: 2.8, fx: 830, fy: 1380, r: 0},
    {f: 100, s: 2.8, fx: 830, fy: 1380, r: 0},
    {f: 150, s: 0.9, fx: 540, fy: 1100, r: 0, ease: easeOut},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <Elevation d={d} slope={SLOPE} frame={frame} flange={hot} glow={0.4} />
      <Pill x={760} y={RAIL_Y + 270} text="FLANGE" appear={prog(frame, 40, 58) * (1 - prog(frame, 100, 118))} />
    </World></Camera></Shell>
  );
};

// 10. Reprise: the train on the curve, big zoom-out with a slow spin.
const Scene10Final: React.FC = () => {
  const frame = useCurrentFrame();
  const keys: Key[] = [
    {f: 0, s: 2.8, fx: 420, fy: 640, r: -12},
    {f: 110, s: 0.45, fx: 80, fy: 960, r: 18, ease: easeInOut},
    {f: 120, s: 0.45, fx: 80, fy: 960, r: 19},
  ];
  return (
    <Shell><Camera frame={frame} keys={keys}><World>
      <ArcTrack cx={AERIAL.cx} cy={AERIAL.cy} rc={AERIAL.rc} n={110} />
      <Train phiHead={-0.2 - frame * 0.003} />
    </World></Camera></Shell>
  );
};

const SCENES = [
  Scene1Aerial, Scene2Cone, Scene3Axle, Scene4Drift, Scene5Radii,
  Scene6Circles, Scene7Yaw, Scene8Restore, Scene9Flange, Scene10Final,
];

/* =====================================================================
   VOICEOVER
   Narration files live in public/voice/Scene1.mp3 ... Scene10.mp3
   (`npm run voice` makes them). If a file is missing, that scene is
   silent and keeps its default length. If a voice line is longer than
   the scene, the scene stretches to fit it.
   ===================================================================== */
const VOICE_DELAY = 8; // frames of picture before the voice starts
const VOICE_TAIL = 12; // frames of picture after the voice ends

type Plan = {sceneFrames: number[]; speechFrames: number[]; voice: boolean[]};
const DEFAULT_PLAN: Plan = {
  sceneFrames: BEATS.map((b) => b.sec * FPS),
  speechFrames: BEATS.map((b) => b.sec * FPS),
  voice: BEATS.map(() => false),
};

const voiceFile = (i: number) => staticFile(`voice/Scene${i + 1}.mp3`);

const speechSeconds = async (i: number): Promise<number | null> => {
  try {
    return await getAudioDurationInSeconds(voiceFile(i));
  } catch {
    return null; // no file for this scene
  }
};

const sceneLength = (i: number, sec: number | null) => {
  const base = BEATS[i].sec * FPS;
  if (sec === null) return {scene: base, speech: base, voice: false};
  const speech = Math.ceil(sec * FPS);
  return {scene: Math.max(base, speech + VOICE_DELAY + VOICE_TAIL), speech, voice: true};
};

const calcMain: CalculateMetadataFunction<Plan> = async () => {
  const plan: Plan = {sceneFrames: [], speechFrames: [], voice: []};
  for (let i = 0; i < BEATS.length; i++) {
    const r = sceneLength(i, await speechSeconds(i));
    plan.sceneFrames.push(r.scene);
    plan.speechFrames.push(r.speech);
    plan.voice.push(r.voice);
  }
  return {durationInFrames: plan.sceneFrames.reduce((a, b) => a + b, 0), props: plan};
};

/* =====================================================================
   CAPTIONS: 2-3 words at a time at the top, one bold word,
   timed to the voice (or spread over the scene when there is no voice)
   ===================================================================== */
const chunkWords = (text: string): string[] => {
  const words = text.split(' ');
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const left = words.length - i;
    const n = left <= 3 ? left : left === 4 ? 2 : 3;
    out.push(words.slice(i, i + n).join(' '));
    i += n;
  }
  return out;
};

const Captions: React.FC<Plan> = ({sceneFrames, speechFrames, voice}) => {
  const frame = useCurrentFrame();
  let start = 0;
  for (let i = 0; i < BEATS.length; i++) {
    const dur = sceneFrames[i];
    if (frame < start + dur) {
      const local = frame - start;
      const chunks = chunkWords(BEATS[i].text);
      const w = chunks.map((c) => c.replace(/\s/g, '').length);
      const total = w.reduce((a, b) => a + b, 0);
      const from = voice[i] ? VOICE_DELAY : 0;
      const win = voice[i] ? speechFrames[i] : dur;
      const pos = clamp01((local - from) / win) * total;
      let idx = 0;
      let acc = 0;
      for (; idx < chunks.length - 1; idx++) {
        if (pos < acc + w[idx]) break;
        acc += w[idx];
      }
      const chunkStart = from + (acc / total) * win;
      const pop = easeOut((local - chunkStart) / 6);
      const words = chunks[idx].split(' ');
      let bi = 0;
      words.forEach((wd, k) => {
        if (wd.replace(/[^a-zA-Z0-9-]/g, '').length > words[bi].replace(/[^a-zA-Z0-9-]/g, '').length) bi = k;
      });
      return (
        <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: 170}}>
          <div style={{
            fontFamily: FONT, fontSize: 88, lineHeight: 1.1, textAlign: 'center', color: S.text, opacity: pop,
            scale: String(0.86 + 0.14 * pop), maxWidth: 940, WebkitTextStroke: `16px ${S.ink}`, paintOrder: 'stroke fill',
          }}>
            {words.map((wd, k) => (
              <span key={k} style={{fontWeight: k === bi ? 900 : 500}}>{wd}{k < words.length - 1 ? ' ' : ''}</span>
            ))}
          </div>
        </AbsoluteFill>
      );
    }
    start += dur;
  }
  return null;
};

/* =====================================================================
   VIDEO + REGISTRATION
   ===================================================================== */
const VoiceTrack: React.FC<{i: number}> = ({i}) => (
  <Sequence from={VOICE_DELAY}>
    <Audio src={voiceFile(i)} />
  </Sequence>
);

// The full video: scenes + voice + captions
const TrainWheels: React.FC<Plan> = (plan) => (
  <AbsoluteFill>
    <Series>
      {BEATS.map((b, i) => {
        const Scene = SCENES[i];
        return (
          <Series.Sequence key={b.id} name={b.id} durationInFrames={plan.sceneFrames[i]}>
            <Scene />
            {plan.voice[i] && <VoiceTrack i={i} />}
          </Series.Sequence>
        );
      })}
    </Series>
    <Captions {...plan} />
  </AbsoluteFill>
);

// One scene on its own: picture + its voice line, no captions (add your own in an editor)
type Solo = {i: number; voice: boolean};
const SoloScene: React.FC<Solo> = ({i, voice}) => {
  const Scene = SCENES[i];
  return (
    <AbsoluteFill>
      <Scene />
      {voice && <VoiceTrack i={i} />}
    </AbsoluteFill>
  );
};

const calcSolo: CalculateMetadataFunction<Solo> = async ({props}) => {
  const r = sceneLength(props.i, await speechSeconds(props.i));
  return {durationInFrames: r.scene, props: {i: props.i, voice: r.voice}};
};

const Root: React.FC = () => (
  <>
    <Composition
      id="TrainWheels" component={TrainWheels} width={W} height={H} fps={FPS}
      durationInFrames={TOTAL} defaultProps={DEFAULT_PLAN} calculateMetadata={calcMain}
    />
    <Folder name="Scenes">
      {BEATS.map((b, i) => (
        <Composition
          key={b.id} id={`Scene${i + 1}`} component={SoloScene} width={W} height={H} fps={FPS}
          durationInFrames={b.sec * FPS} defaultProps={{i, voice: false}} calculateMetadata={calcSolo}
        />
      ))}
    </Folder>
  </>
);

registerRoot(Root);

export {SCENES, Captions, BEATS, DEFAULT_PLAN};
