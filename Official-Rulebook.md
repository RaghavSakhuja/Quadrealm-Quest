# Quadrealm Quest: Official Rulebook

**Status:** Draft v0.1, for review. This replaces neither [Rulebook.md](Rulebook.md) nor [Rules.md](Rules.md); those stay as the original sources.

**How to read this draft**
- Rules without a marker are either in the original rulebook or confirmed by the designer.
- **(Q*n*)** marks a rule that needs a decision. Each one is listed under [Open questions](#14-open-questions) with the proposed answer the draft currently uses.

---

## 1. Objective

Be the last player with HP left.

## 2. Components

- 1 board: 4 realms and 4 corridors (see [Section 6](#6-the-board-and-movement)).
- 10 character cards.
- 1 common deck of event and support cards.
- 1 piece per player.
- 1 six-sided die.
- Energy and HP tracking for each player.

## 3. Setup

1. Each player drafts **3 characters**. A player cannot pick the same character twice.
2. Each player's **starting HP** is the total of their 3 characters' HP.
3. Each player chooses one of their characters as their **active character**.
4. Each player places their **one piece** on **Embark**, the shared starting space.
5. Each player starts with **0 energy** and an empty hand.
6. Shuffle the common deck.
7. Play proceeds **clockwise**.

## 4. Core concepts

### 4.1 Team HP

Your HP is **one team total**: the sum of your 3 characters' HP.
- Damage, self-damage and healing all change this one number.
- Characters are **never knocked out**. All 3 stay available until your HP reaches 0.
- Healing cannot raise your HP above your starting total.

### 4.2 Active character

You **always have exactly one active character**.
- Your active character is the one that attacks.
- Realm effects apply based on your active character's type, including defensive ones when you are attacked (see [Section 8](#8-realm-effects)).
- Card conditions such as "if your active character is a Mage" refer to your active character.

### 4.3 Your piece

Each player has **one piece** on the board, which represents the whole team. The realm your piece is in is the realm your active character is in.

### 4.4 Energy

- Gain **1 energy** at the start of each of your turns.
- Spend energy on attacks, lanes and some cards.
- Discard 1 card from your hand to gain **1 energy**.
- Energy cannot go below 0.

### 4.5 Cards

- **Hand limit:** 6 cards. If your hand is full, skip the draw.
- **Support cards** go into your **2 support slots** and stay active. Equipping is free, and you may swap one out for a new one. A support card that leaves its slot is discarded; it never returns to your hand.
- **Event cards** are **one-time use**. You may play one at any point during your own turn, including before you roll. Discard it once played; its effect lasts until the start of your next turn (one full round) unless it says otherwise.
- The deck has one copy of each card. When it runs out, shuffle the discard pile to form a new deck.

### 4.6 Character types

Every character has a type. Realm effects and type cards refer to these types.

| Type | Characters | Affected by realms |
|---|---|---|
| **Long Range** | Archer, Ballista Engineer | Yes |
| **Close Range** | Knight, Samurai | Yes |
| **Mage** | Cleric, Necromancer | Yes |
| **Brute** | Berserker, Titan Warlord | Yes |
| **Wildcard** | Gambler, Tactician | No |

Brute and Wildcard replace the original names Heavy Build and Neutral.

A **type card** (a type event or type support) only has an effect while your active character is that type.

### 4.7 Rounding

When an effect halves or divides a number, always round down.

## 5. Turn sequence

On your turn, take these phases in order. You may play event cards at any point during your turn, including before you roll.

1. **Energy:** gain 1 energy.
2. **Draw:** draw 1 card.
3. **Movement:** roll the die and move your piece (see [Section 6](#6-the-board-and-movement)).
4. **Space effect:** the space you landed on activates (see [Section 6.3](#63-board-spaces)).
5. **Cards (optional, any order):**
   - Discard a card for 1 energy.
   - Equip or swap support cards.
6. **Action (optional), choose one:**
   - **Switch** your active character to another of your characters.
   - **Attack** with your active character (see [Section 7](#7-combat)).

   Switching is your action for the turn, so you cannot attack in a turn in which you switch. Switching from the "Change your character" space is the exception: it is free and does not use your action, so you can still attack.
7. **End of turn:** resolve end-of-turn effects, then play passes clockwise.

## 6. The board and movement

### 6.1 Layout

The board is one clockwise loop of **80 spaces**:

- 4 **corridors** of 3 spaces each, with no realm. The first space of the first corridor is **Embark**.
- 4 **realms**, in clockwise order from Embark: **Mountain, Forest, Volcano, Hot Spring**.
- Each realm has **3 lanes**: an outer and an inner lane of 6 spaces each, and a middle lane of 5 spaces.

### 6.2 Moving

- Roll the die and move your piece that many spaces, always **clockwise**. Moving is not optional: only an effect that says you cannot move stops you.
- When your piece reaches a realm entrance, choose a lane:
  - **Outer lane (marked `+1`):** costs 1 energy. You cannot choose it with 0 energy.
  - **Middle lane:** free.
  - **Inner lane (marked `−1`):** gives you 1 energy.
- Only the space your piece **lands on** activates, right after you move. Spaces you pass through do nothing.
- If a space moves your piece, the space it lands on activates too.
- A space's bonus (extra damage, lower cost) lasts as long as your piece stays on that space.
- Pieces may share a space.
- An effect that says you **cannot move** skips your Movement phase.

### 6.3 Board spaces

| Space | Effect |
|---|---|
| Embark | Starting space. No effect. |
| Draw 1 more card | Draw 1 card. |
| Discard one card | Discard 1 card of your choice. |
| Discard 1 card, then draw 2 | Discard 1 card of your choice, then draw 2. |
| Gain 1 energy | Gain 1 energy. |
| Lose 2 energy | Lose 2 energy, down to a minimum of 0. |
| Heal 2 HP | Heal 2 HP. |
| Lose 3 Health | Lose 3 HP. |
| Move back 1 space | Move your piece back 1 space. The space you land on then activates. |
| Change your character | You may switch your active character. This is free: it does not use your action, so you can still attack this turn. |
| Attack deals +1 damage | While your piece is on this space, your attacks deal +1 damage. |
| Basic Attack +1 Damage | While your piece is on this space, your basic attacks deal +1 damage. |
| Skill +1 Damage | While your piece is on this space, your skill attacks deal +1 damage. |
| Ultimate +1 Damage | While your piece is on this space, your ultimate attacks deal +1 damage. |
| Attack costs 1 less energy | While your piece is on this space, your attacks cost 1 less energy. |
| Next Event Card Effect Doubled | The next event card you play while your piece is on this space resolves twice. Later event cards are not doubled. |

### 6.4 Counting distance

When an effect states a range, such as "within 3 spaces":
- Count spaces along the track, in either direction, using the shorter way.
- Inside a realm, crossing to the next lane counts as 1 space. After that, count along the lane as normal.
- Realm entrances and exits count as normal spaces.

## 7. Combat

1. Choose an **attack** of your active character: **Basic**, **Skill** or **Ultimate**.
2. Pay its energy cost.
3. Choose an **opponent**. The damage comes off their team HP.
4. Apply modifiers: realm effects (yours and the defender's), support cards, board-space bonuses and event cards.
5. Resolve damage, healing and self-damage.

**Range:** you can attack any opponent, anywhere on the board, unless the effect states a range (see [Section 6.4](#64-counting-distance)).

**Area attacks** also damage other players. "Every opponent in the same realm" means every opponent whose piece is in that realm. Each player takes an area attack's damage once.

**Veilpiercer** (support) lets you attack a non-active character, for half damage **(Q25)**.

## 8. Realm effects

A realm's effect applies when your piece is in that realm and your active character is the realm's favoured type. Wildcards are never affected by realms.

| Realm | Favoured type | Effect |
|---|---|---|
| **Mountain** | Long Range | **Eagle's View:** your area attacks deal +1 damage. |
| | Brute | **Relentless Assault:** whenever you attack (basic, skill or ultimate), you also make one extra skill attack with the same character, for free. The extra skill does not trigger another one. |
| **Forest** | Long Range | **Natural Cover:** you take 2 less damage from attacks. |
| | Close Range | **Forager's Resilience:** heal 2 HP at the start of your turn. |
| **Volcano** | Mage | **Molten Power:** healing from your Mage's attacks becomes damage instead, at 2 healing to 3 damage. It hits the opponent you choose, which is your attack's target if it has one. For example, heal 2 becomes 3 damage. |
| | Close Range | **Heated Edge:** your attacks deal +2 damage. |
| **Hot Spring** | Mage | **Rejuvenating Waters:** every heal you receive gives +1 HP. |
| | Brute | **Unyielding Fury:** you take no self-damage. |

## 9. Characters

Each character has a **Basic**, **Skill** and **Ultimate** attack. The cost is in energy.

### Long Range

**Archer** (20 HP)

| Attack | Cost | Effect |
|---|---|---|
| Simple Arrow | 0 | Deal 2 damage. |
| Heavy Arrow | 2 | Deal 4 damage. |
| Exploding Arrow | 4 | Deal 4 damage to the target, and 2 damage to every other opponent whose piece is in the same realm as the target. |

**Ballista Engineer** (20 HP)

| Attack | Cost | Effect |
|---|---|---|
| Bolt Launcher | 0 | Deal 2 damage. |
| Piercing Spear | 3 | Deal 3 damage to the target and to every other opponent whose piece is in the same realm as the target. |
| Tracking Radar | 4 | Deal 5 damage. If the target moved during their last turn, deal 3 more. |

### Close Range

**Knight** (30 HP)

| Attack | Cost | Effect |
|---|---|---|
| Thrusting Sword | 0 | Deal 2 damage. |
| Heavy Blow | 2 | Deal 5 damage. |
| Excalibur Strike | 3 | Deal 7 damage. |

**Samurai** (25 HP)

| Attack | Cost | Effect |
|---|---|---|
| Quick Slash | 0 | Deal 2 damage. |
| Shadow Step | 2 | Deal 4 damage. The target cannot move on their next turn. |
| Warrior's Stand | 4 | Deal 9 damage. The target cannot move on their next turn. |

### Mage

**Cleric** (15 HP)

| Attack | Cost | Effect |
|---|---|---|
| Water Ball | 0 | Deal 2 damage. |
| Misty Fog | 3 | Deal 2 damage and heal 2 HP. |
| Potion Blast | 4 | Heal 6 HP. |

**Necromancer** (20 HP)

| Attack | Cost | Effect |
|---|---|---|
| Spirit Orb | 0 | Deal 2 damage. |
| Spirit Drain | 4 | Every opponent whose piece is in your realm loses 2 HP, and you heal 2 HP for each of them. |
| Dark Resurrection | 5 | Steal 5 HP from the target. You cannot move on your next turn. |

### Brute

**Berserker** (30 HP)

| Attack | Cost | Effect |
|---|---|---|
| Stone Throw | 0 | Deal 2 damage. |
| Rampage | 2 | Deal 4 damage and take 1 self-damage. |
| Sacrificial Rampage | 5 | Deal 15 damage, and take self-damage equal to half your remaining HP. |

**Titan Warlord** (35 HP)

| Attack | Cost | Effect |
|---|---|---|
| Battle Cry | 0 | Deal 3 damage and take 1 self-damage. |
| Devastating Blow | 2 | Deal 6 damage and take 2 self-damage. |
| Apocalyptic Slam | All your energy | Deal 3 damage for each energy spent on the Slam, and take 1 self-damage for each. |

### Wildcard

**Gambler** (25 HP)

| Attack | Cost | Effect |
|---|---|---|
| All or Nothing | 0 | Roll the die. On 1–3, deal 0 damage. On 4–6, deal 3 damage. |
| Game of Dice | Half the roll | Roll the die. Deal damage equal to the roll, halved on 2, 4 or 6. |
| Fate's Hand | 4 | Roll the die. On 5–6, deal 10 damage and draw 2 cards. |

**Tactician** (20 HP)

| Attack | Cost | Effect |
|---|---|---|
| Reinforcement Order | 0 | Draw 1 card. |
| Chaos Swap | 2 | Choose an opponent and swap your piece with theirs. |
| Landmine | 3 | Deal 5 damage to every opponent within 4 spaces. |

## 10. Support cards

Equip into one of your 2 support slots. A support card stays active until you swap it out, and then it is discarded.

| Card | Effect |
|---|---|
| Arcane Efficiency | Your skill attacks cost 1 less energy. |
| The Titan's Gauntlet | Your basic attacks deal +1 damage. |
| Warrior's Reclamation | For every 4 damage you deal, gain 1 energy. |
| Alchemist's Exchange | Your basic attacks deal no damage. Instead, gain energy equal to half that damage, rounded down. |
| Soul Battery | Convert all healing you receive into energy, at 2 healing per 1 energy. |
| Priestess' Blessing | At the end of your turn, heal 1 HP. |
| Veilpiercer | You may attack a non-active character, for half damage **(Q25)**. |
| Enchanted Library | Spend 2 energy to draw 1 extra card. |
| Echoing Strikes | If 2 of your characters share a type, both attack, dealing base damage only. |
| Gambler's Favor | Roll the die twice and choose which roll to use. |
| Critical Hit | If you roll 5 or 6 for movement, your next attack deals +2 damage. |
| Steady March | You may move exactly 3 spaces instead of rolling. |
| Refined Strategy | Once per turn, you may discard a card to draw a new one. |
| Endurance Training | If you don't attack this turn, heal 3 HP. |
| Sharpened Reflexes | If you roll 1 or 2 for movement, gain 1 energy. |
| Steady Aim (Archer) | Long Range only. If you don't move this turn, your next attack costs 1 less energy. |
| Duelist's Challenge | Close Range only. If you land on an opponent's space, your next attack deals +2 damage. |
| Calculated Strategy | If you play no cards this turn, draw 1 extra card. |
| Teleportation Spell | If your active character is a Mage, you may teleport up to 3 spaces instead of moving normally. |
| Stone Fortress | If you have 2 Brutes, you take 1 less damage from all attacks. |

## 11. Event cards

One-time use. Play one at any point during your own turn, then discard it. Its effect lasts until the start of your next turn (one full round) unless it says otherwise, so a defensive card also warns other players that attacking you isn't worth it.

### 11.1 General

| Card | Effect |
|---|---|
| Hidden Shortcut | If you roll an even number this turn, double your movement. |
| Swift Footing | Move forward 1–3 extra spaces. |
| Teleport Rune | Swap places with an opponent within 3 spaces. |
| Dash Strike | Move forward 1 space, and your attack deals 1 extra damage. |
| Falling Rocks | Choose an opponent within 2 spaces. They cannot move on their next turn. |
| Medic's Touch | Heal 3 HP. |
| Recovery Surge | Heal 5 HP. You cannot move on your next turn. |
| Overload | Gain 3 energy and take 2 self-damage. |
| Strategic Reserve | Gain 1 energy for each different character type among your characters. |
| Power Infusion | Your next attack this turn costs 1 less energy. |
| Stolen Tactics | Copy the effect of the last event card played. |
| Distraction | Choose an opponent. They discard 1 card. |
| Time Warp | Move forward 1 space, then roll the die. On 4–6, move 1 more space. |
| Slowed by Fear | Move an opponent back 2 spaces if their HP is lower than yours. |
| Momentum Breaker | If an opponent moves more than 3 spaces on their next turn, they lose 1 HP. |
| Blink Step | Swap spaces with an opponent less than 4 spaces away. |
| Energizing Heal | Heal 1 HP for each energy you spent this turn. |
| Armour of Thorns | Until your next turn, anyone who attacks you takes 1 damage. |
| Divine Restoration | Heal HP equal to the number of cards in your hand. |
| Ancient Knowledge | Draw 3 cards, then shuffle 2 cards from your hand back into the deck. |

### 11.2 Type events

Only has an effect while your active character is the type shown.

| Card | Type | Effect |
|---|---|---|
| Quick Draw | Long Range | If you used a basic attack this turn, gain 1 energy. |
| Arrow Rain | Long Range | Deal 2 damage to every opponent within 3 spaces. |
| Longshot Gambit | Long Range | If you attack an opponent at least 6 spaces away, deal +1 damage. |
| Steady Aim | Long Range | Skip your movement this turn, and your next attack deals +2 damage. |
| Explosive Arrows | Long Range | If you use an area attack this turn, it deals +1 damage to every target. |
| Blade Dance | Close Range | If you eliminate an opponent this turn, attack again for free. |
| Warrior's Endurance | Close Range | If you don't move this turn, heal 2 HP. |
| Unshakable Resolve | Close Range | If you start your turn with less than 5 HP, gain 2 energy. |
| Counterstrike | Close Range | Until your next turn, an opponent who attacks you from less than 5 spaces away takes 2 damage. |
| Restless Charge | Close Range | Move 2 extra spaces. Your next attack must target an opponent within 3 spaces. |
| Mana Overflow | Mage | Gain 2 energy. |
| Lifeblood Ritual | Mage | If your skill attack heals, it restores 1 extra HP. |
| Mystic Insight | Mage | If you don't attack this turn, draw 2 cards. |
| Magic Barrier | Mage | The next attack against you deals half damage. |
| Teleport Spell | Mage | Move to any unoccupied space within 3 spaces. |
| Unyielding Strength | Brute | Take 2 less damage from the next attack against you before your next turn. |
| Titanic Slam | Brute | If you use an ultimate attack this turn, every opponent takes 2 damage. |
| Adrenaline Rush | Brute | If you take 5 or more damage before your next turn, gain 3 energy. |
| Battle Roar | Brute | If you have less than 10 HP, your next attack costs 1 less energy. |
| Colossus Stance | Brute | You take up to 3 less self-damage this turn. |

## 12. Victory

A player whose HP reaches 0 is eliminated, and their piece leaves the board. The last player with HP left wins.

## 13. Changes from the original rulebook

- **One piece per player**, instead of placing every character on the board. Everyone starts on **Embark**, instead of on separate starting sides.
- **Team HP is one pool.** Characters are never knocked out.
- **The landing space activates right after movement**, before cards and actions.
- **"Change your character"** on the board lets you switch your active character for free, without using your action for the turn.
- **Realm effects apply by character type**, to your active character. Wildcards (Neutral) are never affected. Heavy Build and Neutral are renamed **Brute** and **Wildcard**.
- **Space bonuses** last while your piece stays on the space, and a space that moves you activates the space you land on.
- **Relentless Assault** triggers on any attack, not only skills and ultimates.
- **Event cards** can be played at any point during your own turn, and their effects last until your next turn. The original said "any time".
- **Support cards** stay equipped, and a swapped-out support card is discarded. The original said "Discard used support cards".
- **Rounding** is always down.
- **One type of energy.** The original's "specific energy types" for movement is removed.
- Wording tidied, for example "5lspaces" → "5 spaces" and "upto" → "up to". The support card **Steady Aim** is renamed **Steady Aim (Archer)** to tell it apart from the event card.

## 14. Open questions

Each question lists the answer this draft currently uses.

| # | Question | Draft currently uses |
|---|---|---|
| Q25 | **Veilpiercer** lets you attack a non-active character for half damage. With one team HP, which character is hit no longer changes anything, so the card only halves your damage. What should it do? | The designer will decide later. One option: your attack ignores the defender's realm effects, such as Natural Cover, but deals half damage. |

### Decided

| # | Decision |
|---|---|
| Q1 | Attacks hit the opponent's team HP. |
| Q2 | Team HP is one pool. Characters are never knocked out, and you play on until your HP reaches 0. |
| Q3 | The "Change your character" space lets you switch your active character for free. It does not use your action, so you can still attack. Switching in the Action phase does use your action. |
| Q4 | Everyone starts on Embark. |
| Q5 | Outer lanes (`+1`) cost 1 energy. Inner lanes (`−1`) give 1 energy. Middle lanes are free. |
| Q6 | Movement is always clockwise and not optional. Cards that reward not moving matter when an effect stops you, such as the Samurai's Shadow Step. |
| Q7 | A space's bonus lasts as long as your piece stays on that space. Moving back counts as moving, so the space you land on activates. |
| Q8 | Realm effects apply by character type: Long Range, Close Range, Mage and Brute. Wildcards are never affected. Heavy Build and Neutral are renamed Brute and Wildcard. |
| Q9 | Attacks have no range unless the effect states one. Count along the track; crossing to the next lane counts as 1 space, and realm entrances and exits count as normal spaces. |
| Q10 | Area attacks damage other players. "Every opponent in a realm" means every opponent whose piece is in that realm. |
| Q11 | Always round down. |
| Q12 | Apocalyptic Slam counts the energy spent on the Slam. |
| Q13 | Sacrificial Rampage uses your team HP. |
| Q14 | Misty Fog deals 2 damage and heals 2 HP. |
| Q15 | Chaos Swap: choose an opponent and swap your piece with theirs. |
| Q16 | Relentless Assault: any attack by your active Brute in Mountain gives one extra skill attack of the same character, for free. Molten Power: healing becomes damage at 2:3, so heal 2 becomes 3 damage. |
| Q17 | Up to 2 support cards. Free to equip and swap. A support card that leaves its slot is discarded and never returns to your hand. |
| Q18 | Event cards are played during your own turn. |
| Q19 | One copy of each card. Reshuffle the discard pile when the deck runs out. |
| Q20 | The support card is renamed "Steady Aim (Archer)". Momentum Breaker means "on their next turn". |
| Q21 | There is only one type of energy. |
| Q22 | With a full hand, skip the draw. |
| Q23 | Removed: characters can't be knocked out. |
| Q24 | Healing can't raise your HP above your starting total. |
| Q26 | An event card's effect lasts the whole round, until the start of your next turn. A defensive card also tells others that attacking you isn't worth it. |
| Q27 | Event cards can be played at any point during your turn, including before you roll. |
| Q28 | A type card only has an effect while your active character is that type. |
| Q29 | Molten Power converts healing from your Mage's attacks into damage to the opponent you choose. Relentless Assault's free skill does not trigger another one. |
| Q30 | "Next Event Card Effect Doubled" doubles only the next event card you play while on that space. |
