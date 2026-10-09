import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- escena
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060f, 0.025);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.z = 8;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const viewH = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const viewW = () => viewH() * camera.aspect;

// estrellas de fondo
{
  const n = 600, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = (Math.random() - 0.5) * 60;
    a[i * 3 + 1] = (Math.random() - 0.5) * 40;
    a[i * 3 + 2] = -10 - Math.random() * 30;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, color: 0x8899cc, fog: false })));
}

// ---------------------------------------------------------------- partículas
const N = 7000;          // varillas
const N_CRUCES = 2200;   // cuántas se dibujan como cruces en la lluvia

const stickGeo = new THREE.BoxGeometry(0.02, 1, 0.02);
const cruzGeo = (() => {
  const a = new THREE.BoxGeometry(0.03, 1, 0.03);
  const b = new THREE.BoxGeometry(0.22, 0.03, 0.03);
  b.translate(0, 0.3, 0);
  const c = new THREE.BoxGeometry(0.08, 0.03, 0.03);
  c.translate(0, -0.1, 0);
  return mergeGeometries([a, b, c]);
})();

const mat = () => new THREE.MeshBasicMaterial({
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95,
});
const sticks = new THREE.InstancedMesh(stickGeo, mat(), N);
const cruces = new THREE.InstancedMesh(cruzGeo, mat(), N_CRUCES);
sticks.frustumCulled = cruces.frustumCulled = false;
scene.add(sticks, cruces);

const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), dir = new Float32Array(N * 3);
const nrm = new Float32Array(N * 3);        // normal fija sobre la esfera
const U = new Float32Array(N), V = new Float32Array(N), W = new Float32Array(N);
const lastTy = new Float32Array(N);
const rx = new Float32Array(N), rz = new Float32Array(N), rs = new Float32Array(N);
const color = new THREE.Color();

for (let i = 0; i < N; i++) {
  // puntos de Fibonacci sobre la esfera
  const k = (i + 0.5) / N, phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i;
  nrm[i * 3] = Math.cos(th) * Math.sin(phi);
  nrm[i * 3 + 1] = Math.sin(th) * Math.sin(phi);
  nrm[i * 3 + 2] = Math.cos(phi);
  U[i] = Math.random(); V[i] = Math.random(); W[i] = Math.random();
  rx[i] = (Math.random() - 0.5) * 2;
  rz[i] = -5 + Math.random() * 11;
  rs[i] = 0.5 + Math.random();
  pos[i * 3] = (Math.random() - 0.5) * 10;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  dir[i * 3 + 1] = 1;
  color.setHSL(0.07 + 0.27 * Math.pow(U[i], 0.8), 1, 0.5);
  sticks.setColorAt(i, color);
  if (i < N_CRUCES) {
    color.setHSL(0.12 + 0.22 * V[i], 1, 0.55);
    cruces.setColorAt(i, color);
  }
}
sticks.instanceColor.needsUpdate = true;
cruces.instanceColor.needsUpdate = true;

// ---------------------------------------------------------------- estado de la mano
const mano = {
  objetivo: new THREE.Vector3(0, 0, 0),
  pos: new THREE.Vector3(0, 0, 0),
  radioObj: 2.2, radio: 2.2,
  vel: new THREE.Vector3(),
};
let modo = 'abierta';           // abierta | puño | estela | lluvia
let hayMano = false, ultimaMano = 0;
const trail = Array.from({ length: 90 }, () => new THREE.Vector3());

const NOMBRES = { abierta: 'mano abierta', 'puño': 'puño', estela: 'dos dedos', lluvia: 'lluvia de cruces' };
const hudGesto = document.getElementById('gesto');
const hudEstado = document.getElementById('estado');

function ponerModo(m) {
  if (m === modo) return;
  modo = m;
}

// ---------------------------------------------------------------- gestos
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function analizar(lm) {
  const tam = d2(lm[0], lm[9]) || 1e-3;
  const dedo = (tip, pip) => d2(lm[tip], lm[0]) > d2(lm[pip], lm[0]) * 1.08;
  const idx = dedo(8, 6), med = dedo(12, 10), anu = dedo(16, 14), men = dedo(20, 18);
  const pulgar = d2(lm[4], lm[5]) > tam * 0.65;
  const apertura = (d2(lm[8], lm[0]) + d2(lm[12], lm[0]) + d2(lm[16], lm[0]) + d2(lm[20], lm[0])) / 4 / tam;

  let g = null;
  const n = [idx, med, anu, men].filter(Boolean).length;
  if (n >= 4) g = 'abierta';
  else if (n === 0 && !pulgar) g = 'puño';
  else if (idx && men && !med && !anu) g = 'lluvia';          // rock
  else if (idx && pulgar && !med && !anu && !men) g = 'lluvia'; // "L"
  else if (idx && med && !anu && !men) g = 'estela';
  return { g, apertura, tam };
}

