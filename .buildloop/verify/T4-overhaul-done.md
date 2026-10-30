# T4 overhaul: definition of done

The master prompt ("billiards game complete overhaul", 15 phases) against what shipped on `main`, 2026-10-28.
"Done" means implemented and pinned by a check in `npm test` (26 suites, about 1920 checks, green in CI).
Everything below "Not met" is known and true at the time of writing; nothing there is hidden behind a done mark.

All verification ran in headless Chromium at iPhone sizes (375x667, 393x852, 440x956, 956x440, dpr 3,
touch). Nothing here was run on a physical iPhone. The independent QA pass (wave 4) found 10 defects the
suites had missed (now fixed, `qa-check`), so a green suite is evidence, not proof.

## Phase by phase

| Phase | Status | Where it lives, what pins it |
|---|---|---|
| 1 Audit | Done | `.buildloop/audit/T4-audit.md`: F1-F17, all fixed except F13 (verified, watch on phones). `audit-check` holds one regression per fix |
| 2 Realistic physics | Done, with limits | Per-table records (`POOL_PHYS`, `SNOOKER_PHYS`, `CAROM_PHYS`); spin decay from pooltool's source (F10), spin in place (F9), cue elevation 0-60 deg for swerve and masse; jump shots (build 2026-10-30g: a vertical axis, `b.z`/`b.vz`, ballistic flight, slate bounces, balls off the table). `physics-check`, `level-cue.cjs` (level shots byte-identical to before) |
| 3 Rules engine | Done | `RULESETS` / `RULE_MODULES`: 8, 9, 10-ball, 14.1, rotation (house and WPA), bumper, snooker (with free ball, miss and put-back, F17), carom, ring games for 3-4 players. `rules-check`, `rules2-check`, `snooker-check` |
| 4 Called shots | Done | `game.call`, `callNeed`, `callResult`, option prompts (push-out, break fouls), settings `calls`, event-locked rules. `called-check` |
| 5 Career | Done, with limits | `Career` engine (300 players, 12 tiers, every bracket format, 52-week rankings, sponsors, rivals, shop, Hall of Fame, 6 slots, atomic saves, v1 migration) and its screens (6d). Abandon = forfeit (F5). `career-check`, `career2-check` |
| 6 Intelligent AI | Done, with limits | `cpuProfile` and nine archetypes; noise on inputs only, never on balls; banks and combos; human think time (F8); hard's two-shot planning, one-rail kick pots, jumps and swerves (2026-10-30g). `ai-check`, `ai2-check` |
| 7 Game modes | Done | Quick tournament (all pocket games, snooker, carom), AI exhibition, party for 2-4, practice, drills, trick shots, daily, tutorials. `modes-check`, `drills-check`, `solo-check`, `tutorial-check` |
| 8 Settings | Done | Grouped pages (gameplay, controls, graphics, look, audio and haptics, accessibility, about), sv 3 with a lossless migration and backup. `settings-check` |
| 9 Premium UX | Done | iOS list and push pages everywhere, 44 px targets, 4.5:1 text, no blur, home scrolls instead of crushing. `boot-check`, `qa-check` |
| 10 Visual and audio polish | Done, with limits | Cloths, cues, chalks, rails, ball sets, frames (`cosmetics-check`: physics identical in every look); sounds and haptics; colour-blind marks on table and dots |
| 11 Persistence | Done | Versioned keys, migrations that keep every value, `.bak`/`.tmp`/checksums, corruption recovery. `stress-check` (round trips and corruption), `career2-check`, `cosmetics-check` |
| 12 QA and stress | Done | `stress-check` (thousands of shots on every table, hundreds of CPU racks, fuzz, rapid navigation) in about 45 s; independent QA pass and its fixes |
| 13 Performance | Partly verified | Search sliced at 12 ms a frame; `render-check` budgets. F13: under 20 fps the roll plays slower than real time (by design of the frame cap); not measured on a real phone |
| 14 Additional features | Done | Replay and camera, shot moments, stats and records book, drills with medals |
| 15 Constraints | Met | No real money, no loot boxes, no randomised rewards, no pay to win (cosmetics only, physics pinned identical), no fake online, AI never touches ball state, progression never changes physics, no saved data destroyed by any migration |

## Not met, or met only in part

- Physics: jump shots are in (2026-10-30g), with limits: the ball-table restitution is one number (E_SLATE 0.5,
  Alciatore) and the dead band under which the cloth takes a vertical impact (V_SLATE 1 m/s) is felt's choice,
  not a measurement; no air drag; a flying ball meets a cushion as if on the bed while its bottom is under the
  nose and clears it above (no glancing contact on the nose's top); a ball past the noses away from a mouth is
  off the table at once (it never lands back on the bed from the rail); contacts in the air have no friction;
  the scooped jump (a miscue, a foul) is not modelled. The jump-arc guide is top-down only (the 3D view draws
  none yet). Spin decays at pooltool's current 10.9 rad/s^2, not the older ~38 the audit first quoted (a
  one-field change if wanted, then re-solve tricks).
- Snooker: the miss rule is a fixed approximation of a referee's judgement; simultaneous contact is not modelled;
  WPBSA rule numbers 3.12 and 3.13 in the comments were cited without access to the rulebook and need checking.
- AI: hard plans two shots ahead only for its finalists, one rail for kick pots (no two-rail kicks), jumps and
  swerves only round a single blocker, and no masse. Against the old hard level it pots more from the same
  positions, but head to head it is only level to slightly ahead (13/24 seeded racks in `ai2-check`, 32/64 in a
  longer paired run): hard-against-hard racks are mostly won by the breaker. The position player differs in its
  knobs but barely in its shot choice.
- Career: AI players keep no rivalries with each other; no fatigue or travel time.
- Drills: pool table only (no snooker or carom drills); stored solutions for the 7 ft regulation table only; no Show me.
- Looks: ball sets apply to pool only; frames show on the career hub card, not the home card.
- Audio: no music or ambience.
- One trick shot (9r "three") has only 2 making shots in the solver's sweep after the spin change: fragile.
- Home at 375x667 now scrolls about 70 px at default text size (taller phones fit).
- Not verified on a physical iPhone: home-screen app sizing, haptics, audio and real frame rates.
