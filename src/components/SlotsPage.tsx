import React from 'react';
import CasinoGameWrapper from './CasinoGameWrapper';
import SlotsGame from '../casino/slots/SlotsGame';

// Client-side composition for the Slots page. The Slots game MUST be
// composed inside a client module: a render-prop child written in
// slots.astro is only server-rendered into the island template — the
// bundler never emits SlotsGame's client code, so the island fails to
// hydrate and the page renders blank (the Dice blank-page bug, found
// Nov 10, 2026). Keeping the composition here guarantees SlotsGame
// ships in the client bundle.
export default function SlotsPage() {
  return (
    <CasinoGameWrapper game="slots">
      {(props: any) => <SlotsGame {...props} />}
    </CasinoGameWrapper>
  );
}
