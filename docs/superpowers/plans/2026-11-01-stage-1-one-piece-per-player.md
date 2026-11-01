# Stage 1 — One Piece Per Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-character tokens and "active character" with one piece per player, let the attacker pick the attacking character and the defender pick the receiving character, apply terrain bonuses by class, and hide the free-resource buttons behind a Debug toggle.

**Architecture:** Game data and pure rules move out of `game/game.js` into a new DOM-free `game/rules.js`, loaded by the browser before `game.js` (exposed as `window.Rules`) and by Node tests via `require` (`module.exports`). `game.js` keeps all UI, state and prompts and calls into `Rules`. State gains a per-player piece (`x`, `y`, `terrain`) and loses `activeIdx` and per-character position/terrain.

**Tech Stack:** Vanilla JS in the browser, zero dependencies, Node 18 built-in test runner (`node --test`), `node game/server.js` to play.

**Spec:** `docs/superpowers/specs/2026-11-01-turn-phases-design.md` (this plan covers "Rollout stages → 1" only).

## Global Constraints

- Keep the existing stack: vanilla JS, zero dependencies, `node server.js`, state saved in `localStorage`.
- Saves from the old (per-character token, active-character) format don't need to migrate; starting a new game is fine.
- `game/rules.js` must not touch `document`, `window` (except the final export line), `localStorage`, `alert`, `prompt` or `confirm`.
- Match `game.js` style: terse, one-liners where the file already uses them, sparse comments, `const`/arrow functions.
- Class names, exactly: `"Marksmen"`, `"Swordsmen"`, `"Mages"`, `"Brutes"`, `"Neutral"`.

## Review Focus

1. **Defender has one living character left** — no prompt appears; that character takes the hit. (Task 4 test: `livingChars` returns only living; `promptChoice` already auto-picks a single choice.)
2. **An eliminated player** must never be offered as a target or asked to pick a character for an area attack. (Task 4 test on `opponents`.)
3. **Cancelling a prompt mid-attack** — cancelling the target-player prompt aborts with no energy spent; cancelling the defender's prompt falls back to their first living character (the defender must take the hit). Energy is deducted only after all choices are made. (Task 4 manual check.)
4. **Natural Cover on a small hit** — a 2-damage hit on a Marksman in Forest deals 0, never negative. (Task 2 test.)
5. **A v1 save already in the browser** — page loads straight to Setup, no crash. (Task 3 test on `isCompatibleSave`.)

---

### Task 1: Extract data and class helpers into `rules.js`

**Files:**
- Create: `game/rules.js`
- Create: `game/test/rules.test.js`
- Modify: `game/game.js:8-153` (move out `ROSTER`, `TERRAINS`, `isSwordsman`, `isMage`, `CARDS`, `CARD_POOL`, `cardByName`, `buildDeck`; `ASSET`, `SAVE_KEY`, `PLAYER_COLORS` stay)
- Modify: `game/index.html` (add `<script src="rules.js"></script>` before `game.js`)

**Interfaces:**
- Produces (on `Rules`): `ROSTER`, `TERRAINS`, `CARDS`, `CARD_POOL`, `cardByName(name)`, `buildDeck()` — moved unchanged; `classOf(id: string) -> "Marksmen"|"Swordsmen"|"Mages"|"Brutes"|"Neutral"`.
- `game.js` opens with `const { ROSTER, TERRAINS, CARDS, CARD_POOL, cardByName, buildDeck, classOf } = Rules;` (later tasks add names to this line).
- `isSwordsman` / `isMage` are deleted; callers use `classOf(c.id)==="Swordsmen"` / `"Mages"`.

- [ ] **Step 1: Write the failing test** in `game/test/rules.test.js` using `node:test` and `node:assert/strict`, `const Rules = require("../rules.js");`

