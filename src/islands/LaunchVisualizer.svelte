<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import { PODS, PODS_WIP } from "../data/launch";

  // ─── physics constants ───────────────────────────────────────────
  const R_EARTH  = 6371;
  const RAIL_RAD = (15 * Math.PI) / 180;
  const EXIT_V   = 1190;   // Gryphon exit m/s (Mach 3.5)

  // ─── mission phases (sim seconds) ───────────────────────────────
  const PH_RAIL_END    = 24;
  const PH_WINGS_END   = PH_RAIL_END + 6;
  const PH_ATMO_END    = PH_WINGS_END + 90;
  const PH_BURN_END    = PH_ATMO_END + 30;
  const PH_ORBIT_END   = PH_BURN_END + 60;
  const PH_SAIL_DEPLOY = PH_ORBIT_END + 20;
  const PH_SAIL_END    = PH_SAIL_DEPLOY + 80;
  const T_MAX          = PH_SAIL_END;

  // ─── pod selection ───────────────────────────────────────────────
  let activePodId = "B";
  $: activePod = PODS[activePodId as keyof typeof PODS] ?? PODS.B;
  $: podGLimit  = activePod.internalG;
  $: podColor   = parseInt(activePod.color.replace("#", ""), 16);

  const podTabs = [
    ...Object.values(PODS),
    ...PODS_WIP.map(p => ({ ...p, internalG: p.internalG ?? 8, color: p.color })),
  ];

  // ─── UI state ────────────────────────────────────────────────────
  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let raf = 0;
  let last = 0;
  let resizeObs: ResizeObserver | null = null;

  let t       = 0;
  let playing = true;
  let speed   = 1;
  let phase   = "TUBE LOADING";
  let velocityMs  = 0;
  let altitudeKm  = 0;
  let gForce      = 0;
  let machNum     = 0;
  let gOverLimit  = false;

  // ─── Three.js objects ────────────────────────────────────────────
  let craftBody: THREE.Mesh;
  let wingL: THREE.Mesh, wingR: THREE.Mesh;
  let sailPanels: THREE.Mesh[] = [];
  let thrustParticles: THREE.Points;
  let particlePositions: Float32Array;
  let craftGroup: THREE.Group;
  let exhaustLight: THREE.PointLight;
  let muzzleFlashLight: THREE.PointLight;
  let tubeInteriorLight: THREE.PointLight;
  let emCoils: THREE.Mesh[] = [];
  let muzzleWorldPos: THREE.Vector3;
  let craftBodyMat: THREE.MeshStandardMaterial;

  // ─── helpers ────────────────────────────────────────────────────
  function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.min(Math.max(t, 0), 1); }
  function easeOut(t: number)   { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t: number) { return t < .5 ? 2*t*t : -1+(4-2*t)*t; }
  function phaseFrac(t: number, s: number, e: number) { return Math.min(Math.max((t - s) / (e - s), 0), 1); }

  function craftPositionAlongRail(frac: number): THREE.Vector3 {
    return new THREE.Vector3(
      -143 + frac * 287 * Math.cos(RAIL_RAD),
      -10  + frac * 287 * Math.sin(RAIL_RAD),
      0,
    );
  }

  function getCraftPosition(simT: number): THREE.Vector3 {
    if (simT <= PH_RAIL_END) {
      return craftPositionAlongRail(easeOut(simT / PH_RAIL_END));
    }
    if (simT <= PH_ATMO_END) {
      const f  = phaseFrac(simT, PH_RAIL_END, PH_ATMO_END);
      const ef = easeInOut(f);
      const sx = craftPositionAlongRail(1).x;
      const sy = craftPositionAlongRail(1).y;
      return new THREE.Vector3(lerp(sx, sx + 300, ef), lerp(sy, sy + 600, ef), 0);
    }
    if (simT <= PH_BURN_END) {
      const f   = phaseFrac(simT, PH_ATMO_END, PH_BURN_END);
      const base = getCraftPosition(PH_ATMO_END);
      return new THREE.Vector3(base.x + f * 80, base.y + f * 200, 0);
    }
    const base = getCraftPosition(PH_BURN_END);
    const f    = phaseFrac(simT, PH_BURN_END, PH_SAIL_END);
    return new THREE.Vector3(base.x + f * 300, base.y + 20, 0);
  }

  function getPhysics(simT: number) {
    if (simT <= PH_RAIL_END) {
      const f = simT / PH_RAIL_END;
      const v = f * EXIT_V;
      const g = 3.9;
      return { v, alt: (craftPositionAlongRail(easeOut(f)).y + 10) / 10, g, ph: `STAGE 1 — EM LAUNCH TUBE · ${activePod.name}` };
    }
    if (simT <= PH_WINGS_END) {
      return { v: EXIT_V, alt: 2.5, g: 0.5, ph: "STAGE 2 — WING DEPLOY" };
    }
    if (simT <= PH_ATMO_END) {
      const f = phaseFrac(simT, PH_WINGS_END, PH_ATMO_END);
      return { v: lerp(EXIT_V, 2_720, f), alt: lerp(2.5, 65, f), g: lerp(3.9, 1.2, f), ph: "STAGE 2 — GRYPHON ASCENT" };
    }
    if (simT <= PH_BURN_END) {
      const f = phaseFrac(simT, PH_ATMO_END, PH_BURN_END);
      return { v: lerp(2_720, 7_800, f), alt: lerp(65, 310, f), g: lerp(1.2, 2.8, f), ph: "STAGE 2 — HYBRID BURN" };
    }
    if (simT <= PH_ORBIT_END) {
      return { v: 7_800, alt: 310, g: 0, ph: "STAGE 3 — ORBITAL INSERTION" };
    }
    if (simT <= PH_SAIL_DEPLOY) {
      return { v: 7_780, alt: 312, g: 0, ph: "STAGE 3 — KEPLER SAIL DEPLOY" };
    }
    return { v: 7_760, alt: 320, g: 0, ph: "STAGE 3 — KEPLER SOLAR SAIL ACTIVE" };
  }

  // ─── EM coil chase effect ────────────────────────────────────────
  function updateEMCoils(simT: number) {
    if (!emCoils.length) return;
    if (simT >= PH_RAIL_END) {
      emCoils.forEach(c => ((c.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25));
      if (tubeInteriorLight) tubeInteriorLight.intensity = 0;
      return;
    }
    const podFrac  = easeOut(simT / PH_RAIL_END);
    const podLocalX = (podFrac - 0.5) * 287;
    emCoils.forEach(coil => {
      const dist   = podLocalX - coil.position.x; // positive = coil is behind pod
      let intensity = 0.25;
      if (dist > -4 && dist < 32) {
        intensity = 2.5 + Math.max(0, 1 - Math.abs(dist - 14) / 14) * 9;
      }
      (coil.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    });
    const podWorld = craftPositionAlongRail(podFrac);
    if (tubeInteriorLight) {
      tubeInteriorLight.position.copy(podWorld);
      tubeInteriorLight.intensity = 15 + podFrac * 55;
    }
  }

  function updateParticles(craftPos: THREE.Vector3, simT: number) {
    if (!thrustParticles || !particlePositions) return;
    const active = simT > PH_RAIL_END && simT < PH_BURN_END + 5;
    thrustParticles.visible = active;
    if (!active) return;
    const count = particlePositions.length / 3;
    for (let i = 0; i < count; i++) {
      particlePositions[i*3]   = craftPos.x + (Math.random() - .5)*8 - Math.sin(RAIL_RAD)*i*.5;
      particlePositions[i*3+1] = craftPos.y + (Math.random() - .5)*8 - Math.cos(RAIL_RAD)*i*.5;
      particlePositions[i*3+2] = (Math.random() - .5)*4;
    }
    (thrustParticles.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  function updateWings(simT: number) {
    if (!wingL || !wingR) return;
    const f = easeOut(phaseFrac(simT, PH_RAIL_END, PH_WINGS_END));
    wingL.rotation.z =  f * Math.PI * 0.45;
    wingR.rotation.z = -f * Math.PI * 0.45;
  }

  function updateSail(simT: number) {
    if (!sailPanels.length) return;
    const f = easeOut(phaseFrac(simT, PH_SAIL_DEPLOY, PH_SAIL_END));
    sailPanels.forEach((p, i) => {
      const sign = i % 2 === 0 ? 1 : -1;
      const axis = i < 2 ? "x" : "z";
      p.scale[axis as "x"|"z"] = lerp(0.02, 1, f);
      p.position[axis as "x"|"z"] = sign * lerp(0, 24, f);
      (p.material as THREE.MeshBasicMaterial).opacity = lerp(0, 0.82, f);
    });
  }

  function updateCamera(simT: number, craftPos: THREE.Vector3) {
    if (simT <= PH_RAIL_END) {
      // Show tube EXTERIOR — pan from overview to muzzle close-up
      const f  = simT / PH_RAIL_END;
      const ef = easeInOut(f);
      const mid    = craftPositionAlongRail(0.5);
      const muzzle = craftPositionAlongRail(1.0);
      const cx = lerp(mid.x - 20, muzzle.x - 8, ef);
      const cy = lerp(mid.y + 110, muzzle.y + 30, ef);
      const cz = lerp(390, 105, ef);
      camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.04);
      camera.lookAt(new THREE.Vector3(lerp(mid.x, muzzle.x, ef), lerp(mid.y, muzzle.y, ef), 0));
    } else if (simT <= PH_ATMO_END) {
      const f = phaseFrac(simT, PH_RAIL_END, PH_ATMO_END);
      camera.position.lerp(new THREE.Vector3(craftPos.x - 80, craftPos.y - 80, lerp(120, 500, easeInOut(f))), 0.03);
      camera.lookAt(craftPos);
    } else {
      camera.position.lerp(new THREE.Vector3(craftPos.x - 200, craftPos.y - 100, lerp(500, 1200, phaseFrac(simT, PH_ATMO_END, PH_SAIL_END))), 0.02);
      camera.lookAt(craftPos);
    }
    camera.updateProjectionMatrix();
  }

  function init() {
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;

    scene  = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040910, 0.0002);
    camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 20000);
    camera.position.set(-163, 30, 390);

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
      const ct  = Math.random() * 2 - 1;
      const st  = Math.sqrt(1 - ct * ct);
      starPos[i*3]   = r * st * Math.cos(phi);
      starPos[i*3+1] = r * ct;
      starPos[i*3+2] = r * st * Math.sin(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.2, color: 0xa8c0d8, transparent: true, opacity: 0.7 })));

    // Earth
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH * 10, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a3a6a, emissive: 0x050f22, roughness: 0.9 }),
    );
    earth.position.set(0, -R_EARTH * 10 - 2, 0);
    scene.add(earth);
    scene.add(Object.assign(new THREE.Mesh(
      new THREE.SphereGeometry(R_EARTH * 10 * 1.012, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x004488, transparent: true, opacity: 0.18, side: THREE.BackSide }),
    ), { position: earth.position.clone() }));

    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ color: 0x0d2a1a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    scene.add(ground);

    // ══════════════════════════════════════════════════════════════
    // EM LAUNCH TUBE — sealed barrel (like a 28.7 km gun barrel)
    // Pod rides INSIDE the tube, completely enclosed, shot out the muzzle
    // ══════════════════════════════════════════════════════════════
    const tubeGroup = new THREE.Group();
    tubeGroup.position.set(0, 287 * 0.5 * Math.sin(RAIL_RAD) - 10, 0);
    tubeGroup.rotation.z = RAIL_RAD;
    scene.add(tubeGroup);

    // Outer steel barrel shell
    const outerBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 287, 32, 1, false),
      new THREE.MeshStandardMaterial({ color: 0x1c2d42, emissive: 0x020810, metalness: 0.88, roughness: 0.12 }),
    );
    outerBarrel.rotation.z = Math.PI / 2;
    tubeGroup.add(outerBarrel);

    // Inner evacuated bore (open-ended, dark interior)
    const innerBore = new THREE.Mesh(
      new THREE.CylinderGeometry(5.3, 5.3, 290, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x000408, side: THREE.BackSide }),
    );
    innerBore.rotation.z = Math.PI / 2;
    tubeGroup.add(innerBore);

    // Electromagnetic acceleration coil rings
    const coilMatBase = new THREE.MeshStandardMaterial({
      color: 0x1040a0, emissive: 0x002299, emissiveIntensity: 0.8,
      metalness: 0.95, roughness: 0.05,
    });
    emCoils = [];
    for (let x = -133; x <= 133; x += 13) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(9, 1.8, 8, 20), coilMatBase.clone());
      coil.position.x = x;
      coil.rotation.y = Math.PI / 2;
      tubeGroup.add(coil);
      emCoils.push(coil);
    }

    // Muzzle (exit) reinforcement ring — glowing cyan
    const muzzleRing = new THREE.Mesh(
      new THREE.TorusGeometry(10, 3, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x00b8d9, emissive: 0x00e5ff, emissiveIntensity: 1.3, metalness: 0.9, roughness: 0 }),
    );
    muzzleRing.position.x = 143.5;
    muzzleRing.rotation.y = Math.PI / 2;
    tubeGroup.add(muzzleRing);

    // Breach (entry) reinforcement ring — dimmer
    const breachRing = new THREE.Mesh(
      new THREE.TorusGeometry(9, 2.5, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x1040a0, emissive: 0x001155, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 }),
    );
    breachRing.position.x = -143.5;
    breachRing.rotation.y = Math.PI / 2;
    tubeGroup.add(breachRing);

    // Support struts along tube (structural detail)
    for (let x = -120; x <= 120; x += 40) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(2, 18, 2),
        new THREE.MeshStandardMaterial({ color: 0x0f1e32, metalness: 0.7, roughness: 0.3 }),
      );
      strut.position.set(x, -13, 0);
      tubeGroup.add(strut);
    }

    muzzleWorldPos = craftPositionAlongRail(1).clone();

    // Interior glow — follows pod through tube
    tubeInteriorLight = new THREE.PointLight(0x0066ff, 0, 130);
    scene.add(tubeInteriorLight);

    // Muzzle flash — fires when pod exits
    muzzleFlashLight = new THREE.PointLight(0x00e5ff, 0, 400);
    muzzleFlashLight.position.copy(muzzleWorldPos);
    scene.add(muzzleFlashLight);

    // ══════════════════════════════════════════════════════════════
    // Gryphon spacecraft (emerges from tube at PH_RAIL_END)
    // ══════════════════════════════════════════════════════════════
    craftGroup = new THREE.Group();
    craftGroup.visible = false; // hidden inside tube until exit
    scene.add(craftGroup);

    craftBodyMat = new THREE.MeshStandardMaterial({ color: 0xc8deff, emissive: 0x001122, metalness: 0.6, roughness: 0.4 });
    craftBody = new THREE.Mesh(new THREE.CapsuleGeometry(4, 12, 8, 16), craftBodyMat);
    craftBody.rotation.z = Math.PI / 2;
    craftGroup.add(craftBody);

    const wingMat = new THREE.MeshStandardMaterial({ color: 0x809ab8, metalness: 0.8, roughness: 0.2 });
    wingL = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 6), wingMat);
    wingL.position.set(0, 0, 4); craftGroup.add(wingL);
    wingR = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 6), wingMat);
    wingR.position.set(0, 0, -4); craftGroup.add(wingR);

    sailPanels = [];
    const sailColors = [0xffe066, 0xffd740, 0xffb300, 0xffc107];
    const sailGeo    = new THREE.PlaneGeometry(24, 16);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(sailGeo, new THREE.MeshBasicMaterial({ color: sailColors[i], transparent: true, opacity: 0, side: THREE.DoubleSide }));
      p.scale.x = 0.02;
      craftGroup.add(p);
      sailPanels.push(p);
    }

    // Thrust particles
    const pCount = 60;
    particlePositions = new Float32Array(pCount * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    thrustParticles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 3, color: 0x00e5ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
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
    if (playing) { t += (dt / 1000) * speed; if (t > T_MAX) t = 0; }

    // Pod is hidden inside the sealed tube until it exits the muzzle
    if (craftGroup) craftGroup.visible = t >= PH_RAIL_END;

    // Update pod body color from selection
    if (craftBodyMat && t >= PH_RAIL_END) {
      craftBodyMat.color.setHex(podColor);
    }

    const pos = getCraftPosition(t);
    if (craftGroup) {
      craftGroup.position.copy(pos);
      craftGroup.rotation.z = t < PH_RAIL_END ? RAIL_RAD : 0;
    }

    updateWings(t);
    updateSail(t);
    updateParticles(pos, t);
    updateCamera(t, pos);
    updateEMCoils(t);

    // Muzzle flash when pod exits tube
    if (muzzleFlashLight) {
      if (t >= PH_RAIL_END && t < PH_RAIL_END + 5) {
        const ft = t - PH_RAIL_END;
        muzzleFlashLight.intensity = Math.max(0, (1 - ft / 5) * 650);
      } else {
        muzzleFlashLight.intensity = 0;
      }
    }

    const phys = getPhysics(t);
    velocityMs = Math.round(phys.v);
    altitudeKm = Math.round(phys.alt * 10) / 10;
    gForce     = Math.round(phys.g * 10) / 10;
    machNum    = Math.round(phys.v / 343 * 10) / 10;
    phase      = phys.ph;
    gOverLimit = gForce > podGLimit;

    const burning = t > PH_ATMO_END && t < PH_BURN_END;
    exhaustLight.position.copy(pos);
    exhaustLight.intensity = burning ? 80 + Math.random() * 40 : 0;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  // ─── reactive: re-color craft when pod selection changes ────────
  $: if (craftBodyMat && t >= PH_RAIL_END) craftBodyMat.color.setHex(podColor);

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
  <!-- Pod selector tabs -->
  <div class="pod-bar">
    <span class="pod-bar-label">POD IN TUBE:</span>
    {#each podTabs as pod}
      <button
        class="pod-tab {activePodId === pod.id ? 'active' : ''}"
        style="--pc: {pod.color}"
        on:click={() => { activePodId = pod.id; }}
      >{pod.name}</button>
    {/each}
  </div>

  <div class="canvas-host" bind:this={container}></div>

  <!-- HUD left -->
  <div class="hud-left">
    <div class="hud-block">
      <div class="hud-phase">{phase}</div>
      {#if t < PH_RAIL_END}
        <div class="hud-tube-info">POD INSIDE SEALED TUBE</div>
      {/if}
    </div>
    <div class="hud-block">
      <div class="hud-row"><span class="lbl">VELOCITY</span><span class="val accent">{fmtV(velocityMs)} <span class="unit">m/s</span></span></div>
      <div class="hud-row"><span class="lbl">MACH</span><span class="val">{machNum}</span></div>
      <div class="hud-row"><span class="lbl">ALTITUDE</span><span class="val">{altitudeKm} <span class="unit">km</span></span></div>
      <div class="hud-row">
        <span class="lbl">G-LOAD</span>
        <span class="val {gOverLimit ? 'crit' : gForce > 3 ? 'warn' : ''}">{gForce} G</span>
      </div>
    </div>
    <div class="hud-pod-card" style="--pc: {activePod.color}">
      <div class="hud-pod-name">{activePod.name} — {activePod.full}</div>
      <div class="hud-pod-limit">
        G LIMIT <span class="hud-pod-limit-val {gOverLimit ? 'crit' : ''}">{podGLimit} G</span>
        {#if gOverLimit}<span class="hud-warn">⚠ EXCEEDS LIMIT</span>{/if}
      </div>
      <div class="hud-pod-cost">${activePod.costPerKgLunar}/kg lunar</div>
    </div>
  </div>

  <!-- Controls -->
  <div class="hud-bottom">
    <button class="btn-ctrl" on:click={() => (playing = !playing)}>{playing ? "⏸" : "▶"}</button>
    <input class="scrub" type="range" min="0" max={T_MAX} step="0.1" bind:value={t} aria-label="Mission time"/>
    <select class="spd" bind:value={speed}>
      <option value={0.5}>0.5×</option>
      <option value={1}>1×</option>
      <option value={3}>3×</option>
      <option value={10}>10×</option>
    </select>
    <span class="time-label mono">T+ {t.toFixed(0)}s</span>
  </div>

  <!-- Stage jump buttons -->
  <div class="stage-dots">
    {#each [
      { label:"TUBE",   start:0,              end:PH_WINGS_END   },
      { label:"ASCENT", start:PH_WINGS_END,   end:PH_BURN_END    },
      { label:"ORBIT",  start:PH_BURN_END,    end:PH_SAIL_DEPLOY },
      { label:"KEPLER", start:PH_SAIL_DEPLOY, end:T_MAX          },
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
  min-height: 440px;
  background: radial-gradient(ellipse at 50% 100%, #061830, #02080f 70%);
  border: 1px solid #192e4c;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.canvas-host { position: absolute; inset: 0; }

/* ── Pod selector bar ── */
.pod-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(4,9,16,.85);
  border-bottom: 1px solid #192e4c;
  backdrop-filter: blur(8px);
  overflow-x: auto;
  scrollbar-width: none;
}
.pod-bar-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: .14em;
  color: #344d66;
  white-space: nowrap;
  flex-shrink: 0;
}
.pod-tab {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .08em;
  background: rgba(255,255,255,.04);
  border: 1px solid #192e4c;
  border-radius: 5px;
  color: #4d6680;
  padding: 4px 9px;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.pod-tab:hover  { border-color: var(--pc); color: var(--pc); }
.pod-tab.active { border-color: var(--pc); color: var(--pc); background: color-mix(in srgb, var(--pc) 10%, transparent); }

/* ── HUD ── */
.hud-left {
  position: absolute;
  top: 52px;
  left: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(4,9,16,.78);
  border: 1px solid #192e4c;
  border-radius: 10px;
  padding: 14px 18px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  backdrop-filter: blur(8px);
  min-width: 220px;
}
.hud-phase {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .12em;
  color: #00e5ff;
  text-transform: uppercase;
  padding-bottom: 6px;
  border-bottom: 1px solid #192e4c;
  margin-bottom: 2px;
}
.hud-tube-info {
  font-size: 8px;
  letter-spacing: .1em;
  color: #1a4a80;
  text-transform: uppercase;
  padding-bottom: 4px;
}
.hud-block { display: flex; flex-direction: column; gap: 5px; }
.hud-row   { display: flex; align-items: baseline; gap: 10px; justify-content: space-between; }
.lbl  { color: #344d66; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; min-width: 65px; }
.val  { color: #ddeeff; font-weight: 500; font-size: 13px; text-align: right; }
.val.accent { color: #00e5ff; }
.val.warn   { color: #ffaa00; }
.val.crit   { color: #ff3333; animation: crit-pulse .5s ease-in-out infinite; }
.unit { font-size: 9px; color: #344d66; }

.hud-pod-card {
  border-top: 1px solid #192e4c;
  padding-top: 8px;
  margin-top: 2px;
}
.hud-pod-name  { font-size: 10px; font-weight: 600; color: var(--pc); letter-spacing: .04em; margin-bottom: 3px; }
.hud-pod-limit { font-size: 9px; color: #4d6680; display: flex; align-items: center; gap: 6px; }
.hud-pod-limit-val { color: #7a9ab8; font-weight: 600; }
.hud-pod-limit-val.crit { color: #ff3333; }
.hud-warn { color: #ff3333; font-weight: 700; font-size: 8px; letter-spacing: .1em; }
.hud-pod-cost { font-size: 9px; color: #344d66; margin-top: 2px; }

@keyframes crit-pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }

/* ── Controls ── */
.hud-bottom {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(4,9,16,.78);
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
.scrub { width: 180px; accent-color: #00e5ff; }
.spd {
  background: #080f1c; color: #ddeeff;
  border: 1px solid #192e4c; border-radius: 6px;
  padding: 3px 6px; font-family: "JetBrains Mono", monospace; font-size: 11px;
}
.time-label { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #344d66; }
.mono { font-family: "JetBrains Mono", monospace; }

/* ── Stage jump ── */
.stage-dots {
  position: absolute;
  top: 52px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stage-dot {
  background: rgba(4,9,16,.78);
  border: 1px solid #192e4c;
  border-radius: 6px;
  color: #344d66;
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: .1em;
  padding: 5px 10px;
  cursor: pointer;
  transition: all .2s;
  text-align: right;
}
.stage-dot.active { border-color: #00e5ff; color: #00e5ff; background: rgba(0,229,255,.08); }
.stage-dot.done   { border-color: #192e4c; color: #1a3050; }
.stage-dot:hover  { border-color: #254469; color: #8faec8; }
</style>
