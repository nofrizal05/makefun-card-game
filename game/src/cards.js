// The card set of Lantern Duel: twelve original cards, two copies of each in
// a 24-card deck. Creatures fight on the board; spells resolve at once.
// Glyphs are plain text symbols, drawn by the browser — no image files.
export const CARDS = [
  { id: 'wisp', name: 'Lantern Wisp', kind: 'creature', cost: 1, atk: 1, hp: 1, glyph: '✦', hue: 48, text: 'A tiny light that never goes out.' },
  { id: 'moth', name: 'Moon Moth', kind: 'creature', cost: 2, atk: 1, hp: 3, glyph: '☾', hue: 220, text: 'Draw a card when played.' },
  { id: 'fox', name: 'Ember Fox', kind: 'creature', cost: 2, atk: 2, hp: 2, glyph: '♦', hue: 24, text: 'Quick paws, quicker bite.' },
  { id: 'knight', name: 'Coral Knight', kind: 'creature', cost: 3, atk: 2, hp: 4, glyph: '♜', hue: 350, text: 'A reef that learned to walk.' },
  { id: 'crow', name: 'Storm Crow', kind: 'creature', cost: 3, atk: 3, hp: 2, glyph: '☁', hue: 200, text: 'It arrives with the thunder.' },
  { id: 'serpent', name: 'Tide Serpent', kind: 'creature', cost: 4, atk: 4, hp: 5, glyph: '≈', hue: 170, text: 'The tide itself, given teeth.' },
  { id: 'golem', name: 'Stone Golem', kind: 'creature', cost: 5, atk: 3, hp: 7, glyph: '■', hue: 100, text: 'Slow. Patient. Immovable.' },
  { id: 'phoenix', name: 'Sun Phoenix', kind: 'creature', cost: 6, atk: 6, hp: 5, glyph: '☀', hue: 40, text: 'Every dawn it is born again.' },
  { id: 'firebolt', name: 'Firebolt', kind: 'spell', cost: 2, glyph: '⚡', hue: 16, text: 'Deal 3 damage to any enemy.' },
  { id: 'heal', name: 'Healing Lantern', kind: 'spell', cost: 2, glyph: '♥', hue: 140, text: 'Restore 6 life to your hero.' },
  { id: 'surge', name: 'Lightning Surge', kind: 'spell', cost: 4, glyph: '★', hue: 55, text: 'Deal 5 damage to an enemy creature.' },
  { id: 'blessing', name: 'Lantern Blessing', kind: 'spell', cost: 3, glyph: '♣', hue: 280, text: 'Give a friendly creature +2/+2.' },
];

export function cardById(id) {
  return CARDS.find((c) => c.id === id) ?? null;
}

/** A fresh 24-card deck: two copies of every card, shuffled. */
export function buildDeck(random) {
  const ids = [];
  for (const card of CARDS) ids.push(card.id, card.id);
  const deck = [];
  // Shuffle the ids, then turn them into card instances with unique uids.
  const shuffled = ids.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  for (let i = 0; i < shuffled.length; i += 1) {
    deck.push({ uid: i + 1, id: shuffled[i] });
  }
  return deck;
}

/** A creature as it sits on the board: base stats plus current health. */
export function summonCreature(cardDef, uid) {
  return { uid, id: cardDef.id, atk: cardDef.atk, hp: cardDef.hp, maxHp: cardDef.hp, canAttack: false, justPlayed: true };
}
