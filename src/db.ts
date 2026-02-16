// src/db.ts
import Database from "better-sqlite3";

export const db = new Database("chudemon.sqlite");

export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS owned (
      uid TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      species_id TEXT NOT NULL,
      nickname TEXT,
      level INTEGER NOT NULL,
      xp INTEGER NOT NULL,
      trait_id TEXT NOT NULL,
      moves_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS party (
      user_id TEXT PRIMARY KEY,
      slot1_uid TEXT,
      slot2_uid TEXT,
      slot3_uid TEXT
    );

    CREATE TABLE IF NOT EXISTS encounters (
      channel_id TEXT PRIMARY KEY,
      species_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS battle_invites (
      channel_id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS battles (
      channel_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function newUid() {
  return "ch_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function addOwned(o: {
  userId: string;
  speciesId: string;
  level: number;
  xp: number;
  traitId: string;
  moves: string[];
  nickname?: string;
}) {
  const uid = newUid();
  db.prepare(
    `INSERT INTO owned(uid, user_id, species_id, nickname, level, xp, trait_id, moves_json)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run(uid, o.userId, o.speciesId, o.nickname ?? null, o.level, o.xp, o.traitId, JSON.stringify(o.moves));
  return uid;
}

export function getOwned(uid: string) {
  return db.prepare(`SELECT * FROM owned WHERE uid = ?`).get(uid) as any | undefined;
}

export function listOwned(userId: string) {
  return db.prepare(`SELECT * FROM owned WHERE user_id = ? ORDER BY level DESC`).all(userId) as any[];
}

export function ensurePartyRow(userId: string) {
  db.prepare(`INSERT OR IGNORE INTO party(user_id, slot1_uid, slot2_uid, slot3_uid) VALUES(?,?,?,?)`)
    .run(userId, null, null, null);
}

export function getParty(userId: string) {
  ensurePartyRow(userId);
  return db.prepare(`SELECT * FROM party WHERE user_id = ?`).get(userId) as any;
}

export function setPartySlot(userId: string, slot: 1 | 2 | 3, uid: string | null) {
  ensurePartyRow(userId);
  const col = slot === 1 ? "slot1_uid" : slot === 2 ? "slot2_uid" : "slot3_uid";
  db.prepare(`UPDATE party SET ${col} = ? WHERE user_id = ?`).run(uid, userId);
}

export function setEncounter(channelId: string, speciesId: string, level: number) {
  db.prepare(`INSERT OR REPLACE INTO encounters(channel_id, species_id, level, created_at) VALUES(?,?,?,?)`)
    .run(channelId, speciesId, level, Date.now());
}

export function getEncounter(channelId: string) {
  return db.prepare(`SELECT * FROM encounters WHERE channel_id = ?`).get(channelId) as any | undefined;
}

export function clearEncounter(channelId: string) {
  db.prepare(`DELETE FROM encounters WHERE channel_id = ?`).run(channelId);
}

export function setInvite(channelId: string, fromUserId: string, toUserId: string) {
  db.prepare(`INSERT OR REPLACE INTO battle_invites(channel_id, from_user_id, to_user_id, created_at) VALUES(?,?,?,?)`)
    .run(channelId, fromUserId, toUserId, Date.now());
}

export function getInvite(channelId: string) {
  return db.prepare(`SELECT * FROM battle_invites WHERE channel_id = ?`).get(channelId) as any | undefined;
}

export function clearInvite(channelId: string) {
  db.prepare(`DELETE FROM battle_invites WHERE channel_id = ?`).run(channelId);
}

export function saveBattle(channelId: string, state: any) {
  db.prepare(`INSERT OR REPLACE INTO battles(channel_id, state_json, updated_at) VALUES(?,?,?)`)
    .run(channelId, JSON.stringify(state), Date.now());
}

export function loadBattle(channelId: string) {
  const row = db.prepare(`SELECT * FROM battles WHERE channel_id = ?`).get(channelId) as any | undefined;
  return row ? JSON.parse(row.state_json) : undefined;
}

export function clearBattle(channelId: string) {
  db.prepare(`DELETE FROM battles WHERE channel_id = ?`).run(channelId);
}
