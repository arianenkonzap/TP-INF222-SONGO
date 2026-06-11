/* ================================================
   SONGO — Logique de jeu complète
   Règles : clubawale.com/post/comment-jouer-le-songo
   ================================================ */

"use strict";

// ── Constantes ──────────────────────────────────────
const PITS        = 7;
const INIT_SEEDS  = 5;
const WIN_THRESH  = 40;
const END_THRESH  = 10;

const PLAYER = { NORD: 0, SUD: 1 };

// ── État global ──────────────────────────────────────
let state    = {};
let vsAI     = false;
let animLock = false;

// ── Navigation écrans ───────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

document.getElementById("btn-vs-ai").addEventListener("click",      () => { vsAI = true;  startGame(); });
document.getElementById("btn-vs-human").addEventListener("click",   () => { vsAI = false; startGame(); });
document.getElementById("btn-rules-title").addEventListener("click",() => showScreen("screen-rules"));
document.getElementById("btn-back-rules").addEventListener("click", () => showScreen("screen-title"));
document.getElementById("btn-rules-game").addEventListener("click", () => showScreen("screen-rules"));
document.getElementById("btn-menu").addEventListener("click",       () => showScreen("screen-title"));
document.getElementById("btn-play-again").addEventListener("click", () => { hideOverlay(); startGame(); });
document.getElementById("btn-go-menu").addEventListener("click",    () => { hideOverlay(); showScreen("screen-title"); });
document.getElementById("btn-new-game").addEventListener("click",   () => startGame());

// ── Init ─────────────────────────────────────────────
function initState() {
  return {
    board:  [ Array(PITS).fill(INIT_SEEDS), Array(PITS).fill(INIT_SEEDS) ],
    store:  [0, 0],
    turn:   PLAYER.SUD,
    over:   false,
    winner: null,
  };
}

function startGame() {
  state     = initState();
  animLock  = false;
  document.getElementById("btn-new-game").style.display = "none";
  buildBoard();
  updateUI();
  showScreen("screen-game");
  if (vsAI && state.turn === PLAYER.NORD) setTimeout(aiPlay, 700);
}

// ── Construction DOM ─────────────────────────────────
function buildBoard() {
  const rowNord = document.getElementById("row-nord");
  const rowSud  = document.getElementById("row-sud");
  rowNord.innerHTML = "";
  rowSud.innerHTML  = "";

  // NORD : cases 0→6 de gauche à droite
  for (let i = 0; i < PITS; i++) rowNord.appendChild(createPit(PLAYER.NORD, i));

  // SUD : cases 6→0 de gauche à droite (case 1=idx0 à droite pour SUD)
  for (let i = PITS - 1; i >= 0; i--) rowSud.appendChild(createPit(PLAYER.SUD, i));
}

function createPit(player, idx) {
  const el    = document.createElement("div");
  el.classList.add("pit");
  el.dataset.player = player;
  el.dataset.idx    = idx;

  const label = document.createElement("span");
  label.classList.add("pit-label");
  label.textContent = idx + 1;

  const count = document.createElement("span");
  count.classList.add("pit-count");

  const seeds = document.createElement("div");
  seeds.classList.add("seeds-visual");

  el.append(label, count, seeds);
  el.addEventListener("click", () => onPitClick(player, idx));
  return el;
}

// ── Mise à jour UI ───────────────────────────────────
function updateUI() {
  document.getElementById("score-val-nord").textContent = state.store[PLAYER.NORD];
  document.getElementById("score-val-sud").textContent  = state.store[PLAYER.SUD];

  const nordName = vsAI ? "IA" : "NORD";
  document.getElementById("name-nord").textContent     = nordName;
  document.getElementById("name-sud").textContent      = "SUD";
  document.getElementById("end-name-nord").textContent = nordName;
  document.getElementById("end-name-sud").textContent  = "SUD";

  const turnName = state.turn === PLAYER.SUD ? "SUD" : (vsAI ? "IA" : "NORD");
  document.getElementById("turn-indicator").textContent =
    state.over ? "Partie terminée" : `Tour de ${turnName}`;

  document.getElementById("score-north").classList.toggle("active-turn", state.turn === PLAYER.NORD);
  document.getElementById("score-south").classList.toggle("active-turn", state.turn === PLAYER.SUD);

  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < PITS; i++) {
      refreshPit(p, i);
    }
  }
}

