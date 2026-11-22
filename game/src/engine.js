// The rules of Lantern Duel, with no drawing and no browser in it: two
// heroes with 30 life, mana that grows to 10, 24-card decks, creatures that
// fight on the board and spells that resolve at once. Win by taking the
// enemy hero to 0 life. Everything here is pure state plus a seeded random
// generator, so the same seed plays the same game.
import { buildDeck, cardById, summonCreature } from './cards.js';

export const START_LIFE = 30;
export const MAX_MANA = 10;
export const MAX_BOARD = 5;
export const MAX_HAND = 7;
export const START_HAND = 3;

function newSide(random) {
  const deck = buildDeck(random);
  const hand = [];
  for (let i = 0; i < START_HAND; i += 1) hand.push(deck.pop());
  return {
    life: START_LIFE,
    mana: 0,
    maxMana: 0,
    deck,
    hand,
    board: [],
    fatigue: 0,
  };
}

export function createGame(seed, random) {
  const state = {
    seed,
    turn: 1,
    active: 'player',
    phase: 'title', // title | play | ai | over
    winner: null, // 'player' | 'ai' | null
    turnsPlayed: 0,
    player: newSide(random),
    ai: newSide(random),
    log: ['Welcome to the Lantern Isles.'],
  };
  return state;
}

function other(who) {
  return who === 'player' ? 'ai' : 'player';
}

function nameOf(who) {
  return who === 'player' ? 'You' : 'Mira';
}

export function log(state, message) {
  state.log.push(message);
  if (state.log.length > 5) state.log.shift();
}

export function drawCard(state, who) {
  const side = state[who];
  if (side.deck.length === 0) {
    side.fatigue += 1;
    side.life -= side.fatigue;
    log(state, `${nameOf(who)} draw from an empty deck and take ${side.fatigue} fatigue damage.`);
    checkEnd(state);
    return null;
  }
  const card = side.deck.pop();
  if (side.hand.length >= MAX_HAND) {
    log(state, `${nameOf(who)} draw ${cardById(card.id).name} but the hand is full — it burns.`);
    return null;
  }
  side.hand.push(card);
  return card;
}

/** Begin `who`'s turn: mana grows, a card is drawn, creatures wake up. */
export function startTurn(state, who) {
  const side = state[who];
  side.maxMana = Math.min(MAX_MANA, side.maxMana + 1);
  side.mana = side.maxMana;
  for (const creature of side.board) {
    creature.canAttack = true;
    creature.justPlayed = false;
  }
  if (who === 'player') state.turnsPlayed += 1;
  drawCard(state, who);
  if (state.phase === 'over') return;
  log(state, `${nameOf(who)} begin turn ${state.turn} — ${side.mana} mana.`);
}

export function startGame(state) {
  state.phase = 'play';
  state.active = 'player';
  state.turn = 1;
  state.player.maxMana = 0;
  state.ai.maxMana = 0;
  startTurn(state, 'player');
  log(state, 'Your move: play a card, attack, then End Turn.');
}

/** Where a spell may be aimed: 'enemy' (creature or hero), 'enemyCreature', 'allyCreature', 'self'. */
export function spellTarget(cardDef) {
  if (cardDef.id === 'firebolt') return 'enemy';
  if (cardDef.id === 'heal') return 'self';
  if (cardDef.id === 'surge') return 'enemyCreature';
  if (cardDef.id === 'blessing') return 'allyCreature';
  return 'none';
}

export function canPlayCard(state, who, handIndex) {
  const side = state[who];
  const entry = side.hand[handIndex];
  if (!entry) return false;
  const def = cardById(entry.id);
  if (def.cost > side.mana) return false;
  if (def.kind === 'creature' && side.board.length >= MAX_BOARD) return false;
  return true;
}

function damageCreature(state, who, boardIndex, amount) {
  const creature = state[who].board[boardIndex];
  if (!creature) return;
  creature.hp -= amount;
  if (creature.hp <= 0) {
    const def = cardById(creature.id);
    state[who].board.splice(boardIndex, 1);
    log(state, `${def.name} falls.`);
  }
}

function damageHero(state, who, amount) {
  state[who].life -= amount;
  checkEnd(state);
}

export function playCard(state, who, handIndex, target) {
  const side = state[who];
  if (state.phase !== 'play' && state.phase !== 'ai') return false;
  if (!canPlayCard(state, who, handIndex)) return false;
  const entry = side.hand[handIndex];
  const def = cardById(entry.id);
  // Validate spell targets before spending the card or its mana.
  if (def.kind === 'spell') {
    if (def.id === 'firebolt' && !target) return false;
    if (def.id === 'surge' && (!target || target.type !== 'creature')) return false;
    if (def.id === 'blessing' && (!target || target.type !== 'creature' || !side.board[target.index])) return false;
  }
  side.hand.splice(handIndex, 1);
  side.mana -= def.cost;
  if (def.kind === 'creature') {
    side.board.push(summonCreature(def, entry.uid));
    log(state, `${nameOf(who)} play ${def.name} (${def.atk}/${def.hp}).`);
    if (def.id === 'moth') {
      drawCard(state, who);
      log(state, 'Moon Moth draws a card.');
    }
    return true;
  }
  // Spells.
  if (def.id === 'heal') {
    side.life = Math.min(START_LIFE, side.life + 6);
    log(state, `${nameOf(who)} light the Healing Lantern (+6 life).`);
    return true;
  }
  if (def.id === 'firebolt') {
    if (!target) return false;
    if (target.type === 'hero') {
      damageHero(state, other(who), 3);
      log(state, `${nameOf(who)} hurl Firebolt at the enemy hero for 3.`);
    } else {
      damageCreature(state, other(who), target.index, 3);
      log(state, `${nameOf(who)} hurl Firebolt for 3 damage.`);
    }
    return true;
  }
  if (def.id === 'surge') {
    if (!target || target.type !== 'creature') return false;
    damageCreature(state, other(who), target.index, 5);
    log(state, `${nameOf(who)} call Lightning Surge for 5 damage.`);
    return true;
  }
  if (def.id === 'blessing') {
    if (!target || target.type !== 'creature') return false;
    const creature = side.board[target.index];
    if (!creature) return false;
    creature.atk += 2;
    creature.hp += 2;
    creature.maxHp += 2;
    log(state, `${nameOf(who)} bless ${cardById(creature.id).name} (+2/+2).`);
    return true;
  }
  return false;
}

