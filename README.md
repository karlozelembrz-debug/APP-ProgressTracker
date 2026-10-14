# Progress Tracker – instalacija

## A) Desktop aplikacija (Electron) – preporučeno
Treba samo Node.js (https://nodejs.org, LTS).
1. Raspakiraj ovu mapu, u njoj otvori terminal.
2. `npm install`
3. Probno pokretanje: `npm start`
4. Instalacijska datoteka: `npm run dist:win` (Windows → dist/*.exe), `npm run dist:mac` (macOS → .dmg) ili `npm run dist:linux` (→ .AppImage). Svaki se gradi na svom sustavu.
Bez instaliranja alata: gurni mapu na GitHub → Actions → "Build" → Run workflow; preuzmi gotove instalere kao artifacts.

**Podaci na disku:** desktop aplikacija sprema podatke kao datoteke u mapu `Dokumenti\ProgressTracker-podaci` (mapu možeš promijeniti u Postavke → Podaci). Ograničenje je samo slobodan prostor na disku. Podaci koje je prethodna verzija držala u pregledniku sami se sele u tu mapu pri prvom pokretanju.

**Podaci:** aplikacija ima vlastitu pohranu, pa podaci iz preglednika NE prelaze sami. U staroj verziji: „Sigurnosna kopija" → u novoj: „Učitaj kopiju".

## B) PWA (instalacija iz preglednika)
Mora se poslužiti preko https (npr. GitHub Pages: uključi Pages na ovoj mapi). Otvori adresu u Chromeu/Edgeu → ikona „Instaliraj" u adresnoj traci. Nakon prvog učitavanja radi offline. Dvoklik na index.html (file://) ne instalira PWA, ali aplikacija radi i tako.

## Ažuriranje
Zamijeni `index.html` novom verzijom (tracker.html), pa ponovi korak 4. Za PWA promijeni `V` u sw.js (npr. `pt-v2`) da preglednik osvježi cache.
