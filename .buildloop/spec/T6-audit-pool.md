# Pool, heyball, rotation and bumper rules audit

Read-only audit for [[.buildloop/intent/T6|intent T6]], 2026-11-04. Findings, not decisions: the decisions are in [[.buildloop/spec/T6|spec T6]].

# felt rules audit (read-only)

**Method:**
- I traced the working-tree `index.html`, including the other engineer's in-flight heyball edit (`calls: 'none'`).
- I ran hand-built results through `judge` via `tests/sim.cjs` `loadSim`. The frozen-ball case used real physics.
- I did not run `npm test`, and made no repo edits.
- Texts: the two WPA PDFs, plus WPA Playing Regulations 2026-10-21 for Reg 16.

## CONFIRMED wrong

### Heyball
1. **6(e) break foul.** "may choose a ball in hand behind the Head String, or to have the balls re-racked and break himself, or ... have the opponent break."
   - Felt: `judge8` offers no option. A scratch gives `inHand:'kitchen'`. A ball off the table or a total miss gives `'table'`, which rule 9 excludes ("except for a break shot foul").
   - Edit: new option `breakFoul:'rerack'`, read after the 8 block in `judge8`: `if (g.breakShot && foul && !illegalBreak && R.breakFoul==='rerack') { inHand='kitchen'; option={kind:'badBreak',who:op,choices:['take','rebreak','break']}; }`. Pass `inHand` to `poolEnd`.
   - Test: scratch and 5-off breaks both give `choices take,rebreak,break`, and `take` gives `inHand==='kitchen'`. This replaces the `heyball-check` pin "a scratch on the break".
2. **6(f) 8 on the break with a foul.** "the opposing player may choose to reset the 8-ball ... take a ball in hand behind the Head String, or ... re-racked".
   - Felt: spots the 8, gives kitchen, offers no option.
   - Edit: same as item 1; the 8 is already spotted.
   - Test: `potted:[8,0]` gives the option with the 8 on. This replaces the `heyball-check` pin "the 8 and the cue ball down".
3. **12.1 group when both groups drop.** "if the first ball shot or a ball from the same group as the first ball shot is pocketed, the grouping is complete."
   - Felt: `by = objs[0]`, the first ball to drop. First 1, potted `[9,1]` gives the shooter stripes.
   - Edit in `judge8`, heyball only (option `groupBy:'first'`): use `groupOf(r.first)` when `objs` contains a ball of that group.
   - Test: that case gives `groups[0]==='solids'`.
4. **10.4 simultaneous contact.** "the player may choose to continue playing with balls of either group."
   - Felt: no choice exists, and `r.first` is a single ball. Same-step ties resolve by array index.
   - Edit: record `tab.firstTie` in `metBalls`. If the tie is cross-group and both groups are potted, set `option={kind:'groups',who:me,choices:['solids','stripes']}`, with a branch in `chooseOption` and in `cpuOption`.
   - Test: a result with `firstTie:[1,9]`, potted `[1,9]`: `chooseOption('stripes')` gives `groups[0]==='stripes'`, turn 0.
5. **Rule 8 / WPA 1.6, all legal balls behind the string.** "the player may request the referee to re-spot the legal object ball closest to the Head String."
   - Felt: no spot. The `targets.some(...)` guard in `poolFoul` lets a direct hit on a ball behind the string count as legal (probe: no foul). The code comment admits this.
   - Edit: helper `kitchenSpot(n)` called wherever `inHand` becomes `'kitchen'` (`poolEnd`, and `chooseOption` once item 1 lands). It spots the nearest legal ball when all legal balls are behind the string. Then drop the guard.
   - Trade-off: the "request" becomes automatic, which removes the bank-back option.
   - Test: solids all at `x<HEAD_X` after a scratch: the nearest ball is on the foot spot and a behind-string first hit is a foul.

### All pocket games
6. **2.7 / heyball 15.2 frozen ball.** "A ball touching a rail at the start of a shot ... is not considered driven to that rail unless it leaves the rail and returns."
   - Felt: `stepTable` sets `railAfter` and `rails[n]` when a frozen ball is pressed into its own cushion. In the physics probe at power 0.2, `railAfter:true` with only `rails:{1:1}`. That is a missed no-rail foul, common on safeties.
   - Edit: track `tab.frozen[n]` from the start of the shot, clear it when the ball is clear of the cushion, and ignore rail hits while it is set.
   - Test: physics shot on a frozen ball at low power gives `railAfter===false` and the foul "no rail after contact".

