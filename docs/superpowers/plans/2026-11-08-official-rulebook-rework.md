# Official Rulebook Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the playtest app follow `Official-Rulebook.md` v0.1 and the user's rulings: team HP, one active character, an enforced turn order, passive board bonuses, range counting and the listed card effects.

**Architecture:** Game logic moves from `game/game.js` into DOM-free `game/rules.js`. Anything that needs a player's decision goes through an injected `ui` object, so Node tests can drive it with a stub. `game.js` keeps rendering and supplies the real `ui` using `prompt`, `confirm` and `alert`.

**Tech Stack:** Vanilla JS, no dependencies, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-08-official-rulebook-rework-design.md`. Read it first: it holds the rulings, the card behaviour table and the calls made. "Q" numbers follow its Rulings table.

## Global Constraints

- Vanilla JS, no dependencies, `node game/server.js`, state in `localStorage`.
- `SAVE_VERSION = 4`, `SAVE_KEY = "quadrealm_save_v4"`. Old saves need no migration.
- `game/rules.js` must not touch `document`, `window` (except the final export line), `localStorage`, `alert`, `prompt` or `confirm`.
- Everything in `S` must survive `JSON.stringify`: no functions in saved state.
- Match the file's style: terse, sparse comments, `const` and arrow functions.
- Type names, exactly: `"Long Range"`, `"Close Range"`, `"Mage"`, `"Brute"`, `"Wildcard"`.
- Test command: `node --test game/test/rules.test.js`.
- Do not push, and do not post to the PR, unless the user says so.

## Review Focus

Each has a test in the task shown.

1. **A roll of the die landing on Lose 3 Health kills the current player:** their turn ends with no further prompts. (Task 7)
2. **Relentless Assault when the first hit's self-damage eliminates the attacker, or no opponents remain:** the free skill is skipped with no prompt. (Task 6)
3. **0 energy at a realm entrance:** the outer lane isn't offered, and cancelling the lane prompt takes the middle lane. (Task 2)
4. **Empty deck and empty discard, or a full hand, when drawing:** no crash, and the hand stays at 6 or less. (Task 1)
5. **Reloading mid-turn:** phase, effects and flags survive a JSON round trip. (Task 8)

---

### Task 1: Team HP and active character

**Files:**
- Modify: `game/rules.js`, `game/game.js`, `game/index.html`, `game/test/rules.test.js`

**Interfaces:**
- Produces on `Rules`:
  - `typeOf(id) -> type name` (replaces `classOf`), `activeChar(p) -> char`, `activeType(p) -> type name`
  - `createPlayer({ name, color, charIds, activeIdx }) -> Player`, with `hp`, `maxHp`, `activeIdx`, `effects:[]`, `pos` on Embark, `energy:0`, `attackDiscount:0`, `nextAttackBonus:0`, and `actionUsed`, `attackedThisTurn`, `usedBasicThisTurn`, `movedThisTurn`, `noMoveNext` all false. Characters are roster copies with no `curHp` or `alive`.
  - `isOut(p) -> p.hp <= 0`, `opponents(S, pi) -> number[]`
  - `heal(p, n) -> number healed`: adds Rejuvenating Waters, caps at `maxHp`. Note that Forager's Resilience also goes through it.
  - `loseHp(p, n)`: floors at 0. `selfDamage(p, n)`: 0 under Unyielding Fury, otherwise `loseHp`.
  - `startRegen(p) -> 2` for an active Close Range in Forest, else 0.
  - `drawCards(S, p, n)`, `shuffle(a)`: moved from `game.js`.
  - `distinctTypes(p) -> number`
- Removes: `classOf`, `livingChars`, `hasLivingClass`, `veilpiercerDamage`, `chooseCharacter`, the `ally` attack target, `healChosen`, `selfDmgChosen`, `Veilpiercer`'s prompt.
- Test helpers, used by later tasks, at the top of `rules.test.js`:
  - `mkGame(charIdsPerPlayer, overrides) -> S`, with `version: SAVE_VERSION`, `current: 0`, a full deck and an empty discard.
  - `stubUi({ picks, rolls, confirms }) -> ui`, returning scripted answers in order, recording prompts in `ui.asked` and counting rolls in `ui.rollCount`.

- [ ] **Step 1: Write the failing tests.** Replace the old `classOf`, `createPlayer`, `livingChars`, `opponents`, `hasLivingClass` and `veilpiercerDamage` tests.

```js
test("createPlayer pools HP on the player", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["knight","cleric","titan"], activeIdx:1 });
  assert.equal(p.hp, 80); assert.equal(p.maxHp, 80); assert.equal(Rules.activeChar(p).id, "cleric");
  assert.equal("curHp" in p.chars[0], false);
});
test("typeOf uses the rulebook's names", () => {
  assert.equal(Rules.typeOf("ballista"), "Long Range"); assert.equal(Rules.typeOf("samurai"), "Close Range");
  assert.equal(Rules.typeOf("titan"), "Brute"); assert.equal(Rules.typeOf("gambler"), "Wildcard");
});
test("healing stops at starting HP; +1 only for an active Mage in Hot Spring", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["cleric","knight","titan"], activeIdx:0 });
  p.hp = 70; p.pos = "0,5"; assert.equal(Rules.heal(p, 2), 3); assert.equal(p.hp, 73);
  p.activeIdx = 1; p.hp = 79; assert.equal(Rules.heal(p, 5), 1); assert.equal(p.hp, 80);
});
test("Unyielding Fury needs an active Brute in Hot Spring", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["titan","knight","cleric"], activeIdx:0 });
  p.pos = "0,5"; Rules.selfDamage(p, 3); assert.equal(p.hp, p.maxHp);
  p.activeIdx = 1; Rules.selfDamage(p, 3); assert.equal(p.hp, p.maxHp - 3);
});
test("Forager's Resilience needs an active Close Range in Forest", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["knight","samurai","titan"], activeIdx:0 });
  p.pos = "15,10"; assert.equal(Rules.startRegen(p), 2);
  p.activeIdx = 2; assert.equal(Rules.startRegen(p), 0);
});
test("Strategic Reserve counts distinct types, not ids", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["knight","samurai","titan"], activeIdx:0 });
  assert.equal(Rules.distinctTypes(p), 2);
});
test("drawing with no cards left, or a full hand, is safe", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]);
  S.deck = []; S.discard = []; Rules.drawCards(S, S.players[0], 2); assert.equal(S.players[0].hand.length, 0);
  S.deck = ["a","b"]; S.players[0].hand = ["1","2","3","4","5","6"];
  Rules.drawCards(S, S.players[0], 1); assert.equal(S.players[0].hand.length, 6);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL (`Rules.typeOf is not a function`).
