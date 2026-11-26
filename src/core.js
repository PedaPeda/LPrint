// ===================== LP-Print Kern (DSP + Rillen-Layout + STL) =====================
// Einheiten: Geometrie in mm, Zeit in Samples.

function rbj(type, f0, Q, fs) {
  const w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
  const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function biquad(x, c) {
  const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y;
  }
}
// 1. Ordnung, Bilinear: H(s) = (1 + s*Tz) / (1 + s*Tp)
function shelf1(x, Tz, Tp, fs) {
  const K = 2 * fs;
  const b0 = 1 + K * Tz, b1 = 1 - K * Tz, a0 = 1 + K * Tp, a1 = 1 - K * Tp;
  let x1 = 0, y1 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 - a1 * y1) / a0;
    x1 = x[i]; y1 = y; x[i] = y;
  }
}
// 1. Ordnung Hochpass, Bilinear: H(s) = sT/(1+sT)
function hp1(x, T, fs) {
  const K = 2 * fs;
  const b0 = K * T, b1 = -K * T, a0 = 1 + K * T, a1 = 1 - K * T;
  let x1 = 0, y1 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 - a1 * y1) / a0;
    x1 = x[i]; y1 = y; x[i] = y;
  }
}

function compress(chs, fs, thrDb, ratio) {
  const n = chs[0].length, att = Math.exp(-1 / (0.003 * fs)), rel = Math.exp(-1 / (0.15 * fs));
  const thr = Math.pow(10, thrDb / 20);
  let env = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const c of chs) { const v = Math.abs(c[i]); if (v > p) p = v; }
    env = p > env ? att * env + (1 - att) * p : rel * env + (1 - rel) * p;
    let g = 1;
    if (env > thr) g = Math.pow(env / thr, 1 / ratio - 1);
    for (const c of chs) c[i] *= g;
  }
}

// RIAA-Zeitkonstanten
const T1 = 3180e-6, T2 = 318e-6, T3 = 75e-6;