function refreshPit(p, i) {
  const pit = getPitEl(p, i);
  if (!pit) return;
  const n = state.board[p][i];

  pit.querySelector(".pit-count").textContent = n;
  pit.classList.toggle("empty", n === 0);

  const sv = pit.querySelector(".seeds-visual");
  sv.innerHTML = "";
  const show = Math.min(n, 12);
  for (let k = 0; k < show; k++) {
    const dot = document.createElement("div");
    dot.classList.add("seed-dot");
    sv.appendChild(dot);
  }

  pit.classList.remove("clickable", "not-clickable", "selected");

  if (!state.over && p === state.turn && !animLock) {
    if (n > 0 && isLegalMove(p, i, state)) {
      pit.classList.add("clickable");
    } else {
      pit.classList.add("not-clickable");
    }
  } else {
    pit.classList.add("not-clickable");
  }
}

function getPitEl(player, idx) {
  return document.querySelector(`.pit[data-player="${player}"][data-idx="${idx}"]`);
}

// ── Ordre de distribution ────────────────────────────
// SUD (player=1) : droite→gauche dans son camp, puis gauche→droite chez NORD
// NORD (player=0) : droite→gauche dans son camp, puis gauche→droite chez SUD
// "droite" pour chaque joueur = case 6 (idx 6), "gauche" = case 1 (idx 0)
function buildOrder(player, startIdx) {
  const opp = 1 - player;
  const seq = [];
  // Depuis startIdx-1 vers 0 (gauche dans son camp)
  for (let i = startIdx - 1; i >= 0; i--) seq.push({ p: player, i });
  // Chez adversaire de gauche à droite (0→6)
  for (let i = 0; i < PITS; i++) seq.push({ p: opp, i });
  // Retour dans son camp de droite vers startIdx+1
  for (let i = PITS - 1; i > startIdx; i--) seq.push({ p: player, i });
  return seq;
}

// ── Légalité d'un coup ───────────────────────────────
function isLegalMove(player, idx, st) {
  if (st.board[player][idx] === 0) return false;

  const opp         = 1 - player;
  const oppEmpty    = st.board[opp].every(v => v === 0);

  if (oppEmpty) {
    // Solidarité
    const canSend7 = canAnySend7(player, st);
    if (canSend7) {
      const sent = countSentToOpp(player, idx, st);
      return sent >= 7;
    }
    // Sinon max
    const maxSent = maxSendable(player, st);
    const sent    = countSentToOpp(player, idx, st);
    return sent === maxSent;
  }

  // Interdiction case 7 (idx=6) envoyant 1 ou 2 graines
  if (idx === PITS - 1) {
    const sent = countSentToOpp(player, idx, st);
    if (sent === 1 || sent === 2) return false;
  }

  return true;
}

function countSentToOpp(player, idx, st) {
  const opp   = 1 - player;
  const seeds = st.board[player][idx];
  const order = buildOrder(player, idx);
  let   count = 0;
  const seen  = new Set();
  for (let s = 0; s < seeds; s++) {
    const pos = order[s % order.length];
    if (pos.p === opp) {
      const key = pos.i;
      seen.add(key);
    }
  }
  // Nombre de graines effectivement envoyées chez opp
  // On recompte exactement
  const tmpBoard = st.board.map(r => [...r]);
  tmpBoard[player][idx] = 0;
  for (let s = 0; s < seeds; s++) {
    const pos = order[s % order.length];
    tmpBoard[pos.p][pos.i]++;
  }
  const orig = st.board[opp].reduce((a, b) => a + b, 0);
  const nw   = tmpBoard[opp].reduce((a, b) => a + b, 0);
  return nw - orig;
}

function canAnySend7(player, st) {
  for (let i = 0; i < PITS; i++) {
    if (st.board[player][i] > 0 && countSentToOpp(player, i, st) >= 7) return true;
  }
  return false;
}

function maxSendable(player, st) {
  let max = 0;
  for (let i = 0; i < PITS; i++) {
    if (st.board[player][i] > 0) {
      max = Math.max(max, countSentToOpp(player, i, st));
    }
  }
  return max;
}

