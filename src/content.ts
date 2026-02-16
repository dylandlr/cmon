// src/content.ts
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// 12 types (includes soy + chad)
export type ElementType =
  | "chad"
  | "soy"
  | "sigma"
  | "cringe"
  | "zesty"
  | "doom"
  | "meme"
  | "chaos"
  | "glitchcore"
  | "neurocringe"
  | "parasocial"
  | "toxic";

export type StatusKey =
  | "stun"
  | "burn"
  | "skullstatic"
  | "charm"
  | "zestify"
  | "lagged"
  | "shadowban"
  | "toxify";

export type HazardId = "ad_flood" | "lag_field" | "sticky_threads" | "ratio_spikes";

export type MoveEffect =
  | { kind: "none" }
  | { kind: "heal"; pctMaxHp: number }
  | { kind: "stun"; chance: number; turns: number }
  | { kind: "burn"; chance: number; turns: number; dotPctMaxHp: number }
  | { kind: "skullstatic"; chance: number; turns: number; dotPctMaxHp: number; accDown: number }
  | { kind: "zestify"; chance: number; turns: number; atkDown: number; sigmaVulnPct: number }
  | { kind: "charm"; chance: number; turns: number; failChance: number }
  | { kind: "lagged"; chance: number; turns: number; failChance: number; accDown: number }
  | { kind: "shadowban"; chance: number; turns: number; dmgDownPct: number; blocksBuffs: boolean }
  | { kind: "toxify"; chance: number; turns: number; dotPctMaxHp: number; healDownPct: number }
  | { kind: "buffAtk"; turns: number; amount: number }
  | { kind: "buffDef"; turns: number; amount: number }
  | { kind: "debuffDef"; turns: number; amount: number }
  | { kind: "hazard"; hazard: HazardId; turns: number; chance?: number };

export type Move = {
  id: string;
  name: string;
  type: ElementType;
  power: number; // 0 allowed
  accuracy: number; // 0..1
  effect: MoveEffect;
  desc: string;
};

export type TraitId =
  | "main_character"
  | "touch_grass"
  | "uno_reverse"
  | "mute_button"
  | "chronically_online"
  | "zest_magnet"
  | "adblocker"
  | "low_latency"
  | "mod_favorite"
  | "sanitizer"
  | "parasocial_proof"
  | "gigachad_core"
  | "soy_engine";

export type Trait = {
  id: TraitId;
  name: string;
  desc: string;

  critBonus?: number;
  dmgBonusPct?: number;
  defBonusPct?: number;
  healOnTurnPct?: number;
  firstHitBonusPct?: number;
  accuracyBonus?: number;

  statusResist?: Partial<Record<StatusKey, number>>;
  hazardResist?: Partial<Record<HazardId, number>>;
  reflectDebuffChance?: number;
  cleanseChance?: number;
  typeDamageDealt?: Partial<Record<ElementType, number>>;
  typeDamageTaken?: Partial<Record<ElementType, number>>;
};

export type Species = {
  id: string;
  name: string;
  types: ElementType[]; // 1 or 2
  rarity: Rarity;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  traitPool: TraitId[];
  movePool: string[];
  signatureMoves?: string[]; // exclusive move(s)
  evo?: { to: string; level: number };
};

export type ContentPack = {
  moves: Record<string, Move>;
  traits: Record<TraitId, Trait>;
  species: Record<string, Species>;
  speciesCount: number;
  moveCount: number;
};

// ---------- TYPE COUNTER RING ----------
export const TYPE_RING: ElementType[] = [
  "chad",
  "soy",
  "sigma",
  "cringe",
  "zesty",
  "doom",
  "meme",
  "chaos",
  "glitchcore",
  "neurocringe",
  "parasocial",
  "toxic",
];

export function ringStrongAgainst(t: ElementType): ElementType {
  const i = TYPE_RING.indexOf(t);
  return TYPE_RING[(i + 1) % TYPE_RING.length];
}
export function ringWeakAgainst(t: ElementType): ElementType {
  const i = TYPE_RING.indexOf(t);
  return TYPE_RING[(i - 1 + TYPE_RING.length) % TYPE_RING.length];
}