### 10-ball
7. **6, 6.7, 6.8 early called 10.** "legally pockets the 10-ball on a called shot when it is the only object-ball on the table."
   - Felt: `judgeLowest` has `need ? call.made && call.ball === gb`, so a called 10 with the 3 and 5 still on the table wins (probe). `earlyGameBall` is not read in this path. The test "10: a called 10 (a combination) wins" pins the bug.
   - Edit: `need ? call.made && call.ball === gb && on === gb`.
   - Test: `midGame [3,5,10]`, call 10, first 3: spotted, no win.
8. **6.3(b) illegal break.** "or the shot is a foul" (6.9: cue ball in hand).
   - Felt: `badBreak:'option'` offers take/rebreak, and the foul does not count toward three.
   - Edit: `badBreak:'foul'` on `10-wpa` and `10-house`. This moots the `badBreak` branch of `chooseOption` for 10-ball.
   - Test: `rails3` break gives `inHand:'table'`, `fouls[0]===1`, no option.
9. **6.5 no safety.** "there is no 'safety' call at 10-Ball."
   - Felt: the Safety button is offered, `callResult` accepts it, and it suppresses the 6.6 option. The CPU also calls safeties (`safeCall`).
   - Edit: option `safetyCall:false`. In `callResult`, treat `c.safety` as no call. Hide `safetyBtn` and set `safeCall` null.
   - Test: `{safety:true}` with the 5 potted gives `option.kind==='uncalled'`.
10. **6.5 / 1.7 obvious shots.** Called "as explained in 1.7" ("if they are not obvious"), and the only stated exception is safety.
    - Felt: `obvious:false`.
    - Edit: `obvious:true`. `10-house` then only differs from `10-wpa` in nothing, so delete or relabel it. The test "calls: 8-ball WPA lets an obvious shot ..." pins `.auto===false` for 10.
    - Test: `callNeed(10-wpa).auto===true`.
11. **6.6 only the 10 drops on a missed call.** "pockets an object-ball but does not make the called shot and does not foul, the other athlete chooses."
    - Felt: `extra` excludes `gb`, so no option (probe).
    - Edit: test `pot.length` instead of `extra.length` for the option.
    - Test: call 3, potted `[10]`: 10 spotted and `option.kind==='uncalled'`.

### 9-ball and 10-ball
12. **5.4 / 6.4 push after a foul.** "If no foul is committed on the break shot."
    - Felt: `poolEnd` sets `pushAvail` regardless of the foul (probe: `push:true` after a scratch).
    - Edit: add `&& !foul`.
    - Test: 9-wpa scratch break gives `pushAvail===false`.
13. **Reg 16 / 5.3(c) three-ball rule.** Not modelled at all.
    - Reg 16(2) "accept the table as is, or hand the shot back"; (3) no push on accepting; (4) push allowed if handed back; (5) the 9 is spotted.
    - Edit: sim records object balls past `HEAD_X` as `r.headCross`. New option `threeBall:3` on `9-wpa`. `judgeLowest` gives `{kind:'threeBall',who:op,choices:['take','pass']}` when `pot+crossed<3` on an otherwise legal break, and blocks the 9 win. `chooseOption`: `take` gives no push, `pass` gives turn to breaker with push available.
    - Test: `rails4`, `headCross` of 2: the choices above. 9 potted with `headCross` of 0: spotted, no win.

### 8-ball WPA
14. **4.3(f) 8 on a foul break.** "the opponent has the option of ... cue-ball in hand above the Head String, or re-breaking." Felt: no option.
    - Edit: `{kind:'badBreak',who:op,choices:['take','break'],inHand:'kitchen'}`.
    - Test: `potted:[8,0]` gives the option.
15. **4.3(g) ball off on the break.** "accepting the table in position, or taking cue-ball in hand above the Head String." Felt: `inHand:'table'`.
    - Edit: option with choices `['take','kitchen']`, plus a `kitchen` branch in `chooseOption`.
    - Test: 5 off gives the option, never `'table'`.
16. **4.3(d) total miss on the break.** Felt: `poolFoul` returns "no ball hit", so `breakLegal` is skipped and ball in hand is anywhere. Fewer than four balls reached a rail, so (d) applies.
    - Edit: in `judge8` treat `r.first===null` on the break as an illegal break.
    - Test: `first:null` gives `badBreak` with take, rebreak, break.
17. **4.4 temporary claim.** "unless a group has been completely pocketed ... may temporarily claim that group ... possibly for a win." Felt: `legalTargets` excludes the 8 on an open table (probe), and `cleared` needs an assigned group. Rare.
    - Edit: on `8-wpa`, add 8 to the open-table targets when a group is empty and count that as cleared.
    - Test: `[1,2,3,8]` open includes 8; first 8 potted to a called pocket wins.
18. **4.6 called ball must be your own.** "Each called ball must be from the athlete's group." Felt: no check in `callResult` or `pickCallBall`; `judge8` can keep the turn on a made call of the opponent's ball plus one of yours. Low.
    - Edit: `ok` requires `groupOf(call.ball)===mine` when closed.
    - Test: solids, call 9, potted `[9,2]`: turn passes.