/** A creature attacks: the target fights back unless it is a hero. */
export function attack(state, who, boardIndex, target) {
  const side = state[who];
  const attacker = side.board[boardIndex];
  if (!attacker || !attacker.canAttack) return false;
  attacker.canAttack = false;
  const foe = other(who);
  if (target.type === 'hero') {
    damageHero(state, foe, attacker.atk);
    log(state, `${cardById(attacker.id).name} strikes the enemy hero for ${attacker.atk}.`);
    return true;
  }
  const defender = state[foe].board[target.index];
  if (!defender) return false;
  const atk = attacker.atk;
  const back = defender.atk;
  damageCreature(state, foe, target.index, atk);
  // The attacker may have died from the counter-attack; find it again.
  const stillThere = side.board.indexOf(attacker);
  if (stillThere !== -1) damageCreature(state, who, stillThere, back);
  log(state, `${cardById(attacker.id).name} attacks ${cardById(defender.id).name} (${atk} vs ${back}).`);
  return true;
}

export function checkEnd(state) {
  if (state.phase === 'over') return;
  if (state.ai.life <= 0) {
    state.phase = 'over';
    state.winner = 'player';
    log(state, 'Mira falls. You win the duel!');
  } else if (state.player.life <= 0) {
    state.phase = 'over';
    state.winner = 'ai';
    log(state, 'Your lantern goes out. Mira wins.');
  }
}

/** End the player's turn; the AI plays, then a new player turn begins. */
export function endTurn(state, random) {
  if (state.phase !== 'play' || state.active !== 'player') return;
  state.active = 'ai';
  state.phase = 'ai';
  aiTakeTurn(state, random);
  if (state.phase === 'over') return;
  state.turn += 1;
  state.active = 'player';
  state.phase = 'play';
  startTurn(state, 'player');
}

// ---- The AI: a simple but sensible opponent. -------------------------------

function aiChooseSpellTarget(state, def) {
  const foe = state.player;
  if (def.id === 'firebolt') {
    // Lethal first, else the biggest enemy creature, else the hero.
    if (foe.life <= 3) return { type: 'hero' };
    let best = -1;
    let bestAtk = 0;
    foe.board.forEach((c, i) => {
      if (c.atk > bestAtk) { bestAtk = c.atk; best = i; }
    });
    if (best !== -1 && foe.board[best].hp <= 3) return { type: 'creature', index: best };
    return { type: 'hero' };
  }
  if (def.id === 'surge') {
    let best = -1;
    let bestAtk = 0;
    foe.board.forEach((c, i) => {
      if (c.atk > bestAtk && c.hp <= 5) { bestAtk = c.atk; best = i; }
    });
    if (best === -1) return null;
    return { type: 'creature', index: best };
  }
  if (def.id === 'blessing') {
    let best = -1;
    let bestAtk = -1;
    state.ai.board.forEach((c, i) => {
      if (c.atk > bestAtk) { bestAtk = c.atk; best = i; }
    });
    if (best === -1) return null;
    return { type: 'creature', index: best };
  }
  return null;
}

export function aiTakeTurn(state, random) {
  startTurn(state, 'ai');
  if (state.phase === 'over') return;
  const side = state.ai;
  // Play cards: creatures first (cheapest first), then useful spells.
  let played = true;
  let guard = 0;
  while (played && guard < 12) {
    played = false;
    guard += 1;
    const affordable = side.hand
      .map((entry, i) => ({ entry, i, def: cardById(entry.id) }))
      .filter((x) => x.def.cost <= side.mana);
    if (affordable.length === 0) break;
    affordable.sort((a, b) => a.def.cost - b.def.cost);
    for (const pick of affordable) {
      if (pick.def.kind === 'creature') {
        if (side.board.length < MAX_BOARD && playCard(state, 'ai', pick.i, null)) { played = true; break; }
      } else if (pick.def.id === 'heal') {
        if (side.life <= 18 && playCard(state, 'ai', pick.i, null)) { played = true; break; }
      } else {
        const target = aiChooseSpellTarget(state, pick.def);
        if (target && playCard(state, 'ai', pick.i, target)) { played = true; break; }
      }
      if (state.phase === 'over') return;
    }
  }
  if (state.phase === 'over') return;
  // Attack with every ready creature: lethal first, then good trades, else face.
  for (let i = 0; i < side.board.length; i += 1) {
    const creature = side.board[i];
    if (!creature || !creature.canAttack) continue;
    if (state.player.life <= creature.atk) {
      attack(state, 'ai', i, { type: 'hero' });
    } else {
      // Trade up: kill an enemy creature that would otherwise survive with more attack than us.
      let target = -1;
      state.player.board.forEach((enemy, j) => {
        if (enemy.hp <= creature.atk && enemy.atk >= creature.atk && creature.hp > enemy.atk) target = j;
      });
      if (target !== -1) attack(state, 'ai', i, { type: 'creature', index: target });
      else attack(state, 'ai', i, { type: 'hero' });
    }
    if (state.phase === 'over') return;
  }
}
