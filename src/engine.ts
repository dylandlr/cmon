// src/engine.ts
import {
  CONTENT,
  ElementType,
  HazardId,
  Move,
  Species,
  StatusKey,
  Trait,
  ringStrongAgainst,
  ringWeakAgainst,
} from "./content.js";

export type Status = {
  stunTurns: number;

  burnTurns: number;
  burnDotPct: number;

  skullTurns: number;
  skullDotPct: number;
  skullAccDown: number;

  charmTurns: number;
  charmFailChance: number;

  zestTurns: number;
  zestAtkDown: number;
  zestSigmaVulnPct: number;

  lagTurns: number;
  lagFailChance: number;
  lagAccDown: number;

  shadowTurns: number;
  shadowDmgDownPct: number;
  shadowBlocksBuffs: boolean;

  toxicTurns: number;
  toxicDotPct: number;
  toxicHealDownPct: number;

  atkBuffTurns: number;
  atkBuffAmount: number;

  atkDebuffTurns: number;
  atkDebuffAmount: number;

  defBuffTurns: number;
  defBuffAmount: number;

  defDebuffTurns: number;
  defDebuffAmount: number;

  hazards: Record<HazardId, number>;

  turnAccDown: number;
  turnFailChance: number;
  recoilPctOnAttack: number;

  firstHitReady: boolean;
};

export function blankStatus(): Status {
  return {
    stunTurns: 0,

    burnTurns: 0,
    burnDotPct: 0,

    skullTurns: 0,
    skullDotPct: 0,
    skullAccDown: 0,

    charmTurns: 0,
    charmFailChance: 0,

    zestTurns: 0,
    zestAtkDown: 0,
    zestSigmaVulnPct: 0,

    lagTurns: 0,
    lagFailChance: 0,
    lagAccDown: 0,

    shadowTurns: 0,
    shadowDmgDownPct: 0,
    shadowBlocksBuffs: false,

    toxicTurns: 0,
    toxicDotPct: 0,
    toxicHealDownPct: 0,

    atkBuffTurns: 0,
    atkBuffAmount: 0,

    atkDebuffTurns: 0,
    atkDebuffAmount: 0,

    defBuffTurns: 0,
    defBuffAmount: 0,

    defDebuffTurns: 0,
    defDebuffAmount: 0,

    hazards: { ad_flood: 0, lag_field: 0, sticky_threads: 0, ratio_spikes: 0 },

    turnAccDown: 0,
    turnFailChance: 0,
    recoilPctOnAttack: 0,

    firstHitReady: true,
  };
}

export type ChudInstance = {
  uid: string;
  speciesId: string;
  nickname?: string;
  level: number;
  xp: number;
  moves: string[];
  traitId: string;
  hp: number;
};

export type BattleSide = {
  userId: string;
  team: ChudInstance[];
  active: number;
};

export type BattleState = {
  channelId: string;
  turnUserId: string;
  sides: [BattleSide, BattleSide];

  status: {
    p0: Status[];
    p1: Status[];
  };

  log: string[];
  finished: boolean;
  winnerUserId?: string;
};

export function getMove(moveId: string): Move {
  const m = CONTENT.moves[moveId];
  if (!m) throw new Error(`Unknown move: ${moveId}`);
  return m;
}

export function getSpecies(id: string): Species {
  const s = CONTENT.species[id];
  if (!s) throw new Error(`Unknown species: ${id}`);
  return s;
}