// ── Clic joueur ──────────────────────────────────────
function onPitClick(player, idx) {
  if (animLock || state.over) return;
  if (player !== state.turn) return;
  if (vsAI && player === PLAYER.NORD) return;
  if (state.board[player][idx] === 0) return;
  if (!isLegalMove(player, idx, state)) {
    setMessage("Ce coup n'est pas autorisé.", "warning");
    return;
  }
  playMove(player, idx);
}

// ── Exécution du coup ────────────────────────────────
async function playMove(player, idx) {
  animLock = true;
  updateUI(); // griser les cases

  const opp   = 1 - player;
  const seeds = state.board[player][idx];
  state.board[player][idx] = 0;
  const order = buildOrder(player, idx);

  setMessage(`Distribution de ${seeds} graine${seeds > 1 ? "s" : ""}…`);

  let lastPos = null;

  for (let s = 0; s < seeds; s++) {
    const pos = order[s % order.length];

    // Si >13 graines : on saute la case de départ lors du tour complet
    if (seeds > 13 && pos.p === player && pos.i === idx) {
      // Chercher la prochaine position non-skip
      let next = (s + 1) % order.length;
      const nextPos = order[next];
      state.board[nextPos.p][nextPos.i]++;
      lastPos = nextPos;
      s++; // skip le "vrai" slot
    } else {
      state.board[pos.p][pos.i]++;
      lastPos = pos;
    }

    // Feedback
    const el = getPitEl(pos.p, pos.i);
    if (el) {
      el.querySelector(".pit-count").textContent = state.board[pos.p][pos.i];
      el.classList.add("just-seeded");
      setTimeout(() => el.classList.remove("just-seeded"), 260);
    }

    await sleep(60);
  }

  // Captures
  let captured = 0;
  if (lastPos && lastPos.p === opp) {
    captured = doCaptures(player, lastPos, opp);
  }

  if (captured > 0) {
    setMessage(`✓ ${captured} graine${captured > 1 ? "s" : ""} récoltée${captured > 1 ? "s" : ""} !`, "info");
  } else {
    setMessage("");
  }

  const ended = checkEnd();
  if (!ended) {
    state.turn = opp;
    updateUI();
    if (vsAI && state.turn === PLAYER.NORD) {
      animLock = false;
      setTimeout(aiPlay, 600);
      return;
    }
  }

  animLock = false;
  updateUI();
}

// ── Captures ─────────────────────────────────────────
function doCaptures(player, lastPos, opp) {
  let total    = 0;
  let captures = [];
  let cur      = { ...lastPos };

  while (cur.p === opp) {
    const n         = state.board[cur.p][cur.i];
    const isCase1   = (cur.i === 0); // case 1 adverse (idx 0)
    if (n >= 2 && n <= 4 && !isCase1) {
      captures.push({ ...cur, n });
      total += n;
      if (cur.i === 0) break;
      cur = { p: opp, i: cur.i - 1 };
    } else {
      break;
    }
  }

  if (captures.length === 0) return 0;

  // Vérifier qu'on ne vide pas complètement le camp adverse
  const oppTotal = state.board[opp].reduce((a, b) => a + b, 0);
  if (oppTotal - total === 0) return 0; // interdit

  for (const cap of captures) {
    state.board[cap.p][cap.i] = 0;
    state.store[player] += cap.n;
    const el = getPitEl(cap.p, cap.i);
    if (el) {
      el.classList.add("captured");
      setTimeout(() => el.classList.remove("captured"), 600);
    }
  }

  return total;
}

