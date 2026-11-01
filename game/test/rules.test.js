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