// chs: Float32Array[] (1 oder 2 Kanäle) bei Abtastrate fs (= N*rpm/60)
// P: Parameter (siehe Oberfläche); alle Längen in mm
function prepare(chs, fs, P) {
  const N = P.N;
  const stereo = P.stereo && chs.length > 1;
  let a;
  if (stereo) a = [Float32Array.from(chs[0]), Float32Array.from(chs[1])];
  else {
    const m = new Float32Array(chs[0].length);
    for (const c of chs) for (let i = 0; i < m.length; i++) m[i] += c[i] / chs.length;
    a = [m];
  }
  const Ma = a[0].length;
  // --- Filter ---
  for (const c of a) {
    if (P.hpHz > 0) biquad(c, rbj('hp', P.hpHz, Math.SQRT1_2, fs));
    if (P.lpHz > 0 && P.lpHz < 0.48 * fs) {
      biquad(c, rbj('lp', P.lpHz, 0.5412, fs));
      biquad(c, rbj('lp', P.lpHz, 1.3066, fs));
    }
  }
  if (P.compress) compress(a, fs, -20, 3);
  // Ein-/Ausblenden 15 ms
  const fadeN = Math.min(Math.floor(0.015 * fs), Ma >> 2);
  for (const c of a) for (let i = 0; i < fadeN; i++) { const g = i / fadeN; c[i] *= g; c[Ma - 1 - i] *= g; }
  // Vorschau = das, was nach RIAA-Wiedergabe herauskommen sollte
  const preview = a.map(c => Float32Array.from(c));
  if (P.riaa) for (const c of preview) hp1(c, T1, fs);
  let pk = 1e-9; for (const c of preview) for (let i = 0; i < c.length; i++) pk = Math.max(pk, Math.abs(c[i]));
  for (const c of preview) for (let i = 0; i < c.length; i++) c[i] *= 0.9 / pk;
  // Auslenkung (Displacement): RIAA-Aufnahmekurve inkl. 50-Hz-HP => Shelf (1+sT3)/(1+sT2)
  if (P.riaa) for (const c of a) shelf1(c, T3, T2, fs);

  // --- Layout / Rillenabstand ---
  const h = P.grooveW / 2;
  const Lin = N, Lout = 2 * N, M = Lin + Ma + Lout;
  const revs = Ma / N;
  const avail = P.rStart - 2 * h - P.pitchIn - P.rMin; // Platz für Audio-Windungen
  let A = P.ampMax;
  if (P.autoFit) {
    const Afit = (avail - revs * (P.grooveW + P.land)) / (2 * revs + 1);
    A = Math.min(P.ampMax, Afit);
  }
  const minA = 0.006;
  if (!(A >= minA)) {
    const maxRevs = (avail - minA) / (P.grooveW + P.land + 2 * minA);
    const maxSec = maxRevs * 60 / P.rpm;
    throw new Error(JSON.stringify({ k: 'err_long', max: Math.max(0, Math.floor(maxSec / 60)) + ':' + String(Math.max(0, Math.floor(maxSec % 60))).padStart(2, '0') }));
  }
  const pitch = P.grooveW + 2 * A + P.land;

  // Rillenmitte rc(i)
  const rc = new Float64Array(M);
  const ramp = N >> 2;
  let r = P.rStart - h;
  for (let i = 0; i < M; i++) {
    rc[i] = r;
    let p;
    if (i < Lin - ramp) p = P.pitchIn;
    else if (i < Lin) p = P.pitchIn + (pitch - P.pitchIn) * (i - (Lin - ramp)) / ramp;
    else if (i < Lin + Ma) p = pitch;
    else if (i < Lin + Ma + ramp) p = pitch + (P.pitchOut - pitch) * (i - Lin - Ma) / ramp;
    else p = P.pitchOut;
    r -= p / N;
  }
  const rAudioEnd = rc[Lin + Ma - 1];
  if (rAudioEnd - h - A < P.rMin - 1e-6 && !P.autoFit) {
    throw new Error(JSON.stringify({ k: 'err_long2', r: (rAudioEnd - h - A).toFixed(1), min: P.rMin }));
  }

  // --- Pegel: Amplitude + Steigung (Tracking) ---
  let pkA = 1e-12, pkS = 1e-12, pkV = 1e-12;
  const dTheta = 2 * Math.PI / N;
  for (let i = 0; i < Ma; i++) {
    const ds = rc[Lin + i] * dTheta;
    for (const c of a) {
      const v = Math.abs(c[i]); if (v > pkA) pkA = v;
      if (i + 1 < Ma) { const s = Math.abs(c[i + 1] - c[i]) / ds; if (s > pkS) pkS = s; }
    }
    if (stereo) { const v = Math.abs(a[0][i] - a[1][i]) / 2; if (v > pkV) pkV = v; }
  }
  const gA = A / pkA, gS = P.maxSlope / pkS;
  const gV = stereo ? (P.vertFrac * A) / pkV : Infinity;
  const g = Math.min(gA, gS, gV);
  const limitedBy = g === gA ? 'lim_amp' : (g === gS ? 'lim_slope' : 'lim_vert');

  // --- Rillen-Arrays ---
  const r1 = new Float32Array(M), r4 = new Float32Array(M), rb = new Float32Array(M), zb = new Float32Array(M);
  const aL = a[0], aR = stereo ? a[1] : a[0];
  for (let i = 0; i < M; i++) {
    let L = 0, R = 0;
    const k = i - Lin;
    if (k >= 0 && k < Ma) { L = aL[k] * g; R = aR[k] * g; }
    // innere Flanke (Richtung Zentrum) = linker Kanal, äußere Flanke = rechter Kanal (45/45)
    r1[i] = rc[i] + h + R;
    r4[i] = rc[i] - h + L;
    rb[i] = rc[i] + (L + R) / 2;
    zb[i] = -h + (L - R) / 2;
  }
  const rLabel = rc[M - 1] - h - 0.5;
  if (rLabel < P.rHole + 1.5) throw new Error(JSON.stringify({ k: 'err_label' }));

  const tris = countTris(N, M);
  const vOut = 2 * Math.PI * rc[Lin] * P.rpm / 60, vIn = 2 * Math.PI * rAudioEnd * P.rpm / 60; // mm/s
  return {
    G: { N, M, r1, r4, rb, zb, T: P.thick, rDisc: P.diam / 2, rLabel, rHole: P.rHole },
    preview,
    stats: {
      N, M, fs, Ma, duration: Ma / fs, A, pitch, gain: g, limitedBy,
      levelDb: 20 * Math.log10(g * pkA / A),
      rAudioStart: rc[Lin] + h + A, rAudioEnd: rAudioEnd - h - A, rLabel,
      tris, bytes: 84 + tris * 50,
      vOut, vIn, stereo
    }
  };
}

