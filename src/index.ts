// src/index.ts
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

import { CONTENT, SPECIES_COUNT, MOVE_COUNT, Rarity, TraitId } from "./content.js";
import {
  blankStatus,
  BattleState,
  BattleSide,
  ChudInstance,
  applyEffect,
  applyHazardsAtTurnStart,
  battleSideActive,
  calcMaxHp,
  computeDamage,
  defaultMovesForSpecies,
  forceSwapToNextAlive,
  getMove,
  getSpecies,
  getTrait,
  moveAccuracy,
  sideStatus,
  tickStatus,
  tryCleanse,
} from "./engine.js";
import * as DB from "./db.js";
import { embed, fmtTypes, bar } from "./ui.js";

// -------------------- setup --------------------
DB.initDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder().setName("chud_count").setDescription("How many Chudémon exist?"),
  new SlashCommandBuilder().setName("move_count").setDescription("How many moves exist?"),
  new SlashCommandBuilder().setName("explore").setDescription("Roll a wild Chudémon encounter in this channel."),
  new SlashCommandBuilder().setName("catch").setDescription("Try to catch the wild Chudémon in this channel."),
  new SlashCommandBuilder().setName("owned").setDescription("List your owned Chudémon."),
  new SlashCommandBuilder().setName("party").setDescription("Show your party (3)."),
  new SlashCommandBuilder()
    .setName("setparty")
    .setDescription("Set a party slot to a Chud uid (from /owned).")
    .addIntegerOption(o => o.setName("slot").setDescription("1-3").setRequired(true))
    .addStringOption(o => o.setName("uid").setDescription("Owned uid or 'none'").setRequired(true)),
  new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Invite someone to a 3v3 battle in this channel.")
    .addUserOption(o => o.setName("user").setDescription("Opponent").setRequired(true)),
  new SlashCommandBuilder().setName("accept").setDescription("Accept duel invite in this channel."),
  new SlashCommandBuilder()
    .setName("attack")
    .setDescription("Use a move by name (must be on your active chud).")
    .addStringOption(o => o.setName("move").setDescription("Move name").setRequired(true)),
  new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Swap active Chudémon (1-3).")
    .addIntegerOption(o => o.setName("slot").setDescription("1-3").setRequired(true)),
  new SlashCommandBuilder().setName("forfeit").setDescription("Forfeit the current battle in this channel."),
].map(c => c.toJSON());

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
}

function rarityWeight(r: Rarity) {
  // legendary is EXTREMELY low
  switch (r) {
    case "common": return 7000;
    case "uncommon": return 2500;
    case "rare": return 450;
    case "epic": return 45;
    case "legendary": return 1;
  }
}

function rollWildSpeciesId(): string {
  const ids = Object.keys(CONTENT.species);
  const weights = ids.map((id) => rarityWeight(CONTENT.species[id].rarity));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = Math.floor(Math.random() * total);
  for (let i = 0; i < ids.length; i++) {
    x -= weights[i];
    if (x < 0) return ids[i];
  }
  return ids[0];
}

function randomTraitForSpecies(spId: string): TraitId {
  const sp = CONTENT.species[spId];
  return sp.traitPool[Math.floor(Math.random() * sp.traitPool.length)] as TraitId;
}

function makeBattleTeamFromParty(userId: string): ChudInstance[] {
  const party = DB.getParty(userId);
  const uids = [party.slot1_uid, party.slot2_uid, party.slot3_uid].filter(Boolean) as string[];

  if (uids.length < 3) throw new Error("You need a full party of 3. Use /setparty.");

  return uids.map((uid) => {
    const row = DB.getOwned(uid);
    if (!row) throw new Error(`Missing owned uid: ${uid}`);
    const sp = getSpecies(row.species_id);
    const maxHp = calcMaxHp(sp, row.level);
    return {
      uid: row.uid,
      speciesId: row.species_id,
      nickname: row.nickname ?? undefined,
      level: row.level,
      xp: row.xp,
      moves: JSON.parse(row.moves_json),
      traitId: row.trait_id,
      hp: maxHp,
    };
  });
}

