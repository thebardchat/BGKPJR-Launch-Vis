<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";

  // ─── physics constants ───────────────────────────────────────────
  const R_EARTH = 6371;          // km
  const RAIL_LEN = 28.7;         // km
  const RAIL_DEG = 15;           // incline degrees
  const RAIL_RAD = (RAIL_DEG * Math.PI) / 180;
  const EXIT_V   = 1190;         // m/s → Mach 3.5
  const MAX_V    = 1700;         // m/s → Mach 5
  const SAIL_ALT = 310;          // km

  // scene scale: 1 unit = 0.1 km  → rail = 287 units, Earth radius = 63710 units (clipped to large sphere)
  const S = 10; // 1 unit = 0.1 km

  // ─── mission phases (sim seconds) ───────────────────────────────
  const PH_RAIL_END    = 24;          // 23s rail run
  const PH_WINGS_END   = PH_RAIL_END + 6;   // wing deploy animation
  const PH_ATMO_END    = PH_WINGS_END + 90; // atmospheric climb to ~60km
  const PH_BURN_END    = PH_ATMO_END + 30;  // hybrid propulsion burn
  const PH_ORBIT_END   = PH_BURN_END + 60;  // orbital insertion
  const PH_SAIL_DEPLOY = PH_ORBIT_END + 20; // sail unfurl
  const PH_SAIL_END    = PH_SAIL_DEPLOY + 80;
  const T_MAX          = PH_SAIL_END;

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let raf = 0;
  let last = 0;
  let resizeObs: ResizeObserver | null = null;

  // reactive HUD state
  let t = 0;
  let playing = true;
  let speed = 1;
  let phase = "MAGLEV RAIL";
  let velocityMs = 0;
  let altitudeKm = 0;
  let gForce = 0;
  let machNum = 0;

  // Three.js objects
  let tubeObj: THREE.Mesh;
  let craftBody: THREE.Mesh;
  let wingL: THREE.Mesh, wingR: THREE.Mesh;
  let sailPanels: THREE.Mesh[] = [];
  let thrustParticles: THREE.Points;
  let particlePositions: Float32Array;
  let glowMat: THREE.MeshStandardMaterial;
  let craftGroup: THREE.Group;
  let particleGroup: THREE.Group;
  let exhaustLight: THREE.PointLight;

  function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.min(Math.max(t, 0), 1); }
  function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t: number) { return t < .5 ? 2*t*t : -1+(4-2*t)*t; }

  function craftPositionAlongRail(frac: number): THREE.Vector3 {
    // Rail: starts at ground, 15° incline, 287 S-units long
    const baseX = -143;  // centered
    const railX = baseX + frac * 287 * Math.cos(RAIL_RAD);
    const railY = -10 + frac * 287 * Math.sin(RAIL_RAD);
    return new THREE.Vector3(railX, railY, 0);
  }

  function phaseFrac(t: number, start: number, end: number) {
    return Math.min(Math.max((t - start) / (end - start), 0), 1);
  }

  function getCraftPosition(simT: number): THREE.Vector3 {
    if (simT <= PH_RAIL_END) {
      const f = easeOut(simT / PH_RAIL_END);
      return craftPositionAlongRail(f);
    }
    if (simT <= PH_ATMO_END) {
      const f = phaseFrac(simT, PH_RAIL_END, PH_ATMO_END);
      const ef = easeInOut(f);
      // arc upward from exit point (287 S * cos, 287 S * sin) to 600km altitude equivalent
      const startX = craftPositionAlongRail(1).x;
      const startY = craftPositionAlongRail(1).y;
      return new THREE.Vector3(
        lerp(startX, startX + 300, ef),
        lerp(startY, startY + 600, ef),
        0
      );
    }
    if (simT <= PH_BURN_END) {
      const f = phaseFrac(simT, PH_ATMO_END, PH_BURN_END);
      const base = getCraftPosition(PH_ATMO_END);
      return new THREE.Vector3(base.x + f * 80, base.y + f * 200, 0);
    }
    if (simT <= PH_SAIL_END) {
      const base = getCraftPosition(PH_BURN_END);
      const f = phaseFrac(simT, PH_BURN_END, PH_SAIL_END);
      return new THREE.Vector3(base.x + f * 300, base.y + 20, 0);
    }
    return getCraftPosition(PH_BURN_END);
  }

  function getPhysics(simT: number) {
    if (simT <= PH_RAIL_END) {
      const f = simT / PH_RAIL_END;
      const v = f * EXIT_V;
      return { v, alt: (craftPositionAlongRail(easeOut(f)).y + 10) / S, g: 3.9, ph: "STAGE 1 — MAGLEV RAIL" };
    }
    if (simT <= PH_WINGS_END) {
      return { v: EXIT_V, alt: 2.5, g: 0.5, ph: "WING DEPLOY" };
    }
    if (simT <= PH_ATMO_END) {
      const f = phaseFrac(simT, PH_WINGS_END, PH_ATMO_END);
      const v = lerp(EXIT_V, 2_720, f);
      const alt = lerp(2.5, 65, f);
      return { v, alt, g: lerp(3.9, 1.2, f), ph: "STAGE 2 — GRYPHON ASCENT" };
    }
    if (simT <= PH_BURN_END) {
      const f = phaseFrac(simT, PH_ATMO_END, PH_BURN_END);
      return { v: lerp(2_720, 7_800, f), alt: lerp(65, 310, f), g: lerp(1.2, 2.8, f), ph: "STAGE 2 — HYBRID PROPULSION BURN" };
    }
    if (simT <= PH_ORBIT_END) {
      return { v: 7_800, alt: 310, g: 0, ph: "STAGE 3 — ORBITAL INSERTION" };
    }
    if (simT <= PH_SAIL_DEPLOY) {
      return { v: 7_780, alt: 312, g: 0, ph: "STAGE 3 — KEPLER SAIL DEPLOY" };
    }
    return { v: 7_760, alt: 320, g: 0, ph: "STAGE 3 — KEPLER SOLAR SAIL ACTIVE" };
  }

  function updateParticles(craftPos: THREE.Vector3, simT: number) {
    if (!thrustParticles || !particlePositions) return;
    const active = simT > PH_RAIL_END && simT < PH_BURN_END + 5;
    thrustParticles.visible = active;
    if (!active) return;
    const count = particlePositions.length / 3;
    for (let i = 0; i < count; i++) {
      particlePositions[i * 3]     = craftPos.x + (Math.random() - 0.5) * 8  - Math.sin(RAIL_RAD) * i * 0.5;
      particlePositions[i * 3 + 1] = craftPos.y + (Math.random() - 0.5) * 8  - Math.cos(RAIL_RAD) * i * 0.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    (thrustParticles.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  function updateWings(simT: number) {
    if (!wingL || !wingR) return;
    const f = easeOut(phaseFrac(simT, PH_RAIL_END, PH_WINGS_END));
    const angle = f * Math.PI * 0.45; // fold out 80°
    wingL.rotation.z =  angle;
    wingR.rotation.z = -angle;
  }

  function updateSail(simT: number) {
    if (!sailPanels.length) return;
    const f = easeOut(phaseFrac(simT, PH_SAIL_DEPLOY, PH_SAIL_END));
    sailPanels.forEach((p, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      const axis = i < 2 ? "x" : "z";
      p.scale[axis === "x" ? "x" : "z"] = lerp(0.02, 1, f);
      p.position[axis === "x" ? "x" : "z"] = sign * lerp(0, 24, f);
      p.material.opacity = lerp(0, 0.82, f);
    });
  }

  function updateCamera(simT: number, craftPos: THREE.Vector3) {
    if (simT <= PH_RAIL_END) {
      // close follow along rail
      const target = craftPos.clone().add(new THREE.Vector3(0, 0, 0));
      camera.position.lerp(new THREE.Vector3(craftPos.x - 20, craftPos.y + 30, 120), 0.06);
      camera.lookAt(target);
    } else if (simT <= PH_ATMO_END) {
      const f = phaseFrac(simT, PH_RAIL_END, PH_ATMO_END);
      const dist = lerp(120, 500, easeInOut(f));
      camera.position.lerp(new THREE.Vector3(craftPos.x - 80, craftPos.y - 80, dist), 0.03);
      camera.lookAt(craftPos);
    } else {
      const dist = lerp(500, 1200, phaseFrac(simT, PH_ATMO_END, PH_SAIL_END));
      camera.position.lerp(new THREE.Vector3(craftPos.x - 200, craftPos.y - 100, dist), 0.02);
      camera.lookAt(craftPos);
    }
    camera.updateProjectionMatrix();
  }

  function init() {
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040910, 0.0002);

    camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 20000);
    camera.position.set(-163, 30, 120);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0x102030, 1.2));
    const sun = new THREE.DirectionalLight(0xfff8e0, 2.0);
    sun.position.set(500, 800, 400);
    scene.add(sun);

    exhaustLight = new THREE.PointLight(0x00e5ff, 0, 200);
    scene.add(exhaustLight);

    // Stars
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 3000 + Math.random() * 5000;
      const phi = Math.random() * Math.PI * 2;
      const ct = Math.random() * 2 - 1;
      const st = Math.sqrt(1 - ct * ct);
      starPos[i*3]   = r * st * Math.cos(phi);
      starPos[i*3+1] = r * ct;
      starPos[i*3+2] = r * st * Math.sin(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.2, color: 0xa8c0d8, transparent: true, opacity: 0.7 })));

    // Earth — partial sphere at bottom
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a6a, emissive: 0x050f22, roughness: 0.9, metalness: 0.0,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * S, 64, 64), earthMat);
    earth.position.set(0, -R_EARTH * S - 2, 0);
    earth.name = "earth";
    scene.add(earth);

    // Atmosphere glow
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH * S * 1.012, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x004488, transparent: true, opacity: 0.18, side: THREE.BackSide })
    );
    atm.position.copy(earth.position);
    scene.add(atm);

    // Ground plane (near tube base)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d2a1a, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    scene.add(ground);

    // Maglev tube
    const tubeGeo = new THREE.BoxGeometry(287, 4, 6);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x0a2040, emissive: 0x002244, metalness: 0.7, roughness: 0.3,
    });
    tubeObj = new THREE.Mesh(tubeGeo, tubeMat);
    // Center at midpoint of rail, tilted 15°
    tubeObj.rotation.z = RAIL_RAD;
    tubeObj.position.set(0, 287 * 0.5 * Math.sin(RAIL_RAD) - 10, 0);
    scene.add(tubeObj);

    // Tube glow strip (inner blue light)
    const tubeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(285, 1, 2),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 })
    );
    tubeObj.add(tubeGlow);

    // ─── Gryphon spacecraft ──────────────────────────────────────
    craftGroup = new THREE.Group();
    scene.add(craftGroup);

    // Body — capsule
    craftBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(4, 12, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xc8deff, emissive: 0x001122, metalness: 0.6, roughness: 0.4 })
    );
    craftBody.rotation.z = Math.PI / 2;
    craftGroup.add(craftBody);

    // Wings — start folded (rotation.z = 0), unfold on deploy
    const wingGeo = new THREE.BoxGeometry(18, 0.5, 6);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x809ab8, metalness: 0.8, roughness: 0.2 });
    wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.set(0, 0, 4);
    wingL.rotation.z = 0;
    craftGroup.add(wingL);
    wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0, 0, -4);
    wingR.rotation.z = 0;
    craftGroup.add(wingR);

    // Kepler solar sail panels (4 panels, start collapsed)
    const sailMat = (color: number) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, side: THREE.DoubleSide,
    });
    const sailGeo = new THREE.PlaneGeometry(24, 16);
    const sailColors = [0xffe066, 0xffd740, 0xffb300, 0xffc107];
    sailPanels = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(sailGeo, sailMat(sailColors[i]));
      p.scale.x = 0.02;
      craftGroup.add(p);
      sailPanels.push(p);
    }

    // Thrust particles
    const pCount = 60;
    particlePositions = new Float32Array(pCount * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    thrustParticles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 3, color: 0x00e5ff, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending,
    }));
    thrustParticles.visible = false;
    scene.add(thrustParticles);

    resizeObs = new ResizeObserver(() => {
      const W2 = container.clientWidth, H2 = container.clientHeight;
      camera.aspect = W2 / H2; camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    });
    resizeObs.observe(container);
  }

  function tick(now: number) {
    if (!last) last = now;
    const dt = Math.min(now - last, 80);
    last = now;
    if (playing) {
      t += (dt / 1000) * speed;
      if (t > T_MAX) { t = 0; }
    }

    const pos = getCraftPosition(t);
    craftGroup.position.copy(pos);
    craftGroup.rotation.z = t < PH_RAIL_END ? RAIL_RAD : 0;

    updateWings(t);
    updateSail(t);
    updateParticles(pos, t);
    updateCamera(t, pos);

    const phys = getPhysics(t);
    velocityMs = Math.round(phys.v);
    altitudeKm = Math.round(phys.alt * 10) / 10;
    gForce     = Math.round(phys.g * 10) / 10;
    machNum    = Math.round(phys.v / 343 * 10) / 10;
    phase      = phys.ph;

    // exhaust glow
    const burning = t > PH_ATMO_END && t < PH_BURN_END;
    exhaustLight.position.copy(pos);
    exhaustLight.intensity = burning ? 80 + Math.random() * 40 : 0;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      init(); t = PH_BURN_END + 10; tick(performance.now()); cancelAnimationFrame(raf); return;
    }
    init();
    raf = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
    resizeObs?.disconnect();
    renderer?.dispose();
  });

  function fmtV(v: number) { return v.toLocaleString(); }
