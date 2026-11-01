// Game data and pure rules. No DOM access: loaded by the browser (window.Rules) and by Node tests (require).
(function(){
// Character roster from the rulebook. img = file in Cards/.
// Each attack: target ("enemy"|"ally"|"none"), optional needsRoll/costOf, and resolve(api).
const ROSTER = [
  { id:"archer", name:"Archer", hp:20, img:"Archer.png", attacks:[
    {name:"Simple Arrow", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Heavy Arrow", cost:2, note:"4 dmg", target:"enemy", resolve:a=>a.dmg(4)},
    {name:"Exploding Arrow", cost:4, note:"4 dmg + 2 AOE (same realm)", target:"enemy", resolve:a=>{ a.dmg(4); a.aoe(2); }},
  ]},
  { id:"ballista", name:"Ballista Engineer", hp:20, img:"Ballista Engineer.png", attacks:[
    {name:"Bolt Launcher", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Piercing Spear", cost:3, note:"3 dmg to target + all other enemies", target:"enemy", resolve:a=>{ a.dmg(3); a.aoe(3); }},
    {name:"Tracking Radar", cost:4, note:"5 dmg (+3 if target moved)", target:"enemy", resolve:a=>a.dmg(5 + (a.target.char.movedThisTurn?3:0))},
  ]},
  { id:"knight", name:"Knight", hp:30, img:"Knight.png", attacks:[
    {name:"Thrusting Sword", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Heavy Blow", cost:2, note:"5 dmg", target:"enemy", resolve:a=>a.dmg(5)},
    {name:"Excalibur Strike", cost:3, note:"7 dmg", target:"enemy", resolve:a=>a.dmg(7)},
  ]},
  { id:"samurai", name:"Samurai", hp:25, img:"Samurai.png", attacks:[
    {name:"Quick Slash", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Shadow Step", cost:2, note:"4 dmg + stop target move", target:"enemy", resolve:a=>{ a.dmg(4); a.noMove(a.target.char); }},
    {name:"Warrior's Stand", cost:4, note:"9 dmg + stop target move", target:"enemy", resolve:a=>{ a.dmg(9); a.noMove(a.target.char); }},
  ]},
  { id:"cleric", name:"Cleric", hp:15, img:"Cleric.png", attacks:[
    {name:"Water Ball", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Misty Fog", cost:3, note:"2 dmg + heal 2 to all allies", target:"enemy", resolve:a=>{ a.dmg(2); a.healAllies(2); }},
    {name:"Potion Blast", cost:4, note:"Heal 6 to an ally", target:"ally", resolve:a=>a.heal(a.target.char,6)},
  ]},
  { id:"necromancer", name:"Necromancer", hp:20, img:"Necromancer.png", attacks:[
    {name:"Spirit Orb", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Spirit Drain", cost:4, note:"Steal 2 HP from each enemy", target:"none", resolve:a=>a.stealAll(2)},
    {name:"Dark Resurrection", cost:5, note:"Steal 5 HP, self can't move next turn", target:"enemy", resolve:a=>{ a.steal(5); a.noMove(a.attacker); }},
  ]},
  { id:"berserker", name:"Berserker", hp:30, img:"Berserker.png", attacks:[
    {name:"Stone Throw", cost:0, note:"2 dmg", target:"enemy", resolve:a=>a.dmg(2)},
    {name:"Rampage", cost:2, note:"4 dmg + 1 self", target:"enemy", resolve:a=>{ a.dmg(4); a.selfDmg(1); }},
    {name:"Sacrificial Rampage", cost:5, note:"15 dmg + lose half your HP", target:"enemy", resolve:a=>{ a.dmg(15); a.selfDmg(Math.floor(a.attacker.curHp/2)); }},
  ]},
  { id:"titan", name:"Titan Warlord", hp:35, img:"Titan Warloard.png", attacks:[
    {name:"Battle Cry", cost:0, note:"3 dmg + 1 self", target:"enemy", resolve:a=>{ a.dmg(3); a.selfDmg(1); }},
    {name:"Devastating Blow", cost:2, note:"6 dmg + 2 self", target:"enemy", resolve:a=>{ a.dmg(6); a.selfDmg(2); }},
    {name:"Apocalyptic Slam", cost:0, note:"3× all energy as dmg + self = energy", target:"enemy",
      costOf:p=>p.energy, resolve:a=>{ a.dmg(3*a.energyUsed); a.selfDmg(a.energyUsed); }},
  ]},
  { id:"gambler", name:"Gambler", hp:25, img:"Gambler.png", attacks:[
    {name:"All or Nothing", cost:0, note:"3 dmg (0 if roll 1-3)", target:"enemy", needsRoll:true, resolve:a=>a.dmg(a.roll<=3?0:3)},
    {name:"Game of Dice", cost:0, note:"dmg = roll (halved if even), cost = ⌈roll/2⌉", target:"enemy", needsRoll:true,
      costOf:(p,roll)=>Math.ceil(roll/2), resolve:a=>a.dmg(a.roll%2===0?Math.floor(a.roll/2):a.roll)},
    {name:"Fate's Hand", cost:4, note:"If roll 5-6: 10 dmg + draw 2", target:"enemy", needsRoll:true,
      resolve:a=>{ if(a.roll>=5){ a.dmg(10); a.draw(2); } else a.log("Fate's Hand fizzled (needed 5-6)."); }},
  ]},
  { id:"tactician", name:"Tactician", hp:20, img:"Tactician.png", attacks:[
    {name:"Reinforcement Order", cost:0, note:"Draw 1 card", target:"none", resolve:a=>a.draw(1)},
    {name:"Chaos Swap", cost:2, note:"Swap board positions with an opponent", target:"enemy", resolve:a=>a.swapPos(a.target.char)},
    {name:"Landmine", cost:3, note:"5 dmg to all enemies", target:"none", resolve:a=>a.aoeAll(5)},
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
  { name:"Overload", type:"event", text:"Gain 3 energy, but take 2 self-damage.",
    apply:a=>{ a.energy(3); a.selfDmgActive(2); } },
  { name:"Strategic Reserve", type:"event", text:"Gain 1 energy for every character type you have on the field.",
    apply:a=>a.energy(a.distinctTypes()) },
  { name:"Medic's Touch", type:"event", text:"Heal 3 HP.", apply:a=>a.healActive(3) },
  { name:"Recovery Surge", type:"event", text:"Heal 5 HP, but skip your next movement phase.",
    apply:a=>{ a.healActive(5); a.log("  → remember to skip your next movement."); } },
  { name:"Energizing Heal", type:"event", text:"Heal 1 HP per energy spent this turn.",
    apply:a=>a.healActive(a.energySpent()) },
  { name:"Divine Restoration", type:"event", text:"Heal HP equal to number of cards in hand.",
    apply:a=>a.healActive(a.hand()) },
  { name:"Ancient Knowledge", type:"event", text:"Draw 3 cards, then shuffle 2 from your hand back into the deck.",
    apply:a=>{ a.draw(3); a.log("  → shuffle 2 cards from your hand back into the deck (do manually)."); } },
  { name:"Mana Overflow", type:"event", text:"If your active character is a Mage, gain 2 energy.",
    apply:a=>{ if(a.isActiveMage()){ a.energy(2); } else a.log("  → active is not a Mage: no effect."); } },
  { name:"Arrow Rain", type:"event", text:"Deal 2 damage to all opponents within 3 spaces.",
    apply:a=>a.aoeEnemies(2) },
  // --- Movement / situational / triggered: resolved manually ---
  { name:"Hidden Shortcut", type:"event", text:"If you roll an even number this turn, double your movement.", apply:null },
  { name:"Swift Footing", type:"event", text:"Move forward 1-3 extra spaces.", apply:null },
  { name:"Teleport Rune", type:"event", text:"Swap places with an opponent within 3 spaces.", apply:null },
  { name:"Dash Strike", type:"event", text:"Move forward 1 space and attack for 1 extra damage.", apply:null },
  { name:"Falling Rocks", type:"event", text:"Target an opponent within 2 spaces; they lose their next movement phase.", apply:null },
  { name:"Stolen Tactics", type:"event", text:"Copy the effect of the last played Event Card.", apply:null },
  { name:"Distraction", type:"event", text:"Choose one opponent; they must discard 1 card.", apply:null },
  { name:"Time Warp", type:"event", text:"Move forward 1 space, then roll a die. On 4-6, move another space.", apply:null },
  { name:"Slowed by Fear", type:"event", text:"Move an opponent backward 2 spaces if their HP is lower than yours.", apply:null },
  { name:"Momentum Breaker", type:"event", text:"If an opponent moves more than 3 spaces next, they lose 1 HP.", apply:null },
  { name:"Blink Step", type:"event", text:"Swap spaces with an opponent less than 4 spaces away.", apply:null },
  { name:"Armour of Thorns", type:"event", text:"Deal 1 damage back to attackers till your next turn.", apply:null },
  // --- Class event cards (mostly triggered/situational → manual) ---
  { name:"Quick Draw", type:"event", cls:"Archer", text:"If you used a basic attack this turn, gain 1 energy.", apply:a=>a.energy(1) },
  { name:"Longshot Gambit", type:"event", cls:"Archer", text:"If you attack an opponent at least 6 spaces away, deal +1 damage.", apply:null },
  { name:"Steady Aim", type:"event", cls:"Archer", text:"Skip your movement this turn to deal +2 damage on your next attack.", apply:a=>a.log("  → +2 damage on your next attack (apply manually).") },
  { name:"Explosive Arrows", type:"event", cls:"Archer", text:"If you use an AOE attack this turn, it deals +1 damage to all targets.", apply:null },
  { name:"Blade Dance", type:"event", cls:"Knight", text:"If you defeat an opponent this turn, attack again for free.", apply:null },
  { name:"Warrior's Endurance", type:"event", cls:"Knight", text:"If you don't move this turn, heal 2 HP.", apply:a=>a.healActive(2) },
  { name:"Unshakable Resolve", type:"event", cls:"Knight", text:"If you start your turn with less than 5 HP, gain 2 energy.", apply:a=>a.energy(2) },
  { name:"Counterstrike", type:"event", cls:"Knight", text:"If an opponent attacks you from <5 spaces next turn, they take 2 damage.", apply:null },
  { name:"Restless Charge", type:"event", cls:"Knight", text:"Move 2 extra spaces, but your next attack must target an enemy within 3 spaces.", apply:null },
  { name:"Lifeblood Ritual", type:"event", cls:"Mage", text:"If your skill attack heals, restore 1 extra HP.", apply:null },
  { name:"Mystic Insight", type:"event", cls:"Mage", text:"Draw 2 cards if you don't attack this turn.", apply:a=>a.draw(2) },
  { name:"Magic Barrier", type:"event", cls:"Mage", text:"The next attack against you deals half damage.", apply:null },
  { name:"Teleport Spell", type:"event", cls:"Mage", text:"If your active character is a Mage, move to any unoccupied space within 3 spaces.", apply:null },
  { name:"Unyielding Strength", type:"event", cls:"Heavy", text:"Take 2 less damage from the next attack this turn.", apply:null },
  { name:"Titanic Slam", type:"event", cls:"Heavy", text:"If you use an ultimate attack this turn, all opponents take 2 damage.", apply:null },
  { name:"Adrenaline Rush", type:"event", cls:"Heavy", text:"If you take 5+ damage in a turn, gain 3 energy.", apply:a=>a.energy(3) },
  { name:"Battle Roar", type:"event", cls:"Heavy", text:"If you have less than 10 HP, your next attack costs 1 less energy.", apply:a=>a.discount(1) },
  { name:"Colossus Stance", type:"event", cls:"Heavy", text:"You take up to 3 less self damage this turn.", apply:null },
  // --- Support cards (equip system not modeled; shown as playable text) ---
  { name:"Arcane Efficiency", type:"support", text:"Skill energy cost -1.", apply:null },
  { name:"The Titan's Gauntlet", type:"support", text:"Base attack does +1 damage.", apply:null },
  { name:"Warrior's Reclamation", type:"support", text:"For every 4 damage dealt, gain 1 energy.", apply:null },
  { name:"Alchemist's Exchange", type:"support", text:"Base does no damage; instead gives that much energy /2 (floor).", apply:null },
  { name:"Soul Battery", type:"support", text:"Converts all healing to energy (2:1).", apply:null },
  { name:"Priestess' Blessing", type:"support", text:"Heal active character 1 HP at end of each turn.", apply:null },
  { name:"Veilpiercer", type:"support", text:"Attack a non-active character for half damage.", apply:null },
  { name:"Enchanted Library", type:"support", text:"Expend 2 energy to draw 1 additional card.", apply:a=>{ if(a.p.energy>=2){ a.energy(-2); a.draw(1); } else a.log("  → need 2 energy."); } },
  { name:"Echoing Strikes", type:"support", text:"If you have 2 characters of the same type, both attack but only use base damage.", apply:null },
  { name:"Gambler's Favor", type:"support", text:"Roll the dice twice and choose your roll.", apply:null },
  { name:"Critical Hit", type:"support", text:"If you roll 5-6 on movement, deal +2 damage on your next attack.", apply:null },
  { name:"Steady March", type:"support", text:"You may move exactly 3 spaces instead of rolling.", apply:null },
  { name:"Refined Strategy", type:"support", text:"Once per turn, discard a card to draw a new one.", apply:null },
  { name:"Endurance Training", type:"support", text:"If your active character doesn't attack this turn, heal 3 HP.", apply:null },
  { name:"Sharpened Reflexes", type:"support", text:"If you roll a 1 or 2, gain 1 energy.", apply:null },
  { name:"Steady Aim (Archer)", type:"support", cls:"Archer", text:"If you don't move this turn, reduce your next attack cost by 1.", apply:null },
  { name:"Duelist's Challenge", type:"support", cls:"Knight", text:"If you land on an opponent's space, your next attack deals +2 damage.", apply:null },
  { name:"Calculated Strategy", type:"support", text:"If you play no cards this turn, draw 1 extra card.", apply:null },
  { name:"Teleportation Spell", type:"support", cls:"Mage", text:"If your active character is a Mage, teleport up to 3 spaces.", apply:null },
  { name:"Stone Fortress", type:"support", text:"If you have 2+ Heavy Build characters, they take 1 less damage.", apply:null },
];
const CARD_POOL = CARDS.filter(c=>!c.hidden);
function cardByName(n){ return CARD_POOL.find(c=>c.name===n); }

function buildDeck() {
  return CARD_POOL.map(c=>c.name);   // one copy of each card
}

const CLASS_OF = { archer:"Marksmen", ballista:"Marksmen", knight:"Swordsmen", samurai:"Swordsmen",
  cleric:"Mages", necromancer:"Mages", berserker:"Brutes", titan:"Brutes", gambler:"Neutral", tactician:"Neutral" };
function classOf(id){ return CLASS_OF[id]; }

/* ---- Terrain modifiers (by class, from the realm the owner's piece is in) ---- */
function combatDamage({ base, attackerId, attackerTerrain, defenderId, defenderTerrain, isAoe }){
  let dmg = base;
  if(classOf(attackerId)==="Swordsmen" && attackerTerrain==="Volcano") dmg += 2;        // Heated Edge
  if(isAoe && classOf(attackerId)==="Marksmen" && attackerTerrain==="Mountain") dmg += 1; // Eagle's View
  if(classOf(defenderId)==="Marksmen" && defenderTerrain==="Forest") dmg -= 2;          // Natural Cover
  return Math.max(0, dmg);
}
function selfDamageAfterTerrain(charId, terrain, amount){
  return (classOf(charId)==="Brutes" && terrain==="Hot Spring") ? 0 : amount;           // Unyielding Fury
}
function healAfterTerrain(charId, terrain, amount){
  return (classOf(charId)==="Mages" && terrain==="Hot Spring") ? amount+1 : amount;     // Rejuvenating Waters
}
function startRegen(charId, terrain){
  return (classOf(charId)==="Swordsmen" && terrain==="Forest") ? 2 : 0;                 // Forager's Resilience
}

const Rules = { ROSTER, TERRAINS, CARDS, CARD_POOL, cardByName, buildDeck, classOf,
  combatDamage, selfDamageAfterTerrain, healAfterTerrain, startRegen };
if (typeof module === "object" && module.exports) module.exports = Rules; else window.Rules = Rules;
})();
