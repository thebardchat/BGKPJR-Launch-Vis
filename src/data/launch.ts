// BGKPJR physics constants — all values sourced from BGKPJR-Core-Simulations research
export const MACH_1 = 343;           // m/s at sea level
export const G_EARTH = 9.81;         // m/s²
export const R_EARTH_KM = 6371;      // km

export const RAIL = {
  lengthKm:         28.7,
  inclinationDeg:   15,              // nominal; 15–45° variable
  exitMach:         3.5,             // nominal; up to Mach 5
  exitVelocityMs:   1190,            // m/s (Mach 3.5)
  exitVelocityMaxMs:1700,            // m/s (Mach 5)
  pressureAtm:      0.1,             // partial vacuum inside tube
  peakGForce:       3.9,             // sustained human-rated
  magFieldT:        8,               // superconducting NbTi coils, Tesla
  tempK:            4.2,             // operating temp of NbTi
  runTimeSec:       23,              // rail acceleration duration at 3.9G to Mach 3.5
  energyMJ:         900,             // per launch estimate
} as const;

export const GRYPHON = {
  wingspanM:        18,
  massDryKg:        8_200,
  massGrossFuelKg:  14_400,
  payloadKg:        2_200,
  maxMach:          8,               // peak atmospheric
  glideRatio:       6.5,
  reusable:         true,
  crew:             4,
  thermalProtection: "TUFI ceramic tiles + ablative leading edges",
} as const;

export const KEPLER = {
  sailAreaM2:       1_200,
  materialCP1:      "CP1 Polyimide",
  massKg:           3.2,             // sail + boom
  deployAltKm:      310,
  solarPressurePa:  4.56e-6,        // at 1 AU
  nominalDvMmps:    1.8,            // mm/s² from solar pressure at 1 AU
  targetOrbit:      "Heliocentric drift / lunar assist",
} as const;

export const COSTS = {
  currentFalcon9PerKg:   5_500,     // USD
  bgkpjrTargetPerKg:     800,       // USD (Phase 1 operational)
  bgkpjrMaturePerKg:     200,       // USD (serial production)
  mannHTargetLunarPerKg: 54,        // USD (Manna-H mature ops)
  propellantReduction:   0.40,      // 40% reduction vs conventional
} as const;

// Manna cargo pod variants
export const PODS = {
  H: {
    id: "H",
    name: "Manna-H",
    full: "Hardened",
    color: "#ff5555",
    cargoClass:    "Bulk consumables, propellant, food, structural metals",
    payloadFrac:   0.78,
    internalG:     100,
    costPerKgLunar: 54,
    exitMach:      22.9,            // 7,800 m/s → 108G on 28.7km rail
    exitVelocityMs: 7_800,
    massKg:        4_200,
    payloadKg:     3_276,
    diameterM:     1.8,
    lengthM:       4.2,
    thermalShield: "PICA-X ablative nose cone",
    guidance:      "None — passive ballistic + beacon",
    status:        "Concept Design",
  },
  I: {
    id: "I",
    name: "Manna-I",
    full: "Isolated",
    color: "#ffaa00",
    cargoClass:    "Electronics, instruments, mechanical spares",
    payloadFrac:   0.548,
    internalG:     5.5,
    costPerKgLunar: 467,
    exitMach:      8.2,             // 2,800 m/s → 14G on 28.7km rail
    exitVelocityMs: 2_800,
    massKg:        3_800,
    payloadKg:     2_082,
    diameterM:     1.8,
    lengthM:       4.6,
    thermalShield: "Ablative + carbon phenolic TPS",
    guidance:      "Inertial + GPS beacon",
    status:        "Concept Design",
  },
  B: {
    id: "B",
    name: "Manna-B",
    full: "Biological",
    color: "#4fc3f7",
    cargoClass:    "Seedlings, microbiomes, biologics, cell cultures",
    payloadFrac:   0.186,
    internalG:     2.5,
    costPerKgLunar: 4_190,
    exitMach:      3.5,             // 1,190 m/s → 2.5G (same as Gryphon)
    exitVelocityMs: 1_190,
    massKg:        3_200,
    payloadKg:     595,
    diameterM:     1.8,
    lengthM:       5.1,
    thermalShield: "Multi-layer insulation + active thermal control",
    guidance:      "Full GNC + attitude control thrusters",
    status:        "Concept Design",
  },
} as const;

// WIP concept pods
export const PODS_WIP = [
  {
    id: "F",
    name: "Manna-F",
    full: "Fuel",
    color: "#b4ff6e",
    tagline: "Dedicated propellant tanker for Tug refueling operations",
    cargoClass: "LH2/LOX, MMH/NTO, or water (ISRU feedstock)",
    payloadFrac: 0.88,
    internalG: 100,
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
    internalG: 1.8,
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
    internalG: 8,
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
    internalG: 30,
    status: "WIP — Architecture",
    notes: "Oversized diameter (2.4m) for flat-packed deployables. Airbag-cushioned hard landing option on lunar surface (non-Tug dependent). Enables bootstrapped ISRU before crew arrival.",
  },
] as const;

export type PodKey = keyof typeof PODS;
export type WipPod = typeof PODS_WIP[number];
