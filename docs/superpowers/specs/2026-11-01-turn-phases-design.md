# Turn Phases — Design

Date: 2026-11-01
Scope: the turn structure of the Quadrealm Quest playtest app (`game/`), and the rule changes that came with it.

## Intent

Today the app has no turn structure: the phase is always "Main", any button works at any time, and players enforce the rules themselves. We want the app to walk each player through a real turn — roll, move, optionally attack, end — while every phase stays *playable*: you can still play the cards that make sense at that moment, and other players can jump in with reactions when it makes sense for them.

The game is hot-seat (everyone at one PC), so "jumping in" means the app pauses and offers the other players a chance to respond.

## Core model changes (decided)

These replace parts of the original rulebook and the current code.

1. **One piece per player.** Each player has a single piece on the board. Characters are cards the player holds; they are never on the board. (Current code draws a token per character — replace with one token per player.)
2. **No "active" character, no switching.** On your turn you choose which of your living characters attacks. When you are attacked, *you* (the defender) choose which of your living characters takes the damage.
3. **Terrain** = the realm your piece is in. Its bonus applies to whichever of your characters is attacking or being hit.
4. **Only one character attacks per turn.** Exceptions: **Echoing Strikes** (two characters of the same type both attack, base damage only) and **Blade Dance** (after defeating an opponent, attack again for free). The Attack phase must support a second attack with its own response windows.
5. **Area attacks** (Exploding Arrow, Piercing Spear, Landmine, Spirit Drain, Arrow Rain, Titanic Slam, etc.): every player hit chooses which of their own characters takes it.
6. **Death is permanent.** A character at 0 HP is out for the rest of the game. A player is eliminated when all three are dead. Last player with a living character wins.
7. **Defender's choice is free and unlimited** — no cost, every attack.
8. **"Change your character" board space:** landing on it lets you optionally trade one of your living characters for a character card that no player currently holds. The new character starts at **full HP** (for now).

## The turn

```
Start of turn → Move → Attack (optional) → End turn
```

### 1. Start of turn
- Gain 1 energy. Draw 1 card (no draw if hand is already 6).
- Start-of-turn effects resolve: Forest regen (each of your Swordsmen heals 2 if your piece is in Forest), "can't move this turn" markers, etc.
- Own-turn card allowed here: Unshakable Resolve.
- **Response window (opponents):** Falling Rocks, Momentum Breaker, Distraction, Slowed by Fear.

### 2. Move — mandatory
- Roll the die and move your piece. You cannot choose not to move.
- Exceptions come only from effects: Falling Rocks, Recovery Surge, Samurai's Shadow Step / Warrior's Stand, Necromancer's Dark Resurrection ("can't move") and the cards Steady Aim / Warrior's Endurance, which themselves grant skipping the move.
- Movement cards are played here: Hidden Shortcut, Swift Footing, Time Warp, Dash Strike, Restless Charge, Teleport Rune, Blink Step, Teleport Spell.
- Landing triggers the space's effect; entering a realm asks for a lane (see "Dependency on the board model").

### 3. Attack — optional
1. Choose one of your living characters, one of its attacks, and a target player (or none for untargeted attacks).
2. Pay energy (after discounts).
3. **Response window (any player):** reaction cards — Magic Barrier, Unyielding Strength, Distraction, Slowed by Fear, Stolen Tactics.
4. **Defender chooses** which living character takes the hit (for area attacks, each hit player chooses). Veilpiercer overrides this: the attacker picks the enemy character, for half damage.
5. Resolve damage, healing, self-damage, terrain modifiers.
6. **Response window:** Adrenaline Rush (for a player who just took 5+ damage).

Attack-modifier cards are played before or during step 1–2: Power Infusion, Steady Aim, Longshot Gambit, Explosive Arrows, Quick Draw, Blade Dance, Titanic Slam, Battle Roar, Lifeblood Ritual, Colossus Stance.

