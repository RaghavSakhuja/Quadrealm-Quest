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
    apply:a=>{ a.draw(3); a.log("  → shuffle 2 cards from your hand back into the deck (do manually)."); } },
  { name:"Mana Overflow", type:"event", cls:"Mage", text:"Gain 2 energy.", apply:a=>a.energy(2) },
  { name:"Arrow Rain", type:"event", cls:"Long Range", text:"Deal 2 damage to every opponent within 3 spaces.",
    apply:a=>a.rangeHit(3, 2) },
  // --- Movement / situational / triggered: resolved manually ---
  { name:"Hidden Shortcut", type:"event", text:"If you roll an even number this turn, double your movement.", apply:null },
  { name:"Swift Footing", type:"event", text:"Move forward 1–3 extra spaces.", apply:null },
  { name:"Teleport Rune", type:"event", text:"Swap places with an opponent within 3 spaces.", apply:null },
  { name:"Dash Strike", type:"event", text:"Move forward 1 space, and your attack deals 1 extra damage.", apply:null },
  { name:"Falling Rocks", type:"event", text:"Choose an opponent within 2 spaces. They cannot move on their next turn.", apply:a=>a.stopMove(2) },
  { name:"Stolen Tactics", type:"event", text:"Copy the effect of the last event card played.", apply:null },
  { name:"Distraction", type:"event", text:"Choose an opponent. They discard 1 card.", apply:null },
  { name:"Time Warp", type:"event", text:"Move forward 1 space, then roll the die. On 4–6, move 1 more space.", apply:null },
  { name:"Slowed by Fear", type:"event", text:"Move an opponent back 2 spaces if their HP is lower than yours.", apply:null },
  { name:"Momentum Breaker", type:"event", text:"If an opponent moves more than 3 spaces on their next turn, they lose 1 HP.", apply:null },
  { name:"Blink Step", type:"event", text:"Swap spaces with an opponent less than 4 spaces away.", apply:null },
  { name:"Armour of Thorns", type:"event", text:"Until your next turn, anyone who attacks you takes 1 damage.", apply:null },
  // --- Class event cards (mostly triggered/situational → manual) ---
  { name:"Quick Draw", type:"event", cls:"Long Range", text:"If you used a basic attack this turn, gain 1 energy.", apply:a=>a.addEffect({ card:"Quick Draw", until:"endOfTurn" }) },
  { name:"Longshot Gambit", type:"event", cls:"Long Range", text:"If you attack an opponent at least 6 spaces away, deal +1 damage.", apply:null },
  { name:"Steady Aim", type:"event", cls:"Long Range", text:"Skip your movement this turn, and your next attack deals +2 damage.", apply:a=>a.steadyAim() },
  { name:"Explosive Arrows", type:"event", cls:"Long Range", text:"If you use an area attack this turn, it deals +1 damage to every target.", apply:null },
  { name:"Blade Dance", type:"event", cls:"Close Range", text:"If you eliminate an opponent this turn, attack again for free.", apply:a=>a.addEffect({ card:"Blade Dance", until:"endOfTurn" }) },
  { name:"Warrior's Endurance", type:"event", cls:"Close Range", text:"If you don't move this turn, heal 2 HP.", apply:a=>a.addEffect({ card:"Warrior's Endurance", until:"endOfTurn" }) },
  { name:"Unshakable Resolve", type:"event", cls:"Close Range", text:"If you start your turn with less than 5 HP, gain 2 energy.", apply:a=>{ if(a.p.startTurnHp<5) a.energy(2); else a.log("  → you started this turn with 5 HP or more: no effect."); } },
  { name:"Counterstrike", type:"event", cls:"Close Range", text:"Until your next turn, an opponent who attacks you from less than 5 spaces away takes 2 damage.", apply:null },
  { name:"Restless Charge", type:"event", cls:"Close Range", text:"Move 2 extra spaces. Your next attack must target an opponent within 3 spaces.", apply:null },
  { name:"Lifeblood Ritual", type:"event", cls:"Mage", text:"If your skill attack heals, it restores 1 extra HP.", apply:null },
  { name:"Mystic Insight", type:"event", cls:"Mage", text:"If you don't attack this turn, draw 2 cards.", apply:a=>a.addEffect({ card:"Mystic Insight", until:"endOfTurn" }) },
  { name:"Magic Barrier", type:"event", cls:"Mage", text:"The next attack against you deals half damage.", apply:null },
  { name:"Teleport Spell", type:"event", cls:"Mage", text:"Move to any unoccupied space within 3 spaces.", apply:null },
  { name:"Unyielding Strength", type:"event", cls:"Brute", text:"Take 2 less damage from the next attack against you before your next turn.", apply:a=>a.addEffect({ card:"Unyielding Strength", until:"nextTurn" }) },
  { name:"Titanic Slam", type:"event", cls:"Brute", text:"If you use an ultimate attack this turn, every opponent takes 2 damage.", apply:null },
  { name:"Adrenaline Rush", type:"event", cls:"Brute", text:"If you take 5 or more damage before your next turn, gain 3 energy.", apply:a=>a.addEffect({ card:"Adrenaline Rush", until:"nextTurn" }) },
  { name:"Battle Roar", type:"event", cls:"Brute", text:"If you have less than 10 HP, your next attack costs 1 less energy.", apply:a=>{ if(a.p.hp<10) a.discount(1); else a.log("  → you have 10 HP or more: no effect."); } },
  { name:"Colossus Stance", type:"event", cls:"Brute", text:"You take up to 3 less self-damage this turn.", apply:null },
  // --- Support cards (only those named in the rules code have an effect; the rest show their text) ---
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
  dmg += spaceDamageBonus(attacker.pos, kind);
  dmg += attacker.nextAttackBonus;
  if(effectActive(defender, "Unyielding Strength")) dmg -= 2;
  return Math.max(0, dmg);
}
function startRegen(p){
  return (activeType(p)==="Close Range" && realmOf(p.pos)==="Forest") ? 2 : 0;           // Forager's Resilience
}