// ---------- TRAITS ----------
export const TRAITS: Record<TraitId, Trait> = {
  main_character: {
    id: "main_character",
    name: "Main Character",
    desc: "First hit deals extra damage.",
    firstHitBonusPct: 0.25,
  },
  touch_grass: {
    id: "touch_grass",
    name: "Touch Grass",
    desc: "Cleanses negatives sometimes. Resists SkullStatic + Charm.",
    cleanseChance: 0.35,
    statusResist: { skullstatic: 0.60, charm: 0.50 },
    typeDamageTaken: { neurocringe: 0.85, parasocial: 0.90 },
  },
  uno_reverse: {
    id: "uno_reverse",
    name: "UNO Reverse",
    desc: "30% chance to reflect debuffs/status.",
    reflectDebuffChance: 0.30,
  },
  mute_button: {
    id: "mute_button",
    name: "Mute Button",
    desc: "Resists stun + chaos.",
    statusResist: { stun: 0.85 },
    typeDamageTaken: { chaos: 0.88 },
  },
  chronically_online: {
    id: "chronically_online",
    name: "Chronically Online",
    desc: "Neurocringe dealt up; Soy taken up.",
    typeDamageDealt: { neurocringe: 1.18 },
    typeDamageTaken: { soy: 1.10 },
  },
  zest_magnet: {
    id: "zest_magnet",
    name: "Zest Magnet",
    desc: "Zesty dealt up; Chad taken up.",
    typeDamageDealt: { zesty: 1.15 },
    typeDamageTaken: { chad: 1.12 },
  },
  adblocker: {
    id: "adblocker",
    name: "Adblocker",
    desc: "Resists Ad Flood hazard + reduces Cringe taken.",
    hazardResist: { ad_flood: 0.75 },
    typeDamageTaken: { cringe: 0.90 },
  },
  low_latency: {
    id: "low_latency",
    name: "Low Latency",
    desc: "Resists Lag effects + Lag Field hazard.",
    statusResist: { lagged: 0.70 },
    hazardResist: { lag_field: 0.70 },
  },
  mod_favorite: {
    id: "mod_favorite",
    name: "Mod Favorite",
    desc: "Resists Shadowban; cleanses sometimes.",
    statusResist: { shadowban: 0.60 },
    cleanseChance: 0.35,
  },
  sanitizer: {
    id: "sanitizer",
    name: "Sanitizer",
    desc: "Resists Toxic effects & DOT.",
    statusResist: { toxify: 0.60, burn: 0.35, skullstatic: 0.30 },
    typeDamageTaken: { toxic: 0.88 },
  },
  parasocial_proof: {
    id: "parasocial_proof",
    name: "Parasocial-Proof",
    desc: "Takes less Parasocial; reflects sometimes.",
    typeDamageTaken: { parasocial: 0.80 },
    reflectDebuffChance: 0.20,
  },
  gigachad_core: {
    id: "gigachad_core",
    name: "Gigachad Core",
    desc: "Chad dealt up; Zesty taken down.",
    typeDamageDealt: { chad: 1.15 },
    typeDamageTaken: { zesty: 0.90 },
    critBonus: 0.05,
  },
  soy_engine: {
    id: "soy_engine",
    name: "Soy Engine",
    desc: "Soy dealt up; Chad taken down.",
    typeDamageDealt: { soy: 1.15 },
    typeDamageTaken: { chad: 0.90 },
    accuracyBonus: 0.02,
  },
};

// ---------- UTIL ----------
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

// ---------- GENERIC MOVE GENERATION (200+ moves) ----------
const ATTACK_VERBS = [
  "Slam","Bonk","Blast","Jab","Pulse","Spike","Crash","Strike","Shred","Smack","Wreck","Bop","Swipe","Stomp","Knock","Thump"
];
const STATUS_NOUNS = [
  "Hex","Curse","Wave","Glare","Hook","Bind","Lock","Meme","Loop","Ping","Buzz","Fumble"
];

type MoveGenOut = { moves: Record<string, Move>; pools: Record<ElementType, string[]> };

