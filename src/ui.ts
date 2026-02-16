// src/ui.ts
import { EmbedBuilder } from "discord.js";

export function embed(title: string, description: string) {
  return new EmbedBuilder().setTitle(title).setDescription(description);
}

export function fmtTypes(types: string[]) {
  return types.map((t) => `\`${t}\``).join(" ");
}

export function bar(current: number, max: number, len = 14) {
  const filled = Math.round((current / max) * len);
  const empty = len - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty)) + `  **${current}/${max}**`;
}