- [ ] **Step 3: Implement the `rules.js` changes.** Set `SAVE_VERSION = 4` and update the `isCompatibleSave` test. Rename card `cls` tags to the type names, and add Mage to Mana Overflow and Long Range to Arrow Rain. Update card texts that refer to living characters to match §10–11.
- [ ] **Step 4: Rewire `game.js`.** Set `SAVE_KEY`. Add an active-character choice per seat at setup, defaulting to the first pick. Show one team HP bar and highlight the active character. List only the active character's attacks. Debug's damage and heal act on `p.hp` and can't revive anyone.
- [ ] **Step 5: Run the tests.** Expected: PASS. Start a 2-player game in the browser and make one attack with no console errors.
- [ ] **Step 6: Commit** — `"Team HP pool and one active character"`

---

### Task 2: Lanes, passive space bonuses, move back

**Files:** Modify `game/rules.js`, `game/game.js`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `heal`, `loseHp`, `drawCards`, the Task 1 test helpers.
- Produces on `Rules`:
  - `laneChoices(p, opts) -> opts`: drops energy-costing lanes the player can't pay.
  - `moveForward(S, p, n, ui)`: asks `ui.chooseLane(choices) -> option|null`; null means the middle lane.
  - `moveBack(p, n)`
  - `landOn(S, p, ui)`: applies the current space's one-off effect. Move back recurses into `landOn`.
  - `moveByCard(S, p, n, ui)`: as `moveForward`, with no `landOn` (Q2).
  - `spaceDamageBonus(pos, kind) -> number`, with `kind` one of `"basic"`, `"skill"`, `"ultimate"`
  - `spaceCostCut(pos) -> 0|1`
  - `onDoubleSpace(p) -> boolean`: on the space and `p.doubleUsedAt !== p.pos`.
- `ui` gains `chooseLane`, `chooseCard(hand, title) -> index|null`, `chooseChar(p, title) -> index|null`, `log(msg)`.
- Removes: `dmgBuffs`, `costCut`, `doubleEvent`, `dmgBuff`, `costBuff`, `doubleNextEvent`, `changeCharacter`.
- `SPACE_EFFECTS` keeps only one-off spaces. "Change your character" optionally sets `activeIdx` through `ui.chooseChar`, with no action used.

- [ ] **Step 1: Write the failing tests.** Update the old lane, "every space text has an effect" and `dmgBuff` tests to match. Passive texts no longer have an effect, so list them as exempt.

