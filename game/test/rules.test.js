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

test("createPlayer puts the piece on Embark, not on the characters", () => {
  const p = Rules.createPlayer({ name:"P1", color:"#fff", charIds:["knight","cleric","titan"], seat:1 });
  assert.equal(p.pos, Rules.START_SPACE); assert.deepEqual(p.trail, []); assert.equal("x" in p, false);
  assert.equal(p.energy, 0); assert.deepEqual(p.hand, []); assert.deepEqual(p.supports, []);
  assert.deepEqual(p.chars.map(c => [c.id, c.curHp, c.alive]), [["knight",30,true],["cleric",15,true],["titan",35,true]]);
  for (const c of p.chars) { assert.equal("x" in c, false); assert.equal("terrain" in c, false); }
});
test("isCompatibleSave rejects v1 and garbage", () => {
  assert.equal(Rules.isCompatibleSave({ version:3, players:[] }), true);
  assert.equal(Rules.isCompatibleSave({ players:[] }), false);
  assert.equal(Rules.isCompatibleSave(null), false);
  assert.equal(Rules.isCompatibleSave({ version:3 }), false);
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

/* ---- Board model ---- */
const walk = (laneIdx) => { let id = Rules.START_SPACE, n = 0;
  do { const o = Rules.nextOptions(id); id = (o.length > 1 ? o[laneIdx] : o[0]).to; n++; } while (id !== Rules.START_SPACE && n < 100);
  return n; };
test("board has 4 three-space corridors and 4 realms of 6+5+6 lanes", () => {
  assert.equal(Object.keys(Rules.SPACES).length, 4*3 + 4*17);
});
test("start is Embark, with no realm", () => {
  assert.equal(Rules.START_SPACE, "6,0");
  assert.equal(Rules.SPACES["6,0"].text, "Embark");
  assert.equal(Rules.realmOf("6,0"), null);
});
test("the loop is 32 spaces by middle lanes and 36 by outer lanes", () => {
  assert.equal(walk(1), 32); assert.equal(walk(0), 36); assert.equal(walk(2), 36);
});
test("lane split after the top corridor offers +1, middle, -1 into Mountain", () => {
  assert.deepEqual(Rules.nextOptions("8,0").map(o => [o.to, o.energy]), [["10,0",1],["10,1",0],["9,1",-1]]);
  assert.deepEqual(Rules.nextOptions("7,0").map(o => o.to), ["8,0"]);
  assert.deepEqual(Rules.nextOptions("15,5").map(o => o.to), ["15,6"]);
});
test("lane splits for every realm", () => {
  assert.deepEqual(Rules.nextOptions("15,8").map(o => o.to), ["15,10","14,10","14,9"]);
  assert.deepEqual(Rules.nextOptions("7,15").map(o => o.to), ["5,15","5,14","6,14"]);
  assert.deepEqual(Rules.nextOptions("0,7").map(o => o.to), ["0,5","1,5","1,6"]);
  assert.deepEqual(Rules.nextOptions("5,1").map(o => o.to), ["6,0"]);
});
test("realmOf follows the space colour", () => {
  assert.equal(Rules.realmOf("10,0"), "Mountain"); assert.equal(Rules.realmOf("12,13"), "Forest");
  assert.equal(Rules.realmOf("3,13"), "Volcano"); assert.equal(Rules.realmOf("0,5"), "Hot Spring");
  assert.equal(Rules.realmOf("15,7"), null);
});
test("prevSpace steps back along the path; from a realm exit it uses the middle lane", () => {
  assert.equal(Rules.prevSpace("10,0"), "8,0"); assert.equal(Rules.prevSpace("11,1"), "10,0");
  assert.equal(Rules.prevSpace("15,6"), "14,5"); assert.equal(Rules.prevSpace("6,0"), "5,1");
});
test("space texts match the board", () => {
  const t = id => Rules.SPACES[id].text;
  assert.equal(t("12,13"), "Attack costs 1 less energy"); assert.equal(t("15,5"), "Next Event Card Effect Doubled");
  assert.equal(t("4,3"), "Move back 1 space"); assert.equal(t("10,1"), null); assert.equal(t("7,0"), null);
});
test("every space text has an effect", () => {
  for (const s of Object.values(Rules.SPACES)) if (s.text && s.text !== "Embark") assert.ok(Rules.SPACE_EFFECTS[s.text], s.text);
});
test("space effects call the api", () => {
  const calls = []; const api = new Proxy({}, { get: (_, k) => (...a) => calls.push([k, ...a]) });
  Rules.SPACE_EFFECTS["Lose 2 energy"](api); Rules.SPACE_EFFECTS["Discard 1 card, then draw 2"](api);
  Rules.SPACE_EFFECTS["Basic Attack +1 Damage"](api);
  assert.deepEqual(calls, [["energy",-2],["discardChosen"],["draw",2],["dmgBuff","basic",1]]);
});
test("space centres sit on the 3216px board grid", () => {
  assert.deepEqual([Rules.spaceXY(0,0).x, Math.round(Rules.spaceXY(15,15).y)], [250, 2968]);
});
