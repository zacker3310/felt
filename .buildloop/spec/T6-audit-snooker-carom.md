# Snooker and three-cushion rules audit

Read-only audit for [[.buildloop/intent/T6|intent T6]], 2026-11-04. Findings, not decisions: the decisions are in [[.buildloop/spec/T6|spec T6]].

# felt rules audit: snooker and three-cushion

I found 13 confirmed errors, 8 in snooker and 5 in carom. Nothing in the repo was edited. I traced every confirmed item through `judgeSnooker` / `chooseSnooker` / `judgeCarom` with `tests/sim.cjs`, against the working copy (HEAD 8922a63 plus the other engineer's uncommitted edits). I did not run `npm test`.

**Sources**
- **Snooker:** the WPBSA rulebook, revised September 2024. This is the primary text and I read it in full.
- **Carom, no current primary text:** I could not get a current primary rules text. umb-carom.org/sport/rules posts only event regulations (World Cup and World Championship, 15.12.2025). They defer to "the general rules of the UMB and the rules of the Three Cushion discipline", which are not posted. Its one "General" document is a 2009 triathlon format.
- **Carom, what I used instead:** the fullest text is the UMB World Rules of Carom Billiard, edition 1 January 1989, on a third-party mirror. Its Papers A and F (the spot diagrams) are missing. CEB General Playing Regulations (13.07.2021) Arts 2003 and 2008 repeat the same rules. The carom findings rest on these, so treat them as "best available", not current official text.

## CONFIRMED wrong

**1. Snooker: a free ball is given when only a cushion is in the way.**
- **Rule:** S2 R17(e), "The cue-ball cannot be snookered by a cushion." The word "angled" appears nowhere in the 2024 rules.
- **felt:** `snkEdges` uses `snkClear`, which fails on `CUSH` and `JAW_ARCS`. The comment says "the rules treat it as snookered after a foul". With one red and no other ball, `snkSnookered` returned true (cue at 0.046, 0.036).
- **Change:** give `snkClear` a flag to skip the cushion and jaw loops, and have `snkEdges` set it. `snkFull` keeps the cushion check.
- **Test:** a lone red behind a jaw gives `snkSnookered` false and option kind not `snkFree`. This flips the check "angled (a cushion's corner in the way) counts as snookered" in `tests/snooker-check.cjs`, and that flip should be an explicit rules decision.

**2. Snooker: with a free ball nominated, hitting a red first is legal.**
- **Rule:** S3 R12(b)(i), "fail to hit the nominated free ball first unless it was hit simultaneously with a ball on". Also R11(b)(iv).
- **felt:** `snookerOn` returns `isRed(n) || n === f`. With `free: 62`, `first: 41` gave `foul` null.
- **Change:** `if (g.on === 'red') return f ? [f] : reds`. `fair` still lets reds be potted after the free ball.
- **Test:** free 62, first 41 gives a foul with pen 4.

**3. Snooker: "play again" hands the offender a free ball.**
- **Rule:** S3 R12(f), "If the offender is asked to play again ... the free ball option becomes void."
- **felt:** `chooseSnooker` `'again'` has `if (o.free && snkSnookered(n)) n.option = { kind: 'snkFree', ...`. The trace gave the offender `["play","free"]`.
- **Change:** delete that line.
- **Test:** after `'again'`, `option` is null. This flips "again: the offender ... being snookered may take the free ball" in snooker-check.

**4. Carom: a cushion-first break can score.**
- **Rule:** Art 23.3 (CEB 2003.3), "The starting cannon must be played by direct attack on the red ball."
- **felt:** `judgeCarom` tests only `count.first !== C_RED`. On the break, seq `[-1,72,-1,-1,71]` gave a point and no foul.
- **Change:** also foul when `g.breakShot && r.seq[0] < 0`. Then check that the tutorial's "Cushion first this time" step does not run with `breakShot` set; I did not check this. Update the How to Play text.
- **Test:** that seq on the break gives a foul and no point.

**5. Carom: there are no frozen-ball rules.**
- **Rule:** Art 27.1, the player may (a) have the balls re-spotted, (b) play the other ball or the cushion first, or (c) play a massé "on condition of not setting into motion the ball being in contact". Art 27.2, "does not have the right to play directly this cushion". Art 41.8 makes that a foul.
- **felt:** nothing handles it. A cue ball shot straight into a touching yellow gave seq `[71]`, foul null. Frozen to a cushion and shot into it gave `[-1,-1]`, foul null.
- **Change:**
  - In `judgeCarom`, foul when `seq[0]` is a ball the cue ball touched at rest, or when it is a cushion the cue ball was frozen to. The cushion case needs the stroke direction.
  - Add a `respot` choice through `game.option`, using the Art 27.3b positions.
- **Test:** both traces above give a foul. A frozen cue ball played away is legal, and the respot moves only the touching balls.

**6. Carom: the re-spot ignores whose ball it is.**
- **Rule:** Art 27.3b and 28.1b. Red on the top spot, "the white ball of the player who wants to play, on the central spot of the starting line", "the white ball of the opponent on the spot in the middle". If a spot is occupied, the ball goes "on the spot corresponding to the ball which occupies" it.
- **felt:** `caromSpot` sends both cue balls to the head spot, then tries centre, then the other spot. The shooter's white out with yellow to shoot next went to (0.71, 0.71).
- **Change:** `caromSpot(balls, n, next)`, with `next = C_CUE[op]` on a foul. The other cue ball's own spot is the centre. On an occupied spot, use the occupier's spot.
- **Test:** white out, yellow next, gives white at (1.42, 0.71). Red out with the foot spot occupied by yellow gives red on yellow's spot.

**7. Snooker: a partly visible ball on is never a miss.**
- **Rule:** S3 R14(c), "a clear path in a straight line from the cue-ball to any part of any ball that is or could be on".
- **felt:** `miss = missable && (full || !snkSnookered(g))`. One edge visible and the centre blocked falls through both tests. Red (2.5, .9), black (1.5, .9+1.5R), cue (.5, .9) gave `[snookered true, full false]`, `miss` false.
- **Change:** add a test that samples aim lines across the ball's contact arc, and use it in place of `!snkSnookered`. Keep `full` for the forfeit count.
- **Test:** that position gives `miss` true and `misses` 0.

**8. Snooker: the second failure escapes the miss when the score changes.**
- **Rule:** S3 R14(d)(i), "shall be called as a FOUL AND A MISS regardless of the difference in scores".
- **felt:** `missable` always requires `!snookersNeeded`. With score `[0, left-7]`, the first failure was a miss (count 1). After the put-back the second gave `miss` false, `misses` 0, kind `snkFoul`, so the run and warning vanish.
- **Change:** skip the score tests when `g.replaced && g.missRun && g.missRun.p === me`.
- **Test:** that sequence gives `misses` 2 and `warn` true.

**9. Snooker: playing into a touching ball is legal.**
- **Rule:** S3 R8(b), "must play the cue-ball away from that ball without moving it or it is a push stroke". R11(b)(v) sets the value.
- **felt:** no touching-ball code. A cue ball touching a red, struck into it, gave `first` 41, foul null. Playing away already works (`first` null, seq `[-1]`).
- **Change:** in `judgeSnooker`, foul at the ball's value when `seq[0]` is a ball within 2R of the cue ball at rest. Mention it in the page text.
- **Test:** touching a red and struck into it gives pen 4. Touching the black gives pen 7.

**10. Snooker: playing a red straight after a red costs 4, not 7.**
- **Rule:** S3 R11(d)(iii), seven points if the striker "plays at Reds, or a nominated free ball followed by a Red, in successive strokes".
- **felt:** `blame` with on `'colour'`, first red, gave pen 4.
- **Change:** `if (g.on === 'colour' && isRed(first)) worth = 7`.
- **Test:** that case gives pen 7.

**11. Snooker: a jump shot is overvalued.**
- **Rule:** S3 R11(a)(x), value of the ball on.
- **felt:** `blame('a jump shot', r.over[0])`. Jumping the black while on a red gave pen 7.
- **Change:** drop the second argument and fix the comment.
- **Test:** `over: [62]`, `first: 41` gives pen 4.

**12. Snooker: the re-spotted black has no draw.**
- **Rule:** S3 R4(b)(ii), "the players draw lots for choice of playing next".
- **felt:** `snookerEnd` uses `turn: 1 - ender`.
- **Change:** a seeded draw (`rng` is allowed in sim), with the winner choosing through `game.option`.
- **Test:** with a fixed seed the choice goes to the draw winner, whoever ended the frame.

**13. Snooker: re-spot precedence when one ball's own spot is free.**
- **Rule:** S3 R7(f), "If there is more than one colour to be spotted and their own spots are occupied, the highest value ball shall take precedence".
- **felt:** `back.sort((a, b) => b - a)` spots the highest first regardless. Pink and blue down on a foul, with the pink and black spots taken: pink took the blue spot and blue landed at x 1.837.
- **Change:** spot colours whose own spot is free first, then the rest highest first.
- **Test:** that position gives blue on its own spot.

## AMBIGUOUS

- **Who can need penalty points (R14(a)(i)):** the rule says "any player", plus "the referee is satisfied that the miss was not intentional". felt tests only the striker: at `[40, 0]` with 35 left, the leader's miss is still called. Exempting the opponent lets a leader miss for free, because no referee judges intent.
- **Put-back after a free-ball stroke (R12(f), R14(b)):** `chooseSnooker` restores `free: p.free` (traced, 62 kept). R14(b)'s list of balls on has no free ball, so I lean wrong, but R12(f) may mean only the current foul's option. Test if changed: `n.free` null.
- **Forfeit test for reds (R14(d)):** the rule says "a full diameter of any Red that is not obstructed by a colour". `snkFull` tests a cue-ball-wide corridor on the centre line. That is a reasonable reading, but other readings are possible.
- **A jaw in the clear path (R14(c)):** `snkFull` treats a jaw as blocking, and the rule does not address it.
- **Carom starting spot offset:** felt uses 15.24 cm, which is the US rule. Art 23 points to Paper A, which I could not get. I could not confirm or refute it.

## SIMPLIFICATIONS a player would notice

- **Snooker, fully snookered:** never a miss. R14(a)(ii) needs a referee's judgement of the attempt, so a snookered player can roll anywhere for 4 with no put-back.
- **Carom, who breaks:** player 1 always breaks and there is no lag (`caromGame` `turn: 0`; the page's `o.breaker` excludes carom). The player who breaks plays white, as the rule says, and their ball's side alternates rather than being chosen (Art 22, 23; World Cup rules).
- **Carom, match format:** no equalizing innings, and races of 5/10/15. UMB plays 30 to 50, with equalizing in groups and none in knockouts. A race with no equalizer is therefore legal in form.
- **Snooker, conceding:** allowed at any time and always accepted (S4 R2(a), (b)).
- **Snooker, no draw-out rules:** no stalemate re-rack (R17) and no frame claim with only the black left and a lead over 7 (S2 R1(b), (c)). The claim cannot change the winner.
- **Snooker, undetected fouls:** `first` is a single ball, so simultaneous double hits (R6, R11(c)) are not seen.
- **Snooker, no declaring:** the first colour hit counts as nominated, so there is no declare step (R8(a), R11(d)(v), (vi)).

## Checked and correct

**Snooker**
- **Table and balls:** 3569 x 1778 mm, baulk 737, D 292, black 324, spots and yellow's side, ball R 0.02625, apex red placement. The compact table scales with the bed.
- **Scoring and respotting:**
  - Values, reds scoring per ball, and the order of colours.
  - The colour after the last red is re-spotted.
  - Occupied spot goes to the highest free spot, then toward the top cushion, then the centre line (R7(e), (g), (h)).
- **Foul values:** ball on or ball concerned, 4 to 7, with free-ball value (R12(a)(ii)). A red off the table stays off.
- **Free ball:**
  - Only a colour other than the ball on can be nominated.
  - Scoring under R12(c), (d) and (e).
  - The foul for snookering the opponent behind the free ball (R12(b)(ii)) applies only at pink and black. R12's "Black and one other colour" clause cannot arise in felt.
- **The miss:**
  - The forfeit needs a full-ball contact (touching counts, R14(d)).
  - The count passes `warn` at 2 before 3, the words show at lines 11928 and 12035 ("A third miss loses the frame"), so no forfeit happens without a warning.
  - Choosing to play from the position left ends the sequence (R14(d)(iii)).
  - The put-back keeps penalties and restores everything else.
- **End of frame:** first pot or foul on the last black, re-spot on a tie, then first pot or foul ends it. Breaks alternate each frame.

**Carom**
- **Table and balls:** 2840 x 1420 mm and 61.5 mm.
- **Start:** red on the top spot, opponent on the bottom spot, breaker beside it.
- **Point definition:** at least 3 cushion contacts before the second ball (Art 83, `caromCount`), one-cushion variant included (Art 82).
- **Fouls:** the wrong ball and a ball off the table each give no point, the turn passes, and the balls stay where they lie.

**Files**
- Trace scripts: `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/pw/v.cjs` and `/private/tmp/claude-501/-Users-zacker-dev-felt/26553d1b-8626-47bf-9525-5c7f186d0436/scratchpad/pw/v2.cjs`
- Tests to change: `/Users/zacker/dev/felt/tests/snooker-check.cjs` (items 1 and 3)

**Sources**
- [WPBSA Official Rules, September 2024](https://www.wpbsa.com/wp-content/uploads/2198_WPBSA-Rulebook-2024-25.pdf)
- [UMB rules page](https://www.umb-carom.org/sport/rules)
- [UMB World Cup rules, 15.12.2025](https://www.umb-carom.org/uploads/documents/uzjk1r3l.fmj.pdf)
- [UMB World Championship rules, 15.12.2025](https://www.umb-carom.org/uploads/documents/gpfyn5wm.srw.pdf)
- [World Rules of Carom Billiard 1989, mirror](https://www.llb.su/files/Carom_Rules.pdf)
- [CEB General Playing Regulations 2021](https://www.eurobillard.org/medias/sport-rules/new-sport-rules/b-eng.pdf)
