// A1 – smooth OS upgrade cards (MY OS UPGRADE) with the same look.
//
// Why it stuttered: each of the 35 cards had
//   • backdrop-filter: blur(16px) saturate(1.25) – background blur. Under the HTML layer it cannot see the
//     game canvas, so it does almost nothing visually, it is just recomputed every frame;
//   • filter: drop-shadow(...) ×2 – a shadow computed from the alpha of the whole card (text too), every frame.
// Replacement: backdrop-filter removed; drop-shadow replaced by the same shadows drawn once
// (a blurred copy of the area under the panel, text-shadow on texts, drop-shadow only on small images),
// and every card has its own layer (will-change), so a click repaints just that one card.
// The values are derived from the original shadows and verified by pixel-by-pixel screenshot comparison.
// Only a style sheet: if a game update renames the classes, it simply matches nothing.
BetterDTKit.mod('os-perf', {}, () => {
  document.getElementById('dtmod-os-perf')?.remove();
  const R = '#mostech-root ';
  const css = `
/* parameters of the original drop-shadow per state: alpha, offset, sigma, white glow, panel transmittance */
${R}.mostech-card {
  --dtA: 0.18; --dtY: 8px; --dtB: 18px; --dtG: 0; --dtP: 0.90;
  filter: none !important;
  transition: transform .26s cubic-bezier(0.32,0.72,0,1) !important;
  will-change: transform;
}
${R}.mostech-card:hover             { --dtA: 0.26; --dtY: 18px; --dtB: 30px; --dtG: 0.14; --dtP: 0.84; filter: none !important; }
${R}.mostech-card.is-selected       { --dtA: 0.30; --dtY: 12px; --dtB: 24px; --dtG: 0;    --dtP: 0.54; filter: none !important; }
${R}.mostech-card.is-selected:hover { --dtA: 0.36; --dtY: 18px; --dtB: 32px; --dtG: 0;    --dtP: 0.60; filter: none !important; }
${R}.mostech-card-in { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }

/* shadow of semi-transparent areas: blurred copy of the area under the panel (alpha = filter alpha × area coverage) */
${R}.mostech-card::before, ${R}.mostech-card::after, ${R}.mostech-card-icon::before, ${R}.mostech-level::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: -1;
  background: rgba(0,0,0, calc(var(--dtA) * var(--dtK)));
  filter: blur(var(--dtB)); transform: translateY(var(--dtY));
  transition: background .35s ease, filter .35s ease, transform .35s ease;
}
${R}.mostech-card::after { z-index: -2; transform: none; filter: blur(16px); background: rgba(255,255,255, calc(var(--dtG) * var(--dtK))); }
${R}.mostech-card::before, ${R}.mostech-card::after { --dtK: 0.115; border-radius: 18px; }
${R}.mostech-card:hover::before, ${R}.mostech-card:hover::after { --dtK: 0.17; }
${R}.mostech-card.is-selected::before, ${R}.mostech-card.is-selected::after { --dtK: 0.48; }
${R}.mostech-card.is-selected:hover::before, ${R}.mostech-card.is-selected:hover::after { --dtK: 0.43; }
${R}.mostech-card-icon, ${R}.mostech-level { position: relative; }
${R}.mostech-card-icon::before { --dtK: 0.19; }
${R}.mostech-card.is-selected .mostech-card-icon::before { --dtK: 0.25; }
${R}.mostech-level::before { --dtK: 0.17; }

/* text shadows sit above the panel → alpha × panel transmittance (× text opacity) */
${R}.mostech-card-name, ${R}.mostech-card-desc, ${R}.mostech-price, ${R}.mostech-level { --dtT: 1; transition: text-shadow .35s ease; }
${R}.mostech-card-desc { --dtT: 0.78; }
${R}.mostech-level { --dtT: 0.86; }
${R}.mostech-card-name, ${R}.mostech-card-desc, ${R}.mostech-price, ${R}.mostech-level {
  --dtS: 0 var(--dtY) calc(2 * var(--dtB)) rgba(0,0,0, calc(var(--dtA) * var(--dtP) * var(--dtT))),
         0 0 32px rgba(255,255,255, calc(var(--dtG) * var(--dtP) * var(--dtT)));
}
${R}.mostech-card-name { text-shadow: 0 1px 6px rgba(0,0,0,0.32), var(--dtS); }
${R}.mostech-card-desc, ${R}.mostech-level { text-shadow: var(--dtS); }
${R}.mostech-price { text-shadow: 0 2px 10px rgba(0,0,0,0.28), var(--dtS); }
${R}.mostech-card.is-selected .mostech-price { text-shadow: 0 2px 12px color-mix(in srgb, var(--cat) 55%, transparent), var(--dtS); }

/* opaque images (icon, star) */
${R}.mostech-card-icon img { --dtT: 0.84; transition: filter .35s ease;
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.40))
          drop-shadow(0 var(--dtY) var(--dtB) rgba(0,0,0, calc(var(--dtA) * var(--dtP) * var(--dtT)))); }
${R}.mostech-card.is-selected .mostech-card-icon img { --dtT: 0.78; }
${R}.mostech-level img { --dtT: 0.86; transition: filter .35s ease;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.40))
          drop-shadow(0 var(--dtY) var(--dtB) rgba(0,0,0, calc(var(--dtA) * var(--dtP) * var(--dtT)))); }

/* selection ring (the selected one is opaque) */
${R}.mostech-check {
  box-shadow: 0 3px 12px transparent,
              0 var(--dtY) calc(2 * var(--dtB)) rgba(0,0,0, calc(var(--dtA) * var(--dtP) * 0.2));
}
${R}.mostech-card.is-selected .mostech-check {
  box-shadow: 0 3px 12px color-mix(in srgb, var(--cat) 55%, transparent),
              0 var(--dtY) calc(2 * var(--dtB)) rgba(0,0,0, calc(var(--dtA) * var(--dtP)));
}

@media (prefers-reduced-motion: reduce) {
  ${R}.mostech-card { transition: none !important; }
  ${R}.mostech-card::before, ${R}.mostech-card::after, ${R}.mostech-card-icon::before, ${R}.mostech-level::before,
  ${R}.mostech-card-name, ${R}.mostech-card-desc, ${R}.mostech-price, ${R}.mostech-level,
  ${R}.mostech-card-icon img, ${R}.mostech-level img { transition: none; }
}
`;
  const s = document.createElement('style');
  s.id = 'dtmod-os-perf';
  s.textContent = css;
  document.head.appendChild(s);
  return () => s.remove();
});