```js
test("classOf maps every roster character", () => {
  const want = { archer:"Marksmen", ballista:"Marksmen", knight:"Swordsmen", samurai:"Swordsmen",
    cleric:"Mages", necromancer:"Mages", berserker:"Brutes", titan:"Brutes", gambler:"Neutral", tactician:"Neutral" };
  for (const r of Rules.ROSTER) assert.equal(Rules.classOf(r.id), want[r.id], r.id);
  assert.equal(Rules.ROSTER.length, 10);
});
test("roster HP matches the rulebook", () => {
  const hp = Object.fromEntries(Rules.ROSTER.map(r => [r.id, r.hp]));
  assert.deepEqual(hp, { archer:20, ballista:20, knight:30, samurai:25, cleric:15, necromancer:20, berserker:30, titan:35, gambler:25, tactician:20 });
});
test("deck has one copy of every card", () => {
  assert.equal(Rules.buildDeck().length, Rules.CARD_POOL.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test game/test/rules.test.js`
Expected: FAIL — `Cannot find module '../rules.js'`

- [ ] **Step 3: Create `game/rules.js`** — an IIFE holding the moved data plus `classOf` (a lookup object keyed by roster id). Last line exports:

```js
if (typeof module === "object" && module.exports) module.exports = Rules; else window.Rules = Rules;
```

Delete the moved definitions from `game.js`, add the destructuring line, replace `isSwordsman(c)` / `isMage(c)` call sites with `classOf`, add the script tag to `index.html`.

- [ ] **Step 4: Run tests — expect PASS.** Then start `node game/server.js`, open http://localhost:5173, draft 2 players, start a game, use one attack: no console errors.

- [ ] **Step 5: Commit** — `git add game/ && git commit -m "Move game data into DOM-free rules.js with classOf"`

---

### Task 2: Class-based terrain modifiers

Today Eagle's View / Natural Cover only check `archer` and Unyielding Fury only `berserker`. The board text says Marksmen / Brutes.

**Files:**
- Modify: `game/rules.js`, `game/test/rules.test.js`
- Modify: `game/game.js` — `dealCombatDamage`, `dealSelfDamage`, `healCharacter`, Forest regen in `startTurn`

**Interfaces:**
- Produces (on `Rules`):
  - `combatDamage({ base, attackerId, attackerTerrain, defenderId, defenderTerrain, isAoe }) -> number` — Heated Edge (Swordsmen attacker in Volcano +2), Eagle's View (Marksmen attacker in Mountain, AOE only, +1), Natural Cover (Marksmen defender in Forest −2), floor at 0. Applied in that order.
  - `selfDamageAfterTerrain(charId, terrain, amount) -> number` — 0 for Brutes in Hot Spring, else `amount`.
  - `healAfterTerrain(charId, terrain, amount) -> number` — +1 for Mages in Hot Spring.
  - `startRegen(charId, terrain) -> number` — 2 for Swordsmen in Forest, else 0.