let candidato = null, cuenta = 0;
function procesarManos(manos) {
  if (!manos.length) { hayMano = false; return; }
  hayMano = true; ultimaMano = performance.now();
  const lm = manos[0];
  const { g, apertura } = analizar(lm);
  if (g) {
    if (g === candidato) cuenta++; else { candidato = g; cuenta = 1; }
    if (cuenta >= 3) ponerModo(g);
  }
  // posición: centro de la palma (landmark 9), espejo horizontal
  const p = lm[9];
  mano.objetivo.set((0.5 - p.x) * viewW() * 1.1, (0.5 - p.y) * viewH() * 1.1, 0);
  mano.radioObj = THREE.MathUtils.lerp(1.1, 3.0, THREE.MathUtils.clamp((apertura - 1.0) / 0.9, 0, 1));

  if (manos.length > 1) {
    const a = manos[0][9], b = manos[1][9];
    mano.objetivo.set((0.5 - (a.x + b.x) / 2) * viewW() * 1.1, (0.5 - (a.y + b.y) / 2) * viewH() * 1.1, 0);
    const dist = Math.hypot((a.x - b.x) * viewW(), (a.y - b.y) * viewH());
    mano.radioObj = THREE.MathUtils.clamp(dist * 0.5, 1.0, 6.0);
  }
}

// ---------------------------------------------------------------- teclado / ratón (sin cámara)
const teclas = { '1': 'abierta', '2': 'puño', '3': 'estela', '4': 'lluvia' };
addEventListener('keydown', e => { if (teclas[e.key]) ponerModo(teclas[e.key]); });
addEventListener('pointermove', e => {
  if (camaraActiva) return;
  mano.objetivo.set((e.clientX / innerWidth - 0.5) * viewW(), -(e.clientY / innerHeight - 0.5) * viewH(), 0);
  hayMano = true; ultimaMano = performance.now();
});
addEventListener('wheel', e => {
  if (camaraActiva) return;
  mano.radioObj = THREE.MathUtils.clamp(mano.radioObj - e.deltaY * 0.002, 0.8, 6);
});

// ---------------------------------------------------------------- cámara + MediaPipe
let camaraActiva = false, landmarker = null, ultimoT = -1;
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');

document.getElementById('start').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  btn.disabled = true; btn.textContent = 'Cargando…';
  try {
    const { HandLandmarker, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO', numHands: 2,
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    await video.play();
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;
    document.getElementById('cam').style.display = 'block';
    camaraActiva = true;
    btn.style.display = 'none';
  } catch (err) {
    console.error(err);
    btn.disabled = false; btn.textContent = 'Reintentar cámara';
    hudEstado.textContent = 'No se pudo iniciar la cámara: ' + err.message;
  }
});

function leerCamara() {
  if (!camaraActiva || video.currentTime === ultimoT) return;
  ultimoT = video.currentTime;
  const r = landmarker.detectForVideo(video, performance.now());
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.fillStyle = '#7dff9a';
  for (const mano of r.landmarks) for (const p of mano) {
    octx.beginPath(); octx.arc(p.x * overlay.width, p.y * overlay.height, 3, 0, 7); octx.fill();
  }
  procesarManos(r.landmarks);
}

