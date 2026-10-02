/**
 * Invented gamer tags ("NimbleMorphy", "Iron_Fork42") for players nobody needs to
 * know: recorded rivals and, later, everyone at a public table. Never a real name.
 */
const ADJECTIVES = [
    'Swift', 'Silent', 'Bold', 'Quick', 'Rogue', 'Dark', 'Blazing', 'Clever',
    'Phantom', 'Royal', 'Grand', 'Nimble', 'Cunning', 'Iron', 'Steel', 'Shadow',
    'Golden', 'Crystal', 'Fierce', 'Brave', 'Noble', 'Sharp', 'Mighty', 'Lucky',
    'Epic', 'Cosmic', 'Turbo', 'Ultra', 'Neo', 'Hyper',
];

const NOUNS = [
    'Knight', 'Bishop', 'Rook', 'Pawn', 'King', 'Queen', 'Castle', 'Gambit',
    'Check', 'Mate', 'Blitz', 'Tempo', 'Fork', 'Pin', 'Tactic', 'Fischer',
    'Morphy', 'Magnus', 'Endgame', 'Zugzwang',
];

/** At most 16 characters, the longest name a player can type (MAX_NAME_LENGTH). */
export function gamerTag(random: () => number = Math.random): string {
    const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(random() * NOUNS.length)];
    const number = random() < 0.5 ? String(Math.floor(random() * 99) + 1) : '';
    const separator = random() < 0.2 ? '_' : '';
    const tag = `${adjective}${separator}${noun}${number}`;
    return tag.length <= 16 ? tag : `${adjective}${noun}`.slice(0, 16);
}
