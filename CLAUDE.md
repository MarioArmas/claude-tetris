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
- **Locking/scoring** (`lockPiece` → `merge` → `clearLines`): merges the current piece into `board`, clears completed rows (scanned bottom-up, shifting a new empty row in at the top), and updates score/level/`dropInterval` via `LINE_SCORES` and the level formula in `clearLines`.
- **Ghost piece** (`ghostY`): projects the current piece straight down until it would collide, drawn at low alpha in `draw()`.
- **Rendering**: `draw()` redraws the whole canvas every frame (grid, locked board, ghost, current piece); `drawNext()` renders the next-piece preview canvas.
- **Input**: a single `keydown` listener dispatches on `e.code` for movement/rotation/soft-drop/hard-drop; `KeyP` toggles pause independently of the `paused`/`gameOver` guard that blocks other input.
- **Lifecycle**: `init()` resets all state and starts the loop; `spawn()` promotes `next` to `current` and generates a new `next`, calling `endGame()` if the newly spawned piece immediately collides.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).

## Notes

- The README (`README.md`) is written in Spanish and documents the same architecture in more detail — check it for control bindings and gameplay feature descriptions if needed.
- `index.html`'s `lang` attribute and UI text (`Reiniciar`, `CONTROLS` labels) are Spanish; keep new user-facing strings consistent with that.
