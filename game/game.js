/* ========================= DATA ========================= */
const ASSET = {
  cards: "/assets/Cards/",
  board: "/assets/QuadRealm Quest/QuadRealm Quest.png",
};
const SAVE_KEY = "quadrealm_save_v1";

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
function isSwordsman(c){ return c.id==="knight" || c.id==="samurai"; }
function isMage(c){ return c.id==="cleric" || c.id==="necromancer"; }

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

const PLAYER_COLORS = ["#e6b450","#58c6ff","#68d391","#ff6b6b"];

/* ========================= STATE ========================= */
let S = null;

function newState(players) {
  const deck = shuffle(buildDeck());
  return { players, deck, discard: [], current: 0, phase: "Main", log: [], drewThisTurn: false,
    tiles: [], scale: null };
}

function shuffle(a) {
  a = a.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function log(msg){ S.log.unshift(msg); if(S.log.length>40) S.log.pop(); }

/* ========================= PERSISTENCE ========================= */
function saveState(){
  try { if(S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){}
}
function loadState(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    S = JSON.parse(raw);
    // Re-attach attack data (functions/arrays survive JSON, but keep roster as source of truth).
    S.players.forEach(p=>p.chars.forEach(c=>{
      const def = ROSTER.find(r=>r.id===c.id);
      if(def) c.attacks = def.attacks;
    }));
    if(!Array.isArray(S.tiles)) S.tiles = [];      // migrate older saves
    if(S.scale === undefined) S.scale = null;
    // Old saves stored card image filenames; replace with the new card deck.
    const looksOld = (S.deck||[]).some(x=>typeof x==="string" && x.endsWith(".png"));
    if(looksOld){ S.deck = shuffle(buildDeck()); S.discard = []; S.players.forEach(p=>{ p.hand = []; }); }
    S.players.forEach(p=>{ if(p.attackDiscount==null) p.attackDiscount=0; if(p.energySpentThisTurn==null) p.energySpentThisTurn=0; if(!Array.isArray(p.supports)) p.supports=[]; });
    return true;
  } catch(e){ return false; }
}
function clearSave(){ try { localStorage.removeItem(SAVE_KEY); } catch(e){} }

/* ========================= SETUP UI ========================= */
let setup = { playerCount: 0, seats: [], activeSeat: 0 };

const $ = sel => document.querySelector(sel);

document.querySelectorAll("[data-pc]").forEach(b=>{
  b.onclick = () => {
    setup.playerCount = +b.dataset.pc;
    setup.seats = Array.from({length:setup.playerCount}, (_,i)=>({ name:`Player ${i+1}`, picks:[] }));
    setup.activeSeat = 0;
    $("#pcLabel").textContent = `${setup.playerCount} players`;
    renderSeats(); renderCharGrid(); updateStart();
  };
});

function renderSeats(){
  const el = $("#seats"); el.innerHTML="";
  setup.seats.forEach((s,i)=>{
    const d = document.createElement("div");
    d.className="seat";
    d.innerHTML = `<h3>${s.name} <span class="count">(${s.picks.length}/3)</span></h3>
      <div>${s.picks.map(p=>ROSTER.find(r=>r.id===p).name).join(", ")||"<span style='color:var(--muted)'>no picks yet</span>"}</div>`;
    const btn = document.createElement("button");
    btn.textContent = (i===setup.activeSeat)?"Drafting…":"Draft for this seat";
    btn.className = (i===setup.activeSeat)?"primary":"ghost";
    btn.onclick = ()=>{ setup.activeSeat=i; renderSeats(); renderCharGrid(); };
    d.appendChild(btn);
    el.appendChild(d);
  });
  $("#draftFor").textContent = setup.seats[setup.activeSeat]?.name || "";
}

function renderCharGrid(){
  const grid = $("#charGrid"); grid.innerHTML="";
  const seat = setup.seats[setup.activeSeat];
  ROSTER.forEach(c=>{
    const picked = seat && seat.picks.includes(c.id);
    const d = document.createElement("div");
    d.className = "char-card"+(picked?" sel":"");
    d.innerHTML = `<img src="${ASSET.cards+c.img}" alt="${c.name}"/>
      <div class="nm">${c.name}</div><div class="hp">${c.hp} HP</div>`;
    d.onclick = ()=>{
      if(!seat) return;
      if(picked){ seat.picks = seat.picks.filter(x=>x!==c.id); }
      else if(seat.picks.length<3){ seat.picks.push(c.id); }
      renderSeats(); renderCharGrid(); updateStart();
    };
    grid.appendChild(d);
  });
}

function updateStart(){
  const ok = setup.playerCount>0 && setup.seats.every(s=>s.picks.length===3);
  $("#startBtn").disabled = !ok;
}

$("#resetSetup").onclick = ()=>{ setup={playerCount:0,seats:[],activeSeat:0}; $("#pcLabel").textContent=""; $("#seats").innerHTML=""; $("#charGrid").innerHTML=""; updateStart(); };

$("#startBtn").onclick = ()=>{
  const players = setup.seats.map((s,pi)=>{
    const chars = s.picks.map((id,ci)=>{
      const c = ROSTER.find(r=>r.id===id);
      return { ...c, curHp:c.hp, alive:true, x: 120 + pi*180 + ci*18, y: 120 + pi*120 + ci*52 };
    });
    return { name:s.name, color:PLAYER_COLORS[pi], chars, energy:0, hand:[], activeIdx:0, supports:[] };
  });
  S = newState(players);
  enterGame();
  startTurn(true);
};

function enterGame(){
  $("#setup").classList.add("hidden");
  $("#game").classList.remove("hidden");
  render(); renderTokens();
  const img = $(".boardimg");
  if(img.complete && img.naturalWidth) initBoardScale();
  else img.onload = initBoardScale;
}

/* ========================= BOARD SCALING ========================= */
let calibrating = false;

function boardNatural(){
  const img = $(".boardimg");
  return { w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 };
}
function initBoardScale(){
  if(S.scale == null) fitBoard(); else applyScale();
}
function applyScale(){
  const b = $("#board");
  const img = $(".boardimg");
  const nat = boardNatural();
  img.style.width = (nat.w * S.scale) + "px";
  img.style.height = (nat.h * S.scale) + "px";
  b.style.width = (nat.w * S.scale) + "px";
  b.style.height = (nat.h * S.scale) + "px";
  const lbl = $("#zoomLabel"); if(lbl) lbl.textContent = Math.round(S.scale*100)+"%";
  renderTokens();
  saveState();
}
function fitBoard(){
  const wrap = $("#boardWrap");
  const nat = boardNatural();
  S.scale = Math.min(1, (wrap.clientWidth - 24) / nat.w);
  applyScale();
}
function setZoom(delta){
  S.scale = Math.max(0.05, Math.min(2, (S.scale||1) + delta));
  applyScale();
}

/* ========================= TURN FLOW ========================= */
function startTurn(){
  const p = S.players[S.current];
  p.energy += 1;
  S.phase = "Main";
  S.drewThisTurn = false;
  p.attackDiscount = 0; p.energySpentThisTurn = 0;   // reset per-turn card modifiers
  p.chars.forEach(c=>{
    c.movedThisTurn = false;
    if(c.alive && isSwordsman(c) && c.terrain==="Forest"){ c.curHp=Math.min(c.hp,c.curHp+2); log(`${c.name} regenerates 2 HP (Forager's Resilience).`); } // Forest regen
    if(c.noMoveNext){ log(`⛔ ${c.name} cannot move this turn.`); c.noMoveNext=false; }
  });
  drawCard(p, 1);
  log(`${p.name}'s turn — +1 energy (now ${p.energy}), drew a card.`);
  render();
}

function endTurn(){
  const ending = S.players[S.current];
  if(hasSupport(ending, "Priestess' Blessing")){   // end-of-turn heal
    const a = ending.chars[ending.activeIdx];
    if(a.alive){ healCharacter(a, 1); }
  }
  let n = S.players.length, i = S.current;
  for(let k=0;k<n;k++){ i=(i+1)%n; if(S.players[i].chars.some(c=>c.alive)){ S.current=i; break; } }
  const alivePlayers = S.players.filter(p=>p.chars.some(c=>c.alive));
  if(alivePlayers.length<=1){
    log(`🏆 ${alivePlayers[0]?.name||"Nobody"} wins!`);
    render();
    alert(`${alivePlayers[0]?.name||"Nobody"} wins the game!`);
    return;
  }
  startTurn();
}

function drawCard(p, n){
  for(let k=0;k<n;k++){
    if(S.deck.length===0){
      if(S.discard.length===0) return;
      S.deck = shuffle(S.discard); S.discard=[];
      log("Deck reshuffled from discard.");
    }
    if(p.hand.length>=6){ log(`${p.name} hand full (6).`); return; }
    p.hand.push(S.deck.pop());
  }
}

function rollDice(){
  const r = 1+Math.floor(Math.random()*6);
  log(`🎲 ${S.players[S.current].name} rolled ${r}.`);
  render();
  const d = $("#dice"); if(d) d.textContent = r;
  return r;
}

/* ========================= ACTIONS ========================= */
function playerHp(p){ return p.chars.reduce((s,c)=>s+Math.max(0,c.curHp),0); }
function playerMaxHp(p){ return p.chars.reduce((s,c)=>s+c.hp,0); }

function hasSupport(p, name){ return (p.supports||[]).includes(name); }

function applyDamage(targetPlayerIdx, charIdx, amount){
  const c = S.players[targetPlayerIdx].chars[charIdx];
  c.curHp -= amount;
  if(c.curHp<=0){ c.curHp=0; if(c.alive){ c.alive=false; log(`💀 ${S.players[targetPlayerIdx].name}'s ${c.name} is down!`); } }
  render(); renderTokens();
}

/* ---- Attack engine with terrain modifiers ---- */
function locate(ch){
  for(let pi=0;pi<S.players.length;pi++){ const ci=S.players[pi].chars.indexOf(ch); if(ci>=0) return {pi,ci}; }
  return null;
}
// Outgoing combat damage, applying attacker/defender terrain modifiers.
let pendingBaseBonus = 0;   // +damage applied to the next non-AOE hit (The Titan's Gauntlet)
function dealCombatDamage(defChar, base, attacker, isAoe){
  let dmg = base;
  if(!isAoe && pendingBaseBonus){ dmg += pendingBaseBonus; pendingBaseBonus = 0; } // Titan's Gauntlet
  if(isSwordsman(attacker) && attacker.terrain==="Volcano") dmg += 2;            // Heated Edge
  if(isAoe && attacker.id==="archer" && attacker.terrain==="Mountain") dmg += 1; // Eagle's View
  if(defChar.id==="archer" && defChar.terrain==="Forest") dmg = Math.max(0,dmg-2); // Natural Cover
  const loc = locate(defChar); if(!loc) return;
  applyDamage(loc.pi, loc.ci, dmg);
  log(`  → ${defChar.name} takes ${dmg}${isAoe?" (AOE)":""}.`);
}
function dealSelfDamage(ch, amount){
  if(ch.id==="berserker" && ch.terrain==="Hot Spring"){ log(`  → ${ch.name} ignores ${amount} self-damage (Unyielding Fury).`); return; }
  const loc = locate(ch); if(!loc) return;
  applyDamage(loc.pi, loc.ci, amount);
  log(`  → ${ch.name} takes ${amount} self-damage.`);
}
function healCharacter(ch, amount){
  if(isMage(ch) && ch.terrain==="Hot Spring") amount += 1;   // Rejuvenating Waters
  if(!ch.alive && ch.curHp<=0) return;
  ch.curHp = Math.min(ch.hp, ch.curHp + amount);
  log(`  → ${ch.name} heals ${amount} (now ${ch.curHp}/${ch.hp}).`);
  render(); renderTokens();
}

function pickEnemyTarget(){
  const choices=[];
  S.players.forEach((pl,pi)=>{ if(pi===S.current) return; pl.chars.forEach((c,ci)=>{ if(c.alive) choices.push({pi,ci,char:c,label:`${pl.name} — ${c.name} (${c.curHp})`}); }); });
  return promptChoice(choices);
}
function pickAllyTarget(){
  const p=S.players[S.current], choices=[];
  p.chars.forEach((c,ci)=>{ if(c.alive) choices.push({pi:S.current,ci,char:c,label:`${c.name} (${c.curHp}/${c.hp})`}); });
  return promptChoice(choices);
}
function promptChoice(choices){
  if(choices.length===0){ alert("No valid targets."); return null; }
  if(choices.length===1) return choices[0];
  const pick = prompt("Choose target:\n"+choices.map((c,i)=>`${i+1}. ${c.label}`).join("\n"), "1");
  const idx=(+pick)-1;
  return (!isNaN(idx) && choices[idx]) ? choices[idx] : null;
}

function useAttack(attacker, atk){
  const p = S.players[S.current];
  const roll = atk.needsRoll ? (1+Math.floor(Math.random()*6)) : null;
  if(roll!=null){ const d=$("#dice"); if(d) d.textContent=roll; log(`🎲 ${p.name} rolled ${roll}.`); }

  let target=null;
  if(atk.target==="enemy"){ target=pickEnemyTarget(); if(!target) return; }
  else if(atk.target==="ally"){ target=pickAllyTarget(); if(!target) return; }

  const atkIndex = attacker.attacks.indexOf(atk);   // 0 basic, 1 skill, 2 ultimate
  const cost = atk.costOf ? atk.costOf(p, roll) : atk.cost;
  let supportCut = 0;
  if(atkIndex===1 && hasSupport(p, "Arcane Efficiency")) supportCut += 1;   // skill cost -1
  const effCost = Math.max(0, cost - (p.attackDiscount||0) - supportCut);
  if(p.energy < effCost){ alert(`Not enough energy (need ${effCost}).`); return; }
  p.energy -= effCost;
  p.energySpentThisTurn = (p.energySpentThisTurn||0) + effCost;
  if(p.attackDiscount){ p.attackDiscount = 0; }   // discount consumed by this attack
  pendingBaseBonus = (atkIndex===0 && hasSupport(p, "The Titan's Gauntlet")) ? 1 : 0;   // base +1 dmg

  const api = {
    attacker, player:p, target, roll, energyUsed:effCost,
    dmg:(n)=>{ if(target) dealCombatDamage(target.char, n, attacker, false); },
    aoe:(n)=>{ S.players.forEach((pl,pi)=>{ if(pi===S.current) return; pl.chars.forEach(c=>{ if(c.alive && c!==(target&&target.char)) dealCombatDamage(c, n, attacker, true); }); }); },
    aoeAll:(n)=>{ S.players.forEach((pl,pi)=>{ if(pi===S.current) return; pl.chars.forEach(c=>{ if(c.alive) dealCombatDamage(c, n, attacker, true); }); }); },
    selfDmg:(n)=> dealSelfDamage(attacker, n),
    heal:(ch,n)=> healCharacter(ch, n),
    healAllies:(n)=>{ p.chars.forEach(c=>{ if(c.alive) healCharacter(c, n); }); },
    steal:(n)=>{ if(target){ dealCombatDamage(target.char, n, attacker, false); healCharacter(attacker, n); } },
    stealAll:(n)=>{ S.players.forEach((pl,pi)=>{ if(pi===S.current) return; pl.chars.forEach(c=>{ if(c.alive){ dealCombatDamage(c, n, attacker, true); } }); }); if(n>0) healCharacter(attacker, n); },
    draw:(n)=> drawCard(p, n),
    noMove:(ch)=>{ ch.noMoveNext=true; log(`  → ${ch.name} cannot move next turn.`); },
    swapPos:(ch)=>{ const ax=attacker.x, ay=attacker.y; attacker.x=ch.x; attacker.y=ch.y; ch.x=ax; ch.y=ay; log(`  → swapped positions with ${ch.name}.`); },
    log:(m)=> log(m),
  };

  log(`${p.name}'s ${attacker.name} used ${atk.name} (-${effCost}⚡).`);
  atk.resolve(api);
  render(); renderTokens();
}

/* ========================= RENDER ========================= */
function render(){
  saveState();
  const p = S.players[S.current];
  $("#turnLabel").textContent = `${p.name}`;
  $("#phaseLabel").textContent = `• ${playerHp(p)} HP • ${p.energy} ⚡ • ${S.deck.length} in deck`;

  const panel = $("#sidePanel");
  panel.innerHTML = "";

  panel.appendChild(h(`<h2 style="color:${p.color}">${p.name}</h2>`));
  const hpPct = Math.round(100*playerHp(p)/playerMaxHp(p));
  panel.appendChild(h(`<div class="stat-row"><span class="pill">HP ${playerHp(p)}/${playerMaxHp(p)}</span>
    <div class="hpbar"><div style="width:${hpPct}%"></div></div></div>`));

  const eRow = h(`<div class="stat-row"><span class="pill energy">⚡ Energy: ${p.energy}</span></div>`);
  eRow.appendChild(btn("+1", ()=>{ p.energy++; render(); }));
  eRow.appendChild(btn("−1", ()=>{ if(p.energy>0){p.energy--; render();} }));
  panel.appendChild(eRow);

  const chRow = h(`<div class="chars"></div>`);
  p.chars.forEach((c,ci)=>{
    const m = document.createElement("div");
    m.className = "mini"+(ci===p.activeIdx?" active":"")+(c.alive?"":" dead");
    m.innerHTML = `<img src="${ASSET.cards+c.img}"/><div>${c.name}</div><div>${c.curHp}/${c.hp}</div>`;
    m.onclick = ()=>{ if(c.alive){ p.activeIdx=ci; render(); } };
    chRow.appendChild(m);
  });
  panel.appendChild(h(`<div class="section"><b>Characters</b> <span style="color:var(--muted);font-size:11px">(click to set active)</span></div>`));
  panel.appendChild(chRow);

  const active = p.chars[p.activeIdx];

  // Terrain (realm) selector for the active character — drives terrain combat modifiers.
  const terrRow = h(`<div class="section"><b>${active.name} — Realm</b></div>`);
  panel.appendChild(terrRow);
  const tsel = document.createElement("select");
  TERRAINS.forEach(t=>{ const o=document.createElement("option"); o.value=t; o.textContent=t||"(none)"; if((active.terrain||"")===t) o.selected=true; tsel.appendChild(o); });
  tsel.style.background="var(--panel2)"; tsel.style.color="var(--text)"; tsel.style.border="1px solid var(--line)"; tsel.style.borderRadius="4px"; tsel.style.padding="3px";
  tsel.onchange = ()=>{ active.terrain = tsel.value || null; render(); };
  const trWrap = h(`<div class="controls"></div>`); trWrap.appendChild(tsel);
  panel.appendChild(trWrap);

  panel.appendChild(h(`<div class="section"><b>${active.name} — Attacks</b></div>`));
  const atkWrap = h(`<div class="attacks"></div>`);
  active.attacks.forEach(a=>{
    const costLabel = a.costOf ? "*" : a.cost;   // * = cost depends on roll/energy
    const row = h(`<div class="atk"><span>${a.name} <span style="color:var(--muted)">— ${a.note}</span></span><span class="cost">${costLabel}⚡</span></div>`);
    const use = btn("Use", ()=> useAttack(active, a));
    use.disabled = !a.costOf && p.energy < a.cost;   // dynamic-cost attacks check at resolve time
    row.appendChild(use);
    atkWrap.appendChild(row);
  });
  panel.appendChild(atkWrap);

  const dice = h(`<div class="section"><b>Dice & Movement</b></div>`);
  panel.appendChild(dice);
  const drow = h(`<div class="controls"></div>`);
  drow.appendChild(h(`<span id="dice">–</span>`));
  drow.appendChild(btn("Roll 🎲", rollDice));
  panel.appendChild(drow);
  panel.appendChild(h(`<div style="font-size:11px;color:var(--muted);margin-top:4px">Drag tokens on the board to move.</div>`));

  panel.appendChild(h(`<div class="section"><b>Support Slots (${(p.supports||[]).length}/2)</b></div>`));
  const slots = h(`<div class="supports"></div>`);
  for(let i=0;i<2;i++){
    const name = (p.supports||[])[i];
    if(name){
      const def = cardByName(name);
      const s = h(`<div class="slot filled"><div class="slot-name">${name}</div><div class="slot-text">${def?def.text:""}</div></div>`);
      s.appendChild(btn("Unequip", ()=>{ p.supports.splice(i,1); S.discard.push(name); log(`${p.name} unequipped ${name}.`); render(); }));
      slots.appendChild(s);
    } else {
      slots.appendChild(h(`<div class="slot empty">empty slot</div>`));
    }
  }
  panel.appendChild(slots);

  panel.appendChild(h(`<div class="section"><b>Hand (${p.hand.length}/6)</b></div>`));
  const hand = h(`<div class="hand"></div>`);
  p.hand.forEach((card,ci)=>{
    const def = cardByName(card);
    const cls = def && def.cls ? ` · ${def.cls}` : "";
    const cc = h(`<div class="tcard ${def?def.type:''}">
      <div class="tcard-name">${card}</div>
      <div class="tcard-type">${def?def.type:''}${cls}</div>
      <div class="tcard-text">${def?def.text:''}</div>
    </div>`);
    cc.onclick = ()=> openCard(card, ci);
    hand.appendChild(cc);
  });
  panel.appendChild(hand);
  const handCtrls = h(`<div class="controls" style="margin-top:6px"></div>`);
  handCtrls.appendChild(btn("Draw +1", ()=>{ drawCard(p,1); render(); }));
  handCtrls.appendChild(btn("Discard→+1⚡", ()=>{ if(p.hand.length){ S.discard.push(p.hand.pop()); p.energy++; log(`${p.name} discarded for +1 energy.`); render(); } }));
  panel.appendChild(handCtrls);

  panel.appendChild(h(`<div class="section"><b>Manual Damage / Heal</b></div>`));
  panel.appendChild(buildDamageHelper());

  panel.appendChild(h(`<div class="section"><b>Log</b></div>`));
  const logEl = h(`<div class="log"></div>`);
  S.log.forEach(l=> logEl.appendChild(h(`<div>${l}</div>`)));
  panel.appendChild(logEl);
}

function buildDamageHelper(){
  const wrap = h(`<div></div>`);
  const psel = document.createElement("select");
  S.players.forEach((pl,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=pl.name; psel.appendChild(o); });
  const csel = document.createElement("select");
  function fillChars(){ csel.innerHTML=""; S.players[psel.value].chars.forEach((c,ci)=>{ const o=document.createElement("option"); o.value=ci; o.textContent=`${c.name} (${c.curHp}/${c.hp})`; csel.appendChild(o); }); }
  psel.onchange=fillChars; fillChars();
  const amt = h(`<input type="number" value="2" min="0" />`);
  const row = h(`<div class="controls" style="align-items:center"></div>`);
  [psel,csel,amt].forEach(e=>{ e.style.background="var(--panel2)"; e.style.color="var(--text)"; e.style.border="1px solid var(--line)"; e.style.borderRadius="4px"; e.style.padding="3px"; row.appendChild(e); });
  row.appendChild(btn("Damage", ()=> applyDamage(+psel.value,+csel.value,+amt.value||0)));
  row.appendChild(btn("Heal", ()=>{ const c=S.players[psel.value].chars[csel.value]; c.curHp=Math.min(c.hp,c.curHp+(+amt.value||0)); if(c.curHp>0&&!c.alive)c.alive=true; render(); renderTokens(); }));
  wrap.appendChild(row);
  return wrap;
}

function openAttackTargeting(attacker, atk){ useAttack(attacker, atk); }

/* --- Card modal + effect engine --- */
let openCardIdx = null;
function cardApi(p){
  return {
    p, active: p.chars[p.activeIdx],
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    healActive(n){ healCharacter(p.chars[p.activeIdx], n); },
    selfDmgActive(n){ const l=locate(p.chars[p.activeIdx]); if(l) applyDamage(l.pi,l.ci,n); },
    draw(n){ drawCard(p, n); },
    hand(){ return p.hand.length; },
    distinctTypes(){ return new Set(p.chars.filter(c=>c.alive).map(c=>c.id)).size; },
    energySpent(){ return p.energySpentThisTurn || 0; },
    discount(n){ p.attackDiscount = (p.attackDiscount||0) + n; },
    aoeEnemies(n){ S.players.forEach((pl,pi)=>{ if(pi===S.current) return; pl.chars.forEach(c=>{ if(c.alive){ const l=locate(c); if(l) applyDamage(l.pi,l.ci,n); } }); }); },
    isActiveMage(){ return isMage(p.chars[p.activeIdx]); },
    log(m){ log(m); },
  };
}
function openCard(card, idx){
  openCardIdx = idx;
  const def = cardByName(card);
  $("#cardModalTitle").textContent = card;
  $("#cardModalType").textContent = def ? (def.type + (def.cls?` · ${def.cls}`:"")) : "";
  $("#cardModalText").textContent = def ? def.text : "";
  $("#cardModalNote").textContent = def && def.type==="support"
    ? "Playing a support card equips it to a support slot (max 2)."
    : (def && def.apply ? "Playing this auto-applies its effect." : "No auto-effect — apply the text manually, then it will be discarded.");
  $("#cardModal").classList.remove("hidden");
}
$("#cardClose").onclick = ()=> $("#cardModal").classList.add("hidden");
$("#cardPlay").onclick = ()=>{
  const p = S.players[S.current];
  if(openCardIdx==null){ $("#cardModal").classList.add("hidden"); return; }
  const name = p.hand[openCardIdx];
  const def = cardByName(name);
  if(def && def.type==="support"){
    if((p.supports||[]).length>=2){ alert("Both support slots are full — unequip one first."); return; }
    p.hand.splice(openCardIdx, 1);
    p.supports.push(name);
    log(`${p.name} equipped support: ${name}.`);
  } else {
    p.hand.splice(openCardIdx, 1);
    S.discard.push(name);
    log(`${p.name} played ${name}.`);
    if(def && def.apply){ def.apply(cardApi(p)); }
  }
  $("#cardModal").classList.add("hidden");
  render();
};

/* ========================= BOARD TOKENS & TILES ========================= */
function sc(){ return S.scale || 1; }

function renderTokens(){
  const board = $("#board");
  board.querySelectorAll(".token").forEach(t=>t.remove());
  renderTiles();
  const p0 = S.players[S.current];
  const activeChar = p0.chars[p0.activeIdx];
  S.players.forEach((p)=>{
    p.chars.forEach((c)=>{
      const t = document.createElement("div");
      const isActive = (c === activeChar);
      t.className = "token"+(c.alive?"":" dead")+(isActive?" active-pawn":"");
      t.style.left = (c.x*sc())+"px"; t.style.top = (c.y*sc())+"px";
      t.style.backgroundImage = `url('${ASSET.cards+c.img}')`;
      t.style.borderColor = p.color;
      t.title = `${p.name} — ${c.name} (${c.curHp}/${c.hp})`;
      makeDraggable(t, c);
      board.appendChild(t);
    });
  });
}

function renderTiles(){
  const board = $("#board");
  board.querySelectorAll(".tile").forEach(t=>t.remove());
  S.tiles.forEach((tile, i)=>{
    const d = document.createElement("div");
    d.className = "tile" + (calibrating ? " calib" : " move");
    d.style.left = (tile.x*sc())+"px"; d.style.top = (tile.y*sc())+"px";
    if(calibrating){
      d.title = `Tile ${i+1} — right-click to remove`;
      d.oncontextmenu = (e)=>{ e.preventDefault(); S.tiles.splice(i,1); renderTiles(); updateTileCount(); saveState(); };
    } else {
      d.title = `Move active pawn here`;
      d.onclick = ()=> moveActiveTo(tile);
    }
    board.appendChild(d);
  });
}

// Click-to-move: place the current player's active (living) character on this space.
function moveActiveTo(tile){
  const p = S.players[S.current];
  const c = p.chars[p.activeIdx];
  if(!c.alive) return;
  c.x = tile.x; c.y = tile.y; c.movedThisTurn = true;
  renderTokens(); saveState();
}

function nearestTile(x,y){
  let best=null, bd=Infinity;
  S.tiles.forEach(t=>{ const dx=t.x-x, dy=t.y-y, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=t; } });
  return best;
}