### 4. End turn
- Before pressing End Turn the player can still play cards, equip/unequip supports, and discard for energy — including after attacking.
- End-of-turn effects resolve (Priestess' Blessing, Endurance Training, Calculated Strategy, Mystic Insight's condition, etc.).
- Play passes clockwise to the next player who still has a living character.

### Free actions — any time during your own turn
- Play an own-turn event card that makes sense in the current phase.
- Discard a card of your choice for +1 energy.
- Equip a support (max 2) or unequip one.

### After any event card is played
- Short response window for Stolen Tactics.

## Response windows

- A window opens at the points listed above. The app goes through the players who hold a card playable in that window, clockwise from the current player; each chooses **Play** or **Pass**.
- **One pass round.** Each eligible player is asked once; nobody is re-asked after someone plays.
- **Chaining is one level deep.** An event card played inside a window gives the other players one Stolen Tactics chance; Stolen Tactics itself does not open a further window.
- Players with nothing playable are skipped automatically, so a window with no possible responders doesn't appear at all.
- Any opponent may respond, not only the one being attacked. The current player does not respond in windows during their own turn (they can play own-turn cards as free actions instead).
- Distraction and Slowed by Fear make a player eligible only in the start-of-turn and attack response windows — not in the after-damage or after-event windows — so windows stay rare.
- **Hidden hands.** A player's cards are visible only on their own turn. Before each responder acts, the app shows a "Pass the screen to <Player>" screen; the responder clicks to reveal their playable cards, then Play/Pass hides them again. The same handoff screen appears at the start of each turn.
- **Reaction effects are resolved by hand in this project.** The window shows the played card's text; players apply the effect themselves (using the Debug controls if needed). Cards that already auto-resolve today keep doing so. Automating reaction effects (markers that last across turns, damage modifiers, Stolen Tactics replay) is a later project.

## Class cards

A class card (Archer, Knight, Mage, Heavy) is playable by anyone who has a **living character of that class**. Classes: Archer → Marksmen (Archer, Ballista Engineer); Knight → Swordsmen (Knight, Samurai); Mage → Mages (Cleric, Necromancer); Heavy → Brutes (Berserker, Titan Warlord). This rule also decides eligibility for response windows (Magic Barrier, Unyielding Strength, Adrenaline Rush).

## Card timing

| When | Cards |
|---|---|
| Opponent's start of turn (before they roll) | Falling Rocks, Momentum Breaker |
| Any response window | Distraction, Slowed by Fear |
| Attack response window | Magic Barrier, Unyielding Strength |
| After taking damage | Adrenaline Rush |
| After an event card is played | Stolen Tactics |
| Own turn, lasts until your next turn | Counterstrike, Armour of Thorns |
| Own turn only | Everything else — including Medic's Touch |

## Card text that referred to the "active character"

With no active character, these become "a character of your choice": Mana Overflow ("if one of your characters is a Mage" — see calls), Teleport Spell, Teleportation Spell, Priestess' Blessing, Endurance Training, Medic's Touch, Recovery Surge, Energizing Heal, Divine Restoration, Overload's self-damage.

## Dependency on the board model

The board is currently an image with hand-placed ("calibrated") tiles that carry no type, realm or lane. Real movement (counting spaces along a path, lane choice, landing effects, automatic terrain, distances for "within N spaces") needs a board model, which is a **separate project**. Until it exists, the Move phase:

- rolls the die automatically and shows the result,
- lets the player place their piece by hand (click a tile / drag) and confirm,
- lets the player set their piece's realm and apply the landed space's effect by hand,
- "same realm" / "same terrain" effects hit opponents whose piece's recorded realm matches the attacker's,
- "within N spaces" effects: the attacker ticks which opponents are in range.

The phase engine should be built so the board model can later plug into Move without restructuring.

