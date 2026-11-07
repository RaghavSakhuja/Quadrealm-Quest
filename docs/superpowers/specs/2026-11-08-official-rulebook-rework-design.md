# Official rulebook rework — design

Date: 2026-11-08
Scope: bring the playtest app (`game/`) in line with `Official-Rulebook.md` draft v0.1, as asked in the review on PR #1.

## Intent

PR #1 was built on rules we had worked out ourselves. The designer has since written the official rules, and several of our "decided" points are reversed. This rework makes the code follow the rulebook, and adds the turn structure that Stage 2 of the old plan never delivered. It keeps the parts the review praised: the board model, auto-move and the DOM-free `rules.js` with tests.

## Sources, in priority order

1. The rulings table below (the user's, 2026-11-08). They fill gaps in the rulebook.
2. `Official-Rulebook.md` draft v0.1. Section numbers below refer to it.
3. The review on PR #1 (items R1–R15).

This supersedes `2026-11-01-turn-phases-design.md`, `2026-11-02-board-auto-move-design.md` and the Stage 1 plan wherever they conflict. Add a one-line "superseded" note at the top of each. Keep the board tracing in the board spec, except its lane energy.

## Rulings

Q numbers here are this project's gap questions, and they are not the rulebook's own Q1–Q30. This spec writes "rulebook Qn" for those.

| # | Ruling |
|---|---|
| Q1 | No limit on event cards per turn. |
| Q2 | A piece moved by a card, swap or forced move does not trigger the space it lands on. |
| Q3 | Range counting may cross between lanes through spaces that share an edge, at 1 per crossing (see Distance). |
| Lanes | Pieces pick a lane only at the realm entrance, then only go forward along it. They never switch lanes inside a realm. |
| Q4 | The §7 modifier list is an order: realm effects, support cards, board-space bonuses, event cards. |
| Q5 | Event card damage is not an attack. |
| Q6 | Area-attack bonuses apply to every target, including the main target. |
| Q7 | Steals heal only the damage dealt. **Provisional: flag on the PR.** |
| Q8 | Game of Dice with an unaffordable roll: no attack, no energy paid, action used. |
| Q9 | Molten Power rounds down after the final operation: `floor(heal * 3 / 2)`. |
| Q10 | Relentless Assault is mandatory and may pick a new target. **Provisional: flag on the PR.** |
| Q11 | An eliminated player's cards are discarded. If players die together, most energy wins; if tied, the defender wins. |
| Q12 | Unshakable Resolve checks HP after Forager's Resilience heals. |
| Q13 | Echoing Strikes: for that turn both characters make their 0-energy attack, and the effects of both apply. Your active character must be one of the two sharing a type. |
| Q15 | 2–4 players. |
| Zero damage | An attack that deals 0 deals 0 in all cases: no bonus or modifier adds to it. The rulebook is the source of truth. |
| Adrenaline Rush | Its energy counts in the dying-together tiebreak, even for a player who is dying. |
| Echoing Strikes | The second strike doesn't run if the attacking player's shared HP pool reached 0 or the game was won by the first. Characters are never knocked out. |
| Landmine | Hits all opponents, with no range. **Differs from §9 and R11: flag on the PR.** |

## Goals

- Every review item R1–R15 is implemented, except the Landmine range, which follows the ruling above.
- A turn runs in the §5 order, and the app enforces it.
- A full 2-, 3- and 4-player game can be played to a winner with Debug off.
- The new rules logic can be tested in Node without a page.

## Non-goals

- Response windows, the opponent-turn card timing table and the pass-the-screen handoff (old Stage 3). Rulebook Q18 and Q27 limit event cards to your own turn, so there is nothing to respond with.
- Automating cards not listed under Cards below. They keep showing their text. The user accepts that about a dozen movement cards and the remaining support cards do nothing in playtests until a follow-up project.
- Veilpiercer's final design (rulebook Q25, the designer's to decide).
- Online play and AI opponents.

## Anti-goals

- A player being stuck: unable to end a turn, or forced to roll when an effect says they cannot move.
- A free reroll by cancelling or by failing to afford an attack.
- Silent differences from the rulebook. Every one is listed for the PR.

## Constraints