</script>

<div class="vis-frame">
  <div class="canvas-host" bind:this={container}></div>

  <div class="hud-left">
    <div class="hud-block">
      <div class="hud-phase">{phase}</div>
    </div>
    <div class="hud-block">
      <div class="hud-row"><span class="lbl">VELOCITY</span><span class="val accent">{fmtV(velocityMs)} <span class="unit">m/s</span></span></div>
      <div class="hud-row"><span class="lbl">MACH</span><span class="val">{machNum}</span></div>
      <div class="hud-row"><span class="lbl">ALTITUDE</span><span class="val">{altitudeKm} <span class="unit">km</span></span></div>
      <div class="hud-row"><span class="lbl">G-LOAD</span><span class="val {gForce > 3 ? 'warn' : ''}">{gForce} G</span></div>
    </div>
  </div>

  <div class="hud-bottom">
    <button class="btn-ctrl" on:click={() => (playing = !playing)}>{playing ? "⏸" : "▶"}</button>
    <input class="scrub" type="range" min="0" max={T_MAX} step="0.1" bind:value={t} aria-label="Mission time" />
    <select class="spd" bind:value={speed}>
      <option value={0.5}>0.5×</option>
      <option value={1}>1×</option>
      <option value={3}>3×</option>
      <option value={10}>10×</option>
    </select>
    <span class="time-label mono">T+ {t.toFixed(0)}s</span>
  </div>

  <div class="stage-dots">
    {#each [
      {label:"RAIL",   start:0,            end:PH_WINGS_END},
      {label:"ASCENT", start:PH_WINGS_END, end:PH_BURN_END},
      {label:"ORBIT",  start:PH_BURN_END,  end:PH_SAIL_DEPLOY},
      {label:"KEPLER", start:PH_SAIL_DEPLOY,end:T_MAX},
    ] as s}
      <button
        class="stage-dot {t >= s.start && t < s.end ? 'active' : t >= s.end ? 'done' : ''}"
        on:click={() => { t = s.start; }}
        aria-label={s.label}
      >{s.label}</button>
    {/each}
  </div>
