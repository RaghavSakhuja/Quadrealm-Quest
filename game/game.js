/* ========================= DATA ========================= */
const ASSET = {
  cards: "/assets/Cards/",
};
const SAVE_KEY = "quadrealm_save_v4";

const { ROSTER, CARDS, CARD_POOL, cardByName, buildDeck, shuffle, drawCards, say, typeOf, activeChar, activeType, distinctTypes,
  isOut, loseHp, selfDamage, heal, combatDamage, startRegen, SAVE_VERSION, isCompatibleSave, createPlayer, opponents,
  SPACES, realmOf, spaceLabel, moveForward, landOn, spaceDamageBonus, spaceCostCut, onDoubleSpace } = Rules;

const PLAYER_COLORS = ["#e6b450","#58c6ff","#68d391","#ff6b6b"];

/* ========================= STATE ========================= */
let S = null;

function newState(players) {
  const deck = shuffle(buildDeck());
  return { version: SAVE_VERSION, players, deck, discard: [], current: 0, phase: "Main", log: [], drewThisTurn: false,
    scale: null, debug: false };
}

function log(msg){ say(S, msg); }

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
      <div>${s.picks.length ? "" : "<span style='color:var(--muted)'>no picks yet</span>"}</div>`;
    s.picks.forEach((id,pi)=>{   // the highlighted pick starts as the active character
      const pick = document.createElement("button");
      pick.textContent = ROSTER.find(r=>r.id===id).name + (pi===(s.active||0) ? " ★" : "");
      pick.className = pi===(s.active||0) ? "primary" : "ghost";
      pick.title = "Start with this active character";
      pick.onclick = ()=>{ s.active = pi; renderSeats(); };
      d.appendChild(pick);
    });
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
      if(picked){ seat.picks = seat.picks.filter(x=>x!==c.id); seat.active = 0; }
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
  const players = setup.seats.map((s,pi)=>({ ...createPlayer({ name:s.name, color:PLAYER_COLORS[pi], charIds:s.picks, activeIdx:s.active||0 }) }));
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
  const regen = startRegen(p);
  if(regen){ heal(p, regen); log(`${p.name} regenerates ${regen} HP (Forager's Resilience).`); }
  drawCard(p, 1);
  log(`${p.name}'s turn — +1 energy (now ${p.energy}), drew a card.`);
  render();
}

function endTurn(){
  const ending = S.players[S.current];
  if(hasSupport(ending, "Priestess' Blessing") && !isOut(ending)) heal(ending, 1);   // end-of-turn heal
  let n = S.players.length, i = S.current;
  for(let k=0;k<n;k++){ i=(i+1)%n; if(!isOut(S.players[i])){ S.current=i; break; } }
  const alivePlayers = S.players.filter(p=>!isOut(p));
  if(alivePlayers.length<=1){
    log(`🏆 ${alivePlayers[0]?.name||"Nobody"} wins!`);
    render();
    alert(`${alivePlayers[0]?.name||"Nobody"} wins the game!`);
    return;
  }
  startTurn();
}

const drawCard = (p, n)=> drawCards(S, p, n);

// Roll and move: once per turn (Debug allows more), then the final space's effect applies.
function rollDice(){
  const p = S.players[S.current];
  if(p.cantMove){ alert(`${p.name} cannot move this turn.`); return; }
  if(p.rolledThisTurn && !S.debug){ alert("You already rolled this turn."); return; }
  const r = 1+Math.floor(Math.random()*6);
  p.rolledThisTurn = true;
  log(`🎲 ${p.name} rolled ${r}.`);
  moveForward(S, p, r, ui);
  landOn(S, p, ui);
  render(); renderTokens();
  const d = $("#dice"); if(d) d.textContent = r;
  return r;
}

/* ---- Player decisions, handed to the rules ---- */
const LANE_LABEL = { "-1":"Outer lane (+1) — costs 1 energy", 0:"Middle lane — free", 1:"Inner lane (−1) — gives 1 energy" };
const ui = {
  chooseLane(choices, title){ return promptChoice(choices.map(o=>({ ...o, label:LANE_LABEL[o.energy] })), title); },
  chooseCard(hand, title){ const pick = promptChoice(hand.map((c,i)=>({ i, label:c })), title); return pick ? pick.i : null; },
  chooseChar(p, title){ const pick = promptChoice(p.chars.map((c,i)=>({ i, label:c.name })).filter(o=>o.i!==p.activeIdx), title); return pick ? pick.i : null; },
  choosePlayer(pis, title){ const pick = promptChoice(pis.map(pi=>{ const pl=S.players[pi];
    return { pi, label:`${pl.name} — ${pl.hp} HP, active ${activeChar(pl).name}` }; }), title); return pick ? pick.pi : null; },
  roll(){ const r = 1+Math.floor(Math.random()*6); const d=$("#dice"); if(d) d.textContent=r; return r; },
  confirm(title){ return confirm(title); },
};