export function getTrait(id: string): Trait {
  const t = (CONTENT.traits as any)[id] as Trait | undefined;
  if (!t) throw new Error(`Unknown trait: ${id}`);
  return t;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Type multiplier (ring-based)
 * - Strong vs next in ring: 1.25
 * - Weak vs previous in ring: 0.80
 */
export function typeMultiplier(att: ElementType, def: ElementType) {
  if (def === ringStrongAgainst(att)) return 0.80;
  if (def === ringWeakAgainst(att)) return 1.25;
  return 1.0;
}

export function matchupMultiplier(moveType: ElementType, defenderTypes: ElementType[]) {
  let mult = 1.0;
  for (const dt of defenderTypes) mult *= typeMultiplier(moveType, dt);
  return mult;
}

export function calcMaxHp(sp: Species, level: number) {
  return sp.baseHp + Math.floor(level * 2.2);
}
export function calcAtk(sp: Species, level: number) {
  return sp.baseAtk + Math.floor(level * 1.4);
}
export function calcDef(sp: Species, level: number) {
  return sp.baseDef + Math.floor(level * 1.25);
}

export function applyHazardsAtTurnStart(status: Status, maxHp: number): { dot: number; msg: string[] } {
  status.turnAccDown = 0;
  status.turnFailChance = 0;
  status.recoilPctOnAttack = 0;

  const msg: string[] = [];
  let dot = 0;

  if (status.hazards.ad_flood > 0) {
    dot += Math.ceil(maxHp * 0.04);
    status.turnAccDown += 0.05;
    msg.push(`📢 **Ad Flood**: ads deal DOT + aim penalty.`);
  }
  if (status.hazards.lag_field > 0) {
    status.turnFailChance = Math.max(status.turnFailChance, 0.18);
    status.turnAccDown += 0.03;
    msg.push(`📶 **Lag Field**: chance to fumble your turn.`);
  }
  if (status.hazards.sticky_threads > 0) {
    status.defDebuffTurns = Math.max(status.defDebuffTurns, 1);
    status.defDebuffAmount = Math.max(status.defDebuffAmount, 2);
    msg.push(`🧵 **Sticky Threads**: DEF dragged down.`);
  }
  if (status.hazards.ratio_spikes > 0) {
    status.recoilPctOnAttack = Math.max(status.recoilPctOnAttack, 0.02);
    msg.push(`📌 **Ratio Spikes**: attacking causes recoil.`);
  }

  return { dot, msg };
}

export function tickStatus(s: Status) {
  const dec = (k: keyof Status) => {
    const v = s[k];
    if (typeof v === "number" && v > 0) (s as any)[k] = v - 1;
  };

  dec("stunTurns");

  dec("burnTurns");
  if (s.burnTurns <= 0) s.burnDotPct = 0;

  dec("skullTurns");
  if (s.skullTurns <= 0) {
    s.skullDotPct = 0;
    s.skullAccDown = 0;
  }

  dec("charmTurns");
  if (s.charmTurns <= 0) s.charmFailChance = 0;

  dec("zestTurns");
  if (s.zestTurns <= 0) {
    s.zestAtkDown = 0;
    s.zestSigmaVulnPct = 0;
  }

  dec("lagTurns");
  if (s.lagTurns <= 0) {
    s.lagFailChance = 0;
    s.lagAccDown = 0;
  }

  dec("shadowTurns");
  if (s.shadowTurns <= 0) {
    s.shadowDmgDownPct = 0;
    s.shadowBlocksBuffs = false;
  }

  dec("toxicTurns");
  if (s.toxicTurns <= 0) {
    s.toxicDotPct = 0;
    s.toxicHealDownPct = 0;
  }

  dec("atkBuffTurns");
  if (s.atkBuffTurns <= 0) s.atkBuffAmount = 0;

  dec("atkDebuffTurns");
  if (s.atkDebuffTurns <= 0) s.atkDebuffAmount = 0;

  dec("defBuffTurns");
  if (s.defBuffTurns <= 0) s.defBuffAmount = 0;

  dec("defDebuffTurns");
  if (s.defDebuffTurns <= 0) s.defDebuffAmount = 0;

  (Object.keys(s.hazards) as HazardId[]).forEach((h) => {
    if (s.hazards[h] > 0) s.hazards[h] -= 1;
  });
}

function resistChance(defTrait: Trait, key: StatusKey, baseChance: number) {
  const r = defTrait.statusResist?.[key] ?? 0;
  return clamp(baseChance * (1 - r), 0, 1);
}
function hazardChance(defTrait: Trait, hazard: HazardId, baseChance: number) {
  const r = defTrait.hazardResist?.[hazard] ?? 0;
  return clamp(baseChance * (1 - r), 0, 1);
}
function shouldReflect(defTrait: Trait) {
  return Math.random() < (defTrait.reflectDebuffChance ?? 0);
}

export function moveAccuracy(attackerTrait: Trait, move: Move, attackerStatus: Status) {
  let acc = clamp(move.accuracy + (attackerTrait.accuracyBonus ?? 0), 0.55, 0.99);
  if (attackerStatus.skullTurns > 0) acc -= attackerStatus.skullAccDown;
  if (attackerStatus.lagTurns > 0) acc -= attackerStatus.lagAccDown;
  acc -= attackerStatus.turnAccDown;
  return clamp(acc, 0.50, 0.99);
}

export function computeDamage(opts: {
  attacker: ChudInstance;
  defender: ChudInstance;
  attackerStatus: Status;
  defenderStatus: Status;
  attackerTrait: Trait;
  defenderTrait: Trait;
  move: Move;
}) {
  const aSp = getSpecies(opts.attacker.speciesId);
  const dSp = getSpecies(opts.defender.speciesId);

  const dMax = calcMaxHp(dSp, opts.defender.level);

  const atkBase = calcAtk(aSp, opts.attacker.level);
  const defBase = calcDef(dSp, opts.defender.level);

  let atk = atkBase + (opts.attackerStatus.atkBuffAmount || 0) - (opts.attackerStatus.atkDebuffAmount || 0);
  let def = defBase + (opts.defenderStatus.defBuffAmount || 0) - (opts.defenderStatus.defDebuffAmount || 0);
  atk = Math.max(1, atk);
  def = Math.max(1, def);

  let dmg = Math.floor((opts.move.power * atk) / (def + 5));

  let mult = matchupMultiplier(opts.move.type, dSp.types);

  if (opts.defenderStatus.zestTurns > 0 && opts.move.type === "sigma") {
    mult *= (1 + opts.defenderStatus.zestSigmaVulnPct);
  }

  mult *= opts.attackerTrait.typeDamageDealt?.[opts.move.type] ?? 1.0;
  mult *= opts.defenderTrait.typeDamageTaken?.[opts.move.type] ?? 1.0;

  dmg = Math.floor(dmg * mult);

  if (opts.attackerStatus.shadowTurns > 0) {
    dmg = Math.floor(dmg * (1 - opts.attackerStatus.shadowDmgDownPct));
  }

  if (opts.attackerStatus.firstHitReady && (opts.attackerTrait.firstHitBonusPct ?? 0) > 0) {
    dmg = Math.floor(dmg * (1 + (opts.attackerTrait.firstHitBonusPct ?? 0)));
  }

  dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));

  const crit = Math.random() < (0.06 + (opts.attackerTrait.critBonus ?? 0));
  if (crit) dmg = Math.floor(dmg * 1.5);

  dmg = clamp(dmg, 1, dMax);

  return { dmg, crit, mult };
}

