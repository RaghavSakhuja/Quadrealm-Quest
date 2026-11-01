/* ========================= DATA ========================= */
const ASSET = {
  cards: "/assets/Cards/",
};
const SAVE_KEY = "quadrealm_save_v3";

const { ROSTER, CARDS, CARD_POOL, cardByName, buildDeck, classOf,
  combatDamage, selfDamageAfterTerrain, healAfterTerrain, startRegen, SAVE_VERSION, isCompatibleSave, createPlayer,
  livingChars, opponents, hasLivingClass, veilpiercerDamage,
  SPACES, nextOptions, prevSpace, realmOf, SPACE_EFFECTS } = Rules;

const PLAYER_COLORS = ["#e6b450","#58c6ff","#68d391","#ff6b6b"];

/* ========================= STATE ========================= */
let S = null;

function newState(players) {
  const deck = shuffle(buildDeck());
  return { version: SAVE_VERSION, players, deck, discard: [], current: 0, phase: "Main", log: [], drewThisTurn: false,
    scale: null, debug: false };
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
    const saved = JSON.parse(raw);
    if(!isCompatibleSave(saved)){ clearSave(); return false; }   // older formats are discarded
    S = saved;
    // Re-attach attack data (functions/arrays survive JSON, but keep roster as source of truth).
    S.players.forEach(p=>p.chars.forEach(c=>{
      const def = ROSTER.find(r=>r.id===c.id);
      if(def) c.attacks = def.attacks;
    }));
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
  const players = setup.seats.map((s,pi)=>({ ...createPlayer({ name:s.name, color:PLAYER_COLORS[pi], charIds:s.picks, seat:pi }) }));
  S = newState(players);
  enterGame();
  startTurn(true);
};

function enterGame(){
  $("#setup").classList.add("hidden");
  $("#game").classList.remove("hidden");
  $("#debugToggle").checked = !!S.debug;
  render(); renderTokens();
  const img = $(".boardimg");
  if(img.complete && img.naturalWidth) initBoardScale();
  else img.onload = initBoardScale;
}

/* ========================= BOARD SCALING ========================= */
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
  p.movedThisTurn = false; p.rolledThisTurn = false; p.cantMove = false;
  if(p.noMoveNext){ log(`⛔ ${p.name} cannot move this turn.`); p.noMoveNext=false; p.cantMove=true; }
  p.chars.forEach(c=>{
    const regen = c.alive ? startRegen(c.id, terrainOf(c)) : 0;
    if(regen){ c.curHp=Math.min(c.hp,c.curHp+regen); log(`${c.name} regenerates ${regen} HP (Forager's Resilience).`); }
  });
  drawCard(p, 1);
  log(`${p.name}'s turn — +1 energy (now ${p.energy}), drew a card.`);
  render();
}

