/* ========================= DATA ========================= */
const ASSET = {
  cards: "/assets/Cards/",
};
const SAVE_KEY = "quadrealm_save_v4";

const { ROSTER, cardByName, buildDeck, shuffle, drawCards, say, typeOf, activeChar,
  isOut, loseHp, SAVE_VERSION, isCompatibleSave, createPlayer,
  SPACES, spaceLabel, allowed, attackCost } = Rules;

const PLAYER_COLORS = ["#e6b450","#58c6ff","#68d391","#ff6b6b"];

/* ========================= STATE ========================= */
let S = null;

function newState(players) {
  const deck = shuffle(buildDeck());
  return { version: SAVE_VERSION, players, deck, discard: [], current: 0, phase: "Move", log: [],
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
  Rules.startTurn(S, ui);
  enterGame();
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
function announceWinner(){
  if(S.winner==null || S.announced) return;
  S.announced = true;
  alert(`${S.players[S.winner].name} wins the game!`);
}
function refresh(){ render(); renderTokens(); announceWinner(); }
function endTurn(){
  if(!allowed(S).end) return;
  Rules.endTurn(S, ui);
  refresh();
}

const drawCard = (p, n)=> drawCards(S, p, n);

// Roll and move once per turn (Debug allows more); the final space's effect applies.
function rollDice(){
  if(!allowed(S).roll) return;
  const r = Rules.rollDie(S, S.players[S.current], ui, "Movement");
  Rules.roll(S, r, ui);
  refresh();
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
  chooseRoll(rolls, title){ const pick = promptChoice(rolls.map(r=>({ r, label:`${r}` })), title); return pick ? pick.r : null; },
  chooseNumber(min, max, title){ const pick = promptChoice(Array.from({length:max-min+1}, (_,i)=>({ n:min+i, label:`${min+i}` })), title); return pick ? pick.n : null; },
  chooseSpace(ids, title){ const pick = promptChoice(ids.map(id=>({ id, label:spaceLabel(id) })), title); return pick ? pick.id : null; },
  confirm(title){ return confirm(title); },
};

/* ========================= ACTIONS ========================= */
function promptChoice(choices, title="Choose target:"){
  if(choices.length===0){ alert("No valid targets."); return null; }
  if(choices.length===1) return choices[0];
  const pick = prompt(title+"\n"+choices.map((c,i)=>`${i+1}. ${c.label}`).join("\n"), "1");
  const idx=(+pick)-1;
  return (!isNaN(idx) && choices[idx]) ? choices[idx] : null;
}

function useAttack(atkIndex){
  const result = Rules.attackFlow(S, atkIndex, ui);
  if(result==="cancelled") return;
  refresh();
}

/* ========================= RENDER ========================= */
function render(){
  saveState();
  const p = S.players[S.current];
  $("#turnLabel").textContent = `${p.name}`;
  $("#phaseLabel").textContent = `• ${S.phase} • ${p.hp} HP • ${p.energy} ⚡ • ${S.deck.length} in deck`;

  const can = allowed(S);
  $("#endTurnBtn").disabled = !can.end;
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

  if(p.effects.length) panel.appendChild(h(`<div style="font-size:11px;color:var(--good)">Active: ${p.effects.map(e=>e.card).join(" · ")}</div>`));

  // Only the active character attacks.
  panel.appendChild(h(`<div class="section"><b>Attacks — ${activeChar(p).name}</b></div>`));
  const atkWrap = h(`<div class="attacks"></div>`);
  activeChar(p).attacks.forEach((a,ai)=>{
    const cost = attackCost(p, ai, null, !!p.bonusAttack), costLabel = a.costOf ? "*" : cost;   // * = cost depends on roll/energy
    const row = h(`<div class="atk"><span>${a.name} <span style="color:var(--muted)">— ${a.note}</span></span><span class="cost">${costLabel}⚡</span></div>`);
    const use = btn("Use", ()=> useAttack(ai));
    use.disabled = !can.attack || (!a.costOf && p.energy < cost);   // a cost set by the roll is checked at resolve time
    row.appendChild(use);
    atkWrap.appendChild(row);
  });
  panel.appendChild(atkWrap);
  const swRow = h(`<div class="controls"></div>`);
  p.chars.forEach((c,ci)=>{ if(ci===p.activeIdx) return;
    const sw = btn(`Switch to ${c.name}`, ()=>{ Rules.switchActive(S, ci); render(); });
    sw.disabled = !can.switchChar; swRow.appendChild(sw); });
  panel.appendChild(swRow);

  const dice = h(`<div class="section"><b>Dice & Movement</b></div>`);
  panel.appendChild(dice);
  const drow = h(`<div class="controls"></div>`);
  drow.appendChild(h(`<span id="dice">–</span>`));
  const rollB = btn("Roll 🎲", rollDice);
  rollB.disabled = !can.roll;
  drow.appendChild(rollB);
  if(Rules.supportActive(p, "Steady March")){
    const m = btn("Move exactly 3", ()=>{ Rules.steadyMarch(S, ui); refresh(); }); m.disabled = S.phase!=="Move"; drow.appendChild(m);
  }
  if(Rules.supportActive(p, "Teleportation Spell")){
    const t = btn("Teleport (up to 3)", ()=>{ Rules.teleportMove(S, ui); refresh(); }); t.disabled = S.phase!=="Move"; drow.appendChild(t);
  }
  panel.appendChild(drow);

  panel.appendChild(h(`<div class="section"><b>Support Slots (${(p.supports||[]).length}/2)</b></div>`));
  const slots = h(`<div class="supports"></div>`);
  for(let i=0;i<2;i++){
    const name = (p.supports||[])[i];
    if(name){
      const def = cardByName(name);
      const s = h(`<div class="slot filled"><div class="slot-name">${name}</div><div class="slot-text">${def?def.text:""}</div></div>`);
      const un = btn("Unequip", ()=>{ p.supports.splice(i,1); S.discard.push(name); log(`${p.name} unequipped ${name}.`); render(); });
      un.disabled = !can.cards; s.appendChild(un);
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
  const discardB = btn("Discard→+1⚡", ()=>{
    const i = ui.chooseCard(p.hand, "Discard which card for +1 energy?"); if(i==null) return;
    const [c] = p.hand.splice(i, 1); S.discard.push(c); p.energy++; log(`${p.name} discarded ${c} for +1 energy.`); render();
  });
  discardB.disabled = !can.cards || !p.hand.length; handCtrls.appendChild(discardB);
  if(Rules.supportActive(p, "Enchanted Library")){
    const lib = btn("Library: 2⚡ → draw 1", ()=>{ Rules.libraryDraw(S); render(); });
    lib.disabled = !can.cards || p.energy<2 || p.hand.length>=6; handCtrls.appendChild(lib);
  }
  if(Rules.supportActive(p, "Refined Strategy")){
    const rs = btn("Refined Strategy: swap a card", ()=>{ Rules.refinedSwap(S, ui.chooseCard(p.hand, "Discard which card to draw a new one?")); render(); });
    rs.disabled = !can.cards || p.refinedUsed || !p.hand.length; handCtrls.appendChild(rs);
  }
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
  row.appendChild(btn("Damage", ()=>{ loseHp(S.players[psel.value], +amt.value||0); Rules.settleTurn(S, ui); refresh(); }));
  row.appendChild(btn("Heal", ()=>{ const t=S.players[psel.value]; if(!isOut(t)){ t.hp=Math.min(t.maxHp,t.hp+(+amt.value||0)); } render(); renderTokens(); }));
  wrap.appendChild(row);
  return wrap;
}

/* --- Card modal --- */
let openCardIdx = null;
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
    if(!allowed(S).cards){ alert("Supports are equipped in the Main phase, before your action."); return; }
    if((p.supports||[]).length>=2){ alert("Both support slots are full — unequip one first."); return; }
    Rules.equipSupport(S, openCardIdx);
  } else {
    Rules.playEvent(S, openCardIdx, ui);
  }
  $("#cardModal").classList.add("hidden");
  refresh();
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
