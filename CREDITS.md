# Credits

## Sounds

The table's sounds in `sounds/` are real recordings, every one released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (public domain) by its author.
Credit is not required; it is given anyway. Each file is a slice of one recording, built by
`node tools/make-sounds.cjs`: high-passed, faded, its room tail shortened, levelled, 16-bit mono
44.1 kHz WAV (the roll 22.05 kHz). The recordings were taken from public GitHub repositories that
redistribute them (pinned to a commit below); each of those repositories states the CC0 licence
of every source in its own credits file, and the clacks, cue and pocket sources are named as CC0
by several independent projects.

| File | Recording | Author | Licence | Taken from |
|---|---|---|---|---|
| `ball-1.wav` | [billiard ball clack](https://freesound.org/people/Za-Games/sounds/539854/) | Za-Games | CC0 1.0 | [danielKlmr/BreakoutShot](https://github.com/danielKlmr/BreakoutShot/blob/6b1a83ca4f36a5b5d65a16e14a8c49ff47a3a968/addons/Za-Games/539854__za-games__billiard-ball-clack.wav) |
| `ball-2.wav`, `break-1.wav` | [Pool Table Ball Break (in a public bar) No.2](https://freesound.org/people/RossJuterbock/sounds/543482/) | RossJuterbock | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `ball-hard-1.wav` |
| `ball-3.wav`, `ball-4.wav`, `ball-5.wav`, `ball-6.wav`, `ball-7.wav`, `ball-10.wav` | [Pool balls.wav](https://freesound.org/people/bsumusictech/sounds/62331/) | bsumusictech | CC0 1.0 | [YoussefSah05/septhuit](https://github.com/YoussefSah05/septhuit/blob/2a18ca17a9b5379c36ecb2b262666cc4d18776b2/assets/audio/CREDITS.md) `ball_00`, `_01`, `_02`, `_04`, `_05`, `_07` |
| `ball-8.wav`, `cue-4.wav`, `roll.wav` | [BILLIARD pool shots- CsG.wav](https://freesound.org/people/csaszi/sounds/350918/) | csaszi | CC0 1.0 | [YoussefSah05/septhuit](https://github.com/YoussefSah05/septhuit/blob/2a18ca17a9b5379c36ecb2b262666cc4d18776b2/assets/audio/CREDITS.md) `ball_08`, `cue_06`, `roll_00` |
| `ball-9.wav` | [Billiards.wav](https://freesound.org/people/13FPanska_Marval_Lukas/sounds/379327/) | 13FPanska_Marval_Lukas | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `ball-soft-1.wav` |
| `cue-1.wav`, `cue-2.wav`, `cue-3.wav` | [S02-22 Billiards cue stick hits ball.wav](https://freesound.org/people/craigsmith/sounds/675330/) | craigsmith | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `cue-hard-1`, `cue-hard-2`; [imehc/mftp](https://github.com/imehc/mftp/blob/59409ffb5ebee843857fe704d65f2591c41be3eb/src/features/games/billiards/audio/ATTRIBUTION.md) `cue-1` |
| `rail-1.wav`, `rail-2.wav` | [8 ball - billiard.wav](https://freesound.org/people/allberto/sounds/147578/) | allberto | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `cushion-1`, `cushion-2` |
| `rail-3.wav` | [Billiards.wav](https://freesound.org/people/13FPanska_Marval_Lukas/sounds/379327/) | 13FPanska_Marval_Lukas | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `cushion-3` |
| `pocket-1.wav` | [B_1 pool ball falling.wav](https://freesound.org/people/Yarmonics/sounds/441857/) | Yarmonics (Stuart Bowditch) | CC0 1.0 | [melpomenex/Afterlight](https://github.com/melpomenex/Afterlight/blob/cdb806be84fd7afcb85630d0311d46af29c874fb/public/audio/pool/PROVENANCE.md) `pocket-1.wav` |
| `pocket-2.wav`, `pocket-3.wav` | [Potting snooker balls.mp3](https://freesound.org/people/Caitlin_100/sounds/365525/) | Caitlin_100 | CC0 1.0 | [YoussefSah05/septhuit](https://github.com/YoussefSah05/septhuit/blob/2a18ca17a9b5379c36ecb2b262666cc4d18776b2/assets/audio/CREDITS.md) `pocket_00`, `pocket_02` |

The cushions are a ball knocking a real table's rubber cushion, at the recording's own pitch,
from the slices Afterlight cut from those two recordings (its PROVENANCE.md names each slice's
source and CC0 licence).
The UI's cues (a foul, a win, the turn, the power bar's tick) are synthesised in the page.

The app shows a short version of this list in Settings > About > Sound Credits.