export function applyEffect(opts: {
  effect: Move["effect"];
  attackerTrait: Trait;
  defenderTrait: Trait;
  attackerStatus: Status;
  defenderStatus: Status;
}) {
  const { effect, defenderTrait, attackerStatus, defenderStatus } = opts;

  const harmfulKinds = new Set([
    "stun",
    "burn",
    "skullstatic",
    "zestify",
    "charm",
    "lagged",
    "shadowban",
    "toxify",
    "debuffDef",
    "hazard",
  ]);

  const reflected = harmfulKinds.has(effect.kind) && shouldReflect(defenderTrait);
  const target = reflected ? attackerStatus : defenderStatus;

  switch (effect.kind) {
    case "none":
      return;

    case "heal":
      return;

    case "buffAtk":
      attackerStatus.atkBuffTurns = Math.max(attackerStatus.atkBuffTurns, effect.turns);
      attackerStatus.atkBuffAmount = Math.max(attackerStatus.atkBuffAmount, effect.amount);
      return;

    case "buffDef":
      attackerStatus.defBuffTurns = Math.max(attackerStatus.defBuffTurns, effect.turns);
      attackerStatus.defBuffAmount = Math.max(attackerStatus.defBuffAmount, effect.amount);
      return;

    case "debuffDef":
      target.defDebuffTurns = Math.max(target.defDebuffTurns, 2);
      target.defDebuffAmount = Math.max(target.defDebuffAmount, effect.amount);
      return;

    case "stun": {
      const ch = resistChance(defenderTrait, "stun", effect.chance);
      if (Math.random() < ch) target.stunTurns = Math.max(target.stunTurns, effect.turns);
      return;
    }

    case "burn": {
      const ch = resistChance(defenderTrait, "burn", effect.chance);
      if (Math.random() < ch) {
        target.burnTurns = Math.max(target.burnTurns, effect.turns);
        target.burnDotPct = Math.max(target.burnDotPct, effect.dotPctMaxHp);
      }
      return;
    }

    case "skullstatic": {
      const ch = resistChance(defenderTrait, "skullstatic", effect.chance);
      if (Math.random() < ch) {
        target.skullTurns = Math.max(target.skullTurns, effect.turns);
        target.skullDotPct = Math.max(target.skullDotPct, effect.dotPctMaxHp);
        target.skullAccDown = Math.max(target.skullAccDown, effect.accDown);
      }
      return;
    }

    case "zestify": {
      const ch = resistChance(defenderTrait, "zestify", effect.chance);
      if (Math.random() < ch) {
        target.zestTurns = Math.max(target.zestTurns, effect.turns);
        target.zestAtkDown = Math.max(target.zestAtkDown, effect.atkDown);
        target.zestSigmaVulnPct = Math.max(target.zestSigmaVulnPct, effect.sigmaVulnPct);

        target.atkDebuffTurns = Math.max(target.atkDebuffTurns, effect.turns);
        target.atkDebuffAmount = Math.max(target.atkDebuffAmount, effect.atkDown);
      }
      return;
    }

    case "charm": {
      const ch = resistChance(defenderTrait, "charm", effect.chance);
      if (Math.random() < ch) {
        target.charmTurns = Math.max(target.charmTurns, effect.turns);
        target.charmFailChance = Math.max(target.charmFailChance, effect.failChance);
      }
      return;
    }

    case "lagged": {
      const ch = resistChance(defenderTrait, "lagged", effect.chance);
      if (Math.random() < ch) {
        target.lagTurns = Math.max(target.lagTurns, effect.turns);
        target.lagFailChance = Math.max(target.lagFailChance, effect.failChance);
        target.lagAccDown = Math.max(target.lagAccDown, effect.accDown);
      }
      return;
    }

    case "shadowban": {
      const ch = resistChance(defenderTrait, "shadowban", effect.chance);
      if (Math.random() < ch) {
        target.shadowTurns = Math.max(target.shadowTurns, effect.turns);
        target.shadowDmgDownPct = Math.max(target.shadowDmgDownPct, effect.dmgDownPct);
        target.shadowBlocksBuffs = effect.blocksBuffs;
      }
      return;
    }

    case "toxify": {
      const ch = resistChance(defenderTrait, "toxify", effect.chance);
      if (Math.random() < ch) {
        target.toxicTurns = Math.max(target.toxicTurns, effect.turns);
        target.toxicDotPct = Math.max(target.toxicDotPct, effect.dotPctMaxHp);
        target.toxicHealDownPct = Math.max(target.toxicHealDownPct, effect.healDownPct);
      }
      return;
    }

    case "hazard": {
      const baseChance = effect.chance ?? 1.0;
      const ch = hazardChance(defenderTrait, effect.hazard, baseChance);
      if (Math.random() < ch) {
        target.hazards[effect.hazard] = Math.max(target.hazards[effect.hazard] ?? 0, effect.turns);
      }
      return;
    }
  }
}