```js
test("outer lane costs 1, inner gives 1", () => {
  assert.deepEqual(Rules.nextOptions("8,0").map(o => [o.to, o.energy]), [["10,0",-1],["10,1",0],["9,1",1]]);
});
test("outer lane is not offered at 0 energy; cancel takes the middle lane", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  p.pos = "8,0"; p.energy = 0;
  assert.deepEqual(Rules.laneChoices(p, Rules.nextOptions("8,0")).map(o => o.energy), [0,1]);
  Rules.moveForward(S, p, 1, stubUi({ picks:[null] })); assert.equal(p.pos, "10,1");
});
test("space bonuses are passive and follow the piece", () => {
  assert.equal(Rules.spaceDamageBonus("11,13", "basic"), 1); assert.equal(Rules.spaceDamageBonus("11,13", "skill"), 0);
  assert.equal(Rules.spaceDamageBonus("1,4", "ultimate"), 1); assert.equal(Rules.spaceCostCut("12,13"), 1);
  assert.equal(Rules.spaceDamageBonus("7,0", "basic"), 0);
});
test("move back triggers the space it lands on", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  p.pos = "4,3"; p.trail = ["3,4"]; p.energy = 3;
  Rules.landOn(S, p, stubUi({})); assert.equal(p.pos, "3,4"); assert.equal(p.energy, 1);
});
test("a card move does not trigger the landing space", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  const hp = p.hp; p.pos = "13,5"; p.energy = 3;
  Rules.moveByCard(S, p, 1, stubUi({})); assert.equal(p.pos, "14,6"); assert.equal(p.hp, hp); assert.equal(p.energy, 3);
});
test("Change your character switches for free", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  p.pos = "13,5"; Rules.landOn(S, p, stubUi({ picks:[2] })); assert.equal(p.activeIdx, 2); assert.equal(p.actionUsed, false);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement in `rules.js`.** Move movement and landing out of `game.js`. Set `p.movedThisTurn` on any move.
- [ ] **Step 4: Rewire `game.js`.** Lane labels: outer "costs 1 energy", middle "free", inner "gives 1 energy". Show the current space's passive bonus instead of the stored buffs list.
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Commit** — `"Reverse lane energy, passive space bonuses, move back triggers"`

---

### Task 3: Distance

**Files:** Modify `game/rules.js`, `game/test/rules.test.js`

**Interfaces:** Produces `Rules.distance(a, b) -> number`, the shortest path per the spec's Distance section. Keep lane membership by storing `lane` on each space when building `SPACES`. `Rules.withinRange(S, pi, n) -> number[]` gives opponents within `n`.

- [ ] **Step 1: Write the failing tests.**

```js
test("distance crosses lanes through shared edges", () => {
  assert.equal(Rules.distance("12,2", "12,4"), 2);
  assert.equal(Rules.distance("12,2", "12,3"), 1);
  assert.equal(Rules.distance("12,2", "12,2"), 0);
});
test("distance uses the shorter way around the loop", () => {
  assert.equal(Rules.distance("6,0", "5,1"), 1);
  assert.equal(Rules.distance("6,0", "8,0"), 2);
});
test("every lane space has a crossing neighbour", () => {
  for (const s of Object.values(Rules.SPACES)) if (s.realm) {
    const near = Object.values(Rules.SPACES).filter(o => o.realm === s.realm && o.lane !== s.lane && Rules.distance(s.id, o.id) === 1);
    assert.ok(near.length > 0, s.id);
  }
});
test("crossing edges are for counting only: movement stays in the lane", () => {
  assert.deepEqual(Rules.nextOptions("12,2").map(o => o.to), ["13,3"]);
});
test("withinRange filters opponents", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]);
  S.players[0].pos = "6,0"; S.players[1].pos = "8,0"; S.players[2].pos = "15,7";
  assert.deepEqual(Rules.withinRange(S, 0, 2), [1]);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Build the graph once at load, with breadth-first search per call.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `"Add range counting across lanes"`

---

### Task 4: Damage pipeline

**Files:** Modify `game/rules.js`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `activeType`, `spaceDamageBonus`.
- Produces `Rules.combatDamage({ base, attacker, defender, kind, isArea }) -> number`, taking players. Order: base → attacker's realm (Heated Edge +2, Eagle's View +1 if `isArea`) → defender's realm (Natural Cover −2) → supports (The Titan's Gauntlet +1 if basic) → `spaceDamageBonus` → events (`attacker.nextAttackBonus`, Unyielding Strength −2 on the defender). Floor at 0 only at the end. Pure: consuming one-shot effects is Task 6's job.

- [ ] **Step 1: Write the failing tests.** Replace the old `combatDamage` tests.