function genMoves(): MoveGenOut {
  const moves: Record<string, Move> = {};
  const pools: Record<ElementType, string[]> = Object.fromEntries(TYPE_RING.map(t => [t, []])) as any;

  // shared utility moves
  const shared: Move[] = [
    { id:"bonk", name:"Bonk", type:"meme", power:9, accuracy:0.94, effect:{kind:"none"}, desc:"Simple blunt force bonk." },
    { id:"cope", name:"Cope", type:"cringe", power:7, accuracy:0.95, effect:{kind:"heal", pctMaxHp:0.18}, desc:"Heals a bit via coping." },
    { id:"ratio_spikes", name:"Ratio Spikes", type:"sigma", power:0, accuracy:1.0, effect:{kind:"hazard", hazard:"ratio_spikes", turns:3, chance:0.95}, desc:"Sets recoil hazard." },
    { id:"thread_trap", name:"Thread Trap", type:"meme", power:7, accuracy:0.95, effect:{kind:"hazard", hazard:"sticky_threads", turns:3, chance:0.90}, desc:"Sticky Threads hazard." },
  ];
  for (const m of shared) {
    moves[m.id] = m;
    pools[m.type].push(m.id);
  }

  // per-type templates: 17 moves each = 204, plus the 4 shared above => 208 generic
  for (const t of TYPE_RING) {
    // 10 attacks
    for (let i = 0; i < 10; i++) {
      const id = `t_${t}_atk_${i}`;
      const name = `${t.toUpperCase()} ${ATTACK_VERBS[i % ATTACK_VERBS.length]}`;
      const power = 8 + (i % 7) + (t === "chad" ? 2 : 0);
      const accuracy = clamp(0.90 - (i % 3) * 0.02, 0.82, 0.96);

      // status riders
      let effect: MoveEffect = { kind: "none" };
      if (i === 2 && t === "neurocringe") effect = { kind: "skullstatic", chance: 0.32, turns: 3, dotPctMaxHp: 0.05, accDown: 0.07 };
      else if (i === 3 && t === "zesty") effect = { kind: "zestify", chance: 0.28, turns: 3, atkDown: 2, sigmaVulnPct: 0.12 };
      else if (i === 4 && t === "glitchcore") effect = { kind: "lagged", chance: 0.28, turns: 2, failChance: 0.18, accDown: 0.05 };
      else if (i === 5 && t === "doom") effect = { kind: "shadowban", chance: 0.22, turns: 2, dmgDownPct: 0.16, blocksBuffs: true };
      else if (i === 6 && t === "toxic") effect = { kind: "toxify", chance: 0.30, turns: 3, dotPctMaxHp: 0.05, healDownPct: 0.35 };
      else if (i === 7 && t === "parasocial") effect = { kind: "charm", chance: 0.22, turns: 2, failChance: 0.30 };
      else if (i === 8 && t === "chaos") effect = { kind: "stun", chance: 0.14, turns: 1 };
      else if (i === 9 && t === "cringe") effect = { kind: "debuffDef", turns: 2, amount: 2 };

      const m: Move = {
        id, name, type: t, power, accuracy, effect,
        desc: `A ${t}-typed attack with discord-brain damage.`
      };
      moves[id] = m;
      pools[t].push(id);
    }

    // 5 utility/status moves
    for (let i = 0; i < 5; i++) {
      const id = `t_${t}_util_${i}`;
      const name = `${t.toUpperCase()} ${STATUS_NOUNS[(i + 3) % STATUS_NOUNS.length]}`;
      const accuracy = 0.95;

      let effect: MoveEffect = { kind: "none" };
      let power = 5;

      if (i === 0) { effect = { kind: "buffAtk", turns: 2, amount: 2 }; power = 6; }
      if (i === 1) { effect = { kind: "buffDef", turns: 2, amount: 2 }; power = 6; }
      if (i === 2) { effect = { kind: "debuffDef", turns: 2, amount: 2 }; power = 7; }
      if (i === 3) { effect = { kind: "heal", pctMaxHp: 0.16 }; power = 0; }
      if (i === 4) {
        power = 7;
        if (t === "neurocringe") effect = { kind: "skullstatic", chance: 0.35, turns: 3, dotPctMaxHp: 0.05, accDown: 0.08 };
        else if (t === "zesty") effect = { kind: "charm", chance: 0.24, turns: 2, failChance: 0.30 };
        else if (t === "glitchcore") effect = { kind: "lagged", chance: 0.30, turns: 2, failChance: 0.20, accDown: 0.05 };
        else if (t === "doom") effect = { kind: "shadowban", chance: 0.24, turns: 2, dmgDownPct: 0.16, blocksBuffs: false };
        else if (t === "toxic") effect = { kind: "toxify", chance: 0.32, turns: 3, dotPctMaxHp: 0.05, healDownPct: 0.35 };
        else effect = { kind: "stun", chance: 0.12, turns: 1 };
      }

      const m: Move = {
        id, name, type: t, power, accuracy, effect,
        desc: `A ${t}-typed utility move.`
      };
      moves[id] = m;
      pools[t].push(id);
    }

    // 2 hazards per type
    const hazards: HazardId[] = ["ad_flood", "lag_field", "sticky_threads", "ratio_spikes"];
    for (let i = 0; i < 2; i++) {
      const hz = hazards[(TYPE_RING.indexOf(t) + i) % hazards.length];
      const id = `t_${t}_hz_${i}_${hz}`;
      const name = `${t.toUpperCase()} ${hz === "ad_flood" ? "Ad Flood" : hz === "lag_field" ? "Lag Field" : hz === "sticky_threads" ? "Sticky Threads" : "Ratio Spikes"}`;
      const m: Move = {
        id,
        name,
        type: t,
        power: hz === "ratio_spikes" ? 0 : 6,
        accuracy: 0.92,
        effect: { kind: "hazard", hazard: hz, turns: 3, chance: 0.90 },
        desc: `Sets hazard (${hz}) on the target side.`
      };
      moves[id] = m;
      pools[t].push(id);
    }
  }

  return { moves, pools };
}

