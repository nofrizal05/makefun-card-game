// Drawing only: the game state and the UI selection in, DOM out. The stage
// is a fixed 1280x720 table; CSS scales it to the window. Every render
// rebuilds the dynamic zones from scratch, so the screen can never drift
// from the rules.
import { cardById } from './cards.js';
import { MAX_BOARD, spellTarget } from './engine.js';

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A face-up card. `where` is 'hand' or 'board'; `owner` 'player' or 'ai'. */
export function cardHtml(def, opts) {
  const { where, owner, index, state, ui } = opts;
  const classes = ['card', def.kind];
  let extra = '';
  if (where === 'hand' && owner === 'player') {
    const affordable = state.player.mana >= def.cost;
    const boardFull = def.kind === 'creature' && state.player.board.length >= MAX_BOARD;
    if (state.phase === 'play' && affordable && !boardFull) classes.push('playable');
    else classes.push('dim');
    if (ui.selection && ui.selection.type === 'hand' && ui.selection.index === index) classes.push('selected');
  }
  if (where === 'board') {
    const creature = state[owner].board[index];
    if (creature && creature.canAttack && owner === 'player' && state.phase === 'play') classes.push('ready');
    if (ui.selection && ui.selection.type === 'attacker' && ui.selection.index === index) classes.push('selected');
  }
  const key = `${where}-${owner}-${index}`;
  if (ui.targets && ui.targets.has(key)) classes.push('target');
  const stats = def.kind === 'creature'
    ? `<span class="atk">${opts.atk ?? def.atk}</span><span class="hp">${opts.hp ?? def.hp}</span>`
    : '<span class="spell-tag">SPELL</span>';
  const hue = def.hue;
  return `<div class="${classes.join(' ')}" data-where="${where}" data-owner="${owner}" data-index="${index}" style="--hue:${hue}">${extra}
    <span class="cost">${def.cost}</span>
    <span class="cname">${esc(def.name)}</span>
    <span class="art">${def.glyph}</span>
    <span class="ctext">${esc(def.text)}</span>
    ${stats}
  </div>`;
}

function heroHtml(who, state, ui) {
  const side = state[who];
  const name = who === 'player' ? 'You · Lantern Keeper' : 'Mira · Tidecaller';
  const initial = who === 'player' ? 'Y' : 'M';
  const heroKey = `hero-${who}`;
  const targetClass = ui.targets && ui.targets.has(heroKey) ? ' target' : '';
  const manaPips = Array.from({ length: 10 }, (_, i) => `<span class="pip${i < side.mana ? ' on' : ''}"></span>`).join('');
  const lowLife = side.life <= 10 ? ' low' : '';
  return `<div class="hero${targetClass}" data-where="hero" data-owner="${who}">
    <span class="portrait">${initial}</span>
    <span class="hname">${name}</span>
    <span class="life${lowLife}">♥ ${Math.max(side.life, 0)}</span>
    <span class="mana" title="Mana">${manaPips}<b>${side.mana}/${side.maxMana}</b></span>
    <span class="deck">Deck ${side.deck.length}</span>
  </div>`;
}

function boardHtml(who, state, ui) {
  const side = state[who];
  let html = '';
  for (let i = 0; i < MAX_BOARD; i += 1) {
    const creature = side.board[i];
    if (creature) {
      const def = cardById(creature.id);
      html += cardHtml(def, { where: 'board', owner: who, index: i, state, ui, atk: creature.atk, hp: creature.hp });
    } else {
      html += '<div class="slot"></div>';
    }
  }
  return html;
}

function handBacks(count) {
  let html = '';
  for (let i = 0; i < count; i += 1) html += '<div class="card-back">✦</div>';
  return html;
}

/** Compute which targets are legal for the current selection. */
export function computeTargets(state, ui) {
  const targets = new Set();
  const sel = ui.selection;
  if (!sel) return targets;
  if (sel.type === 'attacker') {
    targets.add('hero-ai');
    state.ai.board.forEach((_, i) => targets.add(`board-ai-${i}`));
  } else if (sel.type === 'spell') {
    const def = cardById(sel.defId);
    const mode = spellTarget(def);
    if (mode === 'enemy') {
      targets.add('hero-ai');
      state.ai.board.forEach((_, i) => targets.add(`board-ai-${i}`));
    } else if (mode === 'enemyCreature') {
      state.ai.board.forEach((_, i) => targets.add(`board-ai-${i}`));
    } else if (mode === 'allyCreature') {
      state.player.board.forEach((_, i) => targets.add(`board-player-${i}`));
    }
  }
  return targets;
}

export function render(state, ui, root) {
  ui.targets = computeTargets(state, ui);
  root.querySelector('#hero-ai').innerHTML = heroHtml('ai', state, ui);
  root.querySelector('#hand-ai').innerHTML = handBacks(state.ai.hand.length);
  root.querySelector('#board-ai').innerHTML = boardHtml('ai', state, ui);
  root.querySelector('#board-player').innerHTML = boardHtml('player', state, ui);
  const hand = root.querySelector('#hand-player');
  hand.innerHTML = state.player.hand
    .map((entry, i) => cardHtml(cardById(entry.id), { where: 'hand', owner: 'player', index: i, state, ui }))
    .join('');
  root.querySelector('#hero-player').innerHTML = heroHtml('player', state, ui);

  const turn = root.querySelector('#turn-label');
  if (state.phase === 'over') {
    turn.textContent = state.winner === 'player' ? 'Victory!' : 'Defeat';
  } else if (state.phase === 'ai') {
    turn.textContent = 'Mira is thinking…';
  } else {
    turn.textContent = `Your turn ${state.turn} — play a card, attack, then End Turn`;
  }
  const logEl = root.querySelector('#log');
  logEl.innerHTML = state.log.map((line) => `<div>${esc(line)}</div>`).join('');
  const endBtn = root.querySelector('#end-turn');
  endBtn.disabled = state.phase !== 'play';
  const hint = root.querySelector('#hint');
  if (ui.selection && ui.selection.type === 'hand') {
    const def = cardById(state.player.hand[ui.selection.index].id);
    hint.textContent = spellTarget(def) === 'self' || spellTarget(def) === 'none'
      ? `${def.name} ready — click it again to cast.`
      : `${def.name} ready — click a glowing target.`;
  } else if (ui.selection && ui.selection.type === 'attacker') {
    hint.textContent = 'Attacker chosen — click an enemy creature or Mira to strike.';
  } else if (ui.selection && ui.selection.type === 'spell') {
    hint.textContent = 'Choose a glowing target for the spell.';
  } else {
    hint.textContent = 'Click a glowing card to play it · click a creature, then an enemy, to attack.';
  }

  const title = root.querySelector('#title-overlay');
  title.classList.toggle('hidden', state.phase !== 'title');
  const end = root.querySelector('#end-overlay');
  const showEnd = state.phase === 'over';
  end.classList.toggle('hidden', !showEnd);
  if (showEnd) {
    const win = state.winner === 'player';
    root.querySelector('#end-title').textContent = win ? 'VICTORY' : 'DEFEAT';
    root.querySelector('#end-title').className = win ? 'win' : 'lose';
    root.querySelector('#end-sub').textContent = win
      ? `Mira's lantern is yours. You won in ${state.turn} turns.`
      : `Your lantern goes out on turn ${state.turn}. Mira keeps the Isles — for now.`;
    root.querySelector('#end-stats').textContent = `Your life ${Math.max(state.player.life, 0)} · Mira's life ${Math.max(state.ai.life, 0)} · Cards left in your deck ${state.player.deck.length}`;
  }
}