```js
const pl = (ids, pos, active=0) => { const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:ids, activeIdx:active }); p.pos = pos; return p; };
const CD = (attacker, defender, o) => Rules.combatDamage({ base:4, attacker, defender, kind:"skill", isArea:false, ...o });
const none = ["knight","cleric","titan"];
test("realm effects read the active character only", () => {
  assert.equal(CD(pl(["samurai","cleric","titan"],"4,14"), pl(none,"7,0")), 6);
  assert.equal(CD(pl(["samurai","cleric","titan"],"4,14",1), pl(none,"7,0")), 4);
});
test("Eagle's View is for area attacks; every target gets it", () => {
  const a = pl(["ballista","cleric","titan"],"10,1");
  assert.equal(CD(a, pl(none,"7,0"), { isArea:true }), 5); assert.equal(CD(a, pl(none,"7,0")), 4);
});
test("the floor applies only at the end", () => {
  const a = pl(none,"11,13"), d = pl(["archer","cleric","titan"],"15,10");
  assert.equal(CD(a, d, { base:2, kind:"basic" }), 1);
  assert.equal(CD(a, d, { base:0, kind:"basic" }), 0);
});
test("bonuses stack in order", () => {
  const a = pl(["samurai","cleric","titan"],"4,12"); a.supports = ["The Titan's Gauntlet"];
  assert.equal(CD(a, pl(none,"7,0"), { kind:"basic", base:2 }), 6);
});
test("Wildcards are never affected", () => {
  assert.equal(CD(pl(["gambler","cleric","titan"],"4,14"), pl(["tactician","cleric","titan"],"15,10")), 4);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement,** and update the call in `game.js` so it still runs.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `"Ordered damage pipeline"`

---

### Task 5: Turn phases

**Files:** Modify `game/rules.js`, `game/game.js`, `game/index.html`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `moveForward`, `landOn`, `heal`, `startRegen`, `drawCards`.
- Produces on `Rules`:
  - `startTurn(S, ui)`: resets flags (`movedThisTurn`, `actionUsed`, `attackedThisTurn`, `usedBasicThisTurn`, `energySpentThisTurn`), gains energy, draws, applies Forager, records `p.startTurnHp` after it, and sets `S.phase` to `"Move"`, or `"Main"` if `noMoveNext`.
  - `roll(S, n, ui)`: moves, lands, sets `S.phase = "Main"`.
  - `skipMove(S)`: `"Move"` to `"Main"` with no roll.
  - `allowed(S) -> { roll, cards, switchChar, attack, end, events }`
  - `switchActive(S, idx)`: uses the action, sets `"After"`.
  - `endTurn(S, ui)`: runs Priestess' Blessing, passes to the next player not out, calls `startTurn`.
- `S.phase` values, exactly: `"Move"`, `"Main"`, `"After"`.

- [ ] **Step 1: Write the failing tests.**

```js
const two = () => mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]);
test("a turn runs Move, Main, After", () => {
  const S = two(); Rules.startTurn(S, stubUi({})); const p = S.players[0];
  assert.equal(S.phase, "Move"); assert.deepEqual(Rules.allowed(S), { roll:true, cards:false, switchChar:false, attack:false, end:false, events:true });
  Rules.roll(S, 1, stubUi({})); assert.equal(S.phase, "Main");
  assert.deepEqual(Rules.allowed(S), { roll:false, cards:true, switchChar:true, attack:true, end:true, events:true });
  Rules.switchActive(S, 1); assert.equal(p.activeIdx, 1); assert.equal(S.phase, "After");
  assert.deepEqual(Rules.allowed(S), { roll:false, cards:false, switchChar:false, attack:false, end:true, events:true });
});
test("a player who cannot move skips to Main and can end their turn", () => {
  const S = two(); S.players[0].noMoveNext = true; Rules.startTurn(S, stubUi({}));
  assert.equal(S.phase, "Main"); assert.equal(Rules.allowed(S).end, true); assert.equal(S.players[0].noMoveNext, false);
});
test("start-of-turn HP is recorded after Forager heals", () => {
  const S = mkGame([["knight","samurai","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  p.hp = 4; p.pos = "15,10"; Rules.startTurn(S, stubUi({})); assert.equal(p.startTurnHp, 6);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement in `rules.js`.**
- [ ] **Step 4: Rewire `game.js`.** Show the phase in `#phaseLabel`. Disable buttons from `allowed(S)`. Add a Switch control listing the other two characters. `Discard→+1⚡` asks which card, through `ui.chooseCard`. Equip and unequip follow `allowed(S).cards`. `#endTurnBtn` follows `allowed(S).end`. Debug may reroll in Main, and nothing else bypasses `allowed`.
- [ ] **Step 5: Run the tests.** Expected: PASS. In the browser, confirm Attack and End Turn stay disabled until you roll.
- [ ] **Step 6: Commit** — `"Enforce the turn order"`

---

### Task 6: Attack flow

**Files:** Modify `game/rules.js`, `game/game.js`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `combatDamage`, `spaceCostCut`, `spaceDamageBonus`, `heal`, `selfDamage`, `opponents`, `activeChar`.
- Produces on `Rules`:
  - `attackCost(p, atkIndex, roll, free) -> number`: base or `costOf`, minus Arcane Efficiency, `p.attackDiscount` and `spaceCostCut`, floored at 0; 0 if `free`.
  - `attackFlow(S, atkIndex, ui) -> "done"|"cancelled"|"unaffordable"`: the spec's Attack order. `ui` gains `choosePlayer(pis, title) -> pi|null`, `roll() -> 1..6`, `confirm(title) -> boolean`.
  - `moltenDamage(heal) -> Math.floor(heal*3/2)`
- Roster `resolve(a)` API: `a.hit(n)`, `a.splash(n)` (other opponents in the target's realm), `a.drain(n, healEach)` (opponents in your realm), `a.hitAll(n)`, `a.steal(n)`, `a.heal(n)`, `a.selfDmg(n)`, `a.draw(n)`, `a.noMove(player)`, `a.swap()`, `a.log(m)`, plus `a.target`, `a.player`, `a.roll`, `a.energyUsed`, `a.targetMoved`.
- Mark area attacks with `area:true`, and every hit from them passes `isArea:true`: Exploding Arrow, Piercing Spear, Spirit Drain, Landmine. Change Spirit Drain, Landmine and Potion Blast to `target:"none"`. Game of Dice's `costOf` uses `Math.floor(roll/2)`. Chaos Swap uses `a.swap()`, which triggers no landing (Q2). A `null` realm matches nobody, so splash and drain hit no one in a corridor.
- `attackFlow` calls `ui.choosePlayer` only when there is more than one option. With one opponent it picks them without asking.
- Sets `p.actionUsed`, `p.attackedThisTurn`, `p.usedBasicThisTurn`, `p.energySpentThisTurn`, and `S.phase = "After"`.

- [ ] **Step 1: Write the failing tests.**

```js
const game = (a, d, o={}) => { const S = mkGame([a,d,...(o.more||[])]); S.phase = "Main"; S.players.forEach(p => p.pos = "7,0"); return S; };
test("cancelling the target never rolls", () => {
  const S = game(["gambler","cleric","titan"],["archer","knight","berserker"],{ more:[["samurai","ballista","tactician"]] }); S.players[0].energy = 4;
  const ui = stubUi({ picks:[null], rolls:[6] });
  assert.equal(Rules.attackFlow(S, 2, ui), "cancelled"); assert.equal(ui.rollCount, 0); assert.equal(S.players[0].energy, 4); assert.equal(S.phase, "Main");
});
test("Game of Dice: cost rounds down; an unaffordable roll uses the action", () => {
  const S = game(["gambler","cleric","titan"],["archer","knight","berserker"]); const p = S.players[0], d = S.players[1];
  p.energy = 1; const hp = d.hp;
  assert.equal(Rules.attackFlow(S, 1, stubUi({ rolls:[6] })), "unaffordable");
  assert.equal(p.energy, 1); assert.equal(d.hp, hp); assert.equal(S.phase, "After");
  S.phase = "Main"; assert.equal(Rules.attackCost(p, 1, 3, false), 1);
});
test("splash hits other opponents in the target's realm only", () => {
  const S = game(["archer","cleric","titan"],["knight","gambler","berserker"],{ more:[["samurai","ballista","tactician"],["cleric","knight","titan"]] });
  const [p,t,same,far] = S.players; p.energy = 4; t.pos = "10,1"; same.pos = "12,3"; far.pos = "4,14";
  const [a,b,c] = [t.hp,same.hp,far.hp]; Rules.attackFlow(S, 2, stubUi({ picks:[1] }));
  assert.deepEqual([a-t.hp, b-same.hp, c-far.hp], [4,2,0]);
});
test("Piercing Spear in Mountain gives +1 to every target", () => {
  const S = game(["ballista","cleric","titan"],["knight","gambler","berserker"],{ more:[["samurai","archer","tactician"]] });
  const [p,t,o] = S.players; p.energy = 3; p.pos = "10,1"; t.pos = "11,2"; o.pos = "12,3"; const [a,b] = [t.hp,o.hp];
  Rules.attackFlow(S, 1, stubUi({ picks:[1] })); assert.deepEqual([a-t.hp, b-o.hp], [4,4]);
});
test("Spirit Drain hits your realm and heals per opponent hit", () => {
  const S = game(["necromancer","knight","titan"],["archer","gambler","berserker"],{ more:[["samurai","ballista","tactician"],["cleric","knight","titan"]] });
  const [p,a,b,far] = S.players; p.energy = 4; p.hp = 50; p.pos = "10,1"; a.pos = "11,2"; b.pos = "12,3"; far.pos = "7,0"; const h = far.hp;
  Rules.attackFlow(S, 1, stubUi({})); assert.equal(p.hp, 54); assert.equal(far.hp, h);
});
test("Spirit Drain from a corridor hits nobody and doesn't crash", () => {
  const S = game(["necromancer","knight","titan"],["archer","gambler","berserker"]); const p = S.players[0]; p.energy = 4; p.hp = 50;
  assert.equal(Rules.attackFlow(S, 1, stubUi({})), "done"); assert.equal(p.hp, 50);
});
test("Landmine hits every opponent, wherever they are", () => {
  const S = game(["tactician","knight","titan"],["archer","gambler","berserker"],{ more:[["samurai","ballista","cleric"]] });
  const [p,a,b] = S.players; p.energy = 3; a.pos = "4,14"; const [x,y] = [a.hp,b.hp];
  Rules.attackFlow(S, 2, stubUi({})); assert.deepEqual([x-a.hp, y-b.hp], [5,5]);
});
test("steal heals only the damage dealt", () => {
  const S = game(["necromancer","knight","titan"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.energy = 5; p.hp = 40; d.hp = 3; Rules.attackFlow(S, 2, stubUi({})); assert.equal(p.hp, 43); assert.equal(p.noMoveNext, true);
});
test("Molten Power turns an attack's healing into damage", () => {
  assert.equal(Rules.moltenDamage(5), 7); assert.equal(Rules.moltenDamage(2), 3);
  const S = game(["cleric","knight","titan"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.energy = 3; p.hp = 50; p.pos = "4,14"; const h = d.hp; Rules.attackFlow(S, 1, stubUi({}));
  assert.equal(p.hp, 50); assert.equal(h - d.hp, 5);
});
test("Potion Blast asks for a target only under Molten Power", () => {
  const S = game(["cleric","knight","titan"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.energy = 4; p.hp = 50; Rules.attackFlow(S, 2, stubUi({})); assert.equal(p.hp, 56);
  S.phase = "Main"; p.energy = 4; p.pos = "4,14"; const h = d.hp; Rules.attackFlow(S, 2, stubUi({}));
  assert.equal(h - d.hp, 9); assert.equal(p.hp, 56);
});
test("Relentless Assault: one free skill, new target, no retrigger", () => {
  const S = game(["berserker","knight","cleric"],["archer","gambler","titan"],{ more:[["samurai","ballista","tactician"]] });
  const [p,a,b] = S.players; p.pos = "10,1"; p.energy = 0; const [x,y,h] = [a.hp,b.hp,p.hp];
  Rules.attackFlow(S, 0, stubUi({ picks:[1,2] }));
  assert.deepEqual([x-a.hp, y-b.hp, h-p.hp], [2,4,1]); assert.equal(p.energy, 0);
});
test("Relentless Assault is skipped if the attacker died or no opponents remain", () => {
  const S = game(["titan","knight","cleric"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.pos = "10,1"; p.hp = 1; const ui = stubUi({}); Rules.attackFlow(S, 0, ui);
  assert.equal(p.hp, 0); assert.equal(d.maxHp - d.hp, 3); assert.equal(ui.asked.length, 0);
});
test("one action: the phase blocks a second attack", () => {
  const S = game(["knight","cleric","titan"],["archer","gambler","berserker"]); Rules.attackFlow(S, 0, stubUi({}));
  assert.equal(S.phase, "After"); assert.equal(Rules.allowed(S).attack, false);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement `attackFlow` and the roster API in `rules.js`.** Collect all healing while an attack resolves when Molten Power applies, then convert the total once. The target is the attack's target, or `ui.choosePlayer` if it has none. `targetMoved` keeps reading the target's `movedThisTurn`. Remove `pendingBaseBonus`.
- [ ] **Step 4: Replace `useAttack` in `game.js`** with a call to `attackFlow`, using the real `ui`.
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Commit** — `"Attack flow: no rerolls, area rules, Molten Power, Relentless Assault"`

---

### Task 7: Elimination and winning

**Files:** Modify `game/rules.js`, `game/game.js`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `isOut`, `opponents`.
- Produces on `Rules`:
  - `settle(S, { attackerPi, defenderPis }) -> { winner: pi|null, currentOut: boolean }`: marks new eliminations (`p.out = true`, hand and supports to `S.discard`), then sets `S.winner` if one player is left, or by energy then defender if none are.
  - `attackFlow`, `landOn` callers and event play call it after resolving. `S.winner` stops all further input.
- Tie rule (spec call 6): among defenders tied on the highest energy, the first clockwise from the attacker wins.

- [ ] **Step 1: Write the failing tests.**

```js
test("an eliminated player's cards are discarded and they can't be targeted", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]); const d = S.players[1];
  d.hand = ["x"]; d.supports = ["y"]; d.hp = 0; Rules.settle(S, { attackerPi:0, defenderPis:[1] });
  assert.deepEqual(d.hand, []); assert.deepEqual(d.supports, []); assert.ok(S.discard.includes("x") && S.discard.includes("y"));
  assert.deepEqual(Rules.opponents(S, 0), [2]); assert.equal(S.winner ?? null, null);
});
test("last player standing wins", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); S.players[1].hp = 0;
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[1] }).winner, 0);
});
test("dying together: most energy wins, then the defender", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const [a,d] = S.players;
  a.hp = 0; d.hp = 0; a.energy = 2; d.energy = 1;
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[1] }).winner, 0);
  const T = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); T.players.forEach(p => { p.hp = 0; p.energy = 1; });
  assert.equal(Rules.settle(T, { attackerPi:0, defenderPis:[1] }).winner, 1);
});
test("Lose 3 Health can end your own turn with no more prompts", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]); const p = S.players[0];
  p.hp = 3; p.pos = "10,13"; const ui = stubUi({}); Rules.landOn(S, p, ui);
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[] }).currentOut, true); assert.equal(ui.asked.length, 0);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement,** and when `currentOut` is true, pass the turn to the next player.
- [ ] **Step 4: Rewire `game.js`.** Show the winner when `S.winner` is set, and disable play. Remove the win check from the old `endTurn`.
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Commit** — `"Elimination and win resolution"`

---

### Task 8: Cards

**Files:** Modify `game/rules.js`, `game/game.js`, `game/test/rules.test.js`

**Interfaces:**
- Consumes: `attackFlow`, `withinRange`, `heal`, `selfDamage`, `activeType`, `onDoubleSpace`, `skipMove`, `settle`.
- Produces on `Rules`:
  - `playEvent(S, handIdx, ui) -> boolean`: warns through `ui.confirm` when a type card won't work and returns false if declined; otherwise discards it, applies it (twice if `onDoubleSpace`, then sets `p.doubleUsedAt = p.pos`), records `S.lastEvent`, and calls `settle`.
  - `typeActive(p, def) -> boolean`
  - `addEffect(p, { card, until, ... })`: `until` is `"nextTurn"` or `"endOfTurn"`. Effects are plain data keyed by card name. `startTurn` drops `"nextTurn"` entries of the current player, and `endTurn` resolves and drops `"endOfTurn"` entries.
- Card `apply(a)` API gains `a.addEffect`, `a.choosePlayer`, `a.skipMove()`.
- Behaviours: the spec's card table. These calls are this plan's:
  - **Adrenaline Rush** totals all damage taken before your next turn, including self-damage, and pays out once. It checks for an active Brute when the damage lands. Losing HP from a space doesn't count.
  - **Echoing Strikes** asks at the start of `attackFlow` when equipped and another character shares the active type. Both make attack index 0, the active character first, against one target. It triggers Relentless Assault once. Tactician's 0-energy attack only draws.
  - **Blade Dance** sets `p.bonusAttack` when an opponent is eliminated this turn, with the effect active. `allowed(S).attack` is true while it's set, and the attack is free. It also applies from `"After"`.
  - **Overload** uses `selfDamage`. **Veilpiercer** gets a note in its text and has no effect.