function battleSummary(state: BattleState) {
  const a0 = battleSideActive(state.sides[0]);
  const a1 = battleSideActive(state.sides[1]);
  const sp0 = getSpecies(a0.speciesId);
  const sp1 = getSpecies(a1.speciesId);

  const max0 = calcMaxHp(sp0, a0.level);
  const max1 = calcMaxHp(sp1, a1.level);

  const name0 = a0.nickname ?? sp0.name;
  const name1 = a1.nickname ?? sp1.name;

  const lines = [
    `**Turn:** <@${state.turnUserId}>`,
    ``,
    `**P1** <@${state.sides[0].userId}> — Active: **${name0}** ${fmtTypes(sp0.types)}`,
    `${bar(a0.hp, max0)}`,
    ``,
    `**P2** <@${state.sides[1].userId}> — Active: **${name1}** ${fmtTypes(sp1.types)}`,
    `${bar(a1.hp, max1)}`,
  ];

  const tail = state.log.slice(-6);
  if (tail.length) lines.push(`\n**Log**\n${tail.map((x) => `• ${x}`).join("\n")}`);

  return lines.join("\n");
}

function findMoveByName(instance: ChudInstance, name: string) {
  const wanted = name.trim().toLowerCase();
  for (const mid of instance.moves) {
    const m = getMove(mid);
    if (m.name.toLowerCase() === wanted) return m;
  }
  return null;
}

