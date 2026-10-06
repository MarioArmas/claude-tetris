# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
    - [Menú de pausa](#menú-de-pausa)
  - [Tabla de récords](#tabla-de-récords)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
    - [Skins](#skins)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) más una pieza especial **N (tuerca)**, de 3×3 con un agujero en el centro, con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Combos encadenados**: limpiar líneas con piezas consecutivas multiplica la puntuación (x2, x3, x4…).
- **Bonus** por **T-spin**, **Back-to-Back** (Tetris o T-spins seguidos) y **Perfect Clear** (tablero vacío).
- **Efectos visuales y sonoros** al encadenar: textos flotantes, destello, sacudida del tablero y sonidos sintetizados (se pueden silenciar desde el panel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Menú de pausa** (`P` o `Esc`) con opciones para reanudar, reiniciar, ver los controles y elegir el nivel inicial.
- **Game Over** con opción de reinicio.
- **Tabla de récords local**: Top 5 con nombre del jugador, mejor combo y líneas máximas, guardada en el navegador.
- **Skins** visuales intercambiables en caliente (Retro, Neon, Pastel y Pixel art), compatibles con el modo claro/oscuro.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `C` / `Shift` | Reservar pieza (hold)         |
| `P` o `Esc` | Abrir / cerrar el menú de pausa |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para el estado **GAME OVER** (con la tabla de récords) y otro, `#pause-menu`, para el menú de pausa.
- Una **pantalla de inicio** (`#start-screen`) con el Top 5 y el botón **Jugar**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`). La pieza **N (tuerca)** es una matriz 3×3 con un `0` en el centro: al no ser una celda "sólida", `collide` y `merge` la tratan como espacio vacío igual que el resto del tablero, así que el agujero queda literalmente hueco y una pieza futura puede llegar a caer a través de él si la columna se alinea.
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Combos y bonus** (`scoreLock`): cada pieza que limpia líneas incrementa `combo`, que actúa como multiplicador (la primera limpieza es x1, la segunda x2…); una pieza que no limpia nada lo reinicia. Un **T-spin** se detecta con la regla de las 3 esquinas (pieza T, último movimiento = rotación y 3 de las 4 esquinas de su caja 3×3 ocupadas) y puntúa con `TSPIN_SCORES`. Un Tetris o T-spin seguido de otro aplica **B2B** (×1.5). Si el tablero queda vacío se suma el bonus de **Perfect Clear**. Fórmula: `base × nivel × (1.5 si B2B) × combo + PerfectClear × nivel`.
- **Nivel y velocidad**: `level = nivelInicial + floor(lines / 10)`; la velocidad de caída se calcula con `dropIntervalFor(level)` = `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
carga de la página → pantalla de inicio (récords) → Jugar / Enter → startGame()

init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

### Menú de pausa

Al pulsar `P` o `Esc` el juego se detiene y aparece un menú con:

- **Reanudar**: vuelve a la partida (también con `P` o `Esc`).
- **Reiniciar**: empieza una partida nueva sin recargar la página.
- **Ver controles**: despliega/oculta la lista de teclas dentro del propio menú.
- **Nivel inicial**: selector del 1 al 15 con el nivel con el que empezará la próxima partida. Se guarda en `localStorage` (clave `tetris-start-level`).

El menú se maneja con el ratón o con el teclado (`↑`/`↓` para moverse, `Enter` o `Espacio` para activar y `←`/`→` para cambiar el nivel inicial). Mientras está abierto, ninguna tecla llega al juego; al reanudar se descarta el tiempo de caída acumulado y se ignoran las teclas de juego durante 150 ms para evitar movimientos accidentales.

---

## Tabla de récords

Las mejores partidas se guardan en `localStorage` (clave `tetris-records`), así que persisten entre sesiones en el mismo navegador:

- **Top 5** puntuaciones con nombre, puntos, líneas, combo máximo y nivel alcanzado (pasa el ratón por una fila para ver la fecha).
- **Marcas históricas**: el **mejor combo** y el **máximo de líneas** en una partida. Se actualizan en cada Game Over, aunque la puntuación no entre al Top 5.
- La tabla aparece en la **pantalla de inicio** (al cargar la página; se empieza con **Jugar** o `Enter`) y en el overlay de **Game Over**.
- Si la puntuación entra al Top 5, el Game Over pide el **nombre del jugador** (máx. 12 caracteres; recuerda el último usado en `tetris-player-name`). Se guarda con **Guardar** o `Enter`; la fila de la partida queda resaltada y, si es la mejor de todas, aparece **¡NUEVO RÉCORD!**.
- El botón **Borrar récords** (con confirmación) vacía la tabla y las marcas históricas.
- Si los datos guardados faltan o están corruptos, el juego simplemente empieza con la tabla vacía.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de la skin Retro (por tipo de pieza) | 8 colores          |
| `SKINS`        | Skins disponibles: paleta + función de dibujo de bloque | `retro`, `neon`, `pastel`, `pixel` |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `TSPIN_SCORES` | Puntos por T-spin con 0, 1, 2 o 3 líneas | `[400,800,1200,1600]` |
| `PERFECT_CLEAR_SCORES` | Bonus por Perfect Clear según líneas | `[0,800,1200,1800,2000]` |
| `B2B_MULTIPLIER` | Multiplicador Back-to-Back             | `1.5`                 |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

### Skins

En el panel lateral, debajo de **SONIDO**, el selector **SKIN** cambia la apariencia completa del juego sin recargar la página:

| Skin          | Aspecto                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Retro**     | Bloques cuadrados con colores planos y un brillo superior (el estilo original).            |
| **Neon**      | Tablero negro (también en modo claro) y bloques con contorno brillante y resplandor (`shadowBlur`). |
| **Pastel**    | Colores suaves y esquinas redondeadas simuladas con `arcTo`.                               |
| **Pixel art** | Bisel y textura de tramado dibujados sobre cada bloque, escalados al tamaño de la celda.  |

La preferencia se guarda en `localStorage` (`tetris-skin`); un valor desconocido vuelve a **Retro**. Cada entrada de `SKINS` en `game.js` define su paleta (índices 1–8 = I, O, T, S, Z, J, L, N) y una función que dibuja un bloque; `drawBlock` delega en la skin activa y restablece `globalAlpha`, `shadowBlur` y `shadowColor` tras cada bloque. El fondo y la rejilla del tablero se ajustan por skin con la clase `body.skin-<nombre>` en `style.css`. Para añadir una skin nueva basta con una entrada en `SKINS` y una `<option>` en `#skin-select`.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
