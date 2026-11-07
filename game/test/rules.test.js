const test = require("node:test");
const assert = require("node:assert/strict");
const Rules = require("../rules.js");

/* ---- Helpers ---- */
const mkGame = (charIdsPerPlayer, overrides={}) => ({ version:Rules.SAVE_VERSION,
  players: charIdsPerPlayer.map((charIds, i) => Rules.createPlayer({ name:`P${i+1}`, color:"#fff", charIds, activeIdx:0 })),
  deck: Rules.buildDeck(), discard: [], current: 0, phase: "Main", log: [], ...overrides });
// Scripted player: answers come from picks/rolls/confirms in order; prompts are recorded in asked.
const stubUi = ({ picks=[], rolls=[], confirms=[] }={}) => { const ui = { asked:[], rollCount:0,
  roll(){ ui.rollCount++; return rolls.length ? rolls.shift() : 1; },
  confirm(t){ ui.asked.push(t); return confirms.length ? confirms.shift() : false; },
  choosePlayer(pis, t){ ui.asked.push(t); return picks.length ? picks.shift() : pis[0]; },
  chooseLane(choices, t){ ui.asked.push(t); return picks.length ? picks.shift() : choices[0]; },
  chooseCard(hand, t){ ui.asked.push(t); return picks.length ? picks.shift() : 0; },
  chooseChar(p, t){ ui.asked.push(t); return picks.length ? picks.shift() : null; } };
  return ui; };

test("typeOf uses the rulebook's names", () => {
  const want = { archer:"Long Range", ballista:"Long Range", knight:"Close Range", samurai:"Close Range",
    cleric:"Mage", necromancer:"Mage", berserker:"Brute", titan:"Brute", gambler:"Wildcard", tactician:"Wildcard" };
  for (const r of Rules.ROSTER) assert.equal(Rules.typeOf(r.id), want[r.id], r.id);
  assert.equal(Rules.ROSTER.length, 10);
});
test("roster HP matches the rulebook", () => {
  const hp = Object.fromEntries(Rules.ROSTER.map(r => [r.id, r.hp]));
  assert.deepEqual(hp, { archer:20, ballista:20, knight:30, samurai:25, cleric:15, necromancer:20, berserker:30, titan:35, gambler:25, tactician:20 });
});
test("deck has one copy of every card", () => {
  assert.equal(Rules.buildDeck().length, Rules.CARD_POOL.length);
});

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
test("Natural Cover takes 2 off, only for an active Long Range in Forest", () => {
  assert.equal(CD(pl(none,"7,0"), pl(["ballista","cleric","titan"],"15,10")), 2);
  assert.equal(CD(pl(none,"7,0"), pl(["ballista","cleric","titan"],"15,10",1)), 4);
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
test("a next-attack bonus from a card is added", () => {
  const a = pl(none,"7,0"); a.nextAttackBonus = 2; assert.equal(CD(a, pl(none,"7,0")), 6);
});
test("Wildcards are never affected", () => {
  assert.equal(CD(pl(["gambler","cleric","titan"],"4,14"), pl(["tactician","cleric","titan"],"15,10")), 4);
});
test("Unyielding Fury needs an active Brute in Hot Spring", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["titan","knight","cleric"], activeIdx:0 });
  p.pos = "0,5"; Rules.selfDamage(p, 3); assert.equal(p.hp, p.maxHp);
  p.activeIdx = 1; Rules.selfDamage(p, 3); assert.equal(p.hp, p.maxHp - 3);
});
test("healing stops at starting HP; +1 only for an active Mage in Hot Spring", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["cleric","knight","titan"], activeIdx:0 });
  p.hp = 70; p.pos = "0,5"; assert.equal(Rules.heal(p, 2), 3); assert.equal(p.hp, 73);
  p.activeIdx = 1; p.hp = 79; assert.equal(Rules.heal(p, 5), 1); assert.equal(p.hp, 80);
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