## Goals
- Turn flow enforced in the order above, with a visible phase indicator.
- Each phase offers exactly the actions that make sense in it; nothing else is clickable.
- Response windows for opponents, hot-seat style.
- Attacker picks the attacking character; defender picks the receiving character.
- One piece per player on the board.

## Non-goals
- The board model (path, lanes, space effects, distances) — next project.
- Implementing every remaining card's automatic effect — cards not yet automated stay "resolve by hand", but they must respect their timing window.
- Online multiplayer, AI opponents.

## Anti-goals
- A rigid wizard where you can't play a card because the "card step" has passed.
- Response windows that pop up constantly when nobody can respond.

## Constraints
- Keep the existing stack: vanilla JS, zero dependencies, `node server.js`, state saved in `localStorage`.
- Saves from the old (per-character token, active-character) format don't need to migrate; starting a new game is fine.

## Calls I made (not discussed — check these)
1. **Debug controls kept, hidden behind a toggle.** The free "+1/−1 energy", "Draw +1" and manual damage/heal buttons move into a "Debug" panel that is off by default — useful for playtesting.
2. **Hand full:** start-of-turn draw is skipped if the hand has 6 cards (current behaviour).
3. **Excess damage doesn't carry over** to another character.
4. **Unshakable Resolve's "less than 5 HP"** refers to your total HP (rulebook: "your HP is the sum of your characters' HP").
5. **Mana Overflow:** gain 2 energy if you have a living Mage.
6. **Tracking Radar's "+3 if the target moved this turn"** = the target player's piece moved during their most recent turn.
7. **Misty Fog** heals all your living characters (they share your piece, so they're all "in the same terrain").
8. **Spirit Drain:** each hit opponent picks a character to lose 2; the Necromancer heals 2 per opponent drained.
9. **Character draft:** unchanged — duplicates across players are allowed. "Available" for the trade space = not currently held (alive) by any player.
10. **Blade Dance's "defeat an opponent"** = kill one enemy character (not eliminate a whole player).
11. **Hidden-hand leak accepted:** skipping players with nothing playable reveals, a little, who holds reactions. Accepted to keep windows rare.
12. **Response-window mechanics** (one pass round, one level of Stolen Tactics, current player doesn't respond, Distraction/Slowed by Fear limited to two windows) — my calls, from the review.
13. **Area attacks before the board model** — recorded realm for "same realm", attacker ticks targets for "within N spaces".
14. **Conditional cards** (Mystic Insight, Warrior's Endurance, Quick Draw, …) check their condition at the point it can be known — usually end of turn — instead of paying out immediately as they do now.

## Rollout stages

Each stage leaves the game playable so it can be playtested before the next.

1. **One piece per player, no active character.** One token per player; realm recorded per player. Attacker picks the attacking character; defender picks the receiving character (simple picker). Terrain bonuses apply by class (Marksmen, Swordsmen, Mages, Brutes). Free energy/draw/damage buttons move behind a Debug toggle.
2. **Turn phases.** Start → Move → Attack → End state machine with phase indicator and per-phase controls; mandatory roll; one attack (Echoing Strikes / Blade Dance exceptions); end-of-turn effects; every card tagged with its timing window; class-card rule; choose which card to discard; pass-the-screen at the start of each turn.
3. **Response windows.** Window engine (eligible players, pass-the-screen, Play/Pass, one round, one Stolen Tactics chance) at the four window points; defender's choice moves inside the attack window; area-attack targeting by recorded realm / attacker ticks.
4. **Card clean-up.** Conditional cards check at the right time; Mana Overflow, Spirit Drain, Misty Fog per the calls above; "Change your character" trade via a button until the board model exists.

Later projects: the board model; automating reaction-card effects.

## Testing

Move rules logic (damage, terrain, phase transitions, window eligibility) into its own file with no DOM access, and test it with Node's built-in test runner (`node --test`) — still zero dependencies. Each stage is also played through in the browser before it's called done.