/* ========================= ACTIONS ========================= */
function hasSupport(p, name){ return (p.supports||[]).includes(name); }

function realmDamage(defender, base, attacker, isAoe){
  if(!isAoe && pendingBaseBonus){ base += pendingBaseBonus; pendingBaseBonus = 0; } // Titan's Gauntlet
  const dmg = combatDamage({ base, attackerId:activeChar(attacker).id, attackerTerrain:realmOf(attacker.pos),
    defenderId:activeChar(defender).id, defenderTerrain:realmOf(defender.pos), isAoe });
  loseHp(defender, dmg);
  log(`  → ${defender.name} takes ${dmg}${isAoe?" (AOE)":""}.`);
  if(isOut(defender)) log(`💀 ${defender.name} is out!`);
  render(); renderTokens();
}
let pendingBaseBonus = 0;   // +damage applied to the next non-AOE hit
function dealSelfDamage(p, amount){
  const took = selfDamage(p, amount);
  log(took ? `  → ${p.name} takes ${amount} self-damage.` : `  → ${p.name} ignores ${amount} self-damage (Unyielding Fury).`);
  render(); renderTokens();
}
function healPlayer(p, amount){
  const h = heal(p, amount);
  log(`  → ${p.name} heals ${h} (now ${p.hp}/${p.maxHp}).`);
  render(); renderTokens();
}

function pickOpponent(){
  const choices = opponents(S, S.current).map(pi=>{ const pl=S.players[pi];
    return { pi, label:`${pl.name} — ${pl.hp} HP, active ${activeChar(pl).name}` }; });
  const pick = promptChoice(choices, "Attack which player?");
  return pick ? pick.pi : null;
}
function promptChoice(choices, title="Choose target:"){
  if(choices.length===0){ alert("No valid targets."); return null; }
  if(choices.length===1) return choices[0];
  const pick = prompt(title+"\n"+choices.map((c,i)=>`${i+1}. ${c.label}`).join("\n"), "1");
  const idx=(+pick)-1;
  return (!isNaN(idx) && choices[idx]) ? choices[idx] : null;
}