test("createPlayer pools HP on the player", () => {
  const p = Rules.createPlayer({ name:"P", color:"#fff", charIds:["knight","cleric","titan"], activeIdx:1 });
  assert.equal(p.hp, 80); assert.equal(p.maxHp, 80); assert.equal(Rules.activeChar(p).id, "cleric"); assert.equal(Rules.activeType(p), "Mage");
  assert.equal(p.pos, Rules.START_SPACE); assert.equal(p.energy, 0); assert.deepEqual(p.hand, []); assert.deepEqual(p.effects, []);
  assert.equal("curHp" in p.chars[0], false); assert.equal("alive" in p.chars[0], false);
});
test("isCompatibleSave rejects older versions and garbage", () => {
  assert.equal(Rules.SAVE_VERSION, 4);
  assert.equal(Rules.isCompatibleSave({ version:4, players:[] }), true);
  assert.equal(Rules.isCompatibleSave({ version:3, players:[] }), false);
  assert.equal(Rules.isCompatibleSave(null), false);
  assert.equal(Rules.isCompatibleSave({ version:4 }), false);
});
test("opponents skips the current player and eliminated players", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"],["knight","cleric","titan"]]);
  S.players[1].hp = 0;
  assert.deepEqual(Rules.opponents(S, 0), [2,3]); assert.deepEqual(Rules.opponents(S, 3), [0,2]);
  assert.equal(Rules.isOut(S.players[1]), true); assert.equal(Rules.isOut(S.players[0]), false);
});
test("drawing with no cards left, or a full hand, is safe", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]);
  S.deck = []; S.discard = []; Rules.drawCards(S, S.players[0], 2); assert.equal(S.players[0].hand.length, 0);
  S.deck = ["a","b"]; S.players[0].hand = ["1","2","3","4","5","6"];
  Rules.drawCards(S, S.players[0], 1); assert.equal(S.players[0].hand.length, 6); assert.equal(S.deck.length, 2);
});
test("every type card is tagged with a rulebook type", () => {
  assert.equal(Rules.cardByName("Mana Overflow").cls, "Mage"); assert.equal(Rules.cardByName("Arrow Rain").cls, "Long Range");
  assert.equal(Rules.cardByName("Quick Draw").cls, "Long Range"); assert.equal(Rules.cardByName("Blade Dance").cls, "Close Range");
  assert.equal(Rules.cardByName("Adrenaline Rush").cls, "Brute");
  for (const c of Rules.CARDS) if (c.cls) assert.ok(["Long Range","Close Range","Mage","Brute"].includes(c.cls), c.name);
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
test("outer lane costs 1, inner gives 1", () => {
  assert.deepEqual(Rules.nextOptions("8,0").map(o => [o.to, o.energy]), [["10,0",-1],["10,1",0],["9,1",1]]);
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
const PASSIVE = ["Embark","Attack deals +1 damage","Basic Attack +1 Damage","Skill +1 Damage","Ultimate +1 Damage","Attack costs 1 less energy","Next Event Card Effect Doubled"];
test("every one-off space has an effect, and passive spaces have none", () => {
  for (const s of Object.values(Rules.SPACES)) if (s.text) assert.equal(!!Rules.SPACE_EFFECTS[s.text], !PASSIVE.includes(s.text), s.text);
});
const two = () => mkGame([["knight","cleric","titan"],["archer","gambler","berserker"]]);
test("outer lane is not offered at 0 energy; cancel takes the middle lane", () => {
  const S = two(), p = S.players[0];
  p.pos = "8,0"; p.energy = 0;
  assert.deepEqual(Rules.laneChoices(p, Rules.nextOptions("8,0")).map(o => o.energy), [0,1]);
  Rules.moveForward(S, p, 1, stubUi({ picks:[null] })); assert.equal(p.pos, "10,1"); assert.equal(p.movedThisTurn, true);
});
test("taking a lane applies its energy", () => {
  const S = two(), p = S.players[0]; p.pos = "8,0"; p.energy = 1;
  Rules.moveForward(S, p, 1, stubUi({ picks:[Rules.nextOptions("8,0")[0]] })); assert.equal(p.pos, "10,0"); assert.equal(p.energy, 0);
  p.pos = "8,0"; Rules.moveForward(S, p, 1, stubUi({ picks:[Rules.nextOptions("8,0")[2]] })); assert.equal(p.pos, "9,1"); assert.equal(p.energy, 1);
});
test("space bonuses are passive and follow the piece", () => {
  assert.equal(Rules.spaceDamageBonus("11,13", "basic"), 1); assert.equal(Rules.spaceDamageBonus("11,13", "skill"), 0);
  assert.equal(Rules.spaceDamageBonus("1,4", "ultimate"), 1); assert.equal(Rules.spaceCostCut("12,13"), 1);
  assert.equal(Rules.spaceDamageBonus("7,0", "basic"), 0); assert.equal(Rules.spaceCostCut("7,0"), 0);
});
test("the double-event space is used up once per stay", () => {
  const p = two().players[0]; p.pos = "15,5"; assert.equal(Rules.onDoubleSpace(p), true);
  p.doubleUsedAt = p.pos; assert.equal(Rules.onDoubleSpace(p), false);
  p.pos = "7,0"; assert.equal(Rules.onDoubleSpace(p), false);
});
test("leaving the double-event space makes it usable again", () => {
  const S = two(), p = S.players[0]; p.pos = "15,5"; p.doubleUsedAt = "15,5";
  Rules.moveForward(S, p, 1, stubUi({})); assert.equal(p.doubleUsedAt, null);
});
test("move back triggers the space it lands on", () => {
  const S = two(), p = S.players[0];
  p.pos = "4,3"; p.trail = ["3,4"]; p.energy = 3;
  Rules.landOn(S, p, stubUi({})); assert.equal(p.pos, "3,4"); assert.equal(p.energy, 1);
});
test("a card move does not trigger the landing space", () => {
  const S = two(), p = S.players[0];
  const hp = p.hp; p.pos = "13,5"; p.energy = 3;
  Rules.moveByCard(S, p, 1, stubUi({})); assert.equal(p.pos, "14,6"); assert.equal(p.hp, hp); assert.equal(p.energy, 3);
});
test("landing on Lose 3 Health takes 3 HP", () => {
  const S = two(), p = S.players[0]; p.pos = "14,6"; const hp = p.hp;
  Rules.landOn(S, p, stubUi({})); assert.equal(p.hp, hp - 3);
});
test("Change your character switches for free", () => {
  const S = two(), p = S.players[0];
  p.pos = "13,5"; Rules.landOn(S, p, stubUi({ picks:[2] })); assert.equal(p.activeIdx, 2); assert.equal(p.actionUsed, false);
});
test("declining Change your character keeps the active character", () => {
  const S = two(), p = S.players[0]; p.pos = "13,5"; Rules.landOn(S, p, stubUi({})); assert.equal(p.activeIdx, 0);
});
test("Discard one card lets you choose, and skips an empty hand", () => {
  const S = two(), p = S.players[0]; p.pos = "9,1"; p.hand = ["a","b"];
  Rules.landOn(S, p, stubUi({ picks:[1] })); assert.deepEqual(p.hand, ["a"]); assert.deepEqual(S.discard, ["b"]);
  p.hand = []; const ui = stubUi({}); Rules.landOn(S, p, ui); assert.equal(ui.asked.length, 0);
});
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
/* ---- Turn phases ---- */
test("a turn runs Move, Main, After", () => {
  const S = two(); Rules.startTurn(S, stubUi({})); const p = S.players[0];
  assert.equal(S.phase, "Move"); assert.deepEqual(Rules.allowed(S), { roll:true, cards:false, switchChar:false, attack:false, end:false, events:true });
  Rules.roll(S, 1, stubUi({})); assert.equal(S.phase, "Main");
  assert.deepEqual(Rules.allowed(S), { roll:false, cards:true, switchChar:true, attack:true, end:true, events:true });
  Rules.switchActive(S, 1); assert.equal(p.activeIdx, 1); assert.equal(S.phase, "After");
  assert.deepEqual(Rules.allowed(S), { roll:false, cards:false, switchChar:false, attack:false, end:true, events:true });
});
test("the start of a turn gives 1 energy and 1 card", () => {
  const S = two(), p = S.players[0]; Rules.startTurn(S, stubUi({}));
  assert.equal(p.energy, 1); assert.equal(p.hand.length, 1);
});
test("the start of a turn clears last turn's flags", () => {
  const S = two(), p = S.players[0]; Object.assign(p, { movedThisTurn:true, actionUsed:true, attackedThisTurn:true, usedBasicThisTurn:true, energySpentThisTurn:3, attackDiscount:1, nextAttackBonus:2 });
  Rules.startTurn(S, stubUi({}));
  assert.deepEqual([p.movedThisTurn, p.actionUsed, p.attackedThisTurn, p.usedBasicThisTurn, p.energySpentThisTurn, p.attackDiscount, p.nextAttackBonus], [false,false,false,false,0,0,0]);
});
test("a player who cannot move skips to Main and can end their turn", () => {
  const S = two(); S.players[0].noMoveNext = true; Rules.startTurn(S, stubUi({}));
  assert.equal(S.phase, "Main"); assert.equal(Rules.allowed(S).end, true); assert.equal(S.players[0].noMoveNext, false);
});
test("start-of-turn HP is recorded after Forager heals", () => {
  const S = mkGame([["knight","samurai","titan"],["archer","gambler","berserker"]]); const p = S.players[0];
  p.hp = 4; p.pos = "15,10"; Rules.startTurn(S, stubUi({})); assert.equal(p.startTurnHp, 6);
});
test("skipMove goes from Move to Main with no roll", () => {
  const S = two(); S.phase = "Move"; Rules.skipMove(S); assert.equal(S.phase, "Main"); assert.equal(S.players[0].movedThisTurn, false);
});
test("Debug can reroll in Main, and nothing else changes", () => {
  const S = two(); S.phase = "Main"; S.debug = true;
  assert.equal(Rules.allowed(S).roll, true); S.phase = "After"; assert.equal(Rules.allowed(S).roll, false); assert.equal(Rules.allowed(S).attack, false);
});
test("endTurn passes clockwise, skipping players who are out", () => {
  const S = mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]);
  S.players[1].hp = 0; S.phase = "After"; Rules.endTurn(S, stubUi({})); assert.equal(S.current, 2); assert.equal(S.phase, "Move");
});
test("Priestess' Blessing heals 1 at end of turn", () => {
  const S = two(), p = S.players[0]; p.supports = ["Priestess' Blessing"]; p.hp = 50; Rules.endTurn(S, stubUi({})); assert.equal(p.hp, 51);
});

/* ---- Attacks ---- */
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
test("a fixed cost that can't be paid stops before anything happens", () => {
  const S = game(["knight","cleric","titan"],["archer","gambler","berserker"]); S.players[0].energy = 1; const ui = stubUi({});
  assert.equal(Rules.attackFlow(S, 2, ui), "cancelled"); assert.equal(S.phase, "Main"); assert.equal(S.players[0].energy, 1);
});
test("attack cost: Arcane Efficiency, a card discount and the space all cut it, down to 0", () => {
  const p = pl(["knight","cleric","titan"],"12,13"); p.supports = ["Arcane Efficiency"]; p.attackDiscount = 1;
  assert.equal(Rules.attackCost(p, 1, null, false), 0); assert.equal(Rules.attackCost(p, 2, null, false), 1); assert.equal(Rules.attackCost(p, 2, null, true), 0);
});
test("splash hits other opponents in the target's realm only", () => {
  const S = game(["archer","cleric","titan"],["knight","gambler","berserker"],{ more:[["samurai","ballista","tactician"],["cleric","knight","titan"]] });
  const [p,t,same,far] = S.players; p.energy = 4; t.pos = "10,1"; same.pos = "12,3"; far.pos = "4,14";
  const [a,b,c] = [t.hp,same.hp,far.hp]; Rules.attackFlow(S, 2, stubUi({ picks:[1] }));
  assert.deepEqual([a-t.hp, b-same.hp, c-far.hp], [4,2,0]);
});
test("a target in a corridor brings no splash", () => {
  const S = game(["archer","cleric","titan"],["knight","gambler","berserker"],{ more:[["samurai","ballista","tactician"]] });
  const [p,t,o] = S.players; p.energy = 4; const h = o.hp; Rules.attackFlow(S, 2, stubUi({ picks:[1] })); assert.equal(o.hp, h); assert.equal(t.maxHp - t.hp, 4);
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
test("Molten Power converts a whole attack's healing in one go", () => {
  const S = game(["necromancer","knight","titan"],["archer","gambler","berserker"],{ more:[["samurai","ballista","tactician"]] }); const [p,a,b] = S.players;
  p.energy = 4; p.hp = 50; p.pos = "4,14"; a.pos = "4,13"; b.pos = "3,13"; const [x,y] = [a.hp,b.hp];
  Rules.attackFlow(S, 1, stubUi({ picks:[1] }));
  assert.equal(p.hp, 50); assert.deepEqual([x-a.hp, y-b.hp], [2+6,2]);
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
  assert.equal(S.players[0].attackedThisTurn, true); assert.equal(S.players[0].usedBasicThisTurn, true);
});
test("a next-attack bonus and discount are spent by one attack", () => {
  const S = game(["knight","cleric","titan"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.nextAttackBonus = 2; p.attackDiscount = 1; p.energy = 1; Rules.attackFlow(S, 1, stubUi({}));
  assert.equal(d.maxHp - d.hp, 7); assert.equal(p.energy, 0); assert.equal(p.nextAttackBonus, 0); assert.equal(p.attackDiscount, 0);
});
test("Chaos Swap trades places with no landing, and resets the double-event space", () => {
  const S = game(["tactician","knight","cleric"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.energy = 2; p.pos = "15,5"; p.doubleUsedAt = "15,5"; d.pos = "14,6"; const h = p.hp; Rules.attackFlow(S, 1, stubUi({}));
  assert.equal(p.pos, "14,6"); assert.equal(d.pos, "15,5"); assert.equal(p.hp, h); assert.equal(p.doubleUsedAt, null);
});
test("Tracking Radar adds 3 if the target moved on their last turn", () => {
  const S = game(["ballista","knight","cleric"],["samurai","gambler","berserker"]); const [p,d] = S.players;
  p.energy = 4; d.movedThisTurn = true; Rules.attackFlow(S, 2, stubUi({})); assert.equal(d.maxHp - d.hp, 8);
});
test("Sacrificial Rampage costs half your team HP, rounded down", () => {
  const S = game(["berserker","knight","cleric"],["samurai","gambler","titan"]); const [p] = S.players;
  p.energy = 5; p.hp = 41; Rules.attackFlow(S, 2, stubUi({})); assert.equal(p.hp, 21);
});

/* ---- Elimination and winning ---- */
const three = () => mkGame([["knight","cleric","titan"],["archer","gambler","berserker"],["samurai","ballista","tactician"]]);
test("an eliminated player's cards are discarded and they can't be targeted", () => {
  const S = three(), d = S.players[1];
  d.hand = ["x"]; d.supports = ["y"]; d.hp = 0; Rules.settle(S, { attackerPi:0, defenderPis:[1] });
  assert.deepEqual(d.hand, []); assert.deepEqual(d.supports, []); assert.ok(S.discard.includes("x") && S.discard.includes("y"));
  assert.deepEqual(Rules.opponents(S, 0), [2]); assert.equal(S.winner ?? null, null);
});
test("last player standing wins", () => {
  const S = two(); S.players[1].hp = 0;
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[1] }).winner, 0); assert.equal(S.winner, 0);
});
test("dying together: most energy wins, then the defender", () => {
  const S = two(); const [a,d] = S.players;
  a.hp = 0; d.hp = 0; a.energy = 2; d.energy = 1;
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[1] }).winner, 0);
  const T = two(); T.players.forEach(p => { p.hp = 0; p.energy = 1; });
  assert.equal(Rules.settle(T, { attackerPi:0, defenderPis:[1] }).winner, 1);
});
test("three dying together with two defenders tied: first clockwise from the attacker", () => {
  const S = three(); S.current = 1; S.players.forEach(p => { p.hp = 0; p.energy = 1; });
  assert.equal(Rules.settle(S, { attackerPi:1, defenderPis:[0,2] }).winner, 2);
});
test("Lose 3 Health can end your own turn with no more prompts", () => {
  const S = three(), p = S.players[0];
  p.hp = 3; p.pos = "10,13"; const ui = stubUi({}); Rules.landOn(S, p, ui);
  assert.equal(Rules.settle(S, { attackerPi:0, defenderPis:[] }).currentOut, true); assert.equal(ui.asked.length, 0);
});
test("dying on a landing passes the turn to the next player", () => {
  const S = three(), p = S.players[0]; S.phase = "Move"; p.pos = "13,5"; p.hp = 3;
  Rules.roll(S, 1, stubUi({})); assert.equal(p.hp, 0); assert.equal(S.current, 1); assert.equal(S.phase, "Move");
});
test("dying to your own attack passes the turn; the game ends if one is left", () => {
  const S = game(["titan","knight","cleric"],["archer","gambler","berserker"],{ more:[["samurai","ballista","tactician"]] }); const p = S.players[0];
  p.hp = 1; Rules.attackFlow(S, 0, stubUi({ picks:[1] })); assert.equal(S.current, 1); assert.equal(S.winner ?? null, null);
  const T = game(["knight","cleric","titan"],["archer","gambler","berserker"]); T.players[1].hp = 2; Rules.attackFlow(T, 0, stubUi({}));
  assert.equal(T.winner, 0); assert.deepEqual(Rules.allowed(T), { roll:false, cards:false, switchChar:false, attack:false, end:false, events:false });
});
test("a mutual kill goes to whoever has more energy after paying", () => {
  const S = game(["titan","knight","cleric"],["archer","gambler","berserker"]); const [p,d] = S.players;
  p.hp = 1; d.hp = 3; p.energy = 0; d.energy = 1; Rules.attackFlow(S, 0, stubUi({})); assert.equal(S.winner, 1);
});

test("space centres sit on the 3216px board grid", () => {
  assert.deepEqual([Rules.spaceXY(0,0).x, Math.round(Rules.spaceXY(15,15).y)], [250, 2968]);
});