function makeDraggable(el, c){
  let sx,sy,ox,oy,drag=false;
  el.onmousedown = e=>{ if(calibrating) return; drag=true; el.style.cursor="grabbing"; sx=e.clientX; sy=e.clientY; ox=c.x; oy=c.y; e.preventDefault(); };
  window.addEventListener("mousemove", e=>{
    if(!drag) return;
    c.x = ox+(e.clientX-sx)/sc(); c.y = oy+(e.clientY-sy)/sc();   // screen delta -> board coords
    el.style.left=(c.x*sc())+"px"; el.style.top=(c.y*sc())+"px";
  });
  window.addEventListener("mouseup", ()=>{
    if(!drag) return;
    drag=false; el.style.cursor="grab"; c.movedThisTurn = true;
    if(S.tiles.length){ const t=nearestTile(c.x,c.y); if(t){ c.x=t.x; c.y=t.y; renderTokens(); } }  // snap to nearest space
    saveState();
  });
}

// Calibration: click the board to drop a tile at the click position (board coords).
$("#board").addEventListener("click", e=>{
  if(!calibrating) return;
  if(e.target.classList.contains("tile")) return;
  const rect = $("#board").getBoundingClientRect();
  S.tiles.push({ x:(e.clientX-rect.left)/sc(), y:(e.clientY-rect.top)/sc() });
  renderTiles(); updateTileCount(); saveState();
});

