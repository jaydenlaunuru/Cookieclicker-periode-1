Cookie Clicker — korte uitleg (voor presentatie)

Dit project is een simpele Cookie Clicker gemaakt in "vanilla" JavaScript met een OOP-structuur.
De code is geschreven zodat je het kort kunt uitleggen aan beginners.

Belangrijke klassen (in `app.js`):

- Formatter
  - Hulpfunctie om grote getallen kort weer te geven (bv. 1500 -> 1.50K).

- Upgrade
  - Voorstelling van een koopbaar item in de winkel (cursor, oma, etc.).
  - Houdt prijs, groei en hoeveel er gekocht zijn.

- GameState
  - Eenvoudig object dat huidige cookies en lifetime totalen bewaart.

- StorageService
  - Eenvoudige wrapper rond localStorage om JSON op te slaan en te laden.

- CookieClickerGame
  - Hoofdklasse die de spelstatus, upgrades en services beheert.
  - Methoden om te klikken, kopen, saven, laden en resetten.

- UIController
  - Verantwoordelijk voor DOM-interacties: renderen van winkel, achievements,
  - tonen van toasts en floatjes en het afhandelen van knoppen.

- AchievementService
  - Checkt of doelen gehaald zijn en unlockt thema's.

- ThemeService
  - Beheert thema's (ontgrendelen, kopen, toepassen) en persisteert keuze.

- SoundService
  - Kleine WebAudio wrapper om klik- en aankoopgeluiden af te spelen.

Tips voor je presentatie (kort):

1. Start met de "contract"-uitleg: wat doet elke klasse (input/output, kort).
2. Laat in `CookieClickerGame` zien waar alles samenkomt: UI, achievements, themes.
3. Toont een flow: klik -> cookies stijgen -> upgrade kopen -> achievement unlock -> thema ontgrendeld.
4. Gebruik de Demo-knop in Settings om snel alle achievements/thema's te ontgrendelen tijdens demo.

Hoe run je lokaal:

- Start XAMPP of een andere lokale webserver en open:
  http://localhost/Cookieclicker-periode-1/project%201/index.html

- Of open het bestand direct in de browser (sommige browsers blokkeren Audio/localStorage zonder server).

Waar instellingen en saves staan:

- `localStorage` key `cookie-clicker-oop` bevat de game state (upgrades, themes, state).
- `cookie-settings` bevat kleine UI-instellingen (zoals sound on/off).

Als je wilt kan ik nog een korte slide of spiekbriefje genereren met 5 praatpunten per slide (in het Nederlands).