import React from 'react';
import CasinoGameWrapper from './CasinoGameWrapper';
import DiceGame from '../casino/dice/DiceGame';

// Client-side composition for the Dice page. The Dice game MUST be composed
// inside a client module: a render-prop child written in dice.astro is only
// server-rendered into the island template — the bundler never emits
// DiceGame's client code, so the island fails to hydrate and the page renders
// blank (found Nov 10, 2026: the live page was blank on desktop and phone
// even though both deploys were green). Keeping the composition here
// guarantees DiceGame ships in the client bundle.
export default function DicePage() {
  return (
    <CasinoGameWrapper game="dice">
      {(props: any) => <DiceGame {...props} />}
    </CasinoGameWrapper>
  );
}
