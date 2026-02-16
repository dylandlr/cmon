# Chudémon Discord Bot

A Pokémon-style Discord battle/catch game, but it's **Chudémon** (discord brain-rot creatures).

## Features
- 128 Chudémon (40 evo families x3 + 8 legendaries)
- **260+ moves** with **60+ signature-exclusive moves**
- 12 battle types (includes **Soy** + **Chad**) with a counter ring
- Dual-types, hazards, statuses
- 3v3 team battles with invites + swapping
- SQLite persistence (better-sqlite3)

## Setup
1. Create a Discord Application + Bot, then copy:
   - Bot token
   - Application client ID
2. Create `.env`:
   ```bash
   cp .env.example .env
   ```
3. Install deps:
   ```bash
   npm i
   ```
4. Run dev:
   ```bash
   npm run dev
   ```

## Commands
- `/chud_count`
- `/move_count`
- `/explore`
- `/catch`
- `/owned`
- `/party`
- `/setparty slot:<1-3> uid:<owned_uid|none>`
- `/duel user:@someone`
- `/accept`
- `/attack move:<Move Name>`
- `/swap slot:<1-3>`
- `/forfeit`

## Notes
- Legendaries are **extremely** rare: weight 1 vs commons weight 7000.
- Signature moves are forced into default movesets when catching a species that has one.