</div>

<style>
.vis-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  min-height: 420px;
  background: radial-gradient(ellipse at 50% 100%, #061830, #02080f 70%);
  border: 1px solid #192e4c;
  border-radius: 18px;
  overflow: hidden;
}
.canvas-host { position: absolute; inset: 0; }

.hud-left {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(4,9,16,.72);
  border: 1px solid #192e4c;
  border-radius: 10px;
  padding: 14px 18px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  backdrop-filter: blur(8px);
  min-width: 220px;
}
.hud-phase {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #00e5ff;
  text-transform: uppercase;
  padding-bottom: 8px;
  border-bottom: 1px solid #192e4c;
  margin-bottom: 4px;
}
.hud-block { display: flex; flex-direction: column; gap: 5px; }
.hud-row { display: flex; align-items: baseline; gap: 10px; justify-content: space-between; }
.lbl { color: #4d6680; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; min-width: 65px; }
.val { color: #ddeeff; font-weight: 500; font-size: 13px; text-align: right; }
.val.accent { color: #00e5ff; }
.val.warn   { color: #ffaa00; }
.unit { font-size: 9px; color: #4d6680; }

.hud-bottom {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(4,9,16,.72);
  border: 1px solid #192e4c;
  border-radius: 10px;
  padding: 8px 16px;
  backdrop-filter: blur(8px);
  white-space: nowrap;
}
.btn-ctrl {
  background: none; border: 1px solid #192e4c; border-radius: 6px;
  color: #00e5ff; padding: 4px 10px; cursor: pointer; font-size: 12px;
  transition: background .15s;
}
.btn-ctrl:hover { background: rgba(0,229,255,.1); }
.scrub {
  width: 180px;
  accent-color: #00e5ff;
}
.spd {
  background: #080f1c; color: #ddeeff;
  border: 1px solid #192e4c; border-radius: 6px;
  padding: 3px 6px; font-family: "JetBrains Mono", monospace; font-size: 11px;
}
.time-label { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #4d6680; }
.mono { font-family: "JetBrains Mono", monospace; }

.stage-dots {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stage-dot {
  background: rgba(4,9,16,.72);
  border: 1px solid #192e4c;
  border-radius: 6px;
  color: #4d6680;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  padding: 5px 10px;
  cursor: pointer;
  transition: all .2s;
  text-align: right;
}
.stage-dot.active { border-color: #00e5ff; color: #00e5ff; background: rgba(0,229,255,.08); }
.stage-dot.done   { border-color: #192e4c; color: #254469; }
.stage-dot:hover  { border-color: #254469; color: #8faec8; }
</style>