function endTurn(){
  const ending = S.players[S.current];
  if(hasSupport(ending, "Priestess' Blessing")){   // end-of-turn heal
    if(livingChars(ending).length){ healCharacter(chooseCharacter(S.current, "Priestess' Blessing: heal which character?"), 1); }
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

// Roll and move: once per turn (Debug allows more), then the final space's effect applies.
function rollDice(){
  const p = S.players[S.current];
  if(p.cantMove){ alert(`${p.name} cannot move this turn.`); return; }
  if(p.rolledThisTurn && !S.debug){ alert("You already rolled this turn."); return; }
  const r = 1+Math.floor(Math.random()*6);
  p.rolledThisTurn = true;
  log(`🎲 ${p.name} rolled ${r}.`);
  moveForward(p, r);
  landOn(p);
  render(); renderTokens();
  const d = $("#dice"); if(d) d.textContent = r;
  return r;
}

/* ---- Movement along the board loop ---- */
const LANE_LABEL = { 1:"+1 lane (outer) — gain 1 energy", 0:"Middle lane — free", "-1":"−1 lane (inner) — pay 1 energy" };
function chooseLane(p, opts){
  const choices = opts.filter(o=> o.energy>=0 || p.energy>=-o.energy)
    .map(o=>({ ...o, label:LANE_LABEL[o.energy] }));
  const realm = realmOf(opts[0].to);
  return promptChoice(choices, `${p.name}: which lane into ${realm}?`) || choices.find(o=>o.energy===0);   // cancel → middle
}
function moveForward(p, n){
  for(let k=0;k<n;k++){
    const opts = nextOptions(p.pos);
    const o = opts.length>1 ? chooseLane(p, opts) : opts[0];
    if(o.energy){ p.energy = Math.max(0, p.energy + o.energy); log(`  → ${o.energy>0?"+1":"−1"} lane: ${p.name} ${o.energy>0?"gains":"pays"} 1 energy.`); }
    p.trail.push(p.pos); if(p.trail.length>20) p.trail.shift();
    p.pos = o.to;
  }
  if(n>0) p.movedThisTurn = true;
}
function moveBack(p, n){
  for(let k=0;k<n;k++) p.pos = p.trail.pop() || prevSpace(p.pos);   // back the way it came
  if(n>0) p.movedThisTurn = true;
}
function spaceLabel(id){ const s=SPACES[id]; return `${s.realm||"Corridor"}${s.text?` — ${s.text}`:""}`; }

// Apply the effect of the space the piece ended on.
function landOn(p){
  const s = SPACES[p.pos];
  log(`  → ${p.name} lands on ${spaceLabel(p.pos)}.`);
  const fx = s.text && SPACE_EFFECTS[s.text];
  if(fx) fx(spaceApi(p));
}
function spaceApi(p){
  const pi = S.players.indexOf(p);
  return {
    draw(n){ drawCard(p, n); },
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    discardChosen(){
      if(!p.hand.length){ log("  → no card to discard."); return; }
      const pick = promptChoice(p.hand.map((c,i)=>({ i, label:c })), "Discard which card?") || { i:0 };
      const [c] = p.hand.splice(pick.i, 1); S.discard.push(c); log(`  → discarded ${c}.`);
    },
    healChosen(n){ const c=chooseCharacter(pi, `Heal ${n}: which character?`); if(c) healCharacter(c, n); },
    loseHpChosen(n){ const c=chooseCharacter(pi, `Lose ${n} HP: which character?`); const l=c&&locate(c);
      if(l){ applyDamage(l.pi, l.ci, n); log(`  → ${c.name} loses ${n} HP.`); } },
    moveBack(n){ moveBack(p, n); log(`  → moved back to ${spaceLabel(p.pos)}.`); },   // that space does not trigger
    changeCharacter(){ changeCharacter(p); },
    dmgBuff(kind, n){ p.dmgBuffs[kind] += n; log(`  → next ${kind==="any"?"attack":kind+" attack"} deals +${n} damage.`); },
    costBuff(n){ p.costCut += n; log(`  → next attack costs ${n} less energy.`); },
    doubleNextEvent(){ p.doubleEvent = true; log("  → next event card's effect is doubled."); },
  };
}
// Swap one living character for a character card nobody holds; it starts at full HP.
function changeCharacter(p){
  const held = new Set(S.players.flatMap(pl=>pl.chars.map(c=>c.id)));
  const free = ROSTER.filter(r=>!held.has(r.id));
  if(!free.length || !livingChars(p).length){ log("  → no character to change."); return; }
  if(!confirm(`${p.name}: change one of your characters?`)) return;
  const pi = S.players.indexOf(p);
  const out = chooseCharacter(pi, "Replace which character?", true); if(!out) return;
  const pick = promptChoice(free.map(r=>({ r, label:`${r.name} (${r.hp} HP)` })), `Replace ${out.name} with?`); if(!pick) return;
  p.chars[p.chars.indexOf(out)] = { ...pick.r, curHp:pick.r.hp, alive:true };
  log(`  → ${p.name} swapped ${out.name} for ${pick.r.name}.`);
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
function ownerOf(ch){ const l=locate(ch); return l ? S.players[l.pi] : null; }
function terrainOf(ch){ const o=ownerOf(ch); return o ? realmOf(o.pos) : null; }   // realm of the space the owner's piece is on
// Outgoing combat damage, applying attacker/defender terrain modifiers.
let pendingBaseBonus = 0;   // +damage applied to the next non-AOE hit (The Titan's Gauntlet)
function dealCombatDamage(defChar, base, attacker, isAoe){
  if(!isAoe && pendingBaseBonus){ base += pendingBaseBonus; pendingBaseBonus = 0; } // Titan's Gauntlet
  const dmg = combatDamage({ base, attackerId:attacker.id, attackerTerrain:terrainOf(attacker),
    defenderId:defChar.id, defenderTerrain:terrainOf(defChar), isAoe });
  const loc = locate(defChar); if(!loc) return;
  applyDamage(loc.pi, loc.ci, dmg);
  log(`  → ${defChar.name} takes ${dmg}${isAoe?" (AOE)":""}.`);
}
function dealSelfDamage(ch, amount){
  if(selfDamageAfterTerrain(ch.id, terrainOf(ch), amount)===0 && amount>0){ log(`  → ${ch.name} ignores ${amount} self-damage (Unyielding Fury).`); return; }
  const loc = locate(ch); if(!loc) return;
  applyDamage(loc.pi, loc.ci, amount);
  log(`  → ${ch.name} takes ${amount} self-damage.`);
}
function healCharacter(ch, amount){
  amount = healAfterTerrain(ch.id, terrainOf(ch), amount);
  if(!ch.alive && ch.curHp<=0) return;
  ch.curHp = Math.min(ch.hp, ch.curHp + amount);
  log(`  → ${ch.name} heals ${amount} (now ${ch.curHp}/${ch.hp}).`);
  render(); renderTokens();
}

// Attacks target a player; the defender then chooses which of their characters takes it.
function pickOpponent(){
  const choices = opponents(S, S.current).map(pi=>{ const pl=S.players[pi];
    return { pi, label:`${pl.name} — ${livingChars(pl).map(c=>`${c.name} (${c.curHp})`).join(", ")}` }; });
  const pick = promptChoice(choices, "Attack which player?");
  return pick ? pick.pi : null;
}
// A forced choice (defender, area hit) falls back to the first living character on cancel;
// a cancellable one (your own pick) returns null. Null also when nobody is alive.
function chooseCharacter(pi, title, cancellable=false){
  const chars = livingChars(S.players[pi]);
  if(!chars.length) return null;
  const pick = promptChoice(chars.map(c=>({ char:c, label:`${c.name} (${c.curHp}/${c.hp})` })), title);
  return pick ? pick.char : (cancellable ? null : chars[0]);
}
function promptChoice(choices, title="Choose target:"){
  if(choices.length===0){ alert("No valid targets."); return null; }
  if(choices.length===1) return choices[0];
  const pick = prompt(title+"\n"+choices.map((c,i)=>`${i+1}. ${c.label}`).join("\n"), "1");
  const idx=(+pick)-1;
  return (!isNaN(idx) && choices[idx]) ? choices[idx] : null;
}

function useAttack(attacker, atk){
  const p = S.players[S.current];
  const roll = atk.needsRoll ? (1+Math.floor(Math.random()*6)) : null;
  if(roll!=null){ const d=$("#dice"); if(d) d.textContent=roll; log(`🎲 ${p.name} rolled ${roll}.`); }

  const atkIndex = attacker.attacks.indexOf(atk);   // 0 basic, 1 skill, 2 ultimate
  const cost = atk.costOf ? atk.costOf(p, roll) : atk.cost;
  let supportCut = 0;
  if(atkIndex===1 && hasSupport(p, "Arcane Efficiency")) supportCut += 1;   // skill cost -1
  const effCost = Math.max(0, cost - (p.attackDiscount||0) - supportCut - (p.costCut||0));
  if(p.energy < effCost){ alert(`Not enough energy (need ${effCost}).`); return; }

  let target=null, veil=false;
  if(atk.target==="enemy"){
    const pi = pickOpponent(); if(pi==null) return;
    veil = hasSupport(p, "Veilpiercer") && confirm("Use Veilpiercer? You pick the character, half damage.");
    const char = veil ? chooseCharacter(pi, `Veilpiercer: which of ${S.players[pi].name}'s characters?`, true)
                      : chooseCharacter(pi, `${S.players[pi].name}: which character takes the hit?`);
    if(!char) return;
    target = { pi, char };
  } else if(atk.target==="ally"){
    const char = chooseCharacter(S.current, "Which of your characters?", true); if(!char) return;
    target = { pi:S.current, char };
  }
  const hit = (n)=> veil ? veilpiercerDamage(n) : n;
  // Area effects: every hit opponent chooses which of their characters takes it.
  const eachOpponent = (fn, skipPi)=> opponents(S, S.current).filter(pi=>pi!==skipPi)
    .forEach(pi=> fn(chooseCharacter(pi, `${S.players[pi].name}: which character takes ${atk.name}?`)));

  p.energy -= effCost;
  p.energySpentThisTurn = (p.energySpentThisTurn||0) + effCost;
  if(p.attackDiscount){ p.attackDiscount = 0; }   // discount consumed by this attack
  p.costCut = 0;                                   // board-space discount too
  pendingBaseBonus = (atkIndex===0 && hasSupport(p, "The Titan's Gauntlet")) ? 1 : 0;   // base +1 dmg
  if(atk.target==="enemy"){   // board-space damage bonuses ride on the main hit
    const kind = ["basic","skill","ultimate"][atkIndex];
    pendingBaseBonus += p.dmgBuffs.any + p.dmgBuffs[kind];
    p.dmgBuffs.any = 0; p.dmgBuffs[kind] = 0;
  }

  const api = {
    attacker, player:p, target, roll, energyUsed:effCost,
    dmg:(n)=>{ if(target) dealCombatDamage(target.char, hit(n), attacker, false); },
    aoe:(n)=> eachOpponent(c=> dealCombatDamage(c, n, attacker, true), target && target.pi),
    aoeAll:(n)=> eachOpponent(c=> dealCombatDamage(c, n, attacker, true)),
    selfDmg:(n)=> dealSelfDamage(attacker, n),
    heal:(ch,n)=> healCharacter(ch, n),
    healAllies:(n)=>{ p.chars.forEach(c=>{ if(c.alive) healCharacter(c, n); }); },
    steal:(n)=>{ if(target){ dealCombatDamage(target.char, hit(n), attacker, false); healCharacter(attacker, hit(n)); } },
    stealAll:(n)=>{ eachOpponent(c=> dealCombatDamage(c, n, attacker, true)); if(n>0) healCharacter(attacker, n); },
    draw:(n)=> drawCard(p, n),
    noMove:(ch)=>{ const o=ownerOf(ch); o.noMoveNext=true; log(`  → ${o.name} cannot move next turn.`); },
    swapPos:(ch)=>{ const o=ownerOf(ch); [p.pos,p.trail,o.pos,o.trail]=[o.pos,o.trail,p.pos,p.trail]; log(`  → swapped pieces with ${o.name}.`); },
    targetMoved: !!(target && S.players[target.pi].movedThisTurn),
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
  if(S.debug){   // free resources: Debug only
    eRow.appendChild(btn("+1", ()=>{ p.energy++; render(); }));
    eRow.appendChild(btn("−1", ()=>{ if(p.energy>0){p.energy--; render();} }));
  }
  panel.appendChild(eRow);

  const chRow = h(`<div class="chars"></div>`);
  p.chars.forEach(c=>{
    const m = document.createElement("div");
    m.className = "mini"+(c.alive?"":" dead");
    m.innerHTML = `<img src="${ASSET.cards+c.img}"/><div>${c.name}</div><div>${c.curHp}/${c.hp}</div>`;
    chRow.appendChild(m);
  });
  panel.appendChild(h(`<div class="section"><b>Characters</b></div>`));
  panel.appendChild(chRow);

  // The space the piece is on sets the realm (terrain bonuses) for all this player's characters.
  panel.appendChild(h(`<div class="section"><b>Your piece</b></div>`));
  panel.appendChild(h(`<div style="font-size:12px">${spaceLabel(p.pos)}</div>`));
  const b = p.dmgBuffs, buffs = [
    b.any && `next attack +${b.any} dmg`, b.basic && `basic +${b.basic}`, b.skill && `skill +${b.skill}`,
    b.ultimate && `ultimate +${b.ultimate}`, p.costCut && `next attack −${p.costCut}⚡`, p.doubleEvent && "next event doubled",
  ].filter(Boolean);
  if(buffs.length) panel.appendChild(h(`<div style="font-size:11px;color:var(--good)">${buffs.join(" · ")}</div>`));

  // Any living character may attack; pick the character and the attack together.
  panel.appendChild(h(`<div class="section"><b>Attacks</b></div>`));
  livingChars(p).forEach(ch=>{
    panel.appendChild(h(`<div style="font-size:12px;color:var(--accent2);margin-top:4px">${ch.name}</div>`));
    const atkWrap = h(`<div class="attacks"></div>`);
    ch.attacks.forEach(a=>{
      const costLabel = a.costOf ? "*" : a.cost;   // * = cost depends on roll/energy
      const row = h(`<div class="atk"><span>${a.name} <span style="color:var(--muted)">— ${a.note}</span></span><span class="cost">${costLabel}⚡</span></div>`);
      const use = btn("Use", ()=> useAttack(ch, a));
      use.disabled = !a.costOf && p.energy < a.cost;   // dynamic-cost attacks check at resolve time
      row.appendChild(use);
      atkWrap.appendChild(row);
    });
    panel.appendChild(atkWrap);
  });

  const dice = h(`<div class="section"><b>Dice & Movement</b></div>`);
  panel.appendChild(dice);
  const drow = h(`<div class="controls"></div>`);
  drow.appendChild(h(`<span id="dice">–</span>`));
  const rollB = btn("Roll 🎲", rollDice);
  rollB.disabled = p.cantMove || (p.rolledThisTurn && !S.debug);
  drow.appendChild(rollB);
  panel.appendChild(drow);

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
  if(S.debug) handCtrls.appendChild(btn("Draw +1", ()=>{ drawCard(p,1); render(); }));
  handCtrls.appendChild(btn("Discard→+1⚡", ()=>{ if(p.hand.length){ S.discard.push(p.hand.pop()); p.energy++; log(`${p.name} discarded for +1 energy.`); render(); } }));
  panel.appendChild(handCtrls);

  if(S.debug){
    panel.appendChild(h(`<div class="section"><b>Manual Damage / Heal</b></div>`));
    panel.appendChild(buildDamageHelper());
  }

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
    p,
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    healChosen(n){ const c=chooseCharacter(S.current, "Heal which character?"); if(c) healCharacter(c, n); },
    selfDmgChosen(n){ const c=chooseCharacter(S.current, "Which character takes the self-damage?"); const l=c&&locate(c); if(l) applyDamage(l.pi,l.ci,n); },
    draw(n){ drawCard(p, n); },
    hand(){ return p.hand.length; },
    distinctTypes(){ return new Set(p.chars.filter(c=>c.alive).map(c=>c.id)).size; },
    energySpent(){ return p.energySpentThisTurn || 0; },
    discount(n){ p.attackDiscount = (p.attackDiscount||0) + n; },
    aoeEnemies(n){ opponents(S, S.current).forEach(pi=>{ const l=locate(chooseCharacter(pi, `${S.players[pi].name}: which character takes the hit?`)); if(l) applyDamage(l.pi,l.ci,n); }); },
    hasMage(){ return hasLivingClass(p, "Mages"); },
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
    const twice = p.doubleEvent; p.doubleEvent = false;   // "Next Event Card Effect Doubled" space
    if(def && def.apply){ def.apply(cardApi(p)); if(twice){ log("  → doubled:"); def.apply(cardApi(p)); } }
    else if(twice) log("  → doubled: apply this card's effect twice.");
  }
  $("#cardModal").classList.add("hidden");
  render();
};

/* ========================= BOARD TOKENS ========================= */
function sc(){ return S.scale || 1; }

// Pieces sit on their space's centre; pieces sharing a space fan out so all stay visible.
const SHARE_OFFSETS = [[0,0],[-14,-14],[14,14],[14,-14],[-14,14]];
function renderTokens(){
  const board = $("#board");
  board.querySelectorAll(".token").forEach(t=>t.remove());
  const seen = {};
  S.players.forEach((p, pi)=>{
    if(!p.chars.some(c=>c.alive)) return;   // eliminated players leave the board
    const s = SPACES[p.pos], k = seen[p.pos] = (seen[p.pos]||0) + 1;
    const [dx,dy] = SHARE_OFFSETS[(k-1) % SHARE_OFFSETS.length];
    const t = document.createElement("div");
    t.className = "token"+(pi===S.current?" active-pawn":"");
    t.style.left = (s.x*sc()+dx)+"px"; t.style.top = (s.y*sc()+dy)+"px";
    t.style.background = p.color; t.style.borderColor = p.color;
    t.textContent = pi+1;
    t.title = `${p.name} — ${spaceLabel(p.pos)}`;
    board.appendChild(t);
  });
}

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

/* ---- Zoom controls ---- */
$("#zoomIn").onclick = ()=> setZoom(+0.1);
$("#zoomOut").onclick = ()=> setZoom(-0.1);
$("#zoomFit").onclick = ()=> fitBoard();
$("#debugToggle").onchange = (e)=>{ S.debug = e.target.checked; render(); };

window.addEventListener("resize", ()=>{ if(S) applyScale(); });

/* ========================= BOOT ========================= */
if(loadState()){ enterGame(); }