### 14.1
19. **7.10.** "If both a standard foul and a breaking foul happen on one shot, it is considered a breaking foul."
    - Felt: `!foul &&` skips the test. A scratch with under 2 rails, or no ball hit, gives -1, counts a foul and offers no option (probe).
    - Edit: run the break test regardless of `foul`, and pass `inHand:'kitchen'` on a scratch so the cue ball is not stranded under the option.
    - Test: `first:null` gives -2, `fouls[0]===0`, option.
20. **2.7 pocketed balls count as rails.** "A ball that is pocketed ... is also considered to have been driven to a rail."
    - Felt: `railBalls` reads `r.rails` only. An uncalled pot plus one rail ball is a breaking foul (probe).
    - Edit: count the union with `r.potted`, and count a pocketed cue ball.
    - Test: `potted:[3], rails:{1:1,0:1}` is no foul, the 3 spotted, turn passes.
21. **7.3(b) "after the cue-ball contacts the rack".** Felt: `r.rails[0]>0` accepts a cue ball rail hit before contact.
    - Edit: `r.rails[0] > (r.kick||0)`.
    - Test: `rails:{0:1,1:1,2:1}, kick:1` is a breaking foul.
22. **3.13 mandatory warning, applied by 7.11.** "The referee must warn a shooter who is on two fouls ... Otherwise, a possible third foul will be considered to be only the second."
    - Felt: `poolEnd` excludes `'minus15'` from `twoFouls`, and the page's `onTwo` is 9/10 only. The -16 still applies with no warning.
    - Edit: drop the exclusion, include `'straight'` in `onTwo`, and fix the wording ("a third loses" is wrong here).
    - Test: `fouls:[1,2]`, a miss by player 0, gives `verdict.twoFouls===true`.
23. **7.8 and Table 1, `rackFourteen` and the `left===0` branch** (probed):
    - Both in the rack: "all fifteen balls are re-racked". Felt puts the 15th on the head spot and racks 14.
    - Only the cue ball in the rack, object ball above the string: "the cue-ball is spotted on the Head Spot, or on the Center Spot if ... blocked". Felt gives the hand, and moves the object ball to centre if it blocks the head spot. The object ball should stay.
    - 15th pocketed, cue clear: Table 1 "Cue-ball: in position". Felt gives kitchen.
    - Edit: rewrite those three branches. Keep the hand only when the object ball is below or on the string.
    - Test: one case per Table 1 row.
24. **7.9 / 3.11 second paragraph.** "the cue-ball is in hand above the Head String for the incoming athlete." Felt: `foulHand:'position'` leaves it in position when a shot from the kitchen neither crosses nor hits. Low.
    - Edit: in `poolEnd`, `g.inHand==='kitchen' && !r.crossed && r.first===null` gives `'kitchen'`.

## AMBIGUOUS (recommended reading)

- **Heyball 12.1 vs 10.3, ball only from the other group.** First 1, only the 9 potted. 10.3 ("legally pockets a ball from one of the group's first") would group; 12.1 would not. Felt groups stripes and keeps the turn.
  - Recommend 12.1, the specific grouping rule, read with 10.2 ("illegally pocketed ... not necessary to be taken out"): table stays open, ball stays down, turn passes.
- **Heyball 10.4 "simultaneously".** No tolerance is stated. Recommend the same sim step (1/1200 s).
- **Heyball 6(f) foul list.** "reset the 8-ball to the foot spot, take a ball in hand" could be one option or two. Recommend one, matching WPA 4.3(f)(1).
- **Heyball 6(g) vs 6(b), no contact on the break.** Felt has no miscue and cannot see intent. Recommend 6(g): `['rebreak','break']`, no ball in hand. `cpuOption` must change, because it can return `'take'` here and `chooseOption` would return null, hanging the game.
- **Heyball 20(c) vs 20(a), 8 off the table on the break.** 20(a) exempts the break for a foul pot; 20(c) has no exemption. Felt spots it. Recommend loss of rack for heyball only (`4.3(g)` explicitly spots it in 8-ball).
- **WPA 4.3(f) "re-breaking".** The text does not say who breaks. Recommend the opponent, since the option is his.
- **9-ball 5.3(c) vs Reg 16(1).** 5.3(c) says "if no ball is pocketed"; Reg 16 counts pots. Recommend Reg 16, the detailed rule. "center (or resting point)" reads either way; recommend any crossing during the shot.

## Open questions answered

