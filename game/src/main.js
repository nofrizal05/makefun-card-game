// Boot and the one loop: the game is turn-based, so there is no animation
// frame loop — every click re-renders the table from the rules. The AI moves
// after a short pause so the player sees whose turn it is.
//
// ?seed=N fixes the deal. ?shot=start|play|win|loss (with &seed=N) stages
// that scene instead of running the game, paints it and sets
// window.__shotReady for a screenshot.
import { createRandom } from './random.js';
import { cardById } from './cards.js';
import { attack, canPlayCard, createGame, endTurn, playCard, spellTarget, startGame } from './engine.js';
import { render } from './render.js';
import { isMuted, setMuted, sfx } from './sound.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);
const stage = document.getElementById('stage');
const status = document.getElementById('status');

/** The UI's selection: a hand card, a chosen attacker, or an aimed spell. */
const ui = { selection: null, targets: new Set(), busy: false };

let state = createGame(seed, random);

function announce(message) {
  status.textContent = message;
}

function draw() {
  render(state, ui, stage);
}

function clearSelection() {
  ui.selection = null;
}

function endSounds() {
  if (state.phase !== 'over') return;
  if (state.winner === 'player') sfx.win();
  else sfx.lose();
}

function newGame() {
  const fresh = createRandom(Math.floor(Math.random() * 4294967296));
  state = createGame(seed, fresh);
  clearSelection();
  ui.busy = false;
  startGame(state);
  announce('A new duel begins. Your move.');
  sfx.turn();
  draw();
}

function aiTurn() {
  ui.busy = true;
  draw();
  window.setTimeout(() => {
    endTurn(state, random);
    ui.busy = false;
    endSounds();
    if (state.phase === 'play') sfx.turn();
    announce(state.phase === 'over'
      ? (state.winner === 'player' ? 'Victory!' : 'Defeat.')
      : 'Your turn.');
    draw();
  }, 750);
}

/** Resolve a click on a target (enemy creature/hero, or a friendly one). */
function clickTarget(where, owner, index) {
  const sel = ui.selection;
  if (!sel) return;
  if (sel.type === 'attacker') {
    const target = where === 'hero' ? { type: 'hero' } : { type: 'creature', index };
    if (attack(state, 'player', sel.index, target)) {
      sfx.attack();
      clearSelection();
      endSounds();
      draw();
    } else {
      sfx.error();
    }
    return;
  }
  if (sel.type === 'spell') {
    const def = cardById(sel.defId);
    const mode = spellTarget(def);
    let target = null;
    if (where === 'hero' && mode === 'enemy') target = { type: 'hero' };
    else if (where === 'board' && owner === 'ai' && (mode === 'enemy' || mode === 'enemyCreature')) target = { type: 'creature', index };
    else if (where === 'board' && owner === 'player' && mode === 'allyCreature') target = { type: 'creature', index };
    if (target && playCard(state, 'player', sel.handIndex, target)) {
      if (def.id === 'heal') sfx.heal();
      else sfx.play();
      clearSelection();
      endSounds();
      draw();
    } else {
      sfx.error();
    }
  }
}

function clickHandCard(index) {
  if (state.phase !== 'play' || ui.busy) return;
  const entry = state.player.hand[index];
  if (!entry) return;
  const def = cardById(entry.id);
  const sel = ui.selection;
  // Clicking the same card again casts it (spells that need no target).
  if (sel && sel.type === 'hand' && sel.index === index) {
    const mode = spellTarget(def);
    if (def.kind === 'creature') {
      if (playCard(state, 'player', index, null)) { sfx.play(); clearSelection(); endSounds(); draw(); }
      else sfx.error();
    } else if (mode === 'self' || mode === 'none') {
      if (playCard(state, 'player', index, null)) { sfx.heal(); clearSelection(); endSounds(); draw(); }
      else sfx.error();
    } else {
      ui.selection = { type: 'spell', handIndex: index, defId: def.id };
      draw();
    }
    return;
  }
  if (!canPlayCard(state, 'player', index)) { sfx.error(); return; }
  if (def.kind === 'creature') {
    // Creatures go straight to the board on click.
    if (playCard(state, 'player', index, null)) { sfx.play(); clearSelection(); endSounds(); draw(); }
    else sfx.error();
    return;
  }
  const mode = spellTarget(def);
  if (mode === 'self' || mode === 'none') {
    if (playCard(state, 'player', index, null)) { sfx.heal(); clearSelection(); endSounds(); draw(); }
    else sfx.error();
    return;
  }
  ui.selection = { type: 'spell', handIndex: index, defId: def.id };
  draw();
}

function clickBoardCreature(owner, index) {
  if (state.phase !== 'play' || ui.busy) return;
  const sel = ui.selection;
  if (sel && (sel.type === 'spell' || sel.type === 'attacker')) {
    clickTarget('board', owner, index);
    return;
  }
  if (owner !== 'player') return;
  const creature = state.player.board[index];
  if (!creature) return;
  if (!creature.canAttack) { sfx.error(); return; }
  ui.selection = { type: 'attacker', index };
  draw();
}

function clickHero(owner) {
  if (state.phase !== 'play' || ui.busy) return;
  if (owner !== 'ai') return;
  const sel = ui.selection;
  if (sel && (sel.type === 'spell' || sel.type === 'attacker')) clickTarget('hero', 'ai', -1);
}

stage.addEventListener('click', (event) => {
  const card = event.target.closest('.card');
  if (card) {
    const where = card.dataset.where;
    const owner = card.dataset.owner;
    const index = Number(card.dataset.index);
    if (where === 'hand') clickHandCard(index);
    else if (where === 'board') clickBoardCreature(owner, index);
    return;
  }
  const hero = event.target.closest('.hero');
  if (hero) {
    clickHero(hero.dataset.owner);
    return;
  }
  // Clicking empty table space clears the selection.
  if (event.target.closest('#board-ai, #board-player, #hand-player, #midbar')) clearSelection();
  draw();
});

document.getElementById('play-btn').addEventListener('click', () => {
  startGame(state);
  sfx.turn();
  announce('Your move: play a card, attack, then End Turn.');
  draw();
});
document.getElementById('again-btn').addEventListener('click', newGame);
document.getElementById('end-turn').addEventListener('click', () => {
  if (state.phase !== 'play' || ui.busy) return;
  clearSelection();
  announce('Mira is thinking…');
  aiTurn();
});
document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('mute-btn').addEventListener('click', (event) => {
  setMuted(!isMuted());
  event.currentTarget.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && state.phase === 'play' && !ui.busy) {
    clearSelection();
    aiTurn();
  }
});

/** Scale the fixed 1280x720 stage to fit the window. */
function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

if (shot) {
  document.body.classList.add('shot');
  state = stageShot(shot, seed, random);
  draw();
  let painted = 0;
  (function paint() {
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }());
} else {
  announce('Lantern Duel. Press Play to start.');
  draw();
}