function updateTileCount(){ const el=$("#tileCount"); if(el) el.textContent = `${S.tiles.length} spaces`; }

/* ========================= HELPERS ========================= */
function h(html){ const d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstChild; }
function btn(label, fn){ const b=document.createElement("button"); b.textContent=label; b.onclick=fn; return b; }

$("#endTurnBtn").onclick = endTurn;
$("#newGameBtn").onclick = ()=>{
  if(!confirm("Start a new game? This clears the saved game.")) return;
  clearSave(); S=null;
  $("#game").classList.add("hidden");
  $("#setup").classList.remove("hidden");
  $("#resetSetup").click();
};

/* ---- Zoom + calibration controls ---- */
$("#zoomIn").onclick = ()=> setZoom(+0.1);
$("#zoomOut").onclick = ()=> setZoom(-0.1);
$("#zoomFit").onclick = ()=> fitBoard();

$("#calibrateBtn").onclick = ()=>{
  calibrating = true;
  $("#calibrateBar").classList.remove("hidden");
  $("#board").classList.add("calibrating");
  updateTileCount(); renderTokens();
};
$("#calibrateDone").onclick = ()=>{
  calibrating = false;
  $("#calibrateBar").classList.add("hidden");
  $("#board").classList.remove("calibrating");
  renderTokens();
};
$("#calibrateClear").onclick = ()=>{
  if(!confirm("Remove all defined spaces?")) return;
  S.tiles = []; renderTiles(); updateTileCount(); saveState();
};

window.addEventListener("resize", ()=>{ if(S) applyScale(); });

/* ========================= BOOT ========================= */
if(loadState()){ enterGame(); }