- **6(c):** `take` correctly withholds ball in hand (probe: `inHand:null`, choices take, rebreak, break).
- **6(a) soft-break escalation:** not modellable. It is referee discretion with no threshold, and third-offence match loss needs a counter across racks (`rerack` keeps only score, high, calls, shots). Recommend leaving it out and saying so in the source comment, since a speed threshold would invent a rule.
- **Rule 18 and 6(b) intent:** no code path and no objective test. Same recommendation.
- **10.1:** correct. Only the remaining group is legal, and the opponent is then on the 8 after grouping.

## Rotation and bumper sources

**Neither game appears in WPA 2026:** zero text matches in the Rules of Play or Regulations.

**Rotation:** the authority is the BCA Official Rules and Records Book (2006, pp. 60-62). I could not get the primary text, so these rest on Wikipedia's account of it. Treat them as unverified:
- Three fouls lose; `judgeRotation` never counts fouls (probe).
- A non-scratch foul leaves balls as they lie, with take-or-force; felt gives ball in hand anywhere.
- A scratch gives kitchen with force-to-shoot; felt gives `'table'`.
- Open-break foul has no test.
- Off-table fouls should keep legal pots; felt spots them.
- Correct: 61, lowest first including the break, 60-60 going to the last legal pot.
- Also fix the source label "American rotation". Wikipedia describes that as a different game: Tucker's, 20 points a rack, race to 100.

**Bumper:** I found a text attributed to BCA with no edition named (cuesight, identical on darting.com), and no primary. Felt is labelled a house rule, so these are noted deviations, not bugs:
- Penalty is "any 2 balls"; felt drops one (`bumperBonus`).
- "If player scores his last ball in opponent's scoring hole, he loses game"; felt treats it as a foul and spot.
- Off-table balls go to the centre of the bumpers; felt uses the marked spot plus a bonus drop.
- The opening hits the right-side cushion simultaneously; felt plays it in sequence with no cushion test.
- Scoring an opponent's ball counts for them: matches.

## Not modelled, no action needed

Stalemates (heyball 21, 4.11, 5.9, 6.11, 7.12) need a referee and `stalemate` stays 0. Also 19 (groups are enforced) and 16.3 (a scoop is not modelled in `strike`).

## Cross-cutting warnings

- `cpuOption` returns only `take`, `rebreak`, `pass` or `spot`. Any new choice list must contain those or the CPU returns an invalid choice.
- `callScope` still gives heyball `'all'` under Settings mode `'eight'` (`R.calls === 'none' ? 'all'`), and `call.eight` gives `'game'`. This conflicts with the in-flight rule 11 fix.

## Checked and correct

- **Heyball:**
  - 6(c) legal test, and all three illegal-break choices
  - 6(f) clean (`eightBreak` spot or re-break)
  - 10.1, 10.2, 10.3
  - 12.2, 12.3, 17(a), 17(b), 17(e), rule 9 outside the break
  - 20(a), (b), (d); 8 off on a non-break shot loses
  - rack layout; head string and foot spot at TL/4 and 3TL/4
  - no three-foul rule
- **8-ball WPA:**
  - 4.3(c), (d), (e)
  - scratch kitchen; 4.4 called group
  - 4.6 safety stays down; 4.7; 4.8; no three-foul rule
- **9-ball WPA:**
  - 4-rail foul as a counted standard foul; ball in hand anywhere
  - any 9 wins, including on the break
  - 9 spotted on foul, push or off the table; other balls never spotted
  - push choice, 3.2 and 3.3 suspended, scratch still a foul
  - three fouls lose, with the warning shown for 9 and 10
- **10-ball WPA:**
  - 10 on the break spotted
  - 6.6 take/pass with other balls down; extra balls stay
  - three fouls
- **14.1:**
  - 7.9 foul table: no 3.2, -1, balls spotted, cue in position, scratch kitchen
  - -2 breaking foul not counted as a foul, with accept or re-break
  - s7.11 third foul: -16, count reset, 15 racked, opening break by the offender
  - 7.5 and 7.6 spotting; 7.7 scoring; negative scores; 7.8(c)
- **House rules (`8-house`, `9-house`):** no internal contradictions with their descriptions.

Probe scripts: `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/scripts/probe.cjs`, `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/scripts/probe2.cjs`, `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/scripts/probe3.cjs`

Sources:
- [WPA Rules of Play 2026-10-21](https://wpapool.com/wp-content/uploads/2026/10/WPA-Rules-2026-10-21-211.pdf)
- [WPA Rules of Heyball 2025-08-16](https://wpapool.com/wp-content/uploads/2025/08/250816-Rules-of-Heyball.pdf)
- [Rotation (pool), Wikipedia](https://en.wikipedia.org/wiki/Rotation_(pool))
- [Rules for Bumper Pool, CueSight](https://cuesight.com/bca/rules-for-bumper-pool)
- [Bumper Pool Rules, Darting.com](https://darting.com/Billiards-Info/Billiard-Rules/Bumper-Pool/)
