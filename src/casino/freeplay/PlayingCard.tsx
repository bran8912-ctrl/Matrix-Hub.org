import React from 'react';
import { type Card, RED_SUITS, SUIT_GLYPH } from './cards';

// Our own card rendering: white face, rank + suit glyphs, CSS-only back.
// No third-party card art. The card fills its flex slot (w-full) and keeps
// a 5:7 aspect, so a row of five always fits one line on a phone screen.

interface Props {
  card?: Card; // undefined renders the face-down back
  small?: boolean;
  dimmed?: boolean;
}

export default function PlayingCard({ card, small, dimmed }: Props) {
  if (!card) {
    return (
      <div
        aria-label="Face-down card"
        className={`relative w-full aspect-[5/7] rounded-md border border-green-300/40 bg-gradient-to-br from-green-800 via-green-900 to-black shadow ${
          dimmed ? 'opacity-50' : ''
        }`}
      >
        <div className="absolute inset-1 rounded border border-green-400/30 flex items-center justify-center">
          <span className="text-green-400/50 text-lg sm:text-2xl select-none">♠</span>
        </div>
      </div>
    );
  }

  const red = RED_SUITS.has(card.suit);
  const glyph = SUIT_GLYPH[card.suit];
  const rankSize = small ? 'text-sm sm:text-lg' : 'text-base sm:text-2xl';
  const suitSize = small ? 'text-xs sm:text-base' : 'text-sm sm:text-xl';
  const centerSize = small ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl';

  return (
    <div
      aria-label={`${card.rank} of ${card.suit}`}
      className={`relative w-full aspect-[5/7] rounded-md bg-gray-50 shadow select-none ${
        dimmed ? 'opacity-50' : ''
      } ${red ? 'text-red-600' : 'text-gray-900'}`}
    >
      <div className="absolute top-0.5 left-1 leading-none text-left">
        <div className={`font-bold ${rankSize}`}>{card.rank}</div>
        <div className={`${suitSize} leading-none`}>{glyph}</div>
      </div>
      <div
        className={`absolute inset-0 flex items-center justify-center ${centerSize}`}
      >
        {glyph}
      </div>
      <div className="absolute bottom-0.5 right-1 leading-none text-right rotate-180">
        <div className={`font-bold ${rankSize}`}>{card.rank}</div>
        <div className={`${suitSize} leading-none`}>{glyph}</div>
      </div>
    </div>
  );
}
