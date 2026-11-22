// The screenshot scenes behind ?shot=start|play|win|loss. Each one plays the
// real rules forward from a fresh game with a simple autopilot (random legal
// plays and attacks), so the frame is what a short game really looks like
// and the same seed always gives the same frame. Win and loss are reached
// through the real attack that ends the game, from a staged near-end state.
import { attack, canPlayCard, checkEnd, createGame, endTurn, playCard, spellTarget, startGame } from './engine.js';
import { cardById, summonCreature } from './cards.js';

/** One side's worth of random legal moves: play cards, then attack. */
function autoMove(state, who, random) {
  const side = state[who];
  // Play cards while any affordable one is in hand.
  let guard = 0;
  while (guard < 12) {
    guard += 1;
    const options = [];
    side.hand.forEach((entry, i) => {
      if (canPlayCard(state, who, i)) options.push(i);
    });
    if (options.length === 0) break;
    const pick = options[Math.floor(random() * options.length)];
    const def = cardById(side.hand[pick].id);
    let target = null;
    const mode = spellTarget(def);
    if (mode === 'enemy') {
      const foe = who === 'player' ? state.ai : state.player;
      if (foe.board.length > 0 && random() < 0.5) target = { type: 'creature', index: Math.floor(random() * foe.board.length) };
      else target = { type: 'hero' };
    } else if (mode === 'enemyCreature') {
      const foe = who === 'player' ? state.ai : state.player;
      if (foe.board.length === 0) continue;
      target = { type: 'creature', index: Math.floor(random() * foe.board.length) };
    } else if (mode === 'allyCreature') {
      if (side.board.length === 0) continue;
      target = { type: 'creature', index: Math.floor(random() * side.board.length) };
    }
    if (!playCard(state, who, pick, target)) break;
    if (state.phase === 'over') return;
  }
  // Attack with every ready creature at a random target.
  for (let i = 0; i < side.board.length; i += 1) {
    const creature = side.board[i];
    if (!creature || !creature.canAttack) continue;
    const foe = who === 'player' ? state.ai : state.player;
    let target = { type: 'hero' };
    if (foe.board.length > 0 && random() < 0.4) target = { type: 'creature', index: Math.floor(random() * foe.board.length) };
    attack(state, who, i, target);
    if (state.phase === 'over') return;
  }
}

/** Play `rounds` full rounds (player move + AI move) from the current state. */
function playRounds(state, random, rounds) {
  for (let r = 0; r < rounds; r += 1) {
    autoMove(state, 'player', random);
    if (state.phase === 'over') return;
    endTurn(state, random);
    if (state.phase === 'over') return;
  }
}

/** Give `who` a ready attacker on the board, playing a creature if needed. */
function ensureAttacker(state, who, random) {
  const side = state[who];
  let index = side.board.findIndex((c) => c.canAttack);
  if (index !== -1) return index;
  // Play the cheapest creature in hand, then wake it up for the shot.
  const affordable = side.hand
    .map((entry, i) => ({ entry, i, def: cardById(entry.id) }))
    .filter((x) => x.def.kind === 'creature' && x.def.cost <= side.mana);
  if (affordable.length > 0) {
    affordable.sort((a, b) => a.def.cost - b.def.cost);
    if (playCard(state, who, affordable[0].i, null)) {
      const creature = side.board[side.board.length - 1];
      creature.canAttack = true;
      return side.board.length - 1;
    }
  }
  // Fall back to waking any creature already on the board.
  if (side.board.length > 0) {
    side.board[0].canAttack = true;
    return 0;
  }
  return -1;
}

/**
 * Set `state` to the named scene and return it. The state is a fresh game
 * (from `seed`) played forward by the autopilot; 'start' then returns to
 * the title screen over a lively table.
 */
export function stageShot(name, seed, random) {
  const state = createGame(seed, random);
  startGame(state);
  if (name === 'start') {
    playRounds(state, random, 2);
    if (state.phase !== 'over') state.phase = 'title';
    return state;
  }
  if (name === 'win') {
    playRounds(state, random, 3);
    if (state.phase !== 'over') {
      state.ai.life = 1; // Any ready attacker now lands the winning blow.
      const idx = ensureAttacker(state, 'player', random);
      if (idx !== -1) attack(state, 'player', idx, { type: 'hero' });
      checkEnd(state);
    }
    return state;
  }
  if (name === 'loss') {
    playRounds(state, random, 3);
    if (state.phase !== 'over') {
      state.player.life = 1; // Mira's next swing ends the duel.
      // Stage her finishing blow: a ready Tide Serpent on her board, as if
      // played last turn, striking the hero through the real end check.
      const serpent = summonCreature(cardById('serpent'), 900 + Math.floor(random() * 100));
      serpent.canAttack = true;
      if (state.ai.board.length >= 5) state.ai.board.pop();
      state.ai.board.push(serpent);
      state.player.life -= serpent.atk;
      state.log.push(`Tide Serpent strikes your hero for ${serpent.atk}.`);
      checkEnd(state);
    }
    return state;
  }
  // 'play' (and anything else): a mid-game table a few turns in.
  playRounds(state, random, 4);
  return state;
}