/* ---- Team HP ---- */
function isOut(p){ return p.hp<=0; }
function loseHp(p, n){ p.hp = Math.max(0, p.hp - n); }
function selfDamage(p, n){
  if(activeType(p)==="Brute" && realmOf(p.pos)==="Hot Spring") return 0;                 // Unyielding Fury
  loseHp(p, n); return n;
}
function heal(p, n){
  if(activeType(p)==="Mage" && realmOf(p.pos)==="Hot Spring") n += 1;                    // Rejuvenating Waters
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
function stepTo(p, id){ p.trail.push(p.pos); if(p.trail.length>20) p.trail.shift(); p.pos = id; p.doubleUsedAt = null; }
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
function moveByCard(S, p, n, ui){ moveForward(S, p, n, ui); }
function moveBack(p, n){
  for(let k=0;k<n;k++){ p.pos = p.trail.pop() || prevSpace(p.pos); p.doubleUsedAt = null; }   // back the way it came
  if(n>0) p.movedThisTurn = true;
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
    heal(n){ const h=heal(p, n); say(S, `  → ${p.name} heals ${h}.`); },
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
  Object.assign(p, { movedThisTurn:false, actionUsed:false, attackedThisTurn:false, usedBasicThisTurn:false, energySpentThisTurn:0, attackDiscount:0, nextAttackBonus:0, bonusAttack:false, effects:[] });
  p.energy += 1;
  drawCards(S, p, 1);
  say(S, `${p.name}'s turn: +1 energy (now ${p.energy}), drew a card.`);
  const regen = startRegen(p);
  if(regen){ heal(p, regen); say(S, `${p.name} heals ${regen} (Forager's Resilience).`); }
  p.startTurnHp = p.hp;
  S.phase = "Move";
  if(p.noMoveNext){ p.noMoveNext = false; S.phase = "Main"; say(S, `⛔ ${p.name} cannot move this turn.`); }
}
function roll(S, n, ui){
  const p = S.players[S.current];
  say(S, `🎲 ${p.name} rolled ${n}.`);
  moveForward(S, p, n, ui);
  S.phase = "Main";
  landOn(S, p, ui);
  settleTurn(S, ui);
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
  if(!isOut(p) && p.supports.includes("Priestess' Blessing")){ const h = heal(p, 1); say(S, `  → Priestess' Blessing heals ${h}.`); }
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
  return Math.max(0, c - p.attackDiscount - spaceCostCut(p.pos));
}
function moltenDamage(healing){ return Math.floor(healing*3/2); }
function pickOpponent(S, ui, title, forced=false){
  const opts = opponents(S, S.current);
  if(opts.length<=1) return opts.length ? opts[0] : null;
  const pi = ui.choosePlayer(opts, title);
  return pi==null && forced ? opts[0] : pi;   // already paid for: cancelling can't drop the hit
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
  const strike = (d, n)=>{ const dmg = combatDamage({ base:n, attacker:p, defender:d, kind, isArea }); takeDamage(S, d, dmg); hits.push(d); return dmg; };
  let moltenPool = 0;
  const healSelf = (n)=>{
    if(molten){ moltenPool += n; return; }
    const h = heal(p, n); say(S, `  → ${p.name} heals ${h} (now ${p.hp}/${p.maxHp}).`);
  };
  say(S, `${p.name}'s ${who.name} uses ${atk.name} (-${energyUsed}⚡).`);
  atk.resolve({
    player:p, target, roll, energyUsed, targetMoved: !!(target && target.movedThisTurn),
    hit(n){ if(target) strike(target, n); },
    splash(n){ const realm = target && realmOf(target.pos); if(realm) others(o=>o!==target && realmOf(o.pos)===realm).forEach(o=>strike(o, n)); },
    drain(n, healEach){ const realm = realmOf(p.pos); if(realm) others(o=>realmOf(o.pos)===realm).forEach(o=>{ strike(o, n); healSelf(healEach); }); },
    hitWithin(range, n){ withinRange(S, S.current, range).forEach(i=>strike(S.players[i], n)); },
    steal(n){ if(!target) return; const dealt = Math.min(combatDamage({ base:n, attacker:p, defender:target, kind, isArea }), target.hp);
      takeDamage(S, target, dealt); hits.push(target); healSelf(n); },   // heals the full amount, capped like any heal
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
    if(to) takeDamage(S, to, moltenDamage(moltenPool));
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
  if(strikers.some(c=>c.attacks[index].target==="enemy")){
    const pi = pickOpponent(S, ui, `${atk.name}: attack which player?`);
    if(pi==null) return "cancelled";
    target = S.players[pi];
  }
  const rollFor = (a)=>{ if(!a.needsRoll) return null; const r = ui.roll(); say(S, `🎲 ${p.name} rolled ${r}.`); return r; };
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
  hits.forEach(d=>{ d.effects = d.effects.filter(e=>e.card!=="Unyielding Strength"); });   // it blocks one attack
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
  "Warrior's Endurance":(S,p)=>{ if(!p.movedThisTurn){ const h = heal(p, 2); say(S, `  → Warrior's Endurance heals ${h}.`); } },
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
    heal(n){ const h = heal(p, n); say(S, `  → ${p.name} heals ${h} (now ${p.hp}/${p.maxHp}).`); },
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
    log(m){ say(S, m); },
  };
}
function playEvent(S, handIdx, ui){
  const p = S.players[S.current], name = p.hand[handIdx], def = cardByName(name);
  const works = typeActive(p, def);
  if(!works && !ui.confirm(`${name} only works while your active character is ${def.cls}. Play it anyway for no effect?`)) return false;
  p.hand.splice(handIdx, 1); S.discard.push(name);
  say(S, `${p.name} played ${name}.`);
  const twice = onDoubleSpace(p); if(twice) p.doubleUsedAt = p.pos;
  if(!works) say(S, "  → no effect.");
  else if(def.apply){ def.apply(eventApi(S, p, ui)); if(twice && S.winner==null){ say(S, "  → doubled:"); def.apply(eventApi(S, p, ui)); } }
  else say(S, twice ? "  → apply this card's text by hand, twice." : "  → apply this card's text by hand.");
  S.lastEvent = name;
  settleTurn(S, ui);
  return true;
}

const Rules = { takeDamage, echoingAvailable, typeActive, addEffect, playEvent, settle, settleTurn, attackFlow, attackCost, moltenDamage, allowed, startTurn, roll, skipMove, switchActive, endTurn, opponents, isOut, ROSTER, TERRAINS, CARDS, CARD_POOL, cardByName, buildDeck, shuffle, drawCards, say,
  typeOf, activeChar, activeType, distinctTypes, loseHp, selfDamage, heal,
  combatDamage, startRegen,
  SAVE_VERSION, isCompatibleSave, createPlayer,
  spaceXY, SPACES, START_SPACE, nextOptions, prevSpace, realmOf, spaceLabel, SPACE_EFFECTS,
  laneChoices, moveForward, moveByCard, moveBack, landOn, spaceDamageBonus, spaceCostCut, onDoubleSpace, distance, withinRange };
if (typeof module === "object" && module.exports) module.exports = Rules; else window.Rules = Rules;
})();