// ---------------------------------------------------------------- bucle
const dummy = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();
const clock = new THREE.Clock();
let t = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;

  leerCamara();
  if (hayMano && performance.now() - ultimaMano > 600) hayMano = false;

  const k = 1 - Math.exp(-dt * 12);
  const anterior = mano.pos.clone();
  mano.pos.lerp(mano.objetivo, k);
  mano.vel.copy(mano.pos).sub(anterior).divideScalar(Math.max(dt, 1e-3));
  mano.radio += (mano.radioObj - mano.radio) * (1 - Math.exp(-dt * 6));
  const reposo = !hayMano && !camaraActiva ? false : !hayMano;
  if (reposo) { mano.objetivo.set(0, 0, 0); mano.radioObj = 2.2; }

  trail.unshift(trail.pop().copy(mano.pos));

  const c = mano.pos, R = mano.radio;
  const cosT = Math.cos(t * 0.35), sinT = Math.sin(t * 0.35);
  const ax = 0.3, ay = 1, az = 0.2, al = Math.hypot(ax, ay, az);
  const H = viewH() * 1.3, Wd = viewW() * 1.3;
  const velMano = mano.vel.length();

  let kS, cD, esLluvia = modo === 'lluvia';
  if (modo === 'estela') { kS = 16; cD = 6; } else if (esLluvia) { kS = 7; cD = 4; } else { kS = 11; cD = 5.5; }

  for (let i = 0; i < N; i++) {
    const i3 = i * 3;
    const nx0 = nrm[i3], ny0 = nrm[i3 + 1], nz0 = nrm[i3 + 2];
    // normal girada alrededor de Y
    const nx = nx0 * cosT + nz0 * sinT, ny = ny0, nz = -nx0 * sinT + nz0 * cosT;
    let tx, ty, tz, dx, dy, dz;

    if (modo === 'abierta') {
      const r = R * (0.55 + 0.45 * U[i]) * (1 + 0.07 * Math.sin(t * 3 + W[i] * 20));
      tx = c.x + nx * r; ty = c.y + ny * r; tz = c.z + nz * r * 0.6;
      dx = nx; dy = ny; dz = nz;
    } else if (modo === 'puño') {
      const r = R * 0.5 * (0.92 + 0.08 * U[i]);
      tx = c.x + nx * r; ty = c.y + ny * r; tz = c.z + nz * r;
      // tangente: n × eje
      dx = ny * az / al - nz * ay / al; dy = nz * ax / al - nx * az / al; dz = nx * ay / al - ny * ax / al;
    } else if (modo === 'estela') {
      const s = trail[Math.min(89, Math.floor(Math.pow(U[i], 1.4) * 89))];
      const sp = 0.25 + 0.5 * U[i];
      tx = s.x + (V[i] - 0.5) * sp * 2 + Math.sin(t * 2 + U[i] * 12) * 0.2;
      ty = s.y + (W[i] - 0.5) * sp * 2 + Math.cos(t * 2.3 + V[i] * 12) * 0.2;
      tz = s.z + (nz0) * sp;
      const m = velMano > 0.3 ? 1 / velMano : 0;
      dx = velMano > 0.3 ? mano.vel.x * m : 1; dy = velMano > 0.3 ? mano.vel.y * m : 0.2; dz = 0;
    } else { // lluvia
      const y = ((rs[i] * 1.4 * t + W[i] * 100) % 1000) % H;
      ty = -H / 2 + y; tx = rx[i] * Wd * 0.5; tz = rz[i];
      // se ve más cerca de donde está la mano
      tx = tx * 0.9 + c.x * 0.1;
      dx = 0; dy = 1; dz = 0;
      // al reaparecer arriba/abajo se coloca directo, sin cruzar la pantalla
      if (Math.abs(ty - lastTy[i]) > H * 0.5) { pos[i3 + 1] = ty; vel[i3 + 1] = 0; }
      lastTy[i] = ty;
    }

    // física tipo muelle
    const vx = vel[i3] += (kS * (tx - pos[i3]) - cD * vel[i3]) * dt;
    const vy = vel[i3 + 1] += (kS * (ty - pos[i3 + 1]) - cD * vel[i3 + 1]) * dt;
    const vz = vel[i3 + 2] += (kS * (tz - pos[i3 + 2]) - cD * vel[i3 + 2]) * dt;
    pos[i3] += vx * dt; pos[i3 + 1] += vy * dt; pos[i3 + 2] += vz * dt;

    // orientación suavizada
    const q = 1 - Math.exp(-dt * 10);
    dir[i3] += (dx - dir[i3]) * q; dir[i3 + 1] += (dy - dir[i3 + 1]) * q; dir[i3 + 2] += (dz - dir[i3 + 2]) * q;
    tmpDir.set(dir[i3], dir[i3 + 1], dir[i3 + 2]);
    if (tmpDir.lengthSq() < 1e-6) tmpDir.set(0, 1, 0);
    tmpDir.normalize();

    if (esLluvia && i >= N_CRUCES) continue;

    dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);
    dummy.quaternion.setFromUnitVectors(UP, tmpDir);
    const largo = esLluvia ? 0.7 + 0.9 * V[i] * rs[i] : 0.16 + 0.22 * U[i];
    dummy.scale.set(esLluvia ? 1 + V[i] : 1, largo, 1);
    dummy.updateMatrix();
    (esLluvia ? cruces : sticks).setMatrixAt(i, dummy.matrix);
  }

  // en lluvia las cruces usan el mismo estado; las varillas se desvanecen
  sticks.visible = !esLluvia;
  cruces.visible = esLluvia;
  sticks.instanceMatrix.needsUpdate = true;
  cruces.instanceMatrix.needsUpdate = true;

  // mantener las cruces actualizadas aunque estemos en otro modo no hace falta:
  // al entrar en lluvia los muelles las traen en menos de un segundo.

  hudGesto.textContent = hayMano || !camaraActiva ? NOMBRES[modo] : 'sin mano';
  if (!camaraActiva) hudEstado.textContent = 'modo ratón · teclas 1-4 cambian el efecto · rueda = tamaño';
  else if (!hudEstado.textContent.startsWith('No se pudo')) hudEstado.textContent = '';

  renderer.render(scene, camera);
}
frame();