function useAttack(atk){
  const p = S.players[S.current], attacker = activeChar(p);
  const roll = atk.needsRoll ? (1+Math.floor(Math.random()*6)) : null;
  if(roll!=null){ const d=$("#dice"); if(d) d.textContent=roll; log(`🎲 ${p.name} rolled ${roll}.`); }

  const atkIndex = attacker.attacks.indexOf(atk);   // 0 basic, 1 skill, 2 ultimate
  const cost = atk.costOf ? atk.costOf(p, roll) : atk.cost;
  let supportCut = 0;
  if(atkIndex===1 && hasSupport(p, "Arcane Efficiency")) supportCut += 1;   // skill cost -1
  const effCost = Math.max(0, cost - (p.attackDiscount||0) - supportCut - spaceCostCut(p.pos));
  if(p.energy < effCost){ alert(`Not enough energy (need ${effCost}).`); return; }

  let target=null;
  if(atk.target==="enemy"){
    const pi = pickOpponent(); if(pi==null) return;
    target = S.players[pi];
  }
  const others = (skip)=> opponents(S, S.current).map(i=>S.players[i]).filter(o=>o!==skip);

  p.energy -= effCost;
  p.energySpentThisTurn = (p.energySpentThisTurn||0) + effCost;
  if(p.attackDiscount){ p.attackDiscount = 0; }   // discount consumed by this attack
  pendingBaseBonus = (atkIndex===0 && hasSupport(p, "The Titan's Gauntlet")) ? 1 : 0;   // base +1 dmg
  if(atk.target==="enemy") pendingBaseBonus += spaceDamageBonus(p.pos, ["basic","skill","ultimate"][atkIndex]);

  const api = {
    player:p, target, roll, energyUsed:effCost,
    dmg:(n)=>{ if(target) realmDamage(target, n, p, false); },
    aoe:(n)=> others(target).forEach(o=> realmDamage(o, n, p, true)),
    aoeAll:(n)=> others().forEach(o=> realmDamage(o, n, p, true)),
    selfDmg:(n)=> dealSelfDamage(p, n),
    heal:(n)=> healPlayer(p, n),
    steal:(n)=>{ if(target){ realmDamage(target, n, p, false); healPlayer(p, n); } },
    stealAll:(n)=>{ others().forEach(o=> realmDamage(o, n, p, true)); if(n>0) healPlayer(p, n); },
    draw:(n)=> drawCard(p, n),
    noMove:(o)=>{ o.noMoveNext=true; log(`  → ${o.name} cannot move next turn.`); },
    swap:()=>{ [p.pos,p.trail,target.pos,target.trail]=[target.pos,target.trail,p.pos,p.trail]; log(`  → swapped pieces with ${target.name}.`); },
    targetMoved: !!(target && target.movedThisTurn),
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
  $("#phaseLabel").textContent = `• ${p.hp} HP • ${p.energy} ⚡ • ${S.deck.length} in deck`;

  const panel = $("#sidePanel");
  panel.innerHTML = "";

  panel.appendChild(h(`<h2 style="color:${p.color}">${p.name}</h2>`));
  const hpPct = Math.round(100*p.hp/p.maxHp);
  panel.appendChild(h(`<div class="stat-row"><span class="pill">HP ${p.hp}/${p.maxHp}</span>
    <div class="hpbar"><div style="width:${hpPct}%"></div></div></div>`));

  const eRow = h(`<div class="stat-row"><span class="pill energy">⚡ Energy: ${p.energy}</span></div>`);
  if(S.debug){   // free resources: Debug only
    eRow.appendChild(btn("+1", ()=>{ p.energy++; render(); }));
    eRow.appendChild(btn("−1", ()=>{ if(p.energy>0){p.energy--; render();} }));
  }
  panel.appendChild(eRow);

  const chRow = h(`<div class="chars"></div>`);
  p.chars.forEach((c,ci)=>{
    const m = document.createElement("div");
    m.className = "mini"+(ci===p.activeIdx?" active":"");
    m.innerHTML = `<img src="${ASSET.cards+c.img}"/><div>${c.name}${ci===p.activeIdx?" ★":""}</div><div>${typeOf(c.id)}</div>`;
    chRow.appendChild(m);
  });
  panel.appendChild(h(`<div class="section"><b>Characters</b></div>`));
  panel.appendChild(chRow);

  // The space the piece is on sets the realm; its effects follow the active character's type.
  panel.appendChild(h(`<div class="section"><b>Your piece</b></div>`));
  panel.appendChild(h(`<div style="font-size:12px">${spaceLabel(p.pos)}</div>`));

  // Only the active character attacks.
  panel.appendChild(h(`<div class="section"><b>Attacks — ${activeChar(p).name}</b></div>`));
  const atkWrap = h(`<div class="attacks"></div>`);
  activeChar(p).attacks.forEach(a=>{
    const costLabel = a.costOf ? "*" : a.cost;   // * = cost depends on roll/energy
    const row = h(`<div class="atk"><span>${a.name} <span style="color:var(--muted)">— ${a.note}</span></span><span class="cost">${costLabel}⚡</span></div>`);
    const use = btn("Use", ()=> useAttack(a));
    use.disabled = !a.costOf && p.energy < a.cost;   // dynamic-cost attacks check at resolve time
    row.appendChild(use);
    atkWrap.appendChild(row);
  });
  panel.appendChild(atkWrap);

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

function buildDamageHelper(){   // Debug only; acts on team HP and cannot bring a player back.
  const wrap = h(`<div></div>`);
  const psel = document.createElement("select");
  S.players.forEach((pl,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=`${pl.name} (${pl.hp}/${pl.maxHp})`; psel.appendChild(o); });
  const amt = h(`<input type="number" value="2" min="0" />`);
  const row = h(`<div class="controls" style="align-items:center"></div>`);
  [psel,amt].forEach(e=>{ e.style.background="var(--panel2)"; e.style.color="var(--text)"; e.style.border="1px solid var(--line)"; e.style.borderRadius="4px"; e.style.padding="3px"; row.appendChild(e); });
  row.appendChild(btn("Damage", ()=>{ loseHp(S.players[psel.value], +amt.value||0); render(); renderTokens(); }));
  row.appendChild(btn("Heal", ()=>{ const t=S.players[psel.value]; if(!isOut(t)){ t.hp=Math.min(t.maxHp,t.hp+(+amt.value||0)); } render(); renderTokens(); }));
  wrap.appendChild(row);
  return wrap;
}

/* --- Card modal + effect engine --- */
let openCardIdx = null;
function cardApi(p){
  return {
    p,
    energy(n){ p.energy = Math.max(0, p.energy + n); },
    heal(n){ healPlayer(p, n); },
    selfDmg(n){ dealSelfDamage(p, n); },
    draw(n){ drawCard(p, n); },
    hand(){ return p.hand.length; },
    distinctTypes(){ return distinctTypes(p); },
    energySpent(){ return p.energySpentThisTurn || 0; },
    discount(n){ p.attackDiscount = (p.attackDiscount||0) + n; },
    aoeEnemies(n){ opponents(S, S.current).forEach(pi=>{ loseHp(S.players[pi], n); log(`  → ${S.players[pi].name} takes ${n}.`); }); },
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
    const twice = onDoubleSpace(p); if(twice) p.doubleUsedAt = p.pos;   // "Next Event Card Effect Doubled" space
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
    if(isOut(p)) return;   // eliminated players leave the board
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