export function tryCleanse(status: Status, trait: Trait): string | null {
  const p = trait.cleanseChance ?? 0;
  if (p <= 0) return null;
  if (Math.random() >= p) return null;

  if (status.skullTurns > 0) { status.skullTurns = 0; return "🧼 Cleansed SkullStatic!"; }
  if (status.toxicTurns > 0) { status.toxicTurns = 0; return "🧼 Cleansed Toxify!"; }
  if (status.burnTurns > 0) { status.burnTurns = 0; return "🧼 Cleansed Burn!"; }
  if (status.lagTurns > 0) { status.lagTurns = 0; return "🧼 Cleansed Lagged!"; }
  if (status.shadowTurns > 0) { status.shadowTurns = 0; return "🧼 Cleansed Shadowban!"; }
  if (status.charmTurns > 0) { status.charmTurns = 0; return "🧼 Cleansed Charm!"; }
  if (status.stunTurns > 0) { status.stunTurns = 0; return "🧼 Cleansed Stun!"; }

  const hz = (Object.keys(status.hazards) as HazardId[]).find((h) => status.hazards[h] > 0);
  if (hz) { status.hazards[hz] = 0; return `🧼 Cleansed hazard: ${hz}`; }
  return null;
}

// choose 4 moves; ALWAYS include signature moves first if present
export function defaultMovesForSpecies(sp: Species): string[] {
  const pool = sp.movePool.slice();
  const chosen: string[] = [];

  if (sp.signatureMoves?.length) {
    for (const mid of sp.signatureMoves) {
      if (!chosen.includes(mid)) chosen.push(mid);
    }
  }

  while (chosen.length < 4 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    const pick = pool.splice(i, 1)[0];
    if (!chosen.includes(pick)) chosen.push(pick);
  }
  while (chosen.length < 4) chosen.push("bonk");

  return chosen.slice(0, 4);
}

export function battleSideActive(side: BattleSide): ChudInstance {
  return side.team[side.active];
}

export function sideStatus(state: BattleState, sideIndex: 0 | 1, slot: number): Status {
  return sideIndex === 0 ? state.status.p0[slot] : state.status.p1[slot];
}

export function isTeamDefeated(side: BattleSide) {
  return side.team.every((c) => c.hp <= 0);
}

export function forceSwapToNextAlive(side: BattleSide): number | null {
  for (let i = 0; i < side.team.length; i++) {
    if (side.team[i].hp > 0) {
      side.active = i;
      return i;
    }
  }
  return null;
}
