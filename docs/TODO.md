# Doom Project — TODO

Ideer och funktioner vi vill införa. Tar en sak i taget i varsin branch så vi testar ordentligt.

## Gameplay

- [ ] **Spela flera banor i rad** — Level progression: när man klarar en bana laddas nästa automatiskt. Behöver stöd för flera banor/levels i en kampanj.
- [ ] **Nycklar för att öppna dörrar** — Key system: spelaren måste hitta en nyckel (röd/blå/gul) för att öppna låsta dörrar. Nycklar syns som pickups, dörrar visar vilken nyckel som krävs.

## Monster & Hindersystem

- [ ] **Delvis täckta monster** — Om ett monster står bakom ett hinder men överkroppen sticker upp ska man kunna skjuta över hindret och träffa. Nu verkar hindret vara fullhöjd och blockera skott även när monstrets huvud/överkropp är synligt. Lösning: raycast mot fiendens hitbox ovanför hindrets topp, eller splitta hitbox i övre/nedre del.
- [ ] **Sprites som monster** — Byta ut box-geometrin mot sprite-baserade fiender (som originalet Doom). Kräver sprite sheets för idle/walk/attack/death, och billboard-rotation så de alltid vänder mot kameran.
- [ ] **Sprites som texturer** — Använda sprite-känsliga texturer för väggar/objekt för mer Doom-liknande estetik. Kan vara billboards eller spritedekorationer.

## Arkitektur / Infrastruktur

- [ ] **Test-suite** — Unit tests för GameCollision, GameHelpers, EditorExport, StorageHelpers
- [ ] **E2E-tester** — Playwright-tester som verifierar att spelet laddar, editorn funkar, E1M1 laddas korrekt
- [ ] **CI pipeline** — Kör tsc + vite build + tester på varje PR innan merge