const test = require("node:test");
const assert = require("node:assert/strict");
const Rules = require("../rules.js");

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