Vanilla JS, no dependencies, `node game/server.js`, state in `localStorage`. Old saves need no migration: bump `SAVE_VERSION` to 4 and `SAVE_KEY` to `quadrealm_save_v4`.

## Player model

- `hp` and `maxHp` on the player, where `maxHp` is the sum of the 3 characters' HP. Healing stops at `maxHp`. Characters have no `curHp` or `alive`. (R2)
- `activeIdx` on the player. Each player picks it at setup, after drafting. (§3)
- A player is eliminated at `hp <= 0`. Replace `livingChars`, `chooseCharacter`, `hasLivingClass` and all "which character" prompts, including the `ally` target, `healChosen` and `selfDmgChosen`.
- Rename `classOf` to `typeOf`, with the types `Long Range`, `Close Range`, `Mage`, `Brute` and `Wildcard`. Card tags become the same names. Add the missing tags to Mana Overflow (Mage) and Arrow Rain (Long Range).
- Realm effects read the active character's type at the moment they apply. Wildcards are never affected. Forager's Resilience heals 2 once, and Misty Fog heals 2 once.
- Rewrite the Debug panel for team HP. It must not revive anyone.

## Turn flow

| Phase | Automatic | Player may |
|---|---|---|
| Start | Gain 1 energy, draw 1, Forager's Resilience, then record `startTurnHp` (Q12). | |
| Move | | Play events. Must roll, unless an effect says they cannot move. |
| Main | Space effect on arrival. | Play events, discard for energy (choosing the card), equip or swap supports, then take one action: Switch or Attack. |
| After action | | Play events, End Turn. |
| End | End-of-turn checks, Priestess' Blessing. Pass clockwise to the next living player. | |

- Discard and equip are only available in Main, before the action, as §5 orders them.
- End Turn is available once movement is resolved, whether or not an action was taken.
- Show the current phase. Disable controls that don't apply.
- Debug may keep its reroll, but must not bypass the phase order otherwise.

**Extra attacks beyond the one action:** Relentless Assault, and Blade Dance after eliminating an opponent. Echoing Strikes counts as one action.

## Board and movement

- `LANE_ENERGY = [-1, 0, 1]`. The outer lane costs 1 and is not offered at 0 energy. The inner lane gives 1. Update the labels and tests. (R7)
- **Move back** triggers the space it lands on (R10). There's no chain risk: the four move-back spaces lead to two Discards, a Lose 2 energy and a blank space.
- **Card moves, swaps and forced moves** do not trigger a landing (Q2), and passing an entrance by card still asks for a lane.
- **Passive bonuses** come from the current space, not stored buffs. Remove `dmgBuffs`, `costCut` and `doubleEvent`. A bonus applies whenever the piece is on the space, however it got there. (R9)
- **Next Event Card Effect Doubled:** the next event played while on the space resolves twice. Track "used" on the player and clear it when the piece leaves the space. An event played before rolling can use the space from last turn.

## Combat

**Attack order**, chosen so that no roll can be retried:

1. Choose an attack of the active character. A fixed cost that can't be paid stops here.
2. Choose the target. Cancelling here is free.
3. Roll, if the attack needs it. There is no cancel from here on.
4. Pay. Game of Dice costs `floor(roll / 2)`; if unaffordable, there's no attack and the action is used (Q8, R12).
5. Resolve.
6. Relentless Assault, if it applies.
7. Elimination and win check.

**Damage pipeline**, in Q4 order: base → attacker's realm → defender's realm → supports → board-space → events. Halving rounds down. The floor at 0 applies only at the end. Apply it through one function in `rules.js`.

**Area attacks** (R11):

| Attack | Hits |
|---|---|
| Exploding Arrow, Piercing Spear | The target, plus other opponents in the target's realm. |
| Spirit Drain | Opponents in your realm. Heal 2 for each, per §9. |
| Landmine | All opponents. |
| Arrow Rain (event) | Opponents within 3 spaces. Not an attack (Q5). |

A corridor is not a realm, so a target there brings no splash. Eagle's View and board bonuses apply to every target (Q6). Each player takes the damage once.

**Molten Power** (active Mage in Volcano, R6): total the healing from the attack, deal `floor(total * 3 / 2)` to the attack's target or a chosen opponent, and heal nothing. So Potion Blast asks for a target only in this case.

