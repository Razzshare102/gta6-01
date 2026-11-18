# SOLMAR CITY — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Razzshare102/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Razzshare102/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01): **"Make GTA 6"** — build the most complete open-world crime game you can, playable offline in a desktop browser from static files.

## The game

**Solmar City** is a coastal open world, 100% original — its city, characters, vehicles, story, art and sound are all built here from scratch. Nothing from Rockstar Games or any other commercial game.

Danny Cole came home to Solmar City with nothing but a busted sedan and a debt to Mama Rosa. The Vipers run the docks, the cops run the streets — and tonight, Danny runs both.

### What's in the city

- **A living city** — a 400×400 grid of streets, towers with lit windows, lamps, palms, a beach and the sea, Rosa's Garage, Pier 9 and Solmar General Hospital.
- **On foot and by car** — third-person on-foot movement (run, jump) and arcade driving with steering, braking, handbrake and collisions.
- **Traffic and pedestrians** — cars follow the road grid, turn at intersections and slow for traffic ahead; pedestrians walk the sidewalks and flee from speeding cars and gunfire.
- **Cars to steal** — walk up to any parked or traffic car and take it. Stealing in sight of the law raises your wanted level.
- **Wanted level and police** — 0–5 stars. Crimes raise the heat, police interceptors spawn to match it, ram you and run you down. Lay low and the heat cools; linger near a cop while cornered and you're **busted**.
- **Missions and a story** — three chained jobs for Mama Rosa: *The Pickup*, *Hot Wheels* (steal a Comet GT and lose the heat), and *Harbor Heat* (a shootout with the Vipers at Pier 9). Cash rewards, waypoint beacons, and a free-roam ending.
- **Combat** — a pistol with hitscan shooting, tracers, reloads, and rival gang members who shoot back.
- **HUD with minimap** — health, armor, cash, ammo, wanted stars, a live clock, objective tracker, speedometer, and a north-up minimap showing the player, police, hideout, docks and the mission marker.
- **Start, save and endings** — title screen with story / continue / free roam, pause menu, localStorage saves (cash, story progress, stashes), and Wasted / Busted screens with respawn.
- **Polish** — fully synthesized WebAudio sound (engine hum, sirens, gunshots, a bass-line radio you can toggle), particles, screen shake, damage vignette and a day-lit coastal look.

### Controls

| Keys | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click the game to lock the pointer, or drag) |
| E | Enter / exit car |
| Click | Shoot (on foot) |
| R | Reload |
| Space | Jump / handbrake |
| Shift | Sprint |
| M | Radio music on/off |
| C | Camera distance |
| P / Esc | Pause |

## How to play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network: `game/index.html` and everything it loads are files under `game/` (Three.js is vendored at `game/vendor/three/three.module.min.js`).

## How it is built

- `game/main.js` — boot, the fixed-step loop, camera, screens.
- `game/src/city.js` — the procedural city (seeded, so `?seed=N` replays the same streets).
- `game/src/vehicles.js` — cars, traffic AI, police chase AI, arcade driving.
- `game/src/actors.js` — Danny on foot, pedestrians, Viper enemies, pistol combat.
- `game/src/missions.js` — the three story missions, waypoint beacon, cash stashes.
- `game/src/wanted.js` — wanted level, heat decay, busted logic.
- `game/src/hud.js` — HUD and live minimap. `game/src/audio.js` — synthesized sound. `game/src/fx.js` — particles and tracers.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Screenshots are real renders of the game, staged deterministically with `?shot=cover|drive|chase|mission&seed=7` (see `shots.json`).

## License

MIT — see [LICENSE](LICENSE).
