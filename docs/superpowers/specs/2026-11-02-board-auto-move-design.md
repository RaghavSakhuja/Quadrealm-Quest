# Board model and auto-move — design

## Why

Players currently drag their piece by hand and pick their realm from a dropdown. The user wants pieces
to start on the board and move automatically by the roll, asking the player only where the path splits.

## What the board is (read from `QuadRealm Quest/QuadRealm Quest.png`)

The image is a 16 × 16 grid of spaces. Column `c` and row `r` run 0–15, and space centres in image
pixels are about `x = 1000 + 724.8·c` and `y = 976 + 726.4·r`.

One clockwise loop runs through the four realms:

```
Embark(6,0) → grey (7,0),(8,0) → [Mountain lanes] → grey (15,6),(15,7),(15,8) → [Forest lanes]
→ grey (9,15),(8,15),(7,15) → [Volcano lanes] → grey (0,9),(0,8),(0,7) → [Hot Spring lanes] → Embark
```

Each realm has three diagonal lanes. They split at the arrow corner, which is not a space. The
corner's arrows mark the outer lane **+1** (gain 1 energy) and the inner lane **−1** (pay 1 energy).
The middle lane is free and one space shorter.

| Realm (colour) | +1 lane (outer, 6) | middle (free, 5) | −1 lane (inner, 6) |
|---|---|---|---|
| Mountain (yellow) | (10,0)…(15,5), c−r=10 | (10,1)…(14,5), c−r=9 | (9,1)…(14,6), c−r=8 |
| Forest (green) | (15,10)…(10,15), c+r=25 | (14,10)…(10,14), c+r=24 | (14,9)…(9,14), c+r=23 |
| Volcano (orange) | (5,15)…(0,10), c−r=−10 | (5,14)…(1,10), c−r=−9 | (6,14)…(1,9), c−r=−8 |
| Hot Spring (cyan) | (0,5)…(5,0), c+r=5 | (1,5)…(5,1), c+r=6 | (1,6)…(6,1), c+r=7 |

Space texts by realm, as `(c,r) text`. Unlisted coloured spaces are blank.
- **Mountain:** (10,0) Ultimate +1 Damage · (9,1) Discard one card · (10,2) Move back 1 space · (12,2) Heal 2 HP ·
  (12,3) Discard 1 card, then draw 2 · (13,3) Skill +1 Damage · (12,4) Lose 2 energy · (13,4) Draw 1 more card ·
  (13,5) Change your character · (14,5) Gain 1 energy · (15,5) Next Event Card Effect Doubled · (14,6) Lose 3 Health
- **Hot Spring:** (4,1) Skill +1 Damage · (5,1) Skill +1 Damage · (3,2) Change your character · (5,2) Discard one card ·
  (2,3) Discard 1 card, then draw 2 · (3,3) Discard one card · (4,3) Move back 1 space · (1,4) Attack deals +1 damage ·
  (2,4) Draw 1 more card · (3,4) Lose 2 energy · (0,5) Heal 2 HP · (2,5) Draw 1 more card
- **Volcano:** (0,10) Discard one card · (1,10) Change your character · (2,10) Draw 1 more card · (2,11) Move back 1 space ·
  (2,12) Heal 2 HP · (4,12) Attack deals +1 damage · (3,13) Next Event Card Effect Doubled · (4,13) Gain 1 energy ·
  (4,14) Ultimate +1 Damage · (5,14) Lose 2 energy · (6,14) Lose 2 energy · (5,15) Discard 1 card, then draw 2
- **Forest:** (13,10) Draw 1 more card · (15,10) Gain 1 energy · (12,11) Discard one card · (13,11) Heal 2 HP ·
  (14,11) Ultimate +1 Damage · (11,12) Move back 1 space · (12,12) Change your character · (10,13) Lose 3 Health ·
  (11,13) Basic Attack +1 Damage · (12,13) Attack costs 1 less energy · (10,14) Lose 2 energy · (11,14) Skill +1 Damage

## Decided by the user

- All pieces start on **Embark**.
- Movement is **clockwise only**. Only "move back" effects go backwards.
- At a realm entrance the player **chooses a lane**, and the lane's energy is **applied automatically**.
- Space effects are **applied automatically**.

## Behaviour

- **Roll** moves the current player's piece that many spaces along the loop, once per turn. Players
  who are under "cannot move" get no roll.
- Passing a lane split asks which lane: +1 (gain 1 energy), middle (free) or −1 (pay 1 energy). The −1
  lane is not offered at 0 energy.
- Only the **final** space's effect applies. Spaces passed through do nothing.
- Each piece's **realm comes from the space it stands on**: coloured space → that realm; grey or
  Embark → no realm. The realm dropdown and Calibrate mode are removed, and dragging pieces is gone.
- Pieces may share a space. Pieces on the same space are drawn slightly offset.
- Chaos Swap swaps two pieces' spaces.

## Calls I made (user may overrule)

1. Space effects:
   - Heal 2 HP and Lose 3 Health: you choose which of your characters. Terrain healing bonuses apply. Lose 3 Health is not combat damage.
   - Discard one card: you choose; with an empty hand nothing happens.
   - Attack deals +1 damage / Basic / Skill / Ultimate +1 Damage: a one-time bonus on your next attack of that kind, kept until used.
   - Attack costs 1 less energy: your next attack costs 1 less, kept until used.
   - Next Event Card Effect Doubled: your next event card with an automated effect runs twice. A manual card logs a "double it" reminder.
   - Change your character: as in the turn-phases spec (swap a living character for an unheld one at full HP).
   - Energy never goes below 0.
2. **Move back 1 space** steps back along the way the piece came, and that space's effect does not apply, to avoid chains.
3. Card-driven movement (Time Warp, Hidden Shortcut, push-backs and so on) is not automated yet, and the
   user asked for no manual step buttons.
4. "Within N spaces" ranges stay manual for now.
5. The board is served from a 3216 px copy (`game/board.png`) instead of the 12864 px original. The original
   needs ~660 MB of memory to display and is the likely reason the system ran low.
6. Save version goes to 3, so older saves are dropped.

## Testing

The board graph, path stepping, lane energy and space effects live in DOM-free `rules.js`, tested
with `node game/test/rules.test.js`. The browser check uses the running server.
