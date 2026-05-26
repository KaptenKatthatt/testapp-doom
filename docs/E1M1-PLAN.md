# E1M1 Hangar — Level Design Plan

## Nuvarande level
Den nuvarande banan är en slumpmässig samling rum utan tydligt flöde. Den saknar:
- Egentlig E1M1-layout
- Dörrar (fungerande)
- Nukage/slime som skadar
- Secrets
- Exit
- Rätt rum med rätt innehåll

## E1M1 Hangar — Beskrivning

E1M1 "Hangar" är den allra första Doom-banan. Kännetecken:

### Rum & layout (i ordning spelaren möter dem)

1. **Start Room** — rektangulärt rum, spelaren startar i södra änden, vänder norr. Slätt golv. 
   - 2 health potions i hörnen (NE, NW)
   - Grön armor utanför i corridor (via secret)
   - En doorway norrut leder till en L-formad corridor

2. **L-formad Corridor** — svänger höger (öster) från start room
   - Låg belysning
   - Zombiemen här (2 st)
   - Door i östra änden

3. **Slime Room (Computer Room)** — stort rum med sarg-zigzag walkway över nukage/slime
   - Green slime pool under walkway — **skadar spelaren som står i den**
   - Zigzag-walkway leder över till andra sidan
   - Imp(s) på andra sidan
   - Door i norra änden leder vidare
   - Secret alcove med shotgun (när man triggar panel)

4. **Northern Corridor** — kort korridor med en door
   - Leeder till Computer Room / Exit area

5. **Exit Room** — litet rum med exit door/switch
   - **Exit switch** — avslutar banan!

### 3 Secrets
1. **Outdoor secret** — panel i corridor öppnar en tunnel som leder utomhus med blue Mega-Armor
2. **Shotgun secret** — alcove med shotgun (trigglas av floor trigger som sänker en barrier)
3. **Elevator secret** — hidden elevator i alcoven leder till en tunnel ovanför

## Vad vi behöver implementera

### Nya system (i ordning av prioritet)

#### 1. Dörrar ⚡ Högst prioritet
- Dörrar som öppnas när spelaren närmar sig (auto-trigger)
- Dörrar som öppnas med en knapp/switch
- Animerad dörr som glider upp (3 sekunder), stannar, sedan glider ner
- Door state: closed → opening → open → closing → closed
- Ljud? (valfritt, kan vänta)

#### 2. Nukage/Slime-skada ⚡
- Spelaren tar 1 damage/sekund när de står i slime
- Grön textur på marken
- Bubble-emissive effekt
- Specifika zoner markerade som "harmful floor"

#### 3. Floor Triggers
- Osynliga zoner på marken som triggar events
- Sänker plattformar, öppnar secrets
- Enkel implementation: AABB-zoner som checkar player position

#### 4. Secrets
- Väggar som öppnas som dörrar när man "använder" dem (E-tangent eller touch)
- Secret counter i HUD
- "A secret is revealed!" meddelande

#### 5. Exit
- Exit door/switch som triggar "LEVEL COMPLETE" med rätt stats
- Speciell exit textur (röd EXIT-skylt)

#### 6. Pickup-typer
- Health potion (+1 health)
- Green armor (+50 armor, ny stat)
- Mega-armor (+200 armor, secret only)
- Shotgun pickup (ger vapnet, secret)

### Level Layout (förenklad E1M1)

```
    N
    ^
    |
    
    +--+--+--+--+--+--+--+
    |        EXIT         |
    +--+--+--+--+--+--+--+
    |                     |
    |   COMPUTER ROOM     |
    |   (zigzag + slime)  |
    |                     |
    +--+  +--+--+--+  +--+
    |  |  |        |  |  |  ← L-shaped corridor
    |  +--+  D     +--+  |
    |                      |
    |    START ROOM        |
    |  P                   |  P = player start
    +--+--+--+--+--+--+--+
```

### Dimensioner (i Doom units, skalade till vår engine)

Doom använder 128 units = ~3 meter. Vår unit ≈ 1 meter.

| Område | Vår storlek | Beskrivning |
|--------|-------------|-------------|
| Start Room | 12×12 | Rektangulärt, start position söder |
| L-Corridor | 4×14 + 8×4 | L-formad korridor |
| Slime Room | 16×16 | Stort rum med zigzag walkway |
| Exit Corridor | 4×8 | Smal korridor norr ut |
| Exit Room | 6×6 | Litet rum med exit switch |
| Outdoor Secret | 10×10 | Utomhus med himmel |
| Shotgun Alcove | 4×4 | Liten alcove i slime room |
| Elevator Shaft | 2×2 | Uppgång till tunnel |

### Fiender per rum (E1M1-korrekt)

| Område | Fiender | Typ |
|--------|---------|-----|
| Start Room | 0 | (tom, som i Doom) |
| L-Corridor | 2 | Zombiemen |
| Slime Room | 2 | Imps |
| Exit Corridor | 1 | Zombieman |
| Exit Room | 0 | (tom, bara exit) |
| Totalt | 5 | (lätt intro-bana) |

### Högst prioritet — Fas 1
Det absolut viktigaste att få in först:

1. **Fungerande dörrar** — auto-open när spelaren är nära
2. **Nukage-skada** — standing in slime = 1 dmg/sec
3. **Exit door** — avslutar banan med LEVEL COMPLETE
4. **Rätt layout** — Start Room → L-Corridor → Slime Room → Exit

### Fas 2
5. Floor triggers (öppnar secrets)
6. Secret walls (använd-knapp)
7. Secret counter i HUD
8. Pickup-typer (health potion, green armor, shotgun pickup)

### Fas 3
9. Bättre texturer ( Doom-stil tegel, datorpaneler, EXIT-skylt)
10. Zigzag walkway över slime
11. Outdoor secret (himmelstak)
12. Elevator animation

## Implementation Notes

### Dörrar
```typescript
interface DoorData {
  id: number;
  position: [number, number, number];
  size: [number, number, number];
  state: 'closed' | 'opening' | 'open' | 'closing';
  timer: number; // time in current state
  autoClose: number; // seconds before auto-closing (4s)
  triggerDistance: number; // how close player needs to be (2.0)
}
```

Dörrar renderas som boxar som glider uppåt (Y+) när de öppnas. När öppna, collision inaktiveras.

### Nukage
```typescript
interface SlimeZone {
  position: [number, number, number];
  radius: number; // eller bounding box
  damagePerSecond: number; // 1 för slime, 10 för lava
}
```

### Floor Triggers
```typescript
interface FloorTrigger {
  zone: { min: [number, number, number], max: [number, number, number] };
  action: 'lower_wall' | 'open_door' | 'reveal_secret';
  target: number; // ID of wall/door to modify
  once: boolean; // only trigger once
}
```

## Frågor till Jonas
- Vill du ha exakt E1M1-layout eller en "inspirerad av" version?
- Ska vi ha armor-system (ny stat)?
- Hur viktigt är ljud? (dörrljud, slime-bubblor etc)
- Ska exit vara en switch man trycker på eller en door man går igenom?