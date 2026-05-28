# Guide: Konfigurera Firebase för Doom Karteditor

Denna guide beskriver steg-för-steg hur du skapar ett Firebase-projekt i Google Cloud, sätter upp databasen **Cloud Firestore** och lägger till dina uppgifter i en `.env`-fil så att spelet kan spara dina banor i molnet.

---

## Steg 1: Skapa ett Firebase-projekt

1. Gå till [Firebase Console](https://console.firebase.google.com/) och logga in med ditt Google-konto.
2. Klicka på **Add project** (Skapa ett projekt).
3. Ge ditt projekt ett namn, t.ex. `doom-map-editor`.
4. Välj om du vill aktivera Google Analytics (valfritt, krävs inte för detta projekt) och klicka på **Create project** (Skapa projekt).
5. När projektet är klart, klicka på **Continue** (Fortsätt).

---

## Steg 2: Skapa Cloud Firestore-databasen

1. I vänstermenyn på Firebase-konsolen, klicka på **Build** och välj **Firestore Database**.
2. Klicka på knappen **Create database** (Skapa databas).
3. **Location (Plats):** Välj en region nära dig (t.ex. `eur3 (europe-west)` för Europa) och klicka på **Next**.
4. **Rules (Säkerhetsregler):** Välj **Start in test mode** (Starta i testläge) för enkelhetens skull under utvecklingen. Detta gör att du kan läsa och skriva utan inloggning de första 30 dagarna.
   *(När du vill publicera spelet på riktigt kan du uppdatera reglerna för att kräva inloggning eller skydda datan).*
5. Klicka på **Create** (Skapa).

---

## Steg 3: Skapa en Web App och hämta API-nycklar

1. Gå tillbaka till projektets översiktssida (klicka på **Project Overview** högst upp till vänster).
2. Klicka på **Web-ikonen** (`</>`) mitt på skärmen för att lägga till en app i ditt projekt.
3. Ge din app ett namn, t.ex. `doom-web-client`. Lämna "Firebase Hosting" omarkerat för nu.
4. Klicka på **Register app** (Registrera app).
5. Du kommer nu att se ett kodblock med objektet `firebaseConfig`. Det ser ut ungefär så här:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyA1...",
     authDomain: "doom-map-editor.firebaseapp.com",
     projectId: "doom-map-editor",
     storageBucket: "doom-map-editor.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:123456:web:abcd123"
   };
   ```

---

## Steg 4: Konfigurera `.env`-filen i ditt projekt

1. Öppna ditt projekt (`testapp-doom`) i din kodredigerare.
2. Skapa en ny fil i rotkatalogen (där `package.json` ligger) och döp den till exakt **`.env`**.
3. Kopiera innehållet från `.env.example` eller klistra in följande mall, och ersätt värdena med dina unika uppgifter som du fick i Steg 3:

   ```env
   VITE_FIREBASE_API_KEY=AIzaSyA1...dina_uppgifter...
   VITE_FIREBASE_AUTH_DOMAIN=doom-map-editor.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=doom-map-editor
   VITE_FIREBASE_STORAGE_BUCKET=doom-map-editor.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:123456:web:abcd123
   ```

4. **Spara filen.**
5. Starta om utvecklingsservern (`npm run dev`) om den var igång. Vite läser bara in `.env`-filer vid uppstart.

Nu är spelet helt uppkopplat till molnet! Varje gång du klickar på **Save** i baneditorn sparas banan i ditt Firebase-projekt under kollektionen `maps`.
