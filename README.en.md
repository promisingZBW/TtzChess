# TtzChess

A local-first Xiangqi (Chinese chess) desktop app for studying openings, saving positions, and running engine analysis. Your games and notes stay on your machine.

[中文](README.md) | **English**

---

Three items on the left sidebar cover everything.

### Opening map

Openings are grouped by the first piece you play: Cannon, Horse, Chariot, Elephant, Pawn. Click a center piece to start a new line. Click a small ball to open an existing one and keep recording.

![Opening map](pics/开局径向图.png)

### Recording a game

The board is on the left, a glowing move tree on the right. Legal moves only. Each move becomes a node; click a node to jump there. Right-click to add a variation or a note. Turn on **Sandbox** to try ideas — turning it off restores the position you started from.

![Study board](pics/中炮对屏风马.png)

### Midgame / endgame / full games

A case library with folders and search. Midgames and endgames start from an empty board: place pieces, then hit **Start recording**. A full game starts from the standard initial position.

![Case library](pics/案例库.png)

### AI analysis

Analysis uses the open-source [Pikafish](https://github.com/official-pikafish/Pikafish) engine.

- **Single position**: set up a board and see the next few moves, win rate, captures, and threats.
- **Full game**: pick Red or Black, play from the start, and watch a win-rate chart. You can run a single-position analysis on any move, or save the line so far into the full-game library.

![Full-game analysis](pics/ai分析.png)

---

## Download

No Node.js required. Go to [Releases](https://github.com/promisingZBW/TtzChess/releases) and grab one of:

| File | What it is |
| --- | --- |
| `TtzChess-*-setup.exe` | Installer, Start Menu + desktop shortcut |
| `TtzChess-*-win.zip` | Portable — unzip and run `TtzChess.exe` |

The engine is bundled. After install you can click **Start analysis** right away.

Game data lives in a `data` folder next to the app. To move machines, quit TtzChess and copy that folder over.

## Run from source

```bash
git clone https://github.com/promisingZBW/TtzChess.git
cd TtzChess
npm install
npm run setup:pikafish
npm run dev
```

Windows build:

```bash
npm run dist:win
```

Output lands in `release/<version>/`.

## License

Source in this repo is for learning and personal use. Analysis launches Pikafish as a separate process (GPL v3) and does not link against its code. See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