- `game.js` gets `terrainOf(ch) -> string|null`; in this task it returns `ch.terrain || null` (Task 3 changes it to the owner's piece). All four call sites pass `terrainOf(...)`. Titan's Gauntlet's `pendingBaseBonus` stays in `game.js`, added to `base` before calling `combatDamage`.

- [ ] **Step 1: Write the failing tests**

```js
const cd = (o) => Rules.combatDamage({ base:4, attackerId:"knight", attackerTerrain:null, defenderId:"knight", defenderTerrain:null, isAoe:false, ...o });
test("Heated Edge: Swordsmen +2 in Volcano", () => { assert.equal(cd({ attackerId:"samurai", attackerTerrain:"Volcano" }), 6); });
test("Eagle's View: Marksmen +1 on AOE in Mountain, includes Ballista", () => {
  assert.equal(cd({ attackerId:"ballista", attackerTerrain:"Mountain", isAoe:true }), 5);
  assert.equal(cd({ attackerId:"ballista", attackerTerrain:"Mountain", isAoe:false }), 4);
});
test("Natural Cover: Marksmen take -2 in Forest, never below 0", () => {
  assert.equal(cd({ defenderId:"ballista", defenderTerrain:"Forest" }), 2);
  assert.equal(cd({ base:2, defenderId:"archer", defenderTerrain:"Forest" }), 0);
  assert.equal(cd({ base:1, defenderId:"archer", defenderTerrain:"Forest" }), 0);
});
test("Unyielding Fury: Brutes ignore self-damage in Hot Spring, includes Titan", () => {
  assert.equal(Rules.selfDamageAfterTerrain("titan", "Hot Spring", 3), 0);
  assert.equal(Rules.selfDamageAfterTerrain("titan", "Forest", 3), 3);
});
test("Rejuvenating Waters: Mages +1 healing in Hot Spring", () => {
  assert.equal(Rules.healAfterTerrain("necromancer", "Hot Spring", 5), 6);
  assert.equal(Rules.healAfterTerrain("knight", "Hot Spring", 5), 5);
});
test("Forager's Resilience: Swordsmen regen 2 in Forest", () => {
  assert.equal(Rules.startRegen("samurai", "Forest"), 2);
  assert.equal(Rules.startRegen("archer", "Forest"), 0);
});
```

- [ ] **Step 2: Run — expect FAIL** (`Rules.combatDamage is not a function`).
- [ ] **Step 3: Implement the four functions in `rules.js`; rewire the four `game.js` call sites through `terrainOf`.**
- [ ] **Step 4: Run — expect PASS.** Browser: set a Ballista to Forest, hit it with a basic attack (2) → log shows `takes 0`.
- [ ] **Step 5: Commit** — `"Apply terrain bonuses by class (Marksmen, Swordsmen, Mages, Brutes)"`

---

### Task 3: One piece per player

**Files:**
- Modify: `game/rules.js`, `game/test/rules.test.js`
- Modify: `game/game.js` — `SAVE_KEY`, `loadState`, `#startBtn` handler, `startTurn`, `render` (realm selector, character row), `renderTokens`, `moveActiveTo`, `makeDraggable`, `swapPos`, Tracking Radar, `noMove`, `terrainOf`

**Interfaces:**
- Produces (on `Rules`):
  - `SAVE_VERSION = 2`
  - `isCompatibleSave(obj) -> boolean` — true only when `obj && obj.version === SAVE_VERSION && Array.isArray(obj.players)`.
  - `createPlayer({ name, color, charIds, seat }) -> Player` where `Player = { name, color, chars, energy:0, hand:[], supports:[], x, y, terrain:null, movedThisTurn:false, noMoveNext:false, attackDiscount:0, energySpentThisTurn:0 }`, `x = 120 + seat*180`, `y = 120 + seat*120`, and each char is `{ ...rosterDef, curHp: hp, alive: true }` (no `x`, `y`, `terrain`, `movedThisTurn`, `noMoveNext`).
- State: `newState` sets `version: Rules.SAVE_VERSION`. `SAVE_KEY` becomes `"quadrealm_save_v2"`. `activeIdx` is still present until Task 4 removes it — leave it alone here.
- `terrainOf(ch)` now returns the terrain of the player who owns `ch` (via `locate`).
- Moved to the player: `movedThisTurn` (set by drag/click-move, reset in `startTurn`), `noMoveNext` (Samurai sets it on the **target player**, Dark Resurrection on the **attacking player**), realm (`<select>` edits `p.terrain`, label "Your piece — Realm").
- `renderTokens` draws one token per player who has a living character: background = player colour, text = seat number, `title` = player name. Dead players' tokens are not drawn. The current player's token gets the `active-pawn` class. Rename `moveActiveTo` → `movePiece(tile)`.
- Chaos Swap swaps the attacking **player's** `x/y` with the target **player's**. Tracking Radar checks the target player's `movedThisTurn`.
- Forest regen in `startTurn`: every living Swordsman of the current player heals `startRegen(...)`.

- [ ] **Step 1: Write the failing tests**

```js
test("createPlayer puts the piece on the player, not the characters", () => {
  const p = Rules.createPlayer({ name:"P1", color:"#fff", charIds:["knight","cleric","titan"], seat:1 });
  assert.equal(p.x, 300); assert.equal(p.y, 240); assert.equal(p.terrain, null);
  assert.equal(p.energy, 0); assert.deepEqual(p.hand, []); assert.deepEqual(p.supports, []);
  assert.deepEqual(p.chars.map(c => [c.id, c.curHp, c.alive]), [["knight",30,true],["cleric",15,true],["titan",35,true]]);
  for (const c of p.chars) { assert.equal("x" in c, false); assert.equal("terrain" in c, false); }
});
test("isCompatibleSave rejects v1 and garbage", () => {
  assert.equal(Rules.isCompatibleSave({ version:2, players:[] }), true);
  assert.equal(Rules.isCompatibleSave({ players:[] }), false);
  assert.equal(Rules.isCompatibleSave(null), false);
  assert.equal(Rules.isCompatibleSave({ version:2 }), false);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `createPlayer`, `SAVE_VERSION`, `isCompatibleSave`; update `game.js` as listed.** `loadState` returns false (and clears the key) when `!Rules.isCompatibleSave(parsed)`; drop the old `looksOld` / per-field migration lines.
- [ ] **Step 4: Run — expect PASS.** Browser: with a v1 save present (play once on `main` first, or set `localStorage.quadrealm_save_v1`), reload → Setup screen, no errors. Start a 3-player game → exactly 3 tokens; dragging the current token snaps to a tile and only moves that player; setting realm to Forest heals each of that player's Swordsmen by 2 at their next turn start.
- [ ] **Step 5: Commit** — `"One piece per player; realm and movement live on the player"`

---

### Task 4: Attacker picks the character, defender picks who takes the hit

**Files:**
- Modify: `game/rules.js`, `game/test/rules.test.js`
- Modify: `game/game.js` — `render` (characters + attacks sections), `useAttack` and its `api`, `pickEnemyTarget`, `pickAllyTarget`, `cardApi`, `endTurn` (Priestess' Blessing), `renderTokens`, remove every `activeIdx` use

**Interfaces:**
- Produces (on `Rules`):
  - `livingChars(player) -> Char[]`
  - `opponents(state, currentIdx) -> number[]` — indices of other players with at least one living character, in seat order.
  - `hasLivingClass(player, cls) -> boolean`
  - `veilpiercerDamage(n) -> number` — `Math.floor(n/2)`.
- `game.js` helpers (UI, use `promptChoice`):
  - `pickOpponent() -> number|null` — target **player** index; `null` on cancel.
  - `chooseCharacter(pi, title) -> Char` — prompts with `title` over `livingChars(S.players[pi])`; on cancel/invalid returns the first living character. Used for defender choice, ally targets and "a character of your choice".
- `render`: no active highlight, no click-to-activate. "Attacks" section lists every living character as a sub-heading with its three attacks; `Use` calls `useAttack(char, atk)`.
- `useAttack(attacker, atk)` order: roll (if `needsRoll`) → target (`enemy`: `pickOpponent()` then, if the attacker's player has Veilpiercer and `confirm("Use Veilpiercer? You pick the character, half damage.")`, the attacker picks via `chooseCharacter`, else the defender picks via `chooseCharacter(pi, "<Defender name>: which character takes the hit?")`; `ally`: `chooseCharacter(S.current, ...)`) → cost check → pay → resolve. Abort with no energy spent only when `pickOpponent()` returns `null`.
- `api.dmg(n)` applies `veilpiercerDamage(n)` when Veilpiercer was used. `api.aoe(n)`: every opponent other than the target player picks one character. `api.aoeAll(n)` and `api.stealAll(n)`: every opponent picks one character (stealAll's heal amount unchanged — Stage 4).
- `cardApi`: `healActive` → heals `chooseCharacter(S.current, "Heal which character?")`; `selfDmgActive` → same with "Which character takes the self-damage?"; `isActiveMage()` replaced by `hasMage()` = `hasLivingClass(p,"Mages")` (update Mana Overflow); `aoeEnemies(n)` → every opponent picks one character. Rename the api keys to `healChosen` / `selfDmgChosen` and update the cards that use them.
- Priestess' Blessing in `endTurn`: heal 1 to `chooseCharacter(S.current, "Priestess' Blessing: heal which character?")`.
- Self-damage (`api.selfDmg`) always hits the attacking character.
- `renderTokens`' `active-pawn` keeps marking the current player's piece.

- [ ] **Step 1: Write the failing tests**

```js
const mk = (alive) => ({ chars: alive.map((a, i) => ({ id:["knight","cleric","titan"][i], alive:a })) });
test("livingChars returns only living characters", () => {
  assert.deepEqual(Rules.livingChars(mk([true,false,true])).map(c => c.id), ["knight","titan"]);
});
test("opponents skips the current player and eliminated players", () => {
  const S = { players: [mk([true,true,true]), mk([false,false,false]), mk([false,true,false]), mk([true,true,true])] };
  assert.deepEqual(Rules.opponents(S, 0), [2,3]);
  assert.deepEqual(Rules.opponents(S, 3), [0,2]);
});
test("hasLivingClass checks living characters only", () => {
  assert.equal(Rules.hasLivingClass(mk([true,true,true]), "Mages"), true);
  assert.equal(Rules.hasLivingClass(mk([true,false,true]), "Mages"), false);
});
test("veilpiercerDamage halves, rounding down", () => {
  assert.equal(Rules.veilpiercerDamage(5), 2); assert.equal(Rules.veilpiercerDamage(1), 0);
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement the four `Rules` functions and the `game.js` changes listed.** `grep -n activeIdx game/game.js` must return nothing afterwards.
- [ ] **Step 4: Run — expect PASS.** Browser checks:
  - Player 1's Archer uses Heavy Arrow on Player 2 → Player 2 is prompted to choose; damage lands on their pick.
  - Defender with one living character → no defender prompt.
  - Cancel the target-player prompt → energy unchanged. Cancel the defender prompt → first living character is hit.
  - Exploding Arrow in a 3-player game → target's pick takes 4, the third player picks one character for 2.
  - Eliminated player is never offered as a target.
- [ ] **Step 5: Commit** — `"Attacker picks attacking character, defender picks who takes the hit"`

---

### Task 5: Debug toggle

**Files:**
- Modify: `game/index.html` (topbar), `game/game.js` (`newState`, `render`), `game/styles.css` if needed

**Interfaces:**
- State: `S.debug` (boolean, default `false`, saved with the game).
- Topbar: `<label><input type="checkbox" id="debugToggle"> Debug</label>` before `Calibrate`; toggling sets `S.debug` and re-renders.
- When `S.debug` is false, `render` omits: energy `+1` / `−1` buttons, `Draw +1`, and the whole "Manual Damage / Heal" section. `Discard→+1⚡` always shows (it's a rule).

- [ ] **Step 1: Implement.** (UI-only; no pure logic to unit-test.)
- [ ] **Step 2: Verify in browser** — Debug off: the four controls are absent; Debug on: present and working; reload keeps the setting. `node --test game/test/rules.test.js` still passes.
- [ ] **Step 3: Commit** — `"Hide free-resource buttons behind a Debug toggle"`

---

### Task 6: Stage 1 playthrough and push

- [ ] **Step 1:** `node --test game/test/rules.test.js` — all pass.
- [ ] **Step 2:** Browser: full 2-player game to a winner, with Debug off, using at least one attack from each class, one support equip, one event card. No console errors (check DevTools console).
- [ ] **Step 3:** `git push`