function countTris(N, M) {
  return (M - 1) * 4 + (M - N - 1) * 2 + 2 + 2 * ((N - 1) * 2 + 4) + 4 * (2 * N);
}

// ---------- STL-Erzeugung (binär, gestreamt) ----------
function genMesh(G, chunkTris, onChunk, onProgress) {
  const { N, M, r1, r4, rb, zb, T, rDisc, rLabel, rHole } = G;
  const C = new Float64Array(N), S = new Float64Array(N);
  for (let j = 0; j < N; j++) { const t = 2 * Math.PI * j / N; C[j] = Math.cos(t); S[j] = Math.sin(t); }
  let buf = new ArrayBuffer(chunkTris * 50), dv = new DataView(buf), n = 0, total = 0;
  function flush() {
    if (n === 0) return;
    onChunk(n === chunkTris ? buf : buf.slice(0, n * 50));
    buf = new ArrayBuffer(chunkTris * 50); dv = new DataView(buf); total += n; n = 0;
  }
  function tri(ax, ay, az, bx, by, bz, cx, cy, cz, rx, ry, rz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let o = n * 50;
    if (nx * rx + ny * ry + nz * rz < 0) {
      nx = -nx; ny = -ny; nz = -nz;
      let t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; t = bz; bz = cz; cz = t;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    dv.setFloat32(o + 12, ax, true); dv.setFloat32(o + 16, ay, true); dv.setFloat32(o + 20, az, true);
    dv.setFloat32(o + 24, bx, true); dv.setFloat32(o + 28, by, true); dv.setFloat32(o + 32, bz, true);
    dv.setFloat32(o + 36, cx, true); dv.setFloat32(o + 40, cy, true); dv.setFloat32(o + 44, cz, true);
    dv.setUint16(o + 48, 0, true);
    if (++n === chunkTris) flush();
  }
  // Punkt-Helfer -> [x,y,z]
  const X = (r, j) => r * C[j % N], Y = (r, j) => r * S[j % N];
  const p1 = i => [X(r1[i], i), Y(r1[i], i), T];
  const pb = i => [X(rb[i], i), Y(rb[i], i), T + zb[i]];
  const p4 = i => [X(r4[i], i), Y(r4[i], i), T];
  const ring = (R, j, z) => [X(R, j), Y(R, j), z];
  const up = [0, 0, 1];
  const T3 = (a, b, c, ref) => tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], ref[0], ref[1], ref[2]);
  const Q4 = (a, b, c, d, ref) => { T3(a, b, c, ref); T3(a, c, d, ref); };

  // 1) Rille: Flanken + Stege (heißer Pfad, inline)
  const T_ = T;
  for (let i = 0; i < M - 1; i++) {
    const j0 = i % N, j1 = (i + 1) % N;
    const c0 = C[j0], s0 = S[j0], c1 = C[j1], s1 = S[j1];
    const a1x = r1[i] * c0, a1y = r1[i] * s0, b1x = r1[i + 1] * c1, b1y = r1[i + 1] * s1;
    const abx = rb[i] * c0, aby = rb[i] * s0, abz = T_ + zb[i];
    const bbx = rb[i + 1] * c1, bby = rb[i + 1] * s1, bbz = T_ + zb[i + 1];
    const a4x = r4[i] * c0, a4y = r4[i] * s0, b4x = r4[i + 1] * c1, b4y = r4[i + 1] * s1;
    // äußere Flanke
    tri(a1x, a1y, T_, b1x, b1y, T_, bbx, bby, bbz, 0, 0, 1);
    tri(a1x, a1y, T_, bbx, bby, bbz, abx, aby, abz, 0, 0, 1);
    // innere Flanke
    tri(abx, aby, abz, bbx, bby, bbz, b4x, b4y, T_, 0, 0, 1);
    tri(abx, aby, abz, b4x, b4y, T_, a4x, a4y, T_, 0, 0, 1);
    // Steg zur nächsten Windung
    if (i + N + 1 < M) {
      const k0 = i + N, k1 = i + N + 1;
      const c2x = r1[k1] * c1, c2y = r1[k1] * s1, d2x = r1[k0] * c0, d2y = r1[k0] * s0;
      tri(a4x, a4y, T_, b4x, b4y, T_, c2x, c2y, T_, 0, 0, 1);
      tri(a4x, a4y, T_, c2x, c2y, T_, d2x, d2y, T_, 0, 0, 1);
    }
    if ((i & 0xffff) === 0 && onProgress) onProgress(i / M);
  }
  // 2) Rillenanfang/-ende verschließen
  T3(p1(0), pb(0), p4(0), [-S[0], C[0], 0]);
  { const e = M - 1, j = e % N; T3(p1(e), pb(e), p4(e), [S[j], -C[j], 0]); }

  // 3) Außenfläche (Rand bis erste Windung)
  for (let j = 0; j < N - 1; j++) Q4(ring(rDisc, j, T), ring(rDisc, j + 1, T), p1(j + 1), p1(j), up);
  {
    const a = ring(rDisc, N - 1, T);
    T3(a, ring(rDisc, 0, T), p1(0), up);
    T3(a, p1(0), p4(0), up);
    T3(a, p4(0), p1(N), up);
    T3(a, p1(N), p1(N - 1), up);
  }
  // 4) Innenfläche (letzte Windung bis Etikett-Kreis)
  {
    const s = M - N - 1; // Index auf dem Strahl des Rillenendes
    for (let j = s + 1; j < M - 1; j++) Q4(p4(j), p4(j + 1), ring(rLabel, j + 1, T), ring(rLabel, j, T), up);
    const ap = ring(rLabel, s + 1, T);
    T3(ap, ring(rLabel, M - 1, T), p4(M - 1), up);
    T3(ap, p4(M - 1), p1(M - 1), up);
    T3(ap, p1(M - 1), p4(s), up);
    T3(ap, p4(s), p4(s + 1), up);
  }
  // 5) Etikett, Mittelloch, Außenrand, Unterseite
  for (let j = 0; j < N; j++) {
    const k = j + 1;
    Q4(ring(rLabel, j, T), ring(rLabel, k, T), ring(rHole, k, T), ring(rHole, j, T), up);
    const rad = [C[j] + C[k % N], S[j] + S[k % N], 0];
    Q4(ring(rHole, j, T), ring(rHole, k, T), ring(rHole, k, 0), ring(rHole, j, 0), [-rad[0], -rad[1], 0]);
    Q4(ring(rDisc, j, T), ring(rDisc, k, T), ring(rDisc, k, 0), ring(rDisc, j, 0), rad);
    Q4(ring(rDisc, j, 0), ring(rDisc, k, 0), ring(rHole, k, 0), ring(rHole, j, 0), [0, 0, -1]);
  }
  flush();
  if (onProgress) onProgress(1);
  return total;
}

if (typeof module !== 'undefined') module.exports = { prepare, genMesh, countTris };
