<script lang="ts">
  import { PODS, PODS_WIP, COSTS } from "../data/launch";
  import type { PodKey } from "../data/launch";

  let selected: PodKey = "H";
  const keys: PodKey[] = ["H", "I", "B"];
  $: pod = PODS[selected];

  function pct(v: number) { return (v * 100).toFixed(1) + "%"; }
  function fmtG(g: number) { return g >= 100 ? "100+ G" : g + " G"; }
  function fmtCost(c: number) { return "$" + c.toLocaleString() + "/kg"; }
  function fmtV(v: number) { return v.toLocaleString() + " m/s"; }
</script>

<div class="pod-section">

  <!-- tab selector -->
  <div class="tab-row">
    {#each keys as k}
      <button
        class="tab {selected === k ? 'active' : ''}"
        style="--pod-color: {PODS[k].color}"
        on:click={() => selected = k}
      >
        <span class="tab-id">{PODS[k].name}</span>
        <span class="tab-sub">{PODS[k].full}</span>
      </button>
    {/each}
  </div>

  <!-- detail panel -->
  <div class="pod-detail" style="--pod-color: {pod.color}">
    <div class="pod-header">
      <div>
        <div class="pod-title">{pod.name} — {pod.full}</div>
        <div class="pod-tagline">{pod.cargoClass}</div>
      </div>
      <div class="pod-badge">{pod.status}</div>
    </div>

    <!-- SVG cross-section diagram -->
    <div class="pod-diagram">
      <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <!-- background -->
        <rect width="400" height="200" fill="#080f1c" rx="8"/>

        <!-- pod body outline -->
        <rect x="40" y="60" width="280" height="80" rx="12" fill="#0c1628" stroke={pod.color} stroke-width="1.5"/>
        <!-- nose cone -->
        <polygon points="320,60 360,100 320,140" fill={pod.color + "22"} stroke={pod.color} stroke-width="1.5"/>
        <!-- tail -->
        <rect x="20" y="75" width="22" height="50" rx="4" fill="#0a1422" stroke="#192e4c" stroke-width="1"/>

        <!-- payload zone -->
        <rect x="56" y="70" width={pod.payloadFrac * 220} height="60" rx="6"
          fill={pod.color + "18"} stroke={pod.color} stroke-width="1" stroke-dasharray="4 3"/>
        <text x="{56 + pod.payloadFrac * 110}" y="104" text-anchor="middle"
          font-family="JetBrains Mono, monospace" font-size="10" fill={pod.color}>
          PAYLOAD {pct(pod.payloadFrac)}
        </text>

        <!-- structure zone -->
        <rect x="{56 + pod.payloadFrac * 220}" y="70"
          width="{(1 - pod.payloadFrac) * 220}" height="60" rx="0"
          fill="#192e4c22" stroke="#192e4c" stroke-width="1" stroke-dasharray="4 3"/>
        <text x="{56 + pod.payloadFrac * 220 + (1 - pod.payloadFrac) * 110}" y="104"
          text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#4d6680">
          STRUCT
        </text>

        <!-- dimension labels -->
        <text x="200" y="158" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#4d6680">{pod.lengthM} m length</text>
        <text x="10" y="104" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#4d6680" transform="rotate(-90,10,104)">{pod.diameterM} m</text>

        <!-- G tolerance badge -->
        <rect x="280" y="10" width="108" height="28" rx="5" fill="#0a1422" stroke={pod.color} stroke-width="1"/>
        <text x="334" y="28" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill={pod.color} font-weight="600">
          {fmtG(pod.internalG)} rated
        </text>
      </svg>
    </div>

    <!-- spec grid -->
    <div class="spec-grid">
      <div class="spec-item">
        <div class="spec-label">Exit Velocity</div>
        <div class="spec-val" style="color:{pod.color}">{fmtV(pod.exitVelocityMs)}</div>
        <div class="spec-sub">Mach {pod.exitMach}</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Payload Fraction</div>
        <div class="spec-val">{pct(pod.payloadFrac)}</div>
        <div class="spec-sub">{pod.payloadKg.toLocaleString()} kg of {pod.massKg.toLocaleString()} kg gross</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Internal G-Load</div>
        <div class="spec-val" style="color:{pod.color}">{fmtG(pod.internalG)}</div>
        <div class="spec-sub">Peak during rail run</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Lunar Cost</div>
        <div class="spec-val">{fmtCost(pod.costPerKgLunar)}</div>
        <div class="spec-sub">vs. $1.2M/kg current CLPS</div>
      </div>
      <div class="spec-item col-2">
        <div class="spec-label">Thermal Protection</div>
        <div class="spec-val small">{pod.thermalShield}</div>
      </div>
      <div class="spec-item col-2">
        <div class="spec-label">Guidance</div>
        <div class="spec-val small">{pod.guidance}</div>
      </div>
    </div>

    <!-- mass fraction bar -->
    <div class="bar-section">
      <div class="bar-label">Mass Fraction</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:{pod.payloadFrac * 100}%; background:{pod.color}"></div>
        <div class="bar-fill struct" style="width:{(1-pod.payloadFrac)*100}%"></div>
      </div>
      <div class="bar-legend">
        <span style="color:{pod.color}">Payload {pct(pod.payloadFrac)}</span>
        <span style="color:#4d6680">Structure {pct(1 - pod.payloadFrac)}</span>
      </div>
    </div>
  </div>

  <!-- WIP pods -->
  <div class="wip-section">
    <div class="wip-header">
      <span class="label">NEXT-GENERATION CONCEPTS</span>
      <span class="badge-wip badge">IN DEVELOPMENT</span>
    </div>
    <div class="wip-grid">
      {#each PODS_WIP as wip}
        <div class="wip-card" style="--wip-color: {wip.color}">
          <div class="wip-top">
            <span class="wip-name">{wip.name}</span>
            <span class="wip-status">{wip.status}</span>
          </div>
          <div class="wip-tagline">{wip.tagline}</div>
          <div class="wip-notes">{wip.notes}</div>
          <div class="wip-cargo mono">{wip.cargoClass}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- cost comparison -->
  <div class="cost-card">
    <div class="cost-title">Cost per kg to Lunar Surface — Industry Comparison</div>
    <div class="cost-bars">
      {#each [
        { label: "CLPS (current)",      val: 1_200_000, color: "#ff5555", max: 1_200_000 },
        { label: "SpaceX Cargo Dragon", val: 30_000,    color: "#ff9944", max: 1_200_000 },
        { label: "Falcon 9 ride-share", val: 5_500,     color: "#ffaa00", max: 1_200_000 },
        { label: "BGKPJR Phase 1",      val: 800,       color: "#00e5ff", max: 1_200_000 },
        { label: "BGKPJR Mature Ops",   val: 200,       color: "#b4ff6e", max: 1_200_000 },
        { label: "Manna-H (lunar)",      val: 54,        color: "#ff5555", max: 1_200_000 },
      ] as c}
        <div class="cost-row">
          <div class="cost-label">{c.label}</div>
          <div class="cost-bar-track">
            <div class="cost-bar-fill" style="width:{Math.max((Math.log10(c.val)/Math.log10(c.max))*100, 1.5)}%; background:{c.color}"></div>
          </div>
          <div class="cost-num" style="color:{c.color}">${c.val.toLocaleString()}</div>
        </div>
      {/each}
    </div>
    <div class="cost-note mono">* BGKPJR cost projections assume 50 launches/year serial production. All costs in 2026 USD.</div>
  </div>
</div>

<style>
.pod-section { display: flex; flex-direction: column; gap: 32px; }

.tab-row { display: flex; gap: 12px; flex-wrap: wrap; }
.tab {
  flex: 1; min-width: 120px;
  background: #0a1422; border: 1px solid #192e4c; border-radius: 10px;
  padding: 16px 20px; cursor: pointer; text-align: left;
  transition: all .2s;
}
.tab:hover { border-color: #254469; }
.tab.active { border-color: var(--pod-color); background: rgba(0,0,0,.3); box-shadow: 0 0 20px var(--pod-color, #00e5ff)18; }
.tab-id { display: block; font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 16px; color: var(--pod-color, #ddeeff); }
.tab-sub { font-family: "JetBrains Mono", monospace; font-size: 11px; color: #4d6680; margin-top: 2px; }

.pod-detail {
  background: #0a1422;
  border: 1px solid var(--pod-color, #192e4c);
  border-radius: 14px;
  padding: 28px;
  display: flex; flex-direction: column; gap: 24px;
  box-shadow: 0 0 40px var(--pod-color, transparent)12;
}
.pod-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.pod-title { font-family: "Space Grotesk", sans-serif; font-size: 22px; font-weight: 700; color: #ddeeff; }
.pod-tagline { font-size: 13px; color: #8faec8; margin-top: 4px; }
.pod-badge { font-family: "JetBrains Mono", monospace; font-size: 10px; color: var(--pod-color, #00e5ff); border: 1px solid var(--pod-color, #00e5ff); border-radius: 99px; padding: 4px 12px; letter-spacing: 0.08em; height: fit-content; }

.pod-diagram { border-radius: 8px; overflow: hidden; }
.pod-diagram svg { width: 100%; height: auto; display: block; }

.spec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
.spec-item { background: #080f1c; border: 1px solid #192e4c; border-radius: 10px; padding: 16px; }
.spec-item.col-2 { grid-column: span 2; }
.spec-label { font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.1em; color: #4d6680; text-transform: uppercase; margin-bottom: 6px; }
.spec-val { font-family: "Space Grotesk", sans-serif; font-size: 18px; font-weight: 700; color: #ddeeff; }
.spec-val.small { font-size: 13px; font-weight: 400; color: #8faec8; line-height: 1.5; }
.spec-sub { font-size: 11px; color: #4d6680; margin-top: 2px; }

.bar-section { display: flex; flex-direction: column; gap: 8px; }
.bar-label { font-family: "JetBrains Mono", monospace; font-size: 10px; color: #4d6680; letter-spacing: 0.1em; text-transform: uppercase; }
.bar-track { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: #080f1c; }
.bar-fill { height: 100%; transition: width .4s cubic-bezier(.2,.7,.2,1); }
.bar-fill.struct { background: #192e4c; }
.bar-legend { display: flex; gap: 20px; font-family: "JetBrains Mono", monospace; font-size: 11px; }

.wip-section { display: flex; flex-direction: column; gap: 16px; }
.wip-header { display: flex; align-items: center; gap: 14px; }
.badge-wip { font-family: "JetBrains Mono", monospace; font-size: 10px; color: #4d6680; border: 1px solid #4d6680; border-radius: 99px; padding: 3px 10px; letter-spacing: 0.08em; }
.badge { display: inline-flex; align-items: center; }

.wip-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.wip-card {
  background: #0a1422; border: 1px solid #192e4c; border-radius: 12px; padding: 20px;
  border-top: 2px solid var(--wip-color, #4d6680);
  transition: border-color .2s;
}
.wip-card:hover { border-color: var(--wip-color, #254469); }
.wip-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.wip-name { font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 16px; color: var(--wip-color, #ddeeff); }
.wip-status { font-family: "JetBrains Mono", monospace; font-size: 9px; color: #4d6680; }
.wip-tagline { font-size: 13px; color: #8faec8; margin-bottom: 10px; }
.wip-notes { font-size: 12px; color: #4d6680; line-height: 1.6; margin-bottom: 10px; }
.wip-cargo { font-size: 10px; color: #254469; padding: 6px 8px; background: #080f1c; border-radius: 5px; }
.mono { font-family: "JetBrains Mono", monospace; }

.cost-card { background: #0a1422; border: 1px solid #192e4c; border-radius: 14px; padding: 28px; }
.cost-title { font-family: "Space Grotesk", sans-serif; font-size: 16px; font-weight: 600; color: #ddeeff; margin-bottom: 20px; }
.cost-bars { display: flex; flex-direction: column; gap: 10px; }
.cost-row { display: grid; grid-template-columns: 200px 1fr 100px; align-items: center; gap: 14px; }
.cost-label { font-size: 12px; color: #8faec8; text-align: right; }
.cost-bar-track { height: 6px; background: #080f1c; border-radius: 3px; overflow: hidden; }
.cost-bar-fill { height: 100%; border-radius: 3px; transition: width .4s; }
.cost-num { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 600; }
.cost-note { font-size: 10px; color: #4d6680; margin-top: 16px; }
</style>