// ── Fin de partie ─────────────────────────────────────
function checkEnd() {
  for (let p = 0; p < 2; p++) {
    if (state.store[p] >= WIN_THRESH) { endGame(p); return true; }
  }

  const total = state.board[0].concat(state.board[1]).reduce((a, b) => a + b, 0);
  if (total < END_THRESH) {
    for (let p = 0; p < 2; p++) {
      state.store[p] += state.board[p].reduce((a, b) => a + b, 0);
      state.board[p].fill(0);
    }
    endGame(state.store[0] > state.store[1] ? 0 : state.store[1] > state.store[0] ? 1 : null);
    return true;
  }

  // Solidarité impossible
  const opp     = 1 - state.turn;
  const oppMpty = state.board[opp].every(v => v === 0);
  if (oppMpty) {
    const canReach = state.board[state.turn].some((n, i) =>
      n > 0 && countSentToOpp(state.turn, i, state) > 0
    );
    if (!canReach) {
      for (let p = 0; p < 2; p++) {
        state.store[p] += state.board[p].reduce((a, b) => a + b, 0);
        state.board[p].fill(0);
      }
      endGame(state.store[0] > state.store[1] ? 0 : state.store[1] > state.store[0] ? 1 : null);
      return true;
    }
  }

  return false;
}

function endGame(winner) {
  state.over   = true;
  state.winner = winner;
  updateUI();

  document.getElementById("end-score-nord").textContent = state.store[PLAYER.NORD];
  document.getElementById("end-score-sud").textContent  = state.store[PLAYER.SUD];

  const nordName = vsAI ? "L'IA" : "NORD";

  if (winner === null) {
    document.getElementById("end-icon").textContent  = "🤝";
    document.getElementById("end-title").textContent = "Égalité !";
    document.getElementById("end-desc").textContent  = "Aucun joueur n'a atteint 40 graines.";
  } else {
    const wName = winner === PLAYER.NORD ? nordName : "SUD";
    document.getElementById("end-icon").textContent  = winner === PLAYER.SUD ? "🏆" : (vsAI ? "🤖" : "🏆");
    document.getElementById("end-title").textContent = `${wName} gagne !`;
    document.getElementById("end-desc").textContent  = `${wName} a récolté ${state.store[winner]} graines.`;
  }

  setTimeout(showOverlay, 900);
}

function showOverlay() { document.getElementById("overlay-end").classList.remove("hidden"); }
function hideOverlay()  { document.getElementById("overlay-end").classList.add("hidden"); }

// ── IA ────────────────────────────────────────────────
function aiPlay() {
  if (state.over || state.turn !== PLAYER.NORD) return;

  const best = aiFindBest(PLAYER.NORD);
  if (best === -1) {
    checkEnd();
    animLock = false;
    updateUI();
    return;
  }
  animLock = false;
  playMove(PLAYER.NORD, best);
}

function getLegalMoves(player) {
  return Array.from({ length: PITS }, (_, i) => i)
    .filter(i => state.board[player][i] > 0 && isLegalMove(player, i, state));
}

function aiFindBest(player) {
  const moves = getLegalMoves(player);
  if (moves.length === 0) return -1;

  let best = moves[0];
  let bestScore = -Infinity;

  for (const idx of moves) {
    const score = evalMove(player, idx);
    if (score > bestScore) { bestScore = score; best = idx; }
  }
  return best;
}

function evalMove(player, idx) {
  const opp    = 1 - player;
  const board  = state.board.map(r => [...r]);
  const store  = [...state.store];
  const seeds  = board[player][idx];
  board[player][idx] = 0;
  const order  = buildOrder(player, idx);
  let lastPos  = null;

  for (let s = 0; s < seeds; s++) {
    const pos = order[s % order.length];
    board[pos.p][pos.i]++;
    lastPos = pos;
  }

  let captured = 0;
  if (lastPos && lastPos.p === opp) {
    let cur = { ...lastPos };
    while (cur.p === opp) {
      const n = board[cur.p][cur.i];
      if (n >= 2 && n <= 4 && cur.i !== 0) {
        captured += n;
        if (cur.i === 0) break;
        cur = { p: opp, i: cur.i - 1 };
      } else break;
    }
  }

  const mySeeds  = board[player].reduce((a, b) => a + b, 0);
  const oppSeeds = board[opp].reduce((a, b) => a + b, 0);
  return captured * 4 + mySeeds * 0.1 - oppSeeds * 0.05;
}

// ── Utilitaires ──────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setMessage(msg, cls = "") {
  const el = document.getElementById("game-message");
  el.textContent = msg;
  el.className   = "game-message" + (cls ? ` ${cls}` : "");
}

// ── Démarrage ─────────────────────────────────────────
showScreen("screen-title");
