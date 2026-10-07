# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no package manager — three files (`index.html`, `style.css`, `game.js`) that run directly in a browser.

## Running the game

There is no build/lint/test tooling in this repo. To run it:

```bash
# Open directly
start index.html      # Windows

# Or serve it (recommended, avoids any file:// canvas quirks)
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`. There is no test suite; verify changes by playing the game in a browser.

## Architecture

All game logic lives in `game.js` as top-level functions and module-scope mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — there are no classes or modules.

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–8` identifying which piece type locked there.
- **Pieces**: `PIECES` defines the 7 standard tetrominoes plus a special 3×3 "nut" piece (`N`, color index 8) with a `0` hole in its center, as square matrices of color indices. Because `collide`/`merge` only treat truthy cells as solid, the hole is inert board space — no special-casing needed elsewhere; a later piece can fall through it if the column lines up. Rotation (`rotateCW`) is a transpose + row-reverse, not a lookup table.
- **Collision** (`collide`): checks board bounds and overlap against already-locked cells; used for movement, rotation, and ghost-piece projection.
- **Wall kicks** (`tryRotate`): after rotating, tries horizontal offsets `[0, -1, 1, -2, 2]` in order and takes the first that doesn't collide.
- **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and drops the piece one row once `dropInterval` is exceeded, otherwise just redraws.
- **Locking/scoring** (`lockPiece` → `isTSpin` → `merge` → `clearLines` → `scoreLock`): merges the current piece into `board`, clears completed rows (scanned bottom-up, shifting a new empty row in at the top; returns the count), and `scoreLock` updates score/level/`dropInterval`.
- **Combos/bonus** (`scoreLock`, called from `lockPiece` with the result of `clearLines` and `isTSpin`): `combo` counts consecutive line-clearing locks and multiplies the base score; a non-clearing lock resets it. `isTSpin` uses the 3-corner rule and must run *before* `merge()`; it relies on `lastRotate`, which `tryRotate` sets and every successful move/drop/spawn/hold clears — keep that invariant when adding new movement. `b2b` tracks whether the last clear was a Tetris or T-spin (×`B2B_MULTIPLIER`). Perfect Clear adds `PERFECT_CLEAR_SCORES`.
- **Effects**: `showFx` (floating text in `#fx-layer` over the board), `retrigger` (restart CSS `flash`/`shake` animations on `#board-wrap`), and `playSound` (Web Audio synthesized tones; `AudioContext` is created in `unlockAudio` from the keydown listener due to autoplay policy).
- **Ghost piece** (`ghostY`): projects the current piece straight down until it would collide, drawn at low alpha in `draw()`.
- **Rendering**: `draw()` redraws the whole canvas every frame (grid, locked board, ghost, current piece); `drawNext()` renders the next-piece preview canvas.
- **Skins**: `SKINS` maps a skin name (`retro`, `neon`, `pastel`, `pixel`) to its 8-color palette and a block painter (`drawRetroBlock`, etc.). `drawBlock` delegates to the active `skin`; `applySkin` also toggles a `skin-<name>` class on `<body>` so `style.css` can restyle the board background/grid. The choice is saved in `localStorage` (`tetris-skin`) and switches live via `#skin-select`. `COLORS` is the Retro palette.
- **Input**: a single `keydown` listener dispatches on `e.code` for movement/rotation/soft-drop/hard-drop; `KeyP`/`Escape` toggle the pause menu (`openPauseMenu`/`closePauseMenu`) before the guard; Enter on the start/game-over screen calls `startGame()`. While `paused`, keys go to `handleMenuKey` (arrow navigation, ←/→ change start level) and are recorded in `menuHeldKeys`; those codes are ignored by game input until their `keyup`, so keys held in the menu can't move the piece after resuming.
- **Start level**: `startLevel` (pause menu, persisted in `localStorage`) is copied to `baseLevel` in `init()`; `level = baseLevel + floor(lines / 10)` and `dropIntervalFor(level)` gives the speed. Changing it mid-game only affects the next game.
- **Lifecycle**: on load `showStartScreen()` shows an empty board (`current = null`, `gameOver = true` to block input and pause; `draw()` skips the piece when `current` is null) under the start overlay. `startGame()` (Jugar/Reiniciar button or Enter) saves any pending record, then `init()` resets all state and starts the loop; `spawn()` promotes `next` to `current` and generates a new `next`, calling `endGame()` if the newly spawned piece immediately collides.
- **Overlay**: a single `#overlay` serves two modes via `showOverlay(mode, …)` → `data-mode="start" | "gameover"`; pause uses its own `#pause-menu`.
- **Records** (`localStorage` key `tetris-records` = `{ top, bestCombo, maxLines }`, max `MAX_RECORDS` entries sorted by score): `endGame` → `recordGame()` updates the global bests (`maxCombo` is tracked per game in `scoreLock`) and, if `recordRank(score) !== -1`, sets `pendingRecord`. `renderRecords()` inserts the pending entry in its row with the shared `nameInput` element; `savePendingRecord()` commits it (Enter in the input, or on restart). `nameInput`'s keydown calls `stopPropagation` so typing never reaches the game listener.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, `TSPIN_SCORES`, `PERFECT_CLEAR_SCORES`, `B2B_MULTIPLIER`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).

## Notes

- The README (`README.md`) is written in Spanish and documents the same architecture in more detail — check it for control bindings and gameplay feature descriptions if needed.
- `index.html`'s `lang` attribute and UI text (`Reiniciar`, `CONTROLS` labels) are Spanish; keep new user-facing strings consistent with that.
