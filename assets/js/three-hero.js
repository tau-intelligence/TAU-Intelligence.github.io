/* =========================================================
   Tau Intelligence — Hero 3D scene (fullscreen background)
   ---------------------------------------------------------
   The canvas is position:fixed covering the entire viewport.
   The armillary sphere + particle field renders behind all
   page content. As the user scrolls past the hero section,
   the globe pulls back (zooms out), dims, and the particles
   spread — transitioning the 3D into a subtle ambient
   background for the rest of the page.
   ========================================================= */

import * as THREE from 'three';

const canvas = document.getElementById('hero-canvas');
if (canvas) {
  try {
    initHero(canvas);
  } catch (err) {
    console.warn('Tau hero: WebGL init failed', err);
  }
}

function initHero(canvas) {
  const COLORS = {
    bg:        0x110F0C,
    primary:   0xE8722C,
    primary2:  0xB8541C,
    accent:    0xE9A766,
    cool:      0x6FB7C9,
    cream:     0xF2E9D8,
  };

  // ---- renderer / scene / camera ---------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.bg, 0.045);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.6, 6.2);

  // OrbitControls on the canvas — but canvas has pointer-events:none,
  // so we enable it only when the user interacts with the hero area.
  // For simplicity, we skip orbit controls and rely on pointer parallax.

  // ---- lights ----------------------------------------------------
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(COLORS.primary, 1.4);
  key.position.set(3, 2.5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(COLORS.cool, 0.7);
  rim.position.set(-4, -1, -3);
  scene.add(rim);

  // ---- the central globe (wireframe icosahedron) -----------------
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const globeGeo = new THREE.IcosahedronGeometry(1.25, 4);
  const globeMat = new THREE.MeshStandardMaterial({
    color: COLORS.primary2,
    emissive: COLORS.primary2,
    emissiveIntensity: 0.25,
    metalness: 0.6,
    roughness: 0.45,
    flatShading: true,
    transparent: true,
    opacity: 0.18,
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  globeGroup.add(globe);

  const wireGeo = new THREE.IcosahedronGeometry(1.255, 3);
  const wireMat = new THREE.LineBasicMaterial({
    color: COLORS.primary,
    transparent: true,
    opacity: 0.55,
  });
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(wireGeo), wireMat);
  globeGroup.add(wire);

  const coreGeo = new THREE.SphereGeometry(0.28, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({
    color: COLORS.accent,
    transparent: true,
    opacity: 0.85,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  globeGroup.add(core);

  const haloGeo = new THREE.SphereGeometry(1.55, 48, 48);
  const haloMat = new THREE.MeshBasicMaterial({
    color: COLORS.primary,
    transparent: true,
    opacity: 0.06,
    side: THREE.BackSide,
  });
  globeGroup.add(new THREE.Mesh(haloGeo, haloMat));

  // ---- orbiting rings (armillary sphere) -------------------------
  function makeRing(radius, tube, color, opacity) {
    const g = new THREE.TorusGeometry(radius, tube, 24, 200);
    const m = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.3,
      transparent: true,
      opacity,
    });
    return new THREE.Mesh(g, m);
  }
  const ring1 = makeRing(1.85, 0.018, COLORS.primary, 0.95);
  const ring2 = makeRing(2.05, 0.014, COLORS.accent,  0.85);
  const ring3 = makeRing(2.30, 0.010, COLORS.primary2, 0.75);
  ring2.rotation.x = Math.PI / 2.6;
  ring3.rotation.z = Math.PI / 3;
  globeGroup.add(ring1, ring2, ring3);

  const beadGeo = new THREE.SphereGeometry(0.045, 16, 16);
  const beadMat = new THREE.MeshBasicMaterial({ color: COLORS.cream });
  const bead = new THREE.Mesh(beadGeo, beadMat);
  globeGroup.add(bead);

  // ---- particle field --------------------------------------------
  const PARTICLE_COUNT = 2000;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colorsArr = new Float32Array(PARTICLE_COUNT * 3);
  const tmpColor  = new THREE.Color();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 3.0 + Math.random() * 7.0;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    positions[i*3+0] = r * Math.sin(p) * Math.cos(t);
    positions[i*3+1] = r * Math.sin(p) * Math.sin(t) * 0.5;
    positions[i*3+2] = r * Math.cos(p);
    const mix = Math.random();
    if (mix < 0.78) tmpColor.setHex(COLORS.primary);
    else if (mix < 0.93) tmpColor.setHex(COLORS.accent);
    else tmpColor.setHex(COLORS.cool);
    tmpColor.toArray(colorsArr, i*3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(colorsArr, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.032,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---- scroll state (0 = top of page, 1 = one viewport scrolled) -
  // On pages without a hero section, default to 1 (ambient-only mode).
  const heroEl = document.getElementById('hero-section');
  let scrollT = heroEl ? 0 : 1;
  function updateScroll() {
    if (!heroEl) return; // non-home pages stay at scrollT=1
    const rect = heroEl.getBoundingClientRect();
    scrollT = Math.max(0, Math.min(1, -rect.top / (rect.height * 0.8)));
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  // ---- pointer parallax (works on entire page) -------------------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  document.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ---- resize to full viewport -----------------------------------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- animation loop --------------------------------------------
  const clock = new THREE.Clock();

  // Store initial opacities so we can scale them with scroll
  const initGlobeOp = globeMat.opacity;
  const initWireOp  = wireMat.opacity;
  const initRing1Op = ring1.material.opacity;
  const initRing2Op = ring2.material.opacity;
  const initRing3Op = ring3.material.opacity;

  function tick() {
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();

    // ---- scroll-driven transitions ----
    // scrollT: 0 = hero fully visible, 1 = hero scrolled away
    const fade   = 1 - scrollT * 0.85;           // globe fades to 15% opacity
    const zPull  = scrollT * 6;                    // camera pulls back
    const pSpread = 1 + scrollT * 0.4;             // particles spread out
    const pFade  = Math.max(0.08, 1 - scrollT * 0.7); // particles dim but never fully gone

    // Apply fade to globe elements
    globeMat.opacity = initGlobeOp * fade;
    wireMat.opacity  = initWireOp  * fade;
    ring1.material.opacity = initRing1Op * fade;
    ring2.material.opacity = initRing2Op * fade;
    ring3.material.opacity = initRing3Op * fade;
    haloMat.opacity  = 0.06 * fade;
    coreMat.opacity  = (0.7 + Math.sin(t * 1.4) * 0.15) * fade;
    beadMat.opacity  = fade;
    beadMat.transparent = true;
    pMat.opacity     = pFade;

    // Scale particles outward as user scrolls
    particles.scale.setScalar(pSpread);

    // ring spin
    ring1.rotation.y = t * 0.35;
    ring2.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.3) * 0.4;
    ring2.rotation.y = -t * 0.22;
    ring3.rotation.z = Math.PI / 3 + t * 0.18;

    // bead orbits ring1 plane
    const br = 1.85;
    bead.position.set(
      Math.cos(t * 0.9) * br,
      Math.sin(t * 0.9) * br * 0.04,
      Math.sin(t * 0.9) * br
    );

    // core gentle pulse
    const pulse = 1 + Math.sin(t * 1.4) * 0.06;
    core.scale.setScalar(pulse);

    // particle drift
    particles.rotation.y = t * 0.04;

    // pointer parallax
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    globeGroup.rotation.y += (pointer.x * 0.3 - globeGroup.rotation.y % (Math.PI * 2)) * 0.004;

    // camera: base position + scroll pullback + pointer offset
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (0.6 + pointer.y * -0.3 - camera.position.y) * 0.02;
    camera.position.z = 6.2 + zPull;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  tick();
}
