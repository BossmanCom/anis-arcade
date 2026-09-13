# Ani's Arcade

Six of Ani's browser games under one roof.

**Pure HTML5 + vanilla JS + Canvas.** No build step. Ready for GitHub Pages.

Live: https://bossmancom.github.io/anis-arcade/

## Games

| Cabinet | Play |
| --- | --- |
| **Pixel Fox Runner** | Side-scroller. Jump, grab coins, survive. |
| **Fox Snake** | Classic snake with Ani's fox head. |
| **Tower Defender** | Place fox-head towers, buy extras, hold the path. |
| **Chrono Tail Rush** | Pixel flyer across shifting eras. Character select. |
| **Tailship** | Kitsune / neko social deduction. Solo vs bots here; full couch LAN needs the Tailship zip. |
| **FOX KNOCKOUT** | Punch-Out homage. Dodge, punch, star. Three fights, best of three. |

Open `index.html` → **PRESS START** → pick a cabinet.

Adventure, blackjack, classroom horror, and A-Frame scenes stay in their own repos. Link them from the [station](https://bossmancom.github.io/), not this lobby.

## Run locally

Open `index.html` in a browser, or:

```bash
npx serve .
```

## Controls

Each game has a **◀ Arcade** button (or Esc) to return to the cabinet select.

- Runner: arrows / WASD + space / tap
- Snake: arrows / WASD, joystick, or swipe
- Tower: tap a tile to place a bought fox tower
- Chrono: swipe or arrows to fly, tap / space to boost
- Tailship: WASD move, E use/bell/report/task, Q kill, V vent. Solo works in the cabinet. Couch LAN: `python3 server.py` from tailship.zip
- FOX KNOCKOUT: Z/X punch, A/D or arrows dodge, Space/Enter star punch. On-screen pads on mobile.