// ---------- ROSTER GENERATION (128 species) ----------
const FAMILY_ROOTS = [
  "Skib", "Rizz", "Mog", "Sigma", "Gyatt", "Doom", "Ping", "Glitch", "Yap", "Woj", "NPC", "Drip",
  "Aura", "Based", "Copium", "Cringe", "Chad", "Soy", "Clout", "Kek", "Dank", "Bait", "Lore", "Mald",
  "Toast", "Goon", "Vibe", "Cap", "NoCap", "Stan", "Simp", "Grind", "Patch", "Cache", "Thread", "Reply",
  "Hype", "Feral", "Shill", "Spiral",
]; // 40 families
const EVO_SUFFIX = ["ling", "maxxer", "lord"];

function familyTypes(root: string): ElementType[] {
  const r = root.toLowerCase();

  let primary: ElementType = "meme";
  if (["chad","mog","aura","based"].some(x => r.includes(x))) primary = "chad";
  else if (["soy"].some(x => r.includes(x))) primary = "soy";
  else if (["sigma","grind"].some(x => r.includes(x))) primary = "sigma";
  else if (["cringe","copium","cap","nocap"].some(x => r.includes(x))) primary = "cringe";
  else if (["rizz","gyatt","simp","stan"].some(x => r.includes(x))) primary = "zesty";
  else if (["doom","mald","spiral"].some(x => r.includes(x))) primary = "doom";
  else if (["kek","dank","bait","skib"].some(x => r.includes(x))) primary = "chaos";
  else if (["ping","glitch","patch","cache"].some(x => r.includes(x))) primary = "glitchcore";
  else if (["yap","lore"].some(x => r.includes(x))) primary = "neurocringe";
  else if (["reply","clout","hype"].some(x => r.includes(x))) primary = "parasocial";
  else if (["drip","goon","shill","feral"].some(x => r.includes(x))) primary = "toxic";

  // deterministic dual type based on root length parity
  if ((root.length % 4) === 0) {
    const secondary = (root.length % 2 === 0) ? ringWeakAgainst(primary) : ringStrongAgainst(primary);
    if (secondary !== primary) return [primary, secondary];
  }
  return [primary];
}

function familyTraitPool(types: ElementType[]): TraitId[] {
  const pool: TraitId[] = ["main_character", "touch_grass", "uno_reverse", "mute_button"];
  for (const t of types) {
    if (t === "neurocringe") pool.push("chronically_online");
    if (t === "zesty") pool.push("zest_magnet");
    if (t === "cringe") pool.push("adblocker");
    if (t === "glitchcore") pool.push("low_latency");
    if (t === "doom") pool.push("mod_favorite");
    if (t === "toxic") pool.push("sanitizer");
    if (t === "parasocial") pool.push("parasocial_proof");
    if (t === "chad") pool.push("gigachad_core");
    if (t === "soy") pool.push("soy_engine");
  }
  return uniq(pool);
}

