# Stand van zaken

## Wat is gebouwd

- Fitness-app als React/TypeScript/Vite-webapp met local-first opslag en PWA/offline ondersteuning.
- Exercise Library met custom oefeningen, details en filters.
- Routine Builder met instelbare focus areas, target muscles, exercise types, aantallen en namen.
- Routine-namen en focus-area-namen zijn bewerkbaar.
- Weekly Schedule voor terugkerende workouts.
- Dashboardactie **Start workout**.

## Randomisatie van workouts

Een opgeslagen routine werkt als template. Bij **Start workout** worden de concrete oefeningen willekeurig gegenereerd op basis van de ingestelde groepen.

- De gegenereerde sessie wordt opgeslagen per schedule entry en datum.
- Dezelfde workout op dezelfde datum gebruikt dezelfde selectie.
- Een volgende terugkerende workout krijgt een nieuwe selectie.
- De opgeslagen routine-template blijft ongewijzigd.
- Bestaande opslag wordt gemigreerd naar storage-versie 2.

## Huidige status

- 83 tests geslaagd.
- Lint geslaagd.
- Production build geslaagd.
- Tijdelijke sessie- en taskbestanden zijn verwijderd.

## Mogelijke vervolgstappen

- Een volledige workout-weergave toevoegen met voortgang, sets/tijd en afronden.
- Historiek van voltooide workouts toevoegen.
- Eventueel notificaties koppelen aan de concrete gegenereerde workout.