- [ ] **Step 1: Write the failing tests.**

```js
const card = (S, name, ui=stubUi({ confirms:[true] })) => { const p = S.players[S.current]; p.hand = [name]; return Rules.playEvent(S, 0, ui); };
const brute = () => mkGame([["titan","knight","cleric"],["archer","gambler","berserker"]]);
test("Adrenaline Rush pays only after 5+ damage, once", () => {
  const S = brute(), p = S.players[0]; p.energy = 0; card(S, "Adrenaline Rush"); assert.equal(p.energy, 0);
  Rules.takeDamage(S, p, 4); assert.equal(p.energy, 0); Rules.takeDamage(S, p, 1); assert.equal(p.energy, 3);
  Rules.takeDamage(S, p, 5); assert.equal(p.energy, 3);
});
test("Unyielding Strength covers one attack, and only while a Brute is active", () => {
  const S = brute(), p = S.players[0], a = S.players[1]; card(S, "Unyielding Strength");
  assert.equal(Rules.combatDamage({ base:4, attacker:a, defender:p, kind:"skill", isArea:false }), 2);
  p.activeIdx = 1; assert.equal(Rules.combatDamage({ base:4, attacker:a, defender:p, kind:"skill", isArea:false }), 4);
});
test("lasting effects end at the start of the owner's next turn", () => {
  const S = brute(), p = S.players[0]; card(S, "Unyielding Strength"); Rules.startTurn(S, stubUi({}));
  assert.deepEqual(p.effects, []);
});
test("conditional cards check their condition", () => {
  const S = mkGame([["knight","samurai","cleric"],["archer","gambler","berserker"]]), p = S.players[0];
  p.energy = 0; p.startTurnHp = 6; card(S, "Unshakable Resolve"); assert.equal(p.energy, 0);
  p.startTurnHp = 4; card(S, "Unshakable Resolve"); assert.equal(p.energy, 2);
});
const endWith = (name, active, set) => { const S = mkGame([["knight","archer","cleric"],["samurai","gambler","berserker"]]), p = S.players[0];
  p.activeIdx = active; p.hp = 50; p.energy = 0; card(S, name); Object.assign(p, set); p.hand = []; S.phase = "After"; Rules.endTurn(S, stubUi({})); return p; };
test("Warrior's Endurance checks at end of turn that you didn't move", () => {
  assert.equal(endWith("Warrior's Endurance", 0, { movedThisTurn:false }).hp, 52);
  assert.equal(endWith("Warrior's Endurance", 0, { movedThisTurn:true }).hp, 50);
});
test("Mystic Insight checks at end of turn that you didn't attack", () => {
  assert.equal(endWith("Mystic Insight", 2, { attackedThisTurn:false }).hand.length, 2);
  assert.equal(endWith("Mystic Insight", 2, { attackedThisTurn:true }).hand.length, 0);
});
test("Quick Draw checks at end of turn for a basic attack", () => {
  assert.equal(endWith("Quick Draw", 1, { usedBasicThisTurn:true }).energy, 1);
  assert.equal(endWith("Quick Draw", 1, { usedBasicThisTurn:false }).energy, 0);
});
test("Falling Rocks needs a target within 2, then stops their move", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]); const [p,d] = S.players;
  p.pos = "6,0"; d.pos = "8,0"; card(S, "Falling Rocks", stubUi({ picks:[1] })); assert.equal(d.noMoveNext, true);
});
test("Steady Aim skips the move and adds +2", () => {
  const S = mkGame([["archer","knight","cleric"],["samurai","gambler","berserker"]]); S.phase = "Move"; const p = S.players[0];
  card(S, "Steady Aim"); assert.equal(S.phase, "Main"); assert.equal(p.nextAttackBonus, 2);
});
test("Recovery Surge heals 5 and stops the next move", () => {
  const S = brute(), p = S.players[0]; p.hp = 50; card(S, "Recovery Surge"); assert.equal(p.hp, 55); assert.equal(p.noMoveNext, true);
});
test("Arrow Rain is range-limited and is not an attack", () => {
  const S = mkGame([["archer","knight","cleric"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]); const [p,a,b] = S.players;
  p.pos = "6,0"; a.pos = "8,0"; b.pos = "4,14"; const [x,y] = [a.hp,b.hp]; a.activeIdx = 0; card(S, "Arrow Rain");
  assert.deepEqual([x-a.hp, y-b.hp], [2,0]); assert.equal(p.attackedThisTurn, false);
});
test("a doubled event resolves twice, only once per landing", () => {
  const S = brute(), p = S.players[0]; p.pos = "15,5"; p.energy = 0;
  card(S, "Power Infusion"); assert.equal(p.attackDiscount, 2);
  card(S, "Power Infusion"); assert.equal(p.attackDiscount, 3);
});
test("Overload respects Unyielding Fury", () => {
  const S = brute(), p = S.players[0]; p.pos = "0,5"; card(S, "Overload"); assert.equal(p.hp, p.maxHp); assert.equal(p.energy, 3);
});
test("a type card off-type warns, and does nothing", () => {
  const S = mkGame([["knight","samurai","cleric"],["archer","gambler","berserker"]]), p = S.players[0]; p.energy = 0;
  card(S, "Mana Overflow", stubUi({ confirms:[true] })); assert.equal(p.energy, 0);
});
test("Echoing Strikes makes both 0-energy attacks, if the active character shares a type", () => {
  const S = mkGame([["knight","samurai","cleric"],["archer","gambler","berserker"]]); S.phase = "Main"; const [p,d] = S.players;
  p.supports = ["Echoing Strikes"]; p.energy = 5; p.pos = d.pos = "7,0"; const h = d.hp;
  Rules.attackFlow(S, 2, stubUi({ confirms:[true] })); assert.equal(h - d.hp, 4); assert.equal(p.energy, 5);
  p.activeIdx = 2; assert.equal(Rules.echoingAvailable(p), false);
});
test("Blade Dance gives a free attack after an elimination", () => {
  const S = mkGame([["knight","samurai","cleric"],["archer","gambler","berserker"],["titan","ballista","tactician"]]); S.phase = "Main"; const [p,d] = S.players;
  card(S, "Blade Dance"); d.hp = 2; p.pos = d.pos = "7,0"; Rules.attackFlow(S, 0, stubUi({ picks:[1] }));
  assert.equal(d.hp, 0); assert.equal(p.bonusAttack, true); assert.equal(Rules.allowed(S).attack, true);
});
test("state survives a save and reload mid-turn", () => {
  const S = brute(); S.phase = "Main"; card(S, "Unyielding Strength");
  const R = JSON.parse(JSON.stringify(S));
  assert.equal(R.phase, "Main"); assert.deepEqual(R.players[0].effects, S.players[0].effects);
  assert.equal(Rules.isCompatibleSave(R), true);
});
```