function rarityForStage(stage: 1 | 2 | 3, root: string): Rarity {
  const h = root.length * 131 + root.charCodeAt(0);
  const roll = (h % 100) / 100;

  if (stage === 1) return roll < 0.70 ? "common" : roll < 0.95 ? "uncommon" : "rare";
  if (stage === 2) return roll < 0.10 ? "common" : roll < 0.65 ? "uncommon" : roll < 0.95 ? "rare" : "epic";
  return roll < 0.05 ? "uncommon" : roll < 0.65 ? "rare" : "epic";
}

function baseStatsForStage(stage: 1 | 2 | 3) {
  const hp = stage === 1 ? 28 : stage === 2 ? 36 : 46;
  const atk = stage === 1 ? 9 : stage === 2 ? 12 : 16;
  const def = stage === 1 ? 7 : stage === 2 ? 10 : 13;
  return { hp, atk, def };
}

type SigPlan = { bySpecies: Record<string, string[]>; moves: Record<string, Move> };

function signatureFor(primary: ElementType, speciesName: string, idBase: string, isLegend = false): Move {
  const pow = isLegend ? 20 : 16;
  const acc = isLegend ? 0.90 : 0.92;

  const effect: MoveEffect =
    primary === "chad" ? { kind: "buffAtk", turns: 2, amount: 2 } :
    primary === "soy" ? { kind: "shadowban", chance: 0.28, turns: 2, dmgDownPct: 0.18, blocksBuffs: false } :
    primary === "sigma" ? { kind: "debuffDef", turns: 2, amount: 3 } :
    primary === "cringe" ? { kind: "hazard", hazard: "ad_flood", turns: 4, chance: 0.95 } :
    primary === "zesty" ? { kind: "zestify", chance: 0.34, turns: 3, atkDown: 2, sigmaVulnPct: 0.14 } :
    primary === "doom" ? { kind: "shadowban", chance: 0.30, turns: 2, dmgDownPct: 0.20, blocksBuffs: true } :
    primary === "chaos" ? { kind: "stun", chance: 0.18, turns: 1 } :
    primary === "glitchcore" ? { kind: "lagged", chance: 0.34, turns: 2, failChance: 0.22, accDown: 0.06 } :
    primary === "neurocringe" ? { kind: "skullstatic", chance: 0.36, turns: 3, dotPctMaxHp: 0.05, accDown: 0.09 } :
    primary === "parasocial" ? { kind: "charm", chance: 0.28, turns: 2, failChance: 0.34 } :
    { kind: "toxify", chance: 0.34, turns: 3, dotPctMaxHp: 0.05, healDownPct: 0.38 };

  return {
    id: idBase,
    name: `${speciesName} Signature`,
    type: primary,
    power: pow,
    accuracy: acc,
    effect,
    desc: `Exclusive signature move of ${speciesName}.`,
  };
}

function buildFamily(root: string, pools: Record<ElementType, string[]>): Species[] {
  const types = familyTypes(root);
  const traitPool = familyTraitPool(types);

  const stage1Id = `fam_${slug(root)}_1`;
  const stage2Id = `fam_${slug(root)}_2`;
  const stage3Id = `fam_${slug(root)}_3`;

  const baseMovePool = uniq(types.flatMap(t => pools[t]).concat(["bonk", "cope"]));

  const s1 = baseStatsForStage(1);
  const s2 = baseStatsForStage(2);
  const s3 = baseStatsForStage(3);

  const sp1: Species = {
    id: stage1Id,
    name: `${root}${EVO_SUFFIX[0]}`,
    types,
    rarity: rarityForStage(1, root),
    baseHp: s1.hp,
    baseAtk: s1.atk,
    baseDef: s1.def,
    traitPool,
    movePool: baseMovePool,
    evo: { to: stage2Id, level: 12 },
  };

  const sp2: Species = {
    id: stage2Id,
    name: `${root}${EVO_SUFFIX[1]}`,
    types,
    rarity: rarityForStage(2, root),
    baseHp: s2.hp,
    baseAtk: s2.atk,
    baseDef: s2.def,
    traitPool,
    movePool: baseMovePool,
    evo: { to: stage3Id, level: 24 },
  };

  const sp3: Species = {
    id: stage3Id,
    name: `${root}${EVO_SUFFIX[2]}`,
    types,
    rarity: rarityForStage(3, root),
    baseHp: s3.hp,
    baseAtk: s3.atk,
    baseDef: s3.def,
    traitPool,
    movePool: baseMovePool,
  };

  return [sp1, sp2, sp3];
}