**Relentless Assault** (active Brute in Mountain, R6): after any attack, a free, mandatory skill attack by the same character, with a new target choice. It does not retrigger. It is skipped if the attacker has been eliminated or no opponents remain.

**Steals:** Dark Resurrection heals only the damage dealt, capped by the target's HP.

**Elimination:** takes effect as soon as an attack or effect has finished resolving. Hand and supports go to the discard pile, and the piece leaves the board. If the current player is eliminated, the turn ends. Check for a winner after every resolution, not only in `endTurn`.

**Dying together:** if the last players die in the same resolution, most energy wins, measured after the attack was paid for. If tied, the defender wins.

## Distance

`distance(a, b)` in `rules.js`: shortest path over an undirected graph with a cost of 1 per edge.

- **Edges:** every board link, in both directions, plus crossing edges between spaces in different lanes of the same realm that share a grid edge (`|dc| + |dr| = 1`).
- **Example:** `distance("12,2", "12,4") === 2`.
- **Used by** Arrow Rain (≤3) and Falling Rocks (≤2).
- **Pieces never use crossing edges.** Movement still uses `nextOptions`.

## Cards

**Type cards** (R5): check the active character's type when the effect applies, including later for lasting effects, so switching away turns the effect off (§4.6, rulebook Q28).

**Lasting effects** (R13): a list on the player, with each entry ending at the start of the owner's next turn, or at end of turn for "this turn" cards.

**Automate in this rework:**

| Card | Behaviour |
|---|---|
| Adrenaline Rush | Gain 3 energy once you've taken 5+ damage before your next turn. |
| Unyielding Strength | 2 less from the next attack before your next turn. |
| Quick Draw | At end of turn, gain 1 energy if you used a basic attack. |
| Unshakable Resolve | Gain 2 energy if `startTurnHp < 5`. |
| Battle Roar | 1 less on your next attack if HP < 10. |
| Warrior's Endurance | At end of turn, heal 2 if you didn't move. |
| Mystic Insight | At end of turn, draw 2 if you didn't attack. |
| Strategic Reserve | Gain 1 per distinct type among your characters. |
| Recovery Surge | Heal 5, and you can't move next turn. |
| Falling Rocks | Target within 2 can't move next turn. |
| Steady Aim | Skip movement this turn, +2 on your next attack. |
| Blade Dance | A free extra attack after eliminating an opponent. |
| Echoing Strikes | As Q13. |
| Arrow Rain | As above. |

The three stop-movement cards are needed so mandatory movement can't trap anyone, and Blade Dance because the one-action limit would otherwise block it.

**Overload** must go through the self-damage path, so Unyielding Fury applies.

## Calls I made (user may overrule)

1. **Echoing Strikes is optional each attack,** with a confirm. Otherwise equipping it would lock you to basic attacks. Its attacks count as normal basic attacks, so modifiers apply.
2. **Veilpiercer** can be equipped but does nothing, with a note on the card, until rulebook Q25 is decided. With team HP it could only halve your own damage.
3. **Molten Power's converted damage** ignores modifiers.
4. **Spirit Drain** counts as an attack, so Natural Cover applies, and it still heals 2 per opponent hit even if that opponent's damage is reduced. §9 states a flat amount, and Q7 is applied to steals of a stated target.
5. **Type cards with no effect** can still be played, after a warning that they will do nothing.
6. **Three players dying together with two defenders tied:** the first defender clockwise from the attacker wins.
7. **Quick Draw** waits until end of turn, so playing it before the attack still works.
8. **A piece pushed out of a realm** picks a lane again on re-entry and pays or gains again.

## Testing

Move HP, healing, the damage pipeline, phase transitions, distance, win resolution and lasting effects into `rules.js` so Node can test them. `game.js` keeps prompts and rendering. `node --test game/test/rules.test.js` must pass.

Must have tests for: each R1–R15 change; `distance` (the example above, and that every lane space has a crossing neighbour); dying together; no reroll on cancel or unaffordable Game of Dice; a player under "cannot move" can end their turn.

Finish with a full browser game with Debug off, the check still unticked on PR #1.
