// Game data and pure rules. No DOM access: loaded by the browser (window.Rules) and by Node tests (require).
(function(){
// Character roster from the rulebook. img = file in Cards/.
// Each attack: target ("enemy"|"none"), optional area/needsRoll/costOf, and resolve(api). Index 0 basic, 1 skill, 2 ultimate.
const ROSTER = [
  { id:"archer", name:"Archer", hp:20, img:"Archer.png", attacks:[
    {name:"Simple Arrow", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Heavy Arrow", cost:2, note:"4 dmg", target:"enemy", resolve:a=>a.hit(4)},
    {name:"Exploding Arrow", cost:4, note:"4 dmg + 2 to others in the target's realm", target:"enemy", area:true, resolve:a=>{ a.hit(4); a.splash(2); }},
  ]},
  { id:"ballista", name:"Ballista Engineer", hp:20, img:"Ballista Engineer.png", attacks:[
    {name:"Bolt Launcher", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Piercing Spear", cost:3, note:"3 dmg to the target and others in its realm", target:"enemy", area:true, resolve:a=>{ a.hit(3); a.splash(3); }},
    {name:"Tracking Radar", cost:4, note:"5 dmg (+3 if target moved)", target:"enemy", resolve:a=>a.hit(5 + (a.targetMoved?3:0))},
  ]},
  { id:"knight", name:"Knight", hp:30, img:"Knight.png", attacks:[
    {name:"Thrusting Sword", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Heavy Blow", cost:2, note:"5 dmg", target:"enemy", resolve:a=>a.hit(5)},
    {name:"Excalibur Strike", cost:3, note:"7 dmg", target:"enemy", resolve:a=>a.hit(7)},
  ]},
  { id:"samurai", name:"Samurai", hp:25, img:"Samurai.png", attacks:[
    {name:"Quick Slash", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Shadow Step", cost:2, note:"4 dmg + stop target move", target:"enemy", resolve:a=>{ a.hit(4); a.noMove(a.target); }},
    {name:"Warrior's Stand", cost:4, note:"9 dmg + stop target move", target:"enemy", resolve:a=>{ a.hit(9); a.noMove(a.target); }},
  ]},
  { id:"cleric", name:"Cleric", hp:15, img:"Cleric.png", attacks:[
    {name:"Water Ball", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Misty Fog", cost:3, note:"2 dmg + heal 2", target:"enemy", resolve:a=>{ a.hit(2); a.heal(2); }},
    {name:"Potion Blast", cost:4, note:"Heal 6", target:"none", resolve:a=>a.heal(6)},
  ]},
  { id:"necromancer", name:"Necromancer", hp:20, img:"Necromancer.png", attacks:[
    {name:"Spirit Orb", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Spirit Drain", cost:4, note:"Opponents in your realm lose 2; heal 2 for each", target:"none", area:true, resolve:a=>a.drain(2,2)},
    {name:"Dark Resurrection", cost:5, note:"Steal 5 HP, self can't move next turn", target:"enemy", resolve:a=>{ a.steal(5); a.noMove(a.player); }},
  ]},
  { id:"berserker", name:"Berserker", hp:30, img:"Berserker.png", attacks:[
    {name:"Stone Throw", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.hit(2)},
    {name:"Rampage", cost:2, note:"4 dmg + 1 self", target:"enemy", resolve:a=>{ a.hit(4); a.selfDmg(1); }},
    {name:"Sacrificial Rampage", cost:5, note:"15 dmg + lose half your HP", target:"enemy", resolve:a=>{ a.hit(15); a.selfDmg(Math.floor(a.player.hp/2)); }},
  ]},
  { id:"titan", name:"Titan Warlord", hp:35, img:"Titan Warloard.png", attacks:[
    {name:"Battle Cry", cost:0, note:"3 dmg + 1 self", target:"enemy", resolve:a=>{ a.hit(3); a.selfDmg(1); }},
    {name:"Devastating Blow", cost:2, note:"6 dmg + 2 self", target:"enemy", resolve:a=>{ a.hit(6); a.selfDmg(2); }},
    {name:"Apocalyptic Slam", cost:0, note:"3× all energy as dmg + self = energy", target:"enemy",
      costOf:p=>p.energy, resolve:a=>{ a.hit(3*a.energyUsed); a.selfDmg(a.energyUsed); }},
  ]},
  { id:"gambler", name:"Gambler", hp:25, img:"Gambler.png", attacks:[
    {name:"All or Nothing", cost:0, note:"3 dmg (0 if roll 1-3)", target:"enemy", needsRoll:true, resolve:a=>a.hit(a.roll<=3?0:3)},
    {name:"Game of Dice", cost:0, note:"dmg = roll (halved if even), cost = half the roll, rounded down", target:"enemy", needsRoll:true,
      costOf:(p,roll)=>Math.floor(roll/2), resolve:a=>a.hit(a.roll%2===0?Math.floor(a.roll/2):a.roll)},
    {name:"Fate's Hand", cost:4, note:"If roll 5-6: 10 dmg + draw 2", target:"enemy", needsRoll:true,
      resolve:a=>{ if(a.roll>=5){ a.hit(10); a.draw(2); } else a.log("Fate's Hand fizzled (needed 5-6)."); }},
  ]},
  { id:"tactician", name:"Tactician", hp:20, img:"Tactician.png", attacks:[
    {name:"Reinforcement Order", cost:0, note:"Draw 1 card", target:"none", resolve:a=>a.draw(1)},
    {name:"Chaos Swap", cost:2, note:"Swap board positions with an opponent", target:"enemy", resolve:a=>a.swap()},
    {name:"Landmine", cost:3, note:"5 dmg to every opponent within 4 spaces", target:"none", area:true, resolve:a=>a.hitWithin(4, 5)},
  ]},
];

const TERRAINS = ["", "Mountain", "Forest", "Volcano", "Hot Spring"];

/* ========================= CARD DATABASE =========================
   From the rulebook. apply(api) auto-resolves mechanical effects;
   apply:null means "resolve manually" (play shows the text, then discard). */
const CARDS = [
  // --- Immediate / auto-resolving event cards ---
  { name:"Power Infusion", type:"event", text:"Your next attack this turn costs 1 less energy.",
    apply:a=>a.discount(1) },
  { name:"Overload", type:"event", text:"Gain 3 energy and take 2 self-damage.",
    apply:a=>{ a.energy(3); a.selfDmg(2); } },
  { name:"Strategic Reserve", type:"event", text:"Gain 1 energy for each different character type among your characters.",
    apply:a=>a.energy(a.distinctTypes()) },
  { name:"Medic's Touch", type:"event", text:"Heal 3 HP.", apply:a=>a.heal(3) },
  { name:"Recovery Surge", type:"event", text:"Heal 5 HP. You cannot move on your next turn.",
    apply:a=>{ a.heal(5); a.noMove(); } },
  { name:"Energizing Heal", type:"event", text:"Heal 1 HP for each energy you spent this turn.",
    apply:a=>a.heal(a.energySpent()) },
  { name:"Divine Restoration", type:"event", text:"Heal HP equal to the number of cards in your hand.",
    apply:a=>a.heal(a.hand()) },
  { name:"Ancient Knowledge", type:"event", text:"Draw 3 cards, then shuffle 2 cards from your hand back into the deck.",
    apply:a=>{ a.draw(3); a.returnToDeck(2); } },
  { name:"Mana Overflow", type:"event", cls:"Mage", text:"Gain 2 energy.", apply:a=>a.energy(2) },
  { name:"Arrow Rain", type:"event", cls:"Long Range", text:"Deal 2 damage to every opponent within 3 spaces.",
    apply:a=>a.rangeHit(3, 2) },
  // --- Movement and situational event cards ---
  { name:"Hidden Shortcut", type:"event", text:"If you roll an even number this turn, double your movement.", apply:a=>a.beforeRoll("Hidden Shortcut") },
  { name:"Swift Footing", type:"event", text:"Move forward 1–3 extra spaces.", apply:a=>a.moveExtra(a.chooseNumber(1, 3, "Swift Footing: move how many extra spaces?")) },
  { name:"Teleport Rune", type:"event", text:"Swap places with an opponent within 3 spaces.", apply:a=>a.swapWithin(3) },
  { name:"Dash Strike", type:"event", text:"Move forward 1 space, and your attack deals 1 extra damage.", apply:a=>{ a.moveExtra(1); a.attackBonus(1); } },
  { name:"Falling Rocks", type:"event", text:"Choose an opponent within 2 spaces. They cannot move on their next turn.", apply:a=>a.stopMove(2) },
  { name:"Stolen Tactics", type:"event", text:"Copy the effect of the last event card played.", apply:a=>a.copyLastEvent() },
  { name:"Distraction", type:"event", text:"Choose an opponent. They discard 1 card.", apply:a=>a.forceDiscard() },
  { name:"Time Warp", type:"event", text:"Move forward 1 space, then roll the die. On 4–6, move 1 more space.", apply:a=>{ a.moveExtra(1); if(a.roll()>=4) a.moveExtra(1); } },
  { name:"Slowed by Fear", type:"event", text:"Move an opponent back 2 spaces if their HP is lower than yours.", apply:a=>a.pushBack(2) },
  { name:"Momentum Breaker", type:"event", text:"If an opponent moves more than 3 spaces on their next turn, they lose 1 HP.", apply:a=>a.markMomentum() },
  { name:"Blink Step", type:"event", text:"Swap spaces with an opponent less than 4 spaces away.", apply:a=>a.swapWithin(3) },
  { name:"Armour of Thorns", type:"event", text:"Until your next turn, anyone who attacks you takes 1 damage.", apply:a=>a.addEffect({ card:"Armour of Thorns", until:"nextTurn" }) },
  // --- Type event cards ---
  { name:"Quick Draw", type:"event", cls:"Long Range", text:"If you used a basic attack this turn, gain 1 energy.", apply:a=>a.addEffect({ card:"Quick Draw", until:"endOfTurn" }) },
  { name:"Longshot Gambit", type:"event", cls:"Long Range", text:"If you attack an opponent at least 6 spaces away, deal +1 damage.", apply:a=>a.addEffect({ card:"Longshot Gambit", until:"endOfTurn" }) },
  { name:"Steady Aim", type:"event", cls:"Long Range", text:"Skip your movement this turn, and your next attack deals +2 damage.", apply:a=>a.steadyAim() },
  { name:"Explosive Arrows", type:"event", cls:"Long Range", text:"If you use an area attack this turn, it deals +1 damage to every target.", apply:a=>a.addEffect({ card:"Explosive Arrows", until:"endOfTurn" }) },
  { name:"Blade Dance", type:"event", cls:"Close Range", text:"If you eliminate an opponent this turn, attack again for free.", apply:a=>a.addEffect({ card:"Blade Dance", until:"endOfTurn" }) },
  { name:"Warrior's Endurance", type:"event", cls:"Close Range", text:"If you don't move this turn, heal 2 HP.", apply:a=>a.addEffect({ card:"Warrior's Endurance", until:"endOfTurn" }) },
  { name:"Unshakable Resolve", type:"event", cls:"Close Range", text:"If you start your turn with less than 5 HP, gain 2 energy.", apply:a=>{ if(a.p.startTurnHp<5) a.energy(2); else a.log("  → you started this turn with 5 HP or more: no effect."); } },
  { name:"Counterstrike", type:"event", cls:"Close Range", text:"Until your next turn, an opponent who attacks you from less than 5 spaces away takes 2 damage.", apply:a=>a.addEffect({ card:"Counterstrike", until:"nextTurn" }) },
  { name:"Restless Charge", type:"event", cls:"Close Range", text:"Move 2 extra spaces. Your next attack must target an opponent within 3 spaces.", apply:a=>{ a.moveExtra(2); a.addEffect({ card:"Restless Charge", until:"nextTurn" }); } },
  { name:"Lifeblood Ritual", type:"event", cls:"Mage", text:"If your skill attack heals, it restores 1 extra HP.", apply:a=>a.addEffect({ card:"Lifeblood Ritual", until:"endOfTurn" }) },
  { name:"Mystic Insight", type:"event", cls:"Mage", text:"If you don't attack this turn, draw 2 cards.", apply:a=>a.addEffect({ card:"Mystic Insight", until:"endOfTurn" }) },
  { name:"Magic Barrier", type:"event", cls:"Mage", text:"The next attack against you deals half damage.", apply:a=>a.addEffect({ card:"Magic Barrier", until:"nextTurn" }) },
  { name:"Teleport Spell", type:"event", cls:"Mage", text:"Move to any unoccupied space within 3 spaces.", apply:a=>a.teleport(3, true) },
  { name:"Unyielding Strength", type:"event", cls:"Brute", text:"Take 2 less damage from the next attack against you before your next turn.", apply:a=>a.addEffect({ card:"Unyielding Strength", until:"nextTurn" }) },
  { name:"Titanic Slam", type:"event", cls:"Brute", text:"If you use an ultimate attack this turn, every opponent takes 2 damage.", apply:a=>a.addEffect({ card:"Titanic Slam", until:"endOfTurn" }) },
  { name:"Adrenaline Rush", type:"event", cls:"Brute", text:"If you take 5 or more damage before your next turn, gain 3 energy.", apply:a=>a.addEffect({ card:"Adrenaline Rush", until:"nextTurn" }) },
  { name:"Battle Roar", type:"event", cls:"Brute", text:"If you have less than 10 HP, your next attack costs 1 less energy.", apply:a=>{ if(a.p.hp<10) a.discount(1); else a.log("  → you have 10 HP or more: no effect."); } },
  { name:"Colossus Stance", type:"event", cls:"Brute", text:"You take up to 3 less self-damage this turn.", apply:a=>a.addEffect({ card:"Colossus Stance", until:"endOfTurn", left:3 }) },
  // --- Support cards: their passive and activated effects live in the rules below (Veilpiercer waits on rulebook Q25) ---
  { name:"Arcane Efficiency", type:"support", text:"Your skill attacks cost 1 less energy.", apply:null },
  { name:"The Titan's Gauntlet", type:"support", text:"Your basic attacks deal +1 damage.", apply:null },
  { name:"Warrior's Reclamation", type:"support", text:"For every 4 damage you deal, gain 1 energy.", apply:null },
  { name:"Alchemist's Exchange", type:"support", text:"Your basic attacks deal no damage. Instead, gain energy equal to half that damage, rounded down.", apply:null },
  { name:"Soul Battery", type:"support", text:"Convert all healing you receive into energy, at 2 healing per 1 energy.", apply:null },
  { name:"Priestess' Blessing", type:"support", text:"At the end of your turn, heal 1 HP.", apply:null },
  { name:"Veilpiercer", type:"support", text:"You may attack a non-active character, for half damage. (No effect yet: the designer is deciding this card.)", apply:null },
  { name:"Enchanted Library", type:"support", text:"Spend 2 energy to draw 1 extra card.", apply:null },
  { name:"Echoing Strikes", type:"support", text:"If 2 of your characters share a type, both attack, dealing base damage only.", apply:null },
  { name:"Gambler's Favor", type:"support", text:"Roll the die twice and choose which roll to use.", apply:null },
  { name:"Critical Hit", type:"support", text:"If you roll 5 or 6 for movement, your next attack deals +2 damage.", apply:null },
  { name:"Steady March", type:"support", text:"You may move exactly 3 spaces instead of rolling.", apply:null },
  { name:"Refined Strategy", type:"support", text:"Once per turn, you may discard a card to draw a new one.", apply:null },
  { name:"Endurance Training", type:"support", text:"If you don't attack this turn, heal 3 HP.", apply:null },
  { name:"Sharpened Reflexes", type:"support", text:"If you roll 1 or 2 for movement, gain 1 energy.", apply:null },
  { name:"Steady Aim (Archer)", type:"support", cls:"Long Range", text:"Long Range only. If you don't move this turn, your next attack costs 1 less energy.", apply:null },
  { name:"Duelist's Challenge", type:"support", cls:"Close Range", text:"Close Range only. If you land on an opponent's space, your next attack deals +2 damage.", apply:null },
  { name:"Calculated Strategy", type:"support", text:"If you play no cards this turn, draw 1 extra card.", apply:null },
  { name:"Teleportation Spell", type:"support", cls:"Mage", text:"If your active character is a Mage, you may teleport up to 3 spaces instead of moving normally.", apply:null },
  { name:"Stone Fortress", type:"support", text:"If you have 2 Brutes, you take 1 less damage from all attacks.", apply:null },
];
const CARD_POOL = CARDS.filter(c=>!c.hidden);
function cardByName(n){ return CARD_POOL.find(c=>c.name===n); }

function buildDeck() {
  return CARD_POOL.map(c=>c.name);   // one copy of each card
}
function shuffle(a) {
  a = a.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function say(S, msg){ S.log.unshift(msg); if(S.log.length>40) S.log.pop(); }
function drawCards(S, p, n){
  for(let k=0;k<n;k++){
    if(p.hand.length>=6){ say(S, `${p.name} hand full (6).`); return; }
    if(S.deck.length===0){
      if(S.discard.length===0) return;
      S.deck = shuffle(S.discard); S.discard=[];
      say(S, "Deck reshuffled from discard.");
    }
    p.hand.push(S.deck.pop());
  }
}

/* ---- Character types and the active character ---- */
const TYPE_OF = { archer:"Long Range", ballista:"Long Range", knight:"Close Range", samurai:"Close Range",
  cleric:"Mage", necromancer:"Mage", berserker:"Brute", titan:"Brute", gambler:"Wildcard", tactician:"Wildcard" };
function typeOf(id){ return TYPE_OF[id]; }
function activeChar(p){ return p.chars[p.activeIdx]; }
function activeType(p){ return typeOf(activeChar(p).id); }
function distinctTypes(p){ return new Set(p.chars.map(c=>typeOf(c.id))).size; }

/* ---- Realm modifiers: they read the active character's type and the realm of the piece ---- */
// Damage order: base, attacker's realm, defender's realm, supports, board space, events. Floor at 0 only at the end.
function combatDamage({ base, attacker, defender, kind, isArea }){
  let dmg = base;
  const aType = activeType(attacker), aRealm = realmOf(attacker.pos);
  if(aType==="Close Range" && aRealm==="Volcano") dmg += 2;                              // Heated Edge
  if(isArea && aType==="Long Range" && aRealm==="Mountain") dmg += 1;                    // Eagle's View
  if(activeType(defender)==="Long Range" && realmOf(defender.pos)==="Forest") dmg -= 2;  // Natural Cover
  if(kind==="basic" && attacker.supports.includes("The Titan's Gauntlet")) dmg += 1;
  if(defender.supports.includes("Stone Fortress") && defender.chars.filter(c=>typeOf(c.id)==="Brute").length>=2) dmg -= 1;
  dmg += spaceDamageBonus(attacker.pos, kind);
  dmg += attacker.nextAttackBonus;
  if(effectActive(attacker, "Longshot Gambit") && distance(attacker.pos, defender.pos)>=6) dmg += 1;
  if(isArea && effectActive(attacker, "Explosive Arrows")) dmg += 1;
  if(effectActive(defender, "Unyielding Strength")) dmg -= 2;
  dmg = Math.max(0, dmg);
  return effectActive(defender, "Magic Barrier") ? Math.floor(dmg/2) : dmg;
}
function startRegen(p){
  return (activeType(p)==="Close Range" && realmOf(p.pos)==="Forest") ? 2 : 0;           // Forager's Resilience
}

/* ---- Team HP ---- */
function isOut(p){ return p.hp<=0; }
function loseHp(p, n){ p.hp = Math.max(0, p.hp - n); }
function selfDamage(p, n){
  if(activeType(p)==="Brute" && realmOf(p.pos)==="Hot Spring") return 0;                 // Unyielding Fury
  const stance = p.effects.find(e=>e.card==="Colossus Stance");
  if(stance && effectActive(p, "Colossus Stance")){ const cut = Math.min(stance.left, n); stance.left -= cut; n -= cut; }
  loseHp(p, n); return n;
}
// S is optional: only needed to log Soul Battery.
function heal(p, n, S){
  if(activeType(p)==="Mage" && realmOf(p.pos)==="Hot Spring") n += 1;                    // Rejuvenating Waters
  if(p.supports.includes("Soul Battery")){
    const e = Math.floor(n/2); p.energy += e;
    if(S) say(S, `  → Soul Battery: ${p.name} gains ${e} energy instead of healing ${n}.`);
    return 0;
  }
  const healed = Math.max(0, Math.min(n, p.maxHp - p.hp));
  p.hp += healed; return healed;
}

/* ---- Board: one clockwise loop, traced from the 3216px board image (16×16 grid) ----
   Corridor k leads into REALMS[k]; each realm splits into lanes [outer, middle, inner]. */
function spaceXY(c, r){ return { x:250 + 181.2*c, y:244 + 181.6*r }; }
const line = (c, r, dc, dr, n)=> Array.from({length:n}, (_,i)=> `${c+dc*i},${r+dr*i}`);
const CORRIDORS = [ ["6,0","7,0","8,0"], ["15,6","15,7","15,8"], ["9,15","8,15","7,15"], ["0,9","0,8","0,7"] ];
const REALMS = [
  { realm:"Mountain",   lanes:[ line(10,0,1,1,6),    line(10,1,1,1,5),    line(9,1,1,1,6) ] },
  { realm:"Forest",     lanes:[ line(15,10,-1,1,6),  line(14,10,-1,1,5),  line(14,9,-1,1,6) ] },
  { realm:"Volcano",    lanes:[ line(5,15,-1,-1,6),  line(5,14,-1,-1,5),  line(6,14,-1,-1,6) ] },
  { realm:"Hot Spring", lanes:[ line(0,5,1,-1,6),    line(1,5,1,-1,5),    line(1,6,1,-1,6) ] },
];
const LANE_ENERGY = [-1, 0, 1];   // outer lane (marked +1) costs 1, inner lane (marked −1) gives 1
const START_SPACE = "6,0";
const SPACE_TEXT = {
  "6,0":"Embark",
  // Mountain
  "10,0":"Ultimate +1 Damage", "9,1":"Discard one card", "10,2":"Move back 1 space", "12,2":"Heal 2 HP",
  "12,3":"Discard 1 card, then draw 2", "13,3":"Skill +1 Damage", "12,4":"Lose 2 energy", "13,4":"Draw 1 more card",
  "13,5":"Change your character", "14,5":"Gain 1 energy", "15,5":"Next Event Card Effect Doubled", "14,6":"Lose 3 Health",
  // Hot Spring
  "4,1":"Skill +1 Damage", "5,1":"Skill +1 Damage", "3,2":"Change your character", "5,2":"Discard one card",
  "2,3":"Discard 1 card, then draw 2", "3,3":"Discard one card", "4,3":"Move back 1 space", "1,4":"Attack deals +1 damage",
  "2,4":"Draw 1 more card", "3,4":"Lose 2 energy", "0,5":"Heal 2 HP", "2,5":"Draw 1 more card",
  // Volcano
  "0,10":"Discard one card", "1,10":"Change your character", "2,10":"Draw 1 more card", "2,11":"Move back 1 space",
  "2,12":"Heal 2 HP", "4,12":"Attack deals +1 damage", "3,13":"Next Event Card Effect Doubled", "4,13":"Gain 1 energy",
  "4,14":"Ultimate +1 Damage", "5,14":"Lose 2 energy", "6,14":"Lose 2 energy", "5,15":"Discard 1 card, then draw 2",
  // Forest
  "13,10":"Draw 1 more card", "15,10":"Gain 1 energy", "12,11":"Discard one card", "13,11":"Heal 2 HP",
  "14,11":"Ultimate +1 Damage", "11,12":"Move back 1 space", "12,12":"Change your character", "10,13":"Lose 3 Health",
  "11,13":"Basic Attack +1 Damage", "12,13":"Attack costs 1 less energy", "10,14":"Lose 2 energy", "11,14":"Skill +1 Damage",
};
// SPACES[id] = { id, x, y, realm, text, next:[{to, energy}], prev:[id] }  (prev of a realm exit: lanes' last spaces)
const SPACES = {};
function addSpace(id, realm, lane=null){ const [c,r]=id.split(",").map(Number);
  SPACES[id] = { id, ...spaceXY(c,r), realm, lane, text:SPACE_TEXT[id]||null, next:[], prev:[] }; }
const link = (a, b, energy=0)=>{ SPACES[a].next.push({ to:b, energy }); SPACES[b].prev.push(a); };
CORRIDORS.forEach((cor,k)=>{ cor.forEach(id=>addSpace(id, null)); REALMS[k].lanes.forEach((l,li)=>l.forEach(id=>addSpace(id, REALMS[k].realm, li))); });
CORRIDORS.forEach((cor,k)=>{
  for(let i=1;i<cor.length;i++) link(cor[i-1], cor[i]);
  const exit = CORRIDORS[(k+1)%4][0];
  REALMS[k].lanes.forEach((l,li)=>{
    link(cor[cor.length-1], l[0], LANE_ENERGY[li]);
    for(let i=1;i<l.length;i++) link(l[i-1], l[i]);
    link(l[l.length-1], exit);
  });
});
function nextOptions(id){ return SPACES[id].next; }
function prevSpace(id){ const p=SPACES[id].prev; return p.length>1 ? p[1] : p[0]; }   // middle lane when ambiguous
function realmOf(id){ return (SPACES[id] && SPACES[id].realm) || null; }

/* ---- Range: counted over the track both ways, plus crossings between lanes through spaces that
   share a grid edge. Crossings are for counting only: pieces never use them. ---- */
const RANGE_EDGES = Object.fromEntries(Object.keys(SPACES).map(id=>[id, new Set()]));
Object.values(SPACES).forEach(s=>s.next.forEach(o=>{ RANGE_EDGES[s.id].add(o.to); RANGE_EDGES[o.to].add(s.id); }));
Object.values(SPACES).forEach(s=>{
  if(!s.realm) return;
  const [c,r] = s.id.split(",").map(Number);
  [`${c+1},${r}`,`${c-1},${r}`,`${c},${r+1}`,`${c},${r-1}`].forEach(id=>{
    const o = SPACES[id];
    if(o && o.realm===s.realm && o.lane!==s.lane) RANGE_EDGES[s.id].add(id);
  });
});
function distance(a, b){
  const seen = new Set([a]); let frontier = [a];
  for(let d=0; frontier.length; d++){
    if(frontier.includes(b)) return d;
    const next = [];
    frontier.forEach(id=>RANGE_EDGES[id].forEach(o=>{ if(!seen.has(o)){ seen.add(o); next.push(o); } }));
    frontier = next;
  }
  return Infinity;
}

/* ---- Movement ---- */
function laneChoices(p, opts){ return opts.filter(o=> o.energy>=0 || p.energy>=-o.energy); }
function spaceLabel(id){ const s=SPACES[id]; return `${s.realm||"Corridor"}${s.text?` — ${s.text}`:""}`; }
function stepTo(p, id){ p.trail.push(p.pos); if(p.trail.length>20) p.trail.shift(); p.pos = id; p.doubleUsedAt = null; p.spacesMovedThisTurn = (p.spacesMovedThisTurn||0) + 1; }
function moveForward(S, p, n, ui){
  for(let k=0;k<n;k++){
    const opts = nextOptions(p.pos); let o = opts[0];
    if(opts.length>1){   // a realm entrance: the only place a piece picks a lane
      o = ui.chooseLane(laneChoices(p, opts), `${p.name}: which lane into ${realmOf(opts[0].to)}?`) || opts.find(x=>x.energy===0);
      if(o.energy){ p.energy = Math.max(0, p.energy + o.energy); say(S, `  → ${p.name} ${o.energy>0?"gains":"pays"} 1 energy for the lane.`); }
    }
    stepTo(p, o.to);
  }
  if(n>0) p.movedThisTurn = true;
}
// A card move walks the track like a roll, but the space it ends on does not activate.
function moveByCard(S, p, n, ui){ moveForward(S, p, n, ui); checkMomentum(S, p); }
function moveBack(p, n){
  for(let k=0;k<n;k++){ p.pos = p.trail.pop() || prevSpace(p.pos); p.doubleUsedAt = null; }   // back the way it came
  if(n>0) p.movedThisTurn = true;
}
// Teleporting jumps straight to a space within range; like any card move, that space does not activate.
function teleportTo(S, p, range, unoccupied, ui){
  const taken = new Set(S.players.filter(o=>o!==p && !isOut(o)).map(o=>o.pos));
  const opts = Object.keys(SPACES).filter(id=>id!==p.pos && distance(p.pos, id)<=range && !(unoccupied && taken.has(id)));
  const id = opts.length ? ui.chooseSpace(opts, `${p.name}: teleport to which space?`) : null;
  if(id==null){ say(S, "  → no teleport."); return false; }
  const d = distance(p.pos, id);
  p.trail.push(p.pos); p.pos = id; p.doubleUsedAt = null; p.movedThisTurn = true; p.spacesMovedThisTurn = (p.spacesMovedThisTurn||0) + d;
  say(S, `  → ${p.name} teleports to ${spaceLabel(id)}.`);
  checkMomentum(S, p);
  return true;
}
// Momentum Breaker: a marked player loses 1 HP once they have moved more than 3 spaces on their turn.
function checkMomentum(S, p){
  if(p.momentumMark==="now" && p.spacesMovedThisTurn>3){ p.momentumMark = null; loseHp(p, 1); say(S, `  → Momentum Breaker: ${p.name} loses 1 HP.`); }
}
function supportActive(p, name){ return p.supports.includes(name) && typeActive(p, cardByName(name)); }
// Every die roll goes through here, so Gambler's Favor applies to all of a player's rolls.
function rollDie(S, p, ui, why){
  const a = ui.roll();
  if(!supportActive(p, "Gambler's Favor")) return a;
  const b = ui.roll();
  const r = ui.chooseRoll ? (ui.chooseRoll([a, b], `${why}: Gambler's Favor rolled ${a} and ${b}. Use which?`) ?? Math.max(a, b)) : Math.max(a, b);
  say(S, `  → Gambler's Favor: rolled ${a} and ${b}, used ${r}.`);
  return r;
}

/* ---- Spaces: one-off effects activate on landing; passive bonuses come from where the piece is ---- */
const SPACE_EFFECTS = {
  "Draw 1 more card": a=>a.draw(1),
  "Discard one card": a=>a.discardChosen(),
  "Discard 1 card, then draw 2": a=>{ a.discardChosen(); a.draw(2); },
  "Gain 1 energy": a=>a.energy(1),
  "Lose 2 energy": a=>a.energy(-2),
  "Heal 2 HP": a=>a.heal(2),
  "Lose 3 Health": a=>a.loseHp(3),
  "Move back 1 space": a=>a.moveBack(1),
  "Change your character": a=>a.changeCharacter(),
};
function spaceDamageBonus(pos, kind){
  const t = SPACES[pos] && SPACES[pos].text;
  if(t==="Attack deals +1 damage") return 1;
  return t===`${kind[0].toUpperCase()+kind.slice(1)}${kind==="basic"?" Attack":""} +1 Damage` ? 1 : 0;
}
function spaceCostCut(pos){ return SPACES[pos] && SPACES[pos].text==="Attack costs 1 less energy" ? 1 : 0; }
function onDoubleSpace(p){ return SPACES[p.pos].text==="Next Event Card Effect Doubled" && p.doubleUsedAt!==p.pos; }
function landOn(S, p, ui){
  say(S, `  → ${p.name} lands on ${spaceLabel(p.pos)}.`);
  const fx = SPACE_EFFECTS[SPACES[p.pos].text];
  if(!fx) return;
  fx({
    draw(n){ drawCards(S, p, n); },
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    heal(n){ const h=heal(p, n, S); say(S, `  → ${p.name} heals ${h}.`); },
    loseHp(n){ loseHp(p, n); say(S, `  → ${p.name} loses ${n} HP.`); },
    discardChosen(){
      if(!p.hand.length){ say(S, "  → no card to discard."); return; }
      const i = ui.chooseCard(p.hand, `${p.name}: discard which card?`) ?? 0;
      const [c] = p.hand.splice(i, 1); S.discard.push(c); say(S, `  → discarded ${c}.`);
    },
    moveBack(n){ moveBack(p, n); say(S, `  → moved back to ${spaceLabel(p.pos)}.`); landOn(S, p, ui); },
    changeCharacter(){
      const i = ui.chooseChar(p, `${p.name}: switch your active character for free? (Cancel keeps ${activeChar(p).name})`);
      if(i!=null){ p.activeIdx = i; say(S, `  → ${p.name} switches to ${activeChar(p).name}.`); }
    },
  });
}

/* ---- Players and saves ---- */
const SAVE_VERSION = 4;
function isCompatibleSave(obj){ return !!(obj && obj.version===SAVE_VERSION && Array.isArray(obj.players)); }

// One piece and one HP pool per player; characters are cards with attacks and a type.
function createPlayer({ name, color, charIds, activeIdx=0 }){
  const chars = charIds.map(id=>({ ...ROSTER.find(r=>r.id===id) }));
  const maxHp = chars.reduce((s,c)=>s+c.hp, 0);
  return { name, color, chars, activeIdx, hp:maxHp, maxHp, energy:0, hand:[], supports:[], effects:[], pos:START_SPACE, trail:[],
    actionUsed:false, attackedThisTurn:false, usedBasicThisTurn:false, movedThisTurn:false, noMoveNext:false, out:false,
    attackDiscount:0, nextAttackBonus:0, bonusAttack:false, energySpentThisTurn:0, doubleUsedAt:null };
}

/* ---- Targeting ---- */
function opponents(state, currentIdx){
  return state.players.map((p,i)=>i).filter(i=>i!==currentIdx && !isOut(state.players[i]));
}
function withinRange(state, pi, n){
  return opponents(state, pi).filter(o=>distance(state.players[pi].pos, state.players[o].pos)<=n);
}

/* ---- Elimination and winning ---- */
function settle(S, { attackerPi, defenderPis }){
  const newlyOut = S.players.map((p,i)=>i).filter(i=>isOut(S.players[i]) && !S.players[i].out);
  newlyOut.forEach(i=>{ const p = S.players[i];
    p.out = true; S.discard.push(...p.hand, ...p.supports); p.hand = []; p.supports = [];
    say(S, `💀 ${p.name} is out!`); });
  const alive = S.players.map((p,i)=>i).filter(i=>!isOut(S.players[i]));
  if(S.winner==null){
    if(alive.length===1) S.winner = alive[0];
    else if(alive.length===0){   // died together: most energy, then the defender, first clockwise from the attacker
      const top = Math.max(...newlyOut.map(i=>S.players[i].energy));
      const tied = newlyOut.filter(i=>S.players[i].energy===top);
      const clockwise = (i)=> (i - attackerPi + S.players.length) % S.players.length;
      const pool = tied.filter(i=>defenderPis.includes(i));
      S.winner = (pool.length ? pool : tied).sort((a,b)=>clockwise(a)-clockwise(b))[0];
    }
    if(S.winner!=null) say(S, `🏆 ${S.players[S.winner].name} wins!`);
  }
  return { winner: S.winner ?? null, currentOut: isOut(S.players[S.current]) };
}
// After anything resolves on a turn: every other player counts as the defender. A player who dies on their own turn passes it on.
function settleTurn(S, ui){
  const r = settle(S, { attackerPi:S.current, defenderPis:S.players.map((p,i)=>i).filter(i=>i!==S.current) });
  if(r.currentOut && r.winner==null) endTurn(S, ui);
  return r;
}

/* ---- Turn phases: Move, then Main (cards, then one action), then After ---- */
function allowed(S){
  const main = S.phase==="Main", done = S.winner!=null;
  if(done) return { roll:false, cards:false, switchChar:false, attack:false, end:false, events:false };
  return { roll: S.phase==="Move" || (main && !!S.debug), cards:main, switchChar:main, attack:main || !!S.players[S.current].bonusAttack, end:main || S.phase==="After", events:true };
}
function startTurn(S, ui){
  const p = S.players[S.current];
  Object.assign(p, { movedThisTurn:false, actionUsed:false, attackedThisTurn:false, usedBasicThisTurn:false, energySpentThisTurn:0, attackDiscount:0, nextAttackBonus:0, bonusAttack:false, effects:[],
    spacesMovedThisTurn:0, cardsPlayedThisTurn:0, refinedUsed:false });
  if(p.momentumMark==="next") p.momentumMark = "now";
  p.energy += 1;
  drawCards(S, p, 1);
  say(S, `${p.name}'s turn: +1 energy (now ${p.energy}), drew a card.`);
  const regen = startRegen(p);
  if(regen){ heal(p, regen, S); say(S, `${p.name} heals ${regen} (Forager's Resilience).`); }
  p.startTurnHp = p.hp;
  S.phase = "Move";
  if(p.noMoveNext){ p.noMoveNext = false; S.phase = "Main"; say(S, `⛔ ${p.name} cannot move this turn.`); }
}
// rolled=false is a fixed move (Steady March): it lands normally, but no roll-based effects apply.
function roll(S, n, ui, rolled=true){
  const p = S.players[S.current];
  let steps = n;
  if(rolled){
    say(S, `🎲 ${p.name} rolled ${n}.`);
    if(n>=5 && supportActive(p, "Critical Hit")){ p.nextAttackBonus += 2; say(S, "  → Critical Hit: next attack +2."); }
    if(n<=2 && supportActive(p, "Sharpened Reflexes")){ p.energy += 1; say(S, "  → Sharpened Reflexes: +1 energy."); }
    if(n%2===0 && effectActive(p, "Hidden Shortcut")){ steps = 2*n; say(S, `  → Hidden Shortcut: moving ${steps}.`); }
  } else say(S, `${p.name} moves exactly ${n}.`);
  moveForward(S, p, steps, ui);
  checkMomentum(S, p);
  if(supportActive(p, "Duelist's Challenge") && S.players.some(o=>o!==p && !isOut(o) && o.pos===p.pos)){ p.nextAttackBonus += 2; say(S, "  → Duelist's Challenge: next attack +2."); }
  S.phase = "Main";
  landOn(S, p, ui);
  settleTurn(S, ui);
}
function steadyMarch(S, ui){
  const p = S.players[S.current];
  if(S.phase!=="Move" || !supportActive(p, "Steady March")) return false;
  roll(S, 3, ui, false); return true;
}
function teleportMove(S, ui){
  const p = S.players[S.current];
  if(S.phase!=="Move" || !supportActive(p, "Teleportation Spell")) return false;
  if(!teleportTo(S, p, 3, false, ui)) return false;
  S.phase = "Main"; settleTurn(S, ui); return true;
}
function skipMove(S){ if(S.phase==="Move") S.phase = "Main"; }
function switchActive(S, idx){
  const p = S.players[S.current];
  p.activeIdx = idx; p.actionUsed = true; S.phase = "After";
  say(S, `${p.name} switches to ${activeChar(p).name}.`);
}
function endTurn(S, ui){
  const p = S.players[S.current];
  if(!isOut(p)) resolveEndOfTurn(S, p);
  if(!isOut(p) && supportActive(p, "Priestess' Blessing")){ const h = heal(p, 1, S); say(S, `  → Priestess' Blessing heals ${h}.`); }
  if(!isOut(p) && supportActive(p, "Endurance Training") && !p.attackedThisTurn){ const h = heal(p, 3, S); say(S, `  → Endurance Training heals ${h}.`); }
  if(!isOut(p) && supportActive(p, "Calculated Strategy") && !p.cardsPlayedThisTurn){ drawCards(S, p, 1); say(S, "  → Calculated Strategy: draw 1."); }
  if(p.momentumMark==="now") p.momentumMark = null;
  for(let k=1;k<=S.players.length;k++){
    const i = (S.current+k) % S.players.length;
    if(!isOut(S.players[i])){ S.current = i; break; }
  }
  startTurn(S, ui);
}

/* ---- Attacks ---- */
function attackCost(p, atkIndex, roll, free){
  if(free) return 0;
  const atk = activeChar(p).attacks[atkIndex];
  let c = atk.costOf ? atk.costOf(p, roll) : atk.cost;
  if(atkIndex===1 && p.supports.includes("Arcane Efficiency")) c -= 1;
  if(supportActive(p, "Steady Aim (Archer)") && !p.movedThisTurn) c -= 1;
  return Math.max(0, c - p.attackDiscount - spaceCostCut(p.pos));
}
function moltenDamage(healing){ return Math.floor(healing*3/2); }
function pickOpponent(S, ui, title, forced=false, keep=()=>true){
  const opts = opponents(S, S.current).filter(keep);
  if(opts.length<=1) return opts.length ? opts[0] : null;
  const pi = ui.choosePlayer(opts, title);
  return pi==null && forced ? opts[0] : pi;   // already paid for: cancelling can't drop the hit
}
// Warrior's Reclamation: 1 energy for every 4 damage you deal, keeping the remainder.
function noteDealt(S, p, n){
  if(!n || !supportActive(p, "Warrior's Reclamation")) return;
  p.reclaimDamage = (p.reclaimDamage||0) + n;
  const e = Math.floor(p.reclaimDamage/4);
  if(e){ p.reclaimDamage -= 4*e; p.energy += e; say(S, `  → Warrior's Reclamation: ${p.name} gains ${e} energy.`); }
}
function noteDamage(S, p, n){   // Adrenaline Rush adds up damage until the owner's next turn
  const e = p.effects.find(x=>x.card==="Adrenaline Rush");
  if(!e || !effectActive(p, "Adrenaline Rush")) return;
  e.taken = (e.taken||0) + n;
  if(e.taken>=5){ p.energy += 3; p.effects = p.effects.filter(x=>x!==e); say(S, `  → Adrenaline Rush: ${p.name} gains 3 energy.`); }
}
function takeDamage(S, d, n){ loseHp(d, n); say(S, `  → ${d.name} takes ${n}.`); noteDamage(S, d, n); }
function takeSelfDamage(S, p, n){
  const took = selfDamage(p, n);
  say(S, took ? `  → ${p.name} takes ${n} self-damage.` : `  → ${p.name} ignores ${n} self-damage (Unyielding Fury).`);
  if(took) noteDamage(S, p, took);
}
// Resolve one attack that has already been paid for.
function resolveAttack(S, atkIndex, target, roll, energyUsed, ui, char){
  const p = S.players[S.current], who = char || activeChar(p), atk = who.attacks[atkIndex], hits = [];
  const kind = ["basic","skill","ultimate"][atkIndex], isArea = !!atk.area;
  const molten = activeType(p)==="Mage" && realmOf(p.pos)==="Volcano";
  const others = (keep)=> opponents(S, S.current).map(i=>S.players[i]).filter(keep);
  const strike = (d, n)=>{
    const dmg = combatDamage({ base:n, attacker:p, defender:d, kind, isArea }); hits.push(d);
    if(kind==="basic" && supportActive(p, "Alchemist's Exchange")){   // no damage: half of it becomes energy
      const e = Math.floor(dmg/2); p.energy += e; say(S, `  → Alchemist's Exchange: ${d.name} takes no damage; ${p.name} gains ${e} energy.`); return 0;
    }
    takeDamage(S, d, dmg); noteDealt(S, p, dmg); retaliate(d); return dmg;
  };
  const retaliate = (d)=>{   // the defender's lasting cards strike back at the attacker
    if(effectActive(d, "Armour of Thorns")){ say(S, `  → Armour of Thorns (${d.name}):`); takeDamage(S, p, 1); }
    if(effectActive(d, "Counterstrike") && distance(p.pos, d.pos)<5){ say(S, `  → Counterstrike (${d.name}):`); takeDamage(S, p, 2); }
  };
  let moltenPool = 0, ritual = kind==="skill" && effectActive(p, "Lifeblood Ritual");
  const healSelf = (n)=>{
    if(ritual){ n += 1; ritual = false; }   // Lifeblood Ritual: once per skill attack
    if(molten){ moltenPool += n; return; }
    const h = heal(p, n, S); say(S, `  → ${p.name} heals ${h} (now ${p.hp}/${p.maxHp}).`);
  };
  say(S, `${p.name}'s ${who.name} uses ${atk.name} (-${energyUsed}⚡).`);
  atk.resolve({
    player:p, target, roll, energyUsed, targetMoved: !!(target && target.movedThisTurn),
    hit(n){ if(target) strike(target, n); },
    splash(n){ const realm = target && realmOf(target.pos); if(realm) others(o=>o!==target && realmOf(o.pos)===realm).forEach(o=>strike(o, n)); },
    drain(n, healEach){ const realm = realmOf(p.pos); if(realm) others(o=>realmOf(o.pos)===realm).forEach(o=>{ strike(o, n); healSelf(healEach); }); },
    hitWithin(range, n){ withinRange(S, S.current, range).forEach(i=>strike(S.players[i], n)); },
    steal(n){ if(!target) return; const dealt = Math.min(combatDamage({ base:n, attacker:p, defender:target, kind, isArea }), target.hp);
      takeDamage(S, target, dealt); noteDealt(S, p, dealt); hits.push(target); retaliate(target); healSelf(n); },   // heals the full amount, capped like any heal
    heal: healSelf,
    selfDmg(n){ takeSelfDamage(S, p, n); },
    draw(n){ drawCards(S, p, n); },
    noMove(o){ o.noMoveNext = true; say(S, `  → ${o.name} cannot move next turn.`); },
    swap(){ [p.pos,p.trail,target.pos,target.trail] = [target.pos,target.trail,p.pos,p.trail]; p.doubleUsedAt = target.doubleUsedAt = null; say(S, `  → swapped pieces with ${target.name}.`); },
    log(m){ say(S, m); },
  });
  if(moltenPool>0){   // Molten Power: the attack's healing becomes one hit, with no modifiers
    let to = target;
    if(!to || isOut(to)){ const pi = pickOpponent(S, ui, "Molten Power: which opponent?", true); to = pi==null ? null : S.players[pi]; }
    if(to){ const dmg = moltenDamage(moltenPool); takeDamage(S, to, dmg); noteDealt(S, p, dmg); }
  }
  if(kind==="ultimate" && effectActive(p, "Titanic Slam")){   // once: every opponent takes 2
    p.effects = p.effects.filter(e=>e.card!=="Titanic Slam");
    say(S, "  → Titanic Slam:");
    others(()=>true).forEach(o=>{ takeDamage(S, o, 2); noteDealt(S, p, 2); });
  }
  return hits;
}
function relentlessApplies(S, p){
  return !isOut(p) && activeType(p)==="Brute" && realmOf(p.pos)==="Mountain" && opponents(S, S.current).length>0;
}
// The active character must be one of the two sharing a type.
function echoingAvailable(p){
  if(!p.supports.includes("Echoing Strikes")) return false;
  return p.chars.some((c,i)=>i!==p.activeIdx && typeOf(c.id)===activeType(p));
}
// Target first, then roll, then pay: cancelling can never give a free reroll.
function attackFlow(S, atkIndex, ui){
  const p = S.players[S.current], atk = activeChar(p).attacks[atkIndex], free = !!p.bonusAttack;
  const rollSetsCost = atk.needsRoll && atk.costOf;
  const echo = !free && echoingAvailable(p);   // not optional: when it applies, both characters attack
  if(!echo && !rollSetsCost && p.energy<attackCost(p, atkIndex, null, free)) return "cancelled";
  const strikers = echo ? p.chars.filter((c,i)=>i===p.activeIdx || typeOf(c.id)===activeType(p)).sort((a,b)=>(b===activeChar(p))-(a===activeChar(p))).slice(0,2) : [activeChar(p)];
  const index = echo ? 0 : atkIndex;
  let target = null;
  const charge = effectActive(p, "Restless Charge");   // the next attack must target an opponent within 3 spaces
  if(strikers.some(c=>c.attacks[index].target==="enemy")){
    const keep = charge ? (i)=>distance(p.pos, S.players[i].pos)<=3 : ()=>true;
    if(charge && !opponents(S, S.current).some(keep)){ say(S, "Restless Charge: no opponent within 3 spaces."); return "cancelled"; }
    const pi = pickOpponent(S, ui, `${atk.name}: attack which player?`, false, keep);
    if(pi==null) return "cancelled";
    target = S.players[pi];
  }
  if(charge) p.effects = p.effects.filter(e=>e.card!=="Restless Charge");
  const rollFor = (a)=>{ if(!a.needsRoll) return null; const r = rollDie(S, p, ui, a.name); say(S, `🎲 ${p.name} rolled ${r}.`); return r; };
  const firstRoll = rollFor(strikers[0].attacks[index]);
  const cost = echo ? 0 : attackCost(p, index, firstRoll, free);
  p.actionUsed = true; p.bonusAttack = false; S.phase = "After";
  if(p.energy<cost){ say(S, `${p.name} can't afford ${atk.name} (needs ${cost}): no attack.`); return "unaffordable"; }
  p.energy -= cost; p.energySpentThisTurn += cost; if(!free) p.attackDiscount = 0;
  p.attackedThisTurn = true; if(index===0) p.usedBasicThisTurn = true;
  const hits = [];
  strikers.forEach((c,i)=>{
    if(i>0 && (isOut(p) || !opponents(S, S.current).length)) return;   // the first strike already decided it
    hits.push(...resolveAttack(S, index, target, i===0 ? firstRoll : rollFor(c.attacks[index]), cost, ui, c));
  });
  p.nextAttackBonus = 0;
  hits.forEach(d=>{ d.effects = d.effects.filter(e=>e.card!=="Unyielding Strength" && e.card!=="Magic Barrier"); });   // each blocks one attack
  if(relentlessApplies(S, p)){   // Relentless Assault: mandatory, free, may pick a new target, no retrigger
    say(S, "Relentless Assault: a free skill attack.");
    const pi = activeChar(p).attacks[1].target==="enemy" ? pickOpponent(S, ui, "Relentless Assault: attack which player?", true) : null;
    resolveAttack(S, 1, pi==null ? null : S.players[pi], null, 0, ui);
  }
  const killed = S.players.some((o,i)=>i!==S.current && isOut(o) && !o.out);
  if(killed && !isOut(p) && effectActive(p, "Blade Dance")){   // Blade Dance: one free attack
    p.effects = p.effects.filter(e=>e.card!=="Blade Dance"); p.bonusAttack = true;
    say(S, "Blade Dance: attack again for free.");
  }
  settleTurn(S, ui);
  return "done";
}

/* ---- Event cards ---- */
function typeActive(p, def){ return !def.cls || activeType(p)===def.cls; }
function effectActive(p, name){ return p.effects.some(e=>e.card===name) && typeActive(p, cardByName(name)); }
function addEffect(p, e){ p.effects.push({ ...e }); }
const END_OF_TURN = {
  "Quick Draw":(S,p)=>{ if(p.usedBasicThisTurn){ p.energy += 1; say(S, `  → Quick Draw: ${p.name} gains 1 energy.`); } },
  "Warrior's Endurance":(S,p)=>{ if(!p.movedThisTurn){ const h = heal(p, 2, S); say(S, `  → Warrior's Endurance heals ${h}.`); } },
  "Mystic Insight":(S,p)=>{ if(!p.attackedThisTurn){ drawCards(S, p, 2); say(S, `  → Mystic Insight: ${p.name} draws 2.`); } },
};
function resolveEndOfTurn(S, p){
  p.effects.filter(e=>e.until==="endOfTurn").forEach(e=>{ if(END_OF_TURN[e.card] && effectActive(p, e.card)) END_OF_TURN[e.card](S, p); });
  p.effects = p.effects.filter(e=>e.until!=="endOfTurn");
}
function eventApi(S, p, ui){
  const pi = S.players.indexOf(p);
  return { p,
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    heal(n){ const h = heal(p, n, S); say(S, `  → ${p.name} heals ${h} (now ${p.hp}/${p.maxHp}).`); },
    selfDmg(n){ takeSelfDamage(S, p, n); },
    draw(n){ drawCards(S, p, n); },
    hand(){ return p.hand.length; },
    distinctTypes(){ return distinctTypes(p); },
    energySpent(){ return p.energySpentThisTurn; },
    discount(n){ p.attackDiscount += n; },
    addEffect(e){ addEffect(p, e); },
    noMove(){ p.noMoveNext = true; say(S, `  → ${p.name} cannot move next turn.`); },
    stopMove(range){
      const opts = withinRange(S, pi, range);
      if(!opts.length){ say(S, `  → no opponent within ${range} spaces.`); return; }
      const t = opts.length>1 ? ui.choosePlayer(opts, `Stop which opponent within ${range} spaces?`) : opts[0];
      if(t!=null){ S.players[t].noMoveNext = true; say(S, `  → ${S.players[t].name} cannot move next turn.`); }
    },
    rangeHit(range, n){ withinRange(S, pi, range).forEach(i=>takeDamage(S, S.players[i], n)); },   // card damage is not an attack
    steadyAim(){
      if(p.movedThisTurn){ say(S, "  → you've already moved: no effect."); return; }
      skipMove(S); p.nextAttackBonus += 2; say(S, `  → ${p.name} skips moving; next attack +2.`);
    },
    beforeRoll(card){
      if(S.phase!=="Move"){ say(S, "  → play this before you roll: no effect."); return; }
      addEffect(p, { card, until:"endOfTurn" });
    },
    chooseNumber(min, max, title){ const n = ui.chooseNumber ? ui.chooseNumber(min, max, title) : null; return n==null ? max : Math.max(min, Math.min(max, n)); },
    moveExtra(n){ moveByCard(S, p, n, ui); say(S, `  → ${p.name} moves ${n} to ${spaceLabel(p.pos)}.`); },
    attackBonus(n){ p.nextAttackBonus += n; say(S, `  → next attack +${n}.`); },
    roll(){ const r = rollDie(S, p, ui, "Time Warp"); say(S, `  🎲 ${p.name} rolled ${r}.`); return r; },
    swapWithin(range){
      const opts = withinRange(S, pi, range);
      if(!opts.length){ say(S, `  → no opponent within ${range} spaces.`); return; }
      const t = opts.length>1 ? ui.choosePlayer(opts, `Swap places with which opponent within ${range} spaces?`) : opts[0];
      if(t==null) return;
      const o = S.players[t];
      [p.pos,p.trail,o.pos,o.trail] = [o.pos,o.trail,p.pos,p.trail]; p.doubleUsedAt = o.doubleUsedAt = null;
      say(S, `  → ${p.name} swaps places with ${o.name}.`);
    },
    pushBack(n){
      const opts = opponents(S, pi).filter(i=>S.players[i].hp<p.hp);
      if(!opts.length){ say(S, "  → no opponent has less HP than you."); return; }
      const t = opts.length>1 ? ui.choosePlayer(opts, `Move which opponent back ${n} spaces?`) : opts[0];
      if(t==null) return;
      const o = S.players[t];
      for(let k=0;k<n;k++){ o.pos = o.trail.pop() || prevSpace(o.pos); o.doubleUsedAt = null; }   // being pushed is not moving on their turn
      say(S, `  → ${o.name} is pushed back to ${spaceLabel(o.pos)}.`);
    },
    markMomentum(){
      const opts = opponents(S, pi);
      const t = opts.length>1 ? ui.choosePlayer(opts, "Momentum Breaker: which opponent?") : opts[0];
      if(t==null) return;
      S.players[t].momentumMark = "next"; say(S, `  → ${S.players[t].name} loses 1 HP if they move more than 3 spaces next turn.`);
    },
    forceDiscard(){
      const opts = opponents(S, pi).filter(i=>S.players[i].hand.length);
      if(!opts.length){ say(S, "  → no opponent has a card to discard."); return; }
      const t = opts.length>1 ? ui.choosePlayer(opts, "Distraction: which opponent discards?") : opts[0];
      if(t==null) return;
      const o = S.players[t], i = ui.chooseCard(o.hand, `${o.name}: discard which card?`) ?? 0;
      const [c] = o.hand.splice(i, 1); S.discard.push(c); say(S, `  → ${o.name} discards ${c}.`);
    },
    returnToDeck(n){
      for(let k=0;k<n && p.hand.length;k++){
        const i = ui.chooseCard(p.hand, `Ancient Knowledge: shuffle which card back into the deck? (${n-k} left)`) ?? 0;
        const [c] = p.hand.splice(i, 1); S.deck.push(c);
      }
      S.deck = shuffle(S.deck); say(S, `  → ${p.name} shuffles ${n} cards back into the deck.`);
    },
    teleport(range, unoccupied){ teleportTo(S, p, range, unoccupied, ui); },
    copyLastEvent(){
      const last = S.lastEvent && cardByName(S.lastEvent);
      if(!last || !last.apply){ say(S, "  → no event card to copy."); return; }
      if(!typeActive(p, last)){ say(S, `  → copies ${last.name}, but it only works for ${last.cls}: no effect.`); return; }
      say(S, `  → copies ${last.name}:`); last.apply(eventApi(S, p, ui));
    },
    log(m){ say(S, m); },
  };
}
function playEvent(S, handIdx, ui){
  const p = S.players[S.current], name = p.hand[handIdx], def = cardByName(name);
  const works = typeActive(p, def);
  if(!works && !ui.confirm(`${name} only works while your active character is ${def.cls}. Play it anyway for no effect?`)) return false;
  p.hand.splice(handIdx, 1); S.discard.push(name);
  p.cardsPlayedThisTurn = (p.cardsPlayedThisTurn||0) + 1;
  say(S, `${p.name} played ${name}.`);
  const twice = onDoubleSpace(p); if(twice) p.doubleUsedAt = p.pos;
  if(!works) say(S, "  → no effect.");
  else if(def.apply){ def.apply(eventApi(S, p, ui)); if(twice && S.winner==null){ say(S, "  → doubled:"); def.apply(eventApi(S, p, ui)); } }
  else say(S, twice ? "  → apply this card's text by hand, twice." : "  → apply this card's text by hand.");
  if(name!=="Stolen Tactics") S.lastEvent = name;   // copying a copy repeats the original card
  settleTurn(S, ui);
  return true;
}
function equipSupport(S, handIdx){
  const p = S.players[S.current], name = p.hand[handIdx];
  if(!allowed(S).cards || p.supports.length>=2 || cardByName(name).type!=="support") return false;
  p.hand.splice(handIdx, 1); p.supports.push(name);
  p.cardsPlayedThisTurn = (p.cardsPlayedThisTurn||0) + 1;
  say(S, `${p.name} equipped support: ${name}.`);
  return true;
}
// Enchanted Library: spend 2 energy to draw 1, as often as you can pay.
function libraryDraw(S){
  const p = S.players[S.current];
  if(!allowed(S).cards || !supportActive(p, "Enchanted Library") || p.energy<2 || p.hand.length>=6) return false;
  p.energy -= 2; drawCards(S, p, 1); say(S, `${p.name} uses Enchanted Library: -2 energy, draw 1.`);
  return true;
}
// Refined Strategy: once per turn, discard a card to draw a new one.
function refinedSwap(S, handIdx){
  const p = S.players[S.current];
  if(!allowed(S).cards || !supportActive(p, "Refined Strategy") || p.refinedUsed || handIdx==null || !p.hand[handIdx]) return false;
  const [c] = p.hand.splice(handIdx, 1); S.discard.push(c); drawCards(S, p, 1);
  p.refinedUsed = true; say(S, `${p.name} uses Refined Strategy: discards ${c}, draws 1.`);
  return true;
}

const Rules = { takeDamage, echoingAvailable, typeActive, addEffect, playEvent, equipSupport, libraryDraw, refinedSwap, steadyMarch, teleportMove, rollDie, supportActive, settle, settleTurn, attackFlow, attackCost, moltenDamage, allowed, startTurn, roll, skipMove, switchActive, endTurn, opponents, isOut, ROSTER, TERRAINS, CARDS, CARD_POOL, cardByName, buildDeck, shuffle, drawCards, say,
  typeOf, activeChar, activeType, distinctTypes, loseHp, selfDamage, heal,
  combatDamage, startRegen,
  SAVE_VERSION, isCompatibleSave, createPlayer,
  spaceXY, SPACES, START_SPACE, nextOptions, prevSpace, realmOf, spaceLabel, SPACE_EFFECTS,
  laneChoices, moveForward, moveByCard, moveBack, landOn, spaceDamageBonus, spaceCostCut, onDoubleSpace, distance, withinRange };
if (typeof module === "object" && module.exports) module.exports = Rules; else window.Rules = Rules;
})();
