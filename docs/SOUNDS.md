# Ljudöversikt

Referens för alla ljudeffekter och musikspår i projektet. Baserat på `src/shared/audio/Audio.ts`, alla `audioManager.play()`-anrop, och filer i `public/sounds/` och `public/audio/`.

## Ljudeffekter — registrerade och använda

| Ljudnamn | Fil | Handling |
|---|---|---|
| `player_pain` | `dsplpain` | Spelaren tar skada (fiendeprojektil, lava/slime, fat-explosion, närkontakt) |
| `player_death` | `dspldeth` | Spelaren dör |
| `pistol` | `dspistol` | Revolver och kulspruta skjuter |
| `shotgun` | `dsshotgn` | Hagelgevär skjuter |
| `shotgun_cock` | `dssgcock` | Omladdning (revolver, kulspruta, manuell R) |
| `noway` | `dsnoway` | Use utan effekt, tom ammunition, låst hagelgevär (tangent 2) |
| `weapon_pickup` | `dswpnup` | Byter vapen (1/2/3), plockar upp hagelgevär |
| `item_pickup` | `dsitemup` | Plockar upp health eller ammo |
| `door_open` | `dsdoropn` | Dörr öppnas (use eller spelaren går in i stängande dörr) |
| `door_close` | `dsdbcls` | Dörr stängs automatiskt |
| `switch` | `dsswtchn` | Aktiverar exit-switch |
| `explosion` | `dsbarexp` | Exploderande fat |
| `imp_alert` | `dscacsit` | Imp / cacodemon upptäcker spelaren |
| `imp_death` | `dscacdth` | Imp dör (fallback för okända fiendetyper) |
| `zombie_alert` | `dsposit1` | Zombi / ratman upptäcker spelaren |
| `zombie_death` | `dspodth1` | Zombi / ratman dör |
| `demon_alert` | `dssgtsit` | Demon / mancubus upptäcker spelaren |
| `demon_death` | `dssgtdth` | Demon / mancubus / cacodemon dör |

### Fiendeljud per typ

Samma ljud återanvänds per fiendegrupp:

| Fiendetyp | Alert | Död |
|---|---|---|
| imp | `imp_alert` | `imp_death` |
| cacodemon | `imp_alert` | `demon_death` |
| zombieman | `zombie_alert` | `zombie_death` |
| ratman | `zombie_alert` | `zombie_death` |
| demon | `demon_alert` | `demon_death` |
| mancubus | `demon_alert` | `demon_death` |

### Var ljud triggas i koden

| Ljud | Fil(er) |
|---|---|
| Spelarskada / död | `src/game/Game.tsx`, `src/game/GameHelpers.ts` |
| Vapen | `src/game/GameHelpers.ts`, `src/game/Game.tsx` |
| Dörrar | `src/game/Doors.tsx` |
| Pickups, switch, fat | `src/game/Game.tsx` |
| Fiende-AI | `src/game/GameHelpers.ts` |

---

## Ljudeffekter — registrerade men aldrig spelade

Dessa laddas in vid start men `audioManager.play()` anropas aldrig för dem:

| Ljudnamn | Fil | Trolig avsedd användning |
|---|---|---|
| `player_hurt` | `dsoof` | Tidigare skadeljud — ersatt av `player_pain` |
| `door_open_fast` | `dsbdopn` | Snabb/blå dörr öppnas |
| `door_close_fast` | `dsbdcls` | Snabb/blå dörr stängs |
| `demon_attack` | `dssgtatk` | Demon slår/attackerar |
| `fireball` | `dsfirsht` | Fiende skjuter eldklot |
| `fireball_hit` | `dsfirxpl` | Eldklot träffar |
| `powerup` | `dsgetpow` | Powerup (beskyddadhet m.m.) |
| `teleport` | `dstelept` | Teleport |
| `slime` | `dsslop` | Bubblande slime/nukage |
| `footstep` | `dshoof` | Fotsteg |
| `metal_step` | `dsmetal` | Fotsteg på metall |

**11 av 28** registrerade ljudeffekter används inte.

---

## Filer på disk men inte registrerade

| Fil | Status |
|---|---|
| `dsradio` | Finns (ogg + wav), används inte |
| `dsswtchx` | Finns (ogg + wav), används inte — troligen alternativ switch-ljud |
| `dsdbopn` | Finns (ogg + wav), används inte — vanlig dörr-öppning (skiljer sig från `dsbdopn` som är snabb variant) |

---

## Musik

| Fil / källa | När den spelas |
|---|---|
| `e1m1.ogg` | Standardnivå (E1M1) utan egen `musicTrack` |
| `inferno.ogg` | Custom map med `musicTrack: "inferno"` |
| `darkness.ogg` | Custom map med `musicTrack: "darkness"` |
| `rampage.ogg` | Custom map med `musicTrack: "rampage"` |
| `eerie.ogg` | Custom map med `musicTrack: "eerie"` |
| `doom.ogg` | Custom map med `musicTrack: "doom"` |
| **MenuSynth** (procedurell) | Huvudmenyn |
| **MusicEngine** (procedurell) | Fallback om OGG för vald track saknas |
| `e1m1.mid` | Finns på disk, används inte av spelet |

Musik startas från `src/app/App.tsx` (`playMusic` / `playGameMusic`) och menyn via `src/game/MainMenu.tsx` (`playMenuMusic`).

---

## Sammanfattning

| Kategori | Antal |
|---|---|
| Registrerade SFX, använda | 17 |
| Registrerade SFX, oanvända | 11 |
| Filer på disk, inte ens registrerade | 3 (+ wav-varianter) |
| Musikspår (OGG) | 6 används |

## Möjliga framtida kopplingar

- **Footsteps** (`footstep`, `metal_step`) vid spelarrörelse
- **Fireball** (`fireball`, `fireball_hit`) när fiender skjuter projektiler
- **Slime** (`slime`) vid miljöskada i lava/slime
- **Demon attack** (`demon_attack`) vid närstrid
- **Snabba dörrar** (`door_open_fast`, `door_close_fast`) om blå/snabb dörrtyp införs
