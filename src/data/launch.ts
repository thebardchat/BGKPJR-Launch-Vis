/**
 * BGKPJR Launch Architecture — Canonical Constants
 * ================================================
 *
 * These values mirror the canonical source-of-truth at:
 *   BGKPJR-Core-Simulations/simulation/src/bgkpjr_dimensions.py
 *
 * Reconciled 2026-04-30 to align with the BGKPJR-VacuumGate Feasibility
 * Report v1.0 (April 18, 2026). The VG revision supersedes the prior
 * 28.7 km / Mach 3.5 / thermite-membrane baseline and replaces it with:
 *   - 37 km tube (longer; resolves the kinematic-closure failure)
 *   - Mach 5 exit (still within patent BGKPJR-001 envelope of Mach 3-5)
 *   - 4G sustained (within human-rating)
 *   - Liquid-hydrogen (LH₂) cryogenic muzzle membrane (the novel IP)
 *   - Coilgun (LSM) architecture, copper drive + REBCO vehicle armature
 *
 * All constants close against derive_check() in the Python module.
 * Run `python -m simulation.src.bgkpjr_dimensions` to verify.
 *
 * For full reconciliation rationale see:
 *   BGKPJR-Core-Simulations/expert-reviews/PRE-LUKENS-AUDIT-2026-04-30.md
 */

export const MACH_1 = 340.29;        // m/s sea level (ICAO standard)
export const G_EARTH = 9.80665;      // m/s² standard gravity
export const R_EARTH_KM = 6371;      // km mean equatorial

// ─── STAGE 1: RAIL — VacuumGate Maglev Tunnel ────────────────────────
export const RAIL = {
  // Geometry
  lengthKm:               37,            // VacuumGate canonical (was 28.7)
  diameterM:              10,            // VG internal bore
  inclinationDeg:         15,            // patent envelope: 15-45°

  // Vacuum
  pressureAtm:            0.05,          // patent envelope minimum
  pressureAtmVgTarget:    0.001,         // VG aspirational (requires patent CIP)

  // Kinematics (closes within 0.1%)
  exitMach:               5.0,           // patent envelope max
  exitVelocityMs:         1700,          // Mach 5 at sea level
  exitVelocityMaxMs:      1700,
  peakGForce:             4.0,           // sustained, within patent ≤5
  runTimeSec:             43.5,          // = v / (peakG × g₀)

  // Coilgun architecture (NOT railgun)
  driveType:              "Linear Synchronous Motor (LSM) coilgun",
  driveCoilMaterial:      "Copper (C10100, OFHC)",
  armatureMaterial:       "REBCO superconducting (vehicle-mounted)",
  armatureTempK:          20,            // LH₂ cryogenic
  magFieldT:              8,             // peak field, NbTi/REBCO
  tempK:                  20,            // canonical (was 4.2 K NbTi)
  coilCount:              7400,          // 37 km / 5 m spacing
  coilSpacingM:           5,
  coilInnerDiameterM:     16,
  coilOuterDiameterM:     20,

  // Power
  energyGJ:               580,           // SMES capacity (was 900 MJ)
  energyMJ:               580_000,       // back-compat field for old usage
  peakPowerGW:            39,
  chargeRateMW:           650,
  chargeTimeMin:          15,            // revised from 4 min for 580 GJ

  // Muzzle interface — VacuumGate's novel IP
  muzzleSealType:         "Liquid Hydrogen (LH₂) cryogenic membrane",
  muzzleLh2TempK:         20,            // -253 °C
  muzzleStagnationMPa:    1.77,          // dynamic pressure at exit, Mach 5 SL
  muzzleControlledDetonation: true,      // intended thrust-boost on breach
} as const;