function buildLegendaries(pools: Record<ElementType, string[]>): Species[] {
  const legos: Array<{ id: string; name: string; types: ElementType[]; trait: TraitId[] }> = [
    { id: "lego_0", name: "Gigachad Prime", types: ["chad", "sigma"], trait: ["gigachad_core", "main_character"] },
    { id: "lego_1", name: "Soy Overclock", types: ["soy", "glitchcore"], trait: ["soy_engine", "low_latency"] },
    { id: "lego_2", name: "The Zest Oracle", types: ["zesty", "parasocial"], trait: ["zest_magnet", "parasocial_proof"] },
    { id: "lego_3", name: "Doom Prophet", types: ["doom", "neurocringe"], trait: ["mod_favorite", "chronically_online"] },
    { id: "lego_4", name: "Adpocalypse", types: ["cringe", "chaos"], trait: ["adblocker", "uno_reverse"] },
    { id: "lego_5", name: "Toxic Basilisk", types: ["toxic", "doom"], trait: ["sanitizer", "main_character"] },
    { id: "lego_6", name: "Parasocial Wraith", types: ["parasocial", "neurocringe"], trait: ["parasocial_proof", "touch_grass"] },
    { id: "lego_7", name: "Glitch Seraph", types: ["glitchcore", "zesty"], trait: ["low_latency", "zest_magnet"] },
  ];

  return legos.map((l) => ({
    id: l.id,
    name: l.name,
    types: l.types,
    rarity: "legendary",
    baseHp: 58,
    baseAtk: 20,
    baseDef: 16,
    traitPool: l.trait,
    movePool: uniq(l.types.flatMap(t => pools[t]).concat(["bonk", "cope"])),
  }));
}

function planSignatures(species: Record<string, Species>): SigPlan {
  const bySpecies: Record<string, string[]> = {};
  const moves: Record<string, Move> = {};

  // 40 stage-3 family signatures
  for (const sp of Object.values(species)) {
    if (sp.id.endsWith("_3") && sp.id.startsWith("fam_")) {
      const primary = sp.types[0];
      const mid = `sig_${sp.id}`;
      moves[mid] = signatureFor(primary, sp.name, mid, false);
      bySpecies[sp.id] = [mid];
    }
  }

  // 8 legendary signatures
  for (const sp of Object.values(species)) {
    if (sp.id.startsWith("lego_")) {
      const primary = sp.types[0];
      const mid = `sig_${sp.id}`;
      moves[mid] = signatureFor(primary, sp.name, mid, true);
      bySpecies[sp.id] = [mid];
    }
  }

  // +12 extra stage-2 signatures = 60+ exclusive
  const stage2 = Object.values(species).filter(s => s.id.endsWith("_2") && s.id.startsWith("fam_")).slice(0, 12);
  for (const sp of stage2) {
    const primary = sp.types[0];
    const mid = `sig2_${sp.id}`;
    moves[mid] = signatureFor(primary, sp.name, mid, false);
    bySpecies[sp.id] = [mid];
  }

  return { bySpecies, moves };
}

export function buildContent(): ContentPack {
  const gen = genMoves();

  const species: Record<string, Species> = {};
  for (const root of FAMILY_ROOTS) {
    for (const sp of buildFamily(root, gen.pools)) species[sp.id] = sp;
  }
  for (const sp of buildLegendaries(gen.pools)) species[sp.id] = sp;

  const sig = planSignatures(species);
  for (const [mid, mv] of Object.entries(sig.moves)) gen.moves[mid] = mv;

  for (const [sid, mids] of Object.entries(sig.bySpecies)) {
    species[sid].signatureMoves = mids;
    species[sid].movePool = uniq(species[sid].movePool.concat(mids));
  }

  const speciesCount = Object.keys(species).length;
  const moveCount = Object.keys(gen.moves).length;

  return { moves: gen.moves, traits: TRAITS, species, speciesCount, moveCount };
}

export const CONTENT = buildContent();
export const SPECIES_COUNT = CONTENT.speciesCount;
export const MOVE_COUNT = CONTENT.moveCount;
