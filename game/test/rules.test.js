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