// ─── STAGE 2: GRYPHON — Hypersonic Waverider ─────────────────────────
export const GRYPHON = {
  // Mass (provisional — pending Lukens validation)
  massDryKg:              50_000,        // VG canonical (was 8.2 t / 15 t)
  payloadKg:              5_000,         // 4 crew or 10 t cargo
  massGrossFuelKg:        85_000,        // dry + payload + propellant

  // Aero geometry (Boyd waverider)
  lengthM:                25,
  spanRetractedM:         12,            // tube clearance
  spanDeployedM:          18,
  wingspanM:              18,            // back-compat field
  planformAreaM2:         180,
  leadingEdgeSweepDeg:    75,
  leadingEdgeRadiusMm:    3,

  // Performance
  ldHypersonic:           4.5,           // L/D Mach 8-10
  ldSubsonic:             8.0,
  glideRatio:             6.5,
  maxMach:                8,             // scramjet ceiling
  wingDeploySec:          3,             // patent envelope ≤5

  // Propulsion
  ispVacuumS:             350,           // LOX/RP-1
  ispSeaLevelS:           310,
  thrustMaxN:             500_000,

  reusable:               true,
  crew:                   4,
  thermalProtection: "TUFI ceramic + active transpiration cooling on leading edges",
} as const;

// ─── STAGE 3: KEPLER — Orbital Solar Sail (Phase 4 deep-space) ───────
export const KEPLER = {
  sailAreaM2:             1_200,         // unchanged, both repos agreed
  materialCP1:            "CP1 Polyimide",
  massKg:                 50,            // sail + boom + deploy mech (was 3.2)
  thicknessM:             2.5e-6,
  reflectivity:           0.9,
  deployAltKm:            400,           // standard LEO baseline (was 310)
  solarPressurePa:        4.56e-6,       // at 1 AU
  nominalDvMmps:          0.20,          // DERIVED from physics (was 1.8)
  targetOrbit:            "Heliocentric drift / lunar assist",
} as const;

// ─── COSTS (provisional programmatic estimates) ──────────────────────
export const COSTS = {
  currentFalcon9PerKg:   2_720,          // updated to current pricing (was 5,500)
  bgkpjrTargetPerKg:     1_025,          // VG-revised LEO target (was $200/kg)
  bgkpjrMaturePerKg:     500,            // serial production aspirational
  mannHTargetLunarPerKg: 54,             // Manna-H mature ops (provisional)
  propellantReduction:   0.18,           // rail provides 18% of 9,400 m/s ΔV (was 40%)
  infrastructureUsdLow:  85e9,           // VG canonical
  infrastructureUsdHigh: 120e9,
  perLaunchUsd:          10e6,
  developmentYears:      13,
} as const;

// ─── MISSION ─────────────────────────────────────────────────────────
export const MISSION = {
  deltaVToLeoMs:          9400,
  leoVelocityMs:          7670,
  leoAltitudeKm:          400,
  railDvFraction:         0.181,          // 1700 / 9400
  cadenceInitialPerYr:    21,             // Shotwell integration analysis
  cadenceTargetPerYr:     50,
} as const;