- [ ] **Step 2: Run the tests.** Expected: FAIL. Note that `Rules.takeDamage(S, p, n)` and `Rules.echoingAvailable(p)` are also part of this task; route all attack and self-damage through `takeDamage`.
- [ ] **Step 3: Implement in `rules.js`.** Unlisted cards keep `apply:null` and show their text. Update card texts to §10–11.
- [ ] **Step 4: Rewire `game.js`.** The card modal calls `playEvent`, available in every phase per `allowed(S).events`. Show active lasting effects on the player panel.
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Commit** — `"Lasting effects, type gating and listed card effects"`

---

### Task 9: Docs and full playthrough

**Files:** Modify the two old specs and the Stage 1 plan.

- [ ] **Step 1: Add the note** at the top of `2026-11-01-turn-phases-design.md`, `2026-11-02-board-auto-move-design.md` and `2026-11-01-stage-1-one-piece-per-player.md`: `> Superseded where it conflicts by 2026-11-08-official-rulebook-rework-design.md.`
- [ ] **Step 2: Check for leftovers.** Run `grep -nE "curHp|alive|classOf|dmgBuffs|costCut|doubleEvent|pendingBaseBonus|chooseCharacter|Marksmen|Swordsmen|Brutes|Neutral" game/rules.js game/game.js`. Expected: no matches.
- [ ] **Step 3: Run the tests.** Expected: all pass.
- [ ] **Step 4: Browser check, Debug off.** Play full 2-, 3- and 4-player games to a winner: switching, each realm effect, a lane of each kind, a move-back space, one elimination with cards held. Expected: no console errors, and no point where a player is stuck.
- [ ] **Step 5: Commit** — `"Mark old specs superseded"`. Then report to the user, who decides on pushing and on the PR comment.