async function handle(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId;
  const userId = interaction.user.id;

  if (interaction.commandName === "chud_count") {
    await interaction.reply({ embeds: [embed("📦 Chudédex", `Total Chudémon in this build: **${SPECIES_COUNT}**`)] });
    return;
  }

  if (interaction.commandName === "move_count") {
    await interaction.reply({ embeds: [embed("🧾 MoveDex", `Total moves in this build: **${MOVE_COUNT}**\nSignature-exclusive moves: **60+**`)] });
    return;
  }

  if (interaction.commandName === "explore") {
    const id = rollWildSpeciesId();
    const sp = CONTENT.species[id];
    const level = 6 + Math.floor(Math.random() * 8); // 6-13
    DB.setEncounter(channelId, id, level);
    await interaction.reply({
      embeds: [embed("🌲 Wild Encounter!", `A wild **${sp.name}** appeared!\nTypes: ${fmtTypes(sp.types)}\nRarity: **${sp.rarity}**\nUse **/catch** to try catching it.`)],
    });
    return;
  }

  if (interaction.commandName === "catch") {
    const enc = DB.getEncounter(channelId);
    if (!enc) {
      await interaction.reply({ content: "No wild encounter here. Use /explore.", ephemeral: true });
      return;
    }

    const sp = CONTENT.species[enc.species_id];
    const level = enc.level as number;

    // catch chance by rarity
    const base =
      sp.rarity === "common" ? 0.55 :
      sp.rarity === "uncommon" ? 0.35 :
      sp.rarity === "rare" ? 0.18 :
      sp.rarity === "epic" ? 0.07 : 0.008; // legendary
    const chance = Math.max(0.01, base - (level - 6) * 0.01);

    const ok = Math.random() < chance;
    if (!ok) {
      await interaction.reply({ embeds: [embed("🫳 Missed!", `**${sp.name}** broke free. (Chance: ${(chance*100).toFixed(1)}%)`)] });
      return;
    }

    const trait = randomTraitForSpecies(sp.id);
    const moves = defaultMovesForSpecies(sp);
    const uid = DB.addOwned({ userId, speciesId: sp.id, level, xp: 0, traitId: trait, moves });

    DB.clearEncounter(channelId);

    await interaction.reply({
      embeds: [embed("✅ Caught!", `You caught **${sp.name}** (${fmtTypes(sp.types)})!\nOwned UID: \`${uid}\`\nTrait: **${getTrait(trait).name}**\nMoves: ${moves.map(m => `**${getMove(m).name}**`).join(", ")}`)],
    });
    return;
  }

  if (interaction.commandName === "owned") {
    const rows = DB.listOwned(userId);
    if (!rows.length) {
      await interaction.reply({ content: "You don't own any Chudémon yet. Use /explore.", ephemeral: true });
      return;
    }
    const lines = rows.slice(0, 20).map((r) => {
      const sp = CONTENT.species[r.species_id];
      return `\`${r.uid}\` — **${sp.name}** ${fmtTypes(sp.types)} (Lv ${r.level}) Trait: **${getTrait(r.trait_id).name}**`;
    });
    await interaction.reply({ embeds: [embed("🎒 Your Chudémon", lines.join("\n"))] });
    return;
  }

  if (interaction.commandName === "party") {
    const p = DB.getParty(userId);
    const slots = [p.slot1_uid, p.slot2_uid, p.slot3_uid];
    const lines = slots.map((uid: string | null, i: number) => {
      if (!uid) return `Slot ${i + 1}: *(empty)*`;
      const r = DB.getOwned(uid);
      if (!r) return `Slot ${i + 1}: *(missing uid)*`;
      const sp = CONTENT.species[r.species_id];
      return `Slot ${i + 1}: \`${uid}\` — **${sp.name}** ${fmtTypes(sp.types)} (Lv ${r.level})`;
    });
    await interaction.reply({ embeds: [embed("👥 Party (3)", lines.join("\n"))] });
    return;
  }

  if (interaction.commandName === "setparty") {
    const slot = interaction.options.getInteger("slot", true);
    const uid = interaction.options.getString("uid", true);

    if (slot < 1 || slot > 3) {
      await interaction.reply({ content: "Slot must be 1-3.", ephemeral: true });
      return;
    }
    if (uid.toLowerCase() === "none") {
      DB.setPartySlot(userId, slot as 1 | 2 | 3, null);
      await interaction.reply({ content: `Cleared slot ${slot}.`, ephemeral: true });
      return;
    }

    const owned = DB.getOwned(uid);
    if (!owned || owned.user_id !== userId) {
      await interaction.reply({ content: "That UID isn't yours.", ephemeral: true });
      return;
    }

    DB.setPartySlot(userId, slot as 1 | 2 | 3, uid);
    await interaction.reply({ content: `Set slot ${slot} to \`${uid}\`.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === "duel") {
    const opp = interaction.options.getUser("user", true);
    if (opp.id === userId) {
      await interaction.reply({ content: "You can't duel yourself.", ephemeral: true });
      return;
    }
    DB.setInvite(channelId, userId, opp.id);
    await interaction.reply({
      embeds: [embed("⚔️ Duel Invite", `<@${userId}> invited <@${opp.id}> to a **3v3** Chudémon battle!\n<@${opp.id}> use **/accept** to begin.`)],
    });
    return;
  }

  if (interaction.commandName === "accept") {
    const inv = DB.getInvite(channelId);
    if (!inv) {
      await interaction.reply({ content: "No invite in this channel.", ephemeral: true });
      return;
    }
    if (inv.to_user_id !== userId) {
      await interaction.reply({ content: "That invite isn't for you.", ephemeral: true });
      return;
    }

    let teamA: ChudInstance[], teamB: ChudInstance[];
    try {
      teamA = makeBattleTeamFromParty(inv.from_user_id);
      teamB = makeBattleTeamFromParty(inv.to_user_id);
    } catch (e: any) {
      await interaction.reply({ content: `Party error: ${e.message}`, ephemeral: true });
      return;
    }

    const state: BattleState = {
      channelId,
      turnUserId: inv.from_user_id,
      sides: [
        { userId: inv.from_user_id, team: teamA, active: 0 },
        { userId: inv.to_user_id, team: teamB, active: 0 },
      ],
      status: {
        p0: [blankStatus(), blankStatus(), blankStatus()],
        p1: [blankStatus(), blankStatus(), blankStatus()],
      },
      log: ["Battle started!"],
      finished: false,
    };

    DB.clearInvite(channelId);
    DB.saveBattle(channelId, state);

    await interaction.reply({ embeds: [embed("🔥 Battle Start!", battleSummary(state))] });
    return;
  }

  if (interaction.commandName === "forfeit") {
    const state = DB.loadBattle(channelId) as BattleState | undefined;
    if (!state || state.finished) {
      await interaction.reply({ content: "No active battle in this channel.", ephemeral: true });
      return;
    }
    const p0 = state.sides[0].userId;
    const p1 = state.sides[1].userId;
    if (userId !== p0 && userId !== p1) {
      await interaction.reply({ content: "You aren't in this battle.", ephemeral: true });
      return;
    }
    const winner = userId === p0 ? p1 : p0;
    state.finished = true;
    state.winnerUserId = winner;
    state.log.push(`🏳️ <@${userId}> forfeited. Winner: <@${winner}>`);
    DB.saveBattle(channelId, state);
    await interaction.reply({ embeds: [embed("🏁 Battle Finished", battleSummary(state))] });
    DB.clearBattle(channelId);
    return;
  }

  if (interaction.commandName === "swap") {
    const state = DB.loadBattle(channelId) as BattleState | undefined;
    if (!state || state.finished) {
      await interaction.reply({ content: "No active battle in this channel.", ephemeral: true });
      return;
    }
    if (state.turnUserId !== userId) {
      await interaction.reply({ content: "Not your turn.", ephemeral: true });
      return;
    }

    const slot = interaction.options.getInteger("slot", true);
    if (slot < 1 || slot > 3) {
      await interaction.reply({ content: "Slot must be 1-3.", ephemeral: true });
      return;
    }

    const si = state.sides[0].userId === userId ? 0 : state.sides[1].userId === userId ? 1 : -1;
    if (si === -1) {
      await interaction.reply({ content: "You aren't in this battle.", ephemeral: true });
      return;
    }

    const side = state.sides[si] as BattleSide;
    const targetIndex = slot - 1;

    if (side.team[targetIndex].hp <= 0) {
      await interaction.reply({ content: "That Chudémon has fainted.", ephemeral: true });
      return;
    }
    if (targetIndex === side.active) {
      await interaction.reply({ content: "Already active.", ephemeral: true });
      return;
    }

    side.active = targetIndex;
    state.log.push(`🔁 <@${userId}> swapped to slot ${slot}.`);
    state.turnUserId = state.sides[si === 0 ? 1 : 0].userId;

    DB.saveBattle(channelId, state);
    await interaction.reply({ embeds: [embed("🔁 Swap!", battleSummary(state))] });
    return;
  }

  if (interaction.commandName === "attack") {
    const state = DB.loadBattle(channelId) as BattleState | undefined;
    if (!state || state.finished) {
      await interaction.reply({ content: "No active battle in this channel.", ephemeral: true });
      return;
    }
    if (state.turnUserId !== userId) {
      await interaction.reply({ content: "Not your turn.", ephemeral: true });
      return;
    }

    const moveName = interaction.options.getString("move", true);

    const si = state.sides[0].userId === userId ? 0 : 1;
    const oi = si === 0 ? 1 : 0;

    const side = state.sides[si];
    const opp = state.sides[oi];

    const a = battleSideActive(side);
    const d = battleSideActive(opp);

    const aSp = getSpecies(a.speciesId);
    const dSp = getSpecies(d.speciesId);

    const aStatus = sideStatus(state, si as 0 | 1, side.active);
    const dStatus = sideStatus(state, oi as 0 | 1, opp.active);

    const aTrait = getTrait(a.traitId);
    const dTrait = getTrait(d.traitId);

    const cleanseMsg = tryCleanse(aStatus, aTrait);
    if (cleanseMsg) state.log.push(cleanseMsg);

    const aMaxHp = calcMaxHp(aSp, a.level);
    const hz = applyHazardsAtTurnStart(aStatus, aMaxHp);
    if (hz.dot > 0) {
      a.hp = Math.max(0, a.hp - hz.dot);
      state.log.push(`📉 ${a.nickname ?? aSp.name} took **${hz.dot}** hazard DOT.`);
    }
    hz.msg.forEach(m => state.log.push(m));

    if (aStatus.burnTurns > 0 && aStatus.burnDotPct > 0) {
      const dot = Math.ceil(aMaxHp * aStatus.burnDotPct);
      a.hp = Math.max(0, a.hp - dot);
      state.log.push(`🔥 Burn tick: **${dot}**`);
    }
    if (aStatus.skullTurns > 0 && aStatus.skullDotPct > 0) {
      const dot = Math.ceil(aMaxHp * aStatus.skullDotPct);
      a.hp = Math.max(0, a.hp - dot);
      state.log.push(`🧠 SkullStatic tick: **${dot}**`);
    }
    if (aStatus.toxicTurns > 0 && aStatus.toxicDotPct > 0) {
      const dot = Math.ceil(aMaxHp * aStatus.toxicDotPct);
      a.hp = Math.max(0, a.hp - dot);
      state.log.push(`☣️ Toxify tick: **${dot}**`);
    }

    if (a.hp <= 0) {
      state.log.push(`💀 ${a.nickname ?? aSp.name} fainted from DOT.`);
      const next = forceSwapToNextAlive(side);
      if (next === null) {
        state.finished = true;
        state.winnerUserId = opp.userId;
        state.log.push(`🏆 Winner: <@${opp.userId}>`);
        DB.saveBattle(channelId, state);
        await interaction.reply({ embeds: [embed("🏁 Battle Finished", battleSummary(state))] });
        DB.clearBattle(channelId);
        return;
      }
      state.log.push(`➡️ Forced swap to slot ${next + 1}.`);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("⚠️ Forced Swap", battleSummary(state))] });
      return;
    }

    if (aStatus.stunTurns > 0) {
      state.log.push(`😵 ${a.nickname ?? aSp.name} is stunned and loses the turn!`);
      tickStatus(aStatus); tickStatus(dStatus);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("😵 Stunned", battleSummary(state))] });
      return;
    }

    if (aStatus.charmTurns > 0 && Math.random() < aStatus.charmFailChance) {
      state.log.push(`🫣 Charmlocked! ${a.nickname ?? aSp.name} fumbled the turn.`);
      tickStatus(aStatus); tickStatus(dStatus);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("🫣 Fumbled", battleSummary(state))] });
      return;
    }

    const lagFail = (aStatus.lagTurns > 0 ? aStatus.lagFailChance : 0);
    const fieldFail = aStatus.turnFailChance;
    const failChance = Math.max(lagFail, fieldFail);
    if (failChance > 0 && Math.random() < failChance) {
      state.log.push(`📶 Lagged! ${a.nickname ?? aSp.name} dropped packets and lost the turn.`);
      tickStatus(aStatus); tickStatus(dStatus);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("📶 Lagged", battleSummary(state))] });
      return;
    }

    const move = findMoveByName(a, moveName);
    if (!move) {
      await interaction.reply({ content: "That move isn't on your active Chudémon.", ephemeral: true });
      return;
    }

    const acc = moveAccuracy(aTrait, move, aStatus);
    if (Math.random() > acc) {
      state.log.push(`❌ ${a.nickname ?? aSp.name} used **${move.name}** and missed.`);
      tickStatus(aStatus); tickStatus(dStatus);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("❌ Miss", battleSummary(state))] });
      return;
    }

    if (move.effect.kind === "heal") {
      const healMod = aStatus.toxicTurns > 0 ? (1 - aStatus.toxicHealDownPct) : 1;
      const heal = Math.ceil(aMaxHp * move.effect.pctMaxHp * healMod);
      a.hp = Math.min(aMaxHp, a.hp + heal);
      state.log.push(`💚 ${a.nickname ?? aSp.name} used **${move.name}** and healed **${heal}**.`);
      tickStatus(aStatus); tickStatus(dStatus);
      state.turnUserId = opp.userId;
      DB.saveBattle(channelId, state);
      await interaction.reply({ embeds: [embed("💚 Heal", battleSummary(state))] });
      return;
    }

    const { dmg, crit, mult } = computeDamage({
      attacker: a,
      defender: d,
      attackerStatus: aStatus,
      defenderStatus: dStatus,
      attackerTrait: aTrait,
      defenderTrait: dTrait,
      move,
    });

    d.hp = Math.max(0, d.hp - dmg);

    if (move.power > 0 && aStatus.recoilPctOnAttack > 0) {
      const recoil = Math.ceil(aMaxHp * aStatus.recoilPctOnAttack);
      a.hp = Math.max(0, a.hp - recoil);
      state.log.push(`📌 Recoil: **${recoil}**`);
    }

    aStatus.firstHitReady = false;

    state.log.push(
      `⚔️ ${a.nickname ?? aSp.name} used **${move.name}** (${move.type}) for **${dmg}** dmg` +
      (crit ? " **(CRIT!)**" : "") +
      (mult !== 1 ? ` *(x${mult.toFixed(2)})*` : "")
    );

    applyEffect({
      effect: move.effect,
      attackerTrait: aTrait,
      defenderTrait: dTrait,
      attackerStatus: aStatus,
      defenderStatus: dStatus,
    });

    tickStatus(aStatus);
    tickStatus(dStatus);

    if (d.hp <= 0) {
      state.log.push(`💀 ${d.nickname ?? dSp.name} fainted!`);
      const next = forceSwapToNextAlive(opp);
      if (next === null) {
        state.finished = true;
        state.winnerUserId = side.userId;
        state.log.push(`🏆 Winner: <@${side.userId}>`);
        DB.saveBattle(channelId, state);
        await interaction.reply({ embeds: [embed("🏁 Battle Finished", battleSummary(state))] });
        DB.clearBattle(channelId);
        return;
      }
      state.log.push(`➡️ <@${opp.userId}> forced swap to slot ${next + 1}.`);
    }

    if (a.hp <= 0) {
      state.log.push(`💀 ${a.nickname ?? aSp.name} fainted from recoil!`);
      const next = forceSwapToNextAlive(side);
      if (next === null) {
        state.finished = true;
        state.winnerUserId = opp.userId;
        state.log.push(`🏆 Winner: <@${opp.userId}>`);
        DB.saveBattle(channelId, state);
        await interaction.reply({ embeds: [embed("🏁 Battle Finished", battleSummary(state))] });
        DB.clearBattle(channelId);
        return;
      }
      state.log.push(`➡️ <@${side.userId}> forced swap to slot ${next + 1}.`);
    }

    state.turnUserId = opp.userId;
    DB.saveBattle(channelId, state);
    await interaction.reply({ embeds: [embed("⚔️ Turn Resolved", battleSummary(state))] });
    return;
  }

  await interaction.reply({ content: "Unknown command handler.", ephemeral: true });
}

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    await handle(i);
  } catch (e: any) {
    console.error(e);
    if (i.deferred || i.replied) {
      await i.followUp({ content: `Error: ${e.message}`, ephemeral: true });
    } else {
      await i.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`Chudémon species count: ${SPECIES_COUNT}`);
  console.log(`Move count: ${MOVE_COUNT}`);
});

(async () => {
  await registerCommands();
  await client.login(process.env.DISCORD_TOKEN);
})();