// ─── MANNA CARGO POD VARIANTS ────────────────────────────────────────
//
// All pods share the canonical 37 km / Mach 5 / 4 G rail with Gryphon.
// They differ in payload class, internal cushioning (effective internal G),
// and recovery mode. Pre-VacuumGate variants that claimed exit velocities
// outside Mach 3-5 (e.g. Mach 22.9, Mach 8.2 directly from rail) are
// PROVISIONAL pending physics-honest redesign.
export const PODS = {
  H: {
    id: "H",
    name: "Manna-H",
    full: "Hardened",
    color: "#ff5555",
    cargoClass:    "Bulk consumables, propellant, food, structural metals",
    payloadFrac:   0.78,
    internalG:     4,                    // canonical rail G (was 100, physics-impossible)
    costPerKgLunar: 54,
    exitMach:      5.0,                  // canonical rail (was 22.9)
    exitVelocityMs: 1_700,
    massKg:        4_200,
    payloadKg:     3_276,
    diameterM:     1.8,
    lengthM:       4.2,
    thermalShield: "PICA-X ablative nose cone",
    guidance:      "None — passive ballistic + beacon",
    status:        "Concept Design — VG reconciliation pending",
  },
  I: {
    id: "I",
    name: "Manna-I",
    full: "Isolated",
    color: "#ffaa00",
    cargoClass:    "Electronics, instruments, mechanical spares",
    payloadFrac:   0.548,
    internalG:     2.5,                  // cushioned mounting reduces from 4G rail
    costPerKgLunar: 467,
    exitMach:      5.0,                  // canonical rail (was 8.2, physics-broken)
    exitVelocityMs: 1_700,
    massKg:        3_800,
    payloadKg:     2_082,
    diameterM:     1.8,
    lengthM:       4.6,
    thermalShield: "Ablative + carbon phenolic TPS",
    guidance:      "Inertial + GPS beacon",
    status:        "Concept Design — VG reconciliation pending",
  },
  B: {
    id: "B",
    name: "Manna-B",
    full: "Biological",
    color: "#4fc3f7",
    cargoClass:    "Seedlings, microbiomes, biologics, cell cultures",
    payloadFrac:   0.186,
    internalG:     1.2,                  // double-cushioned; rail 4G → internal 1.2G
    costPerKgLunar: 4_190,
    exitMach:      5.0,                  // canonical rail
    exitVelocityMs: 1_700,
    massKg:        3_200,
    payloadKg:     595,
    diameterM:     1.8,
    lengthM:       5.1,
    thermalShield: "Multi-layer insulation + active thermal control",
    guidance:      "Full GNC + attitude control thrusters",
    status:        "Concept Design — VG reconciliation pending",
  },
} as const;

// ─── WIP CONCEPT PODS ────────────────────────────────────────────────
export const PODS_WIP = [
  {
    id: "F",
    name: "Manna-F",
    full: "Fuel",
    color: "#b4ff6e",
    tagline: "Dedicated propellant tanker for Tug refueling operations",
    cargoClass: "LH2/LOX, MMH/NTO, or water (ISRU feedstock)",
    payloadFrac: 0.88,
    internalG: 4,
    status: "WIP — Trade Study",
    notes: "Optimized tank-in-tube design; cylindrical foam-insulated pressure vessel. Eliminates all non-structural mass. Fleet-critical for Tug sustainability.",
  },
  {
    id: "M",
    name: "Manna-M",
    full: "Medical",
    color: "#d0a0ff",
    tagline: "Pharmaceutical-grade sterile medical supply pod",
    cargoClass: "Surgical kits, pharmaceuticals, blood products, implants",
    payloadFrac: 0.22,
    internalG: 1.5,
    status: "WIP — Feasibility",
    notes: "Extends Manna-B isolation to Class 100 cleanroom equivalence. Active pressure and humidity control. Required for sustained crew beyond 30 days.",
  },
  {
    id: "X",
    name: "Manna-X",
    full: "Experimental",
    color: "#ff88cc",
    tagline: "Open payload bus for research instruments and prototypes",
    cargoClass: "Science payloads, University CubeSats, material samples",
    payloadFrac: 0.40,
    internalG: 3,
    status: "WIP — Interface Study",
    notes: "Standardized 19\" rack mounting. Provides 200W regulated power + Ethernet during transit. Enables rapid science cadence at dramatically reduced cost vs. dedicated launch.",
  },
  {
    id: "T",
    name: "Manna-T",
    full: "Terrain",
    color: "#ffcc44",
    tagline: "Pre-positioned surface equipment for lunar base construction",
    cargoClass: "Regolith printers, solar panels, habitat components",
    payloadFrac: 0.55,
    internalG: 4,
    status: "WIP — Architecture",
    notes: "Oversized diameter (2.4m) for flat-packed deployables. Airbag-cushioned hard landing option on lunar surface (non-Tug dependent). Enables bootstrapped ISRU before crew arrival.",
  },
] as const;

export type PodKey = keyof typeof PODS;
export type WipPod = typeof PODS_WIP[number];
