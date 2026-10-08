# Varró & Suti Tours

Zárt utazási közösség: GitHub Pages felület, Supabase Auth + PostgreSQL + Edge Function háttér.

## Közzététel

A GitHub Pages forrása a `main` ág `/docs` mappája. A nyilvános fájlokban kizárólag a belépőfelület, az arculat, a vezérlőprogram és a nyilvános projektbeállítás található. A teljes alkalmazás HTML-je és az útiterv az adatbázisból, ellenőrzött belépés után érkezik. Nincs nyilvános demóadat vagy belépést megkerülő mód.

## Supabase összekapcsolás

1. Hozz létre vagy válassz **külön, ehhez az oldalhoz tartozó** Supabase-projektet. A migráció új `public.members`, `site_pages`, `stops`, `posts`, `comments`, `likes`, `login_attempts` táblákat hoz létre; meglévő alkalmazás adatbázisán ne futtasd ellenőrzés nélkül.
2. Jelentkezz be: `npx --yes supabase@latest login`.
3. Linkeld: `npx --yes supabase@latest link --project-ref PROJEKTAZONOSITO`.
4. Migráció: `npx --yes supabase@latest db push`.
5. A Supabase Authentication beállításainál kapcsold ki az új felhasználók szabad regisztrációját. A felhasználókat csak a szervező hozza létre; a belépés kisbetűs felhasználónévvel és jelszóval történik.
6. Engedélyezett eredet: `npx --yes supabase@latest secrets set ALLOWED_ORIGINS=https://sutipeter.github.io`. Helyi teszthez külön hozzáadható `http://127.0.0.1:8088` vesszővel elválasztva.
7. Telepítsd a függvényt: `npx --yes supabase@latest functions deploy community --no-verify-jwt`. A saját függvény minden privát műveletnél a Supabase Auth `getUser` hívásával ellenőrzi a tokent, majd az aktív tagságot és az adott művelet jogosultságát. A login jelszó-ellenőrzést és próbálkozáskorlátozást használ.
8. A **helyi, repón kívüli** `deploy-private/content.sql` tartalmát töltsd be a projekt SQL Editorában. Ez tartalmazza az útitervet és a belépés utáni felületet; ne töltsd fel a GitHubra. Későbbi ismételt importja felülírja az állomásszövegeket; induláskor használd, ne az adminfelületen végzett szerkesztések után.
9. Az első szervezői fiókot a `scripts/create-organizer.mjs` hozza létre. Az öt szükséges környezeti változó: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORGANIZER_USERNAME`, `ORGANIZER_PASSWORD`, `ORGANIZER_NAME`. A titkos értékeket csak megbízható helyi környezetben add meg, soha ne commitold vagy küldd chatben.
10. A nyilvános projekt-URL-t és publishable/anon kulcsot a `scripts/configure.mjs` írja a `docs/config.js` fájlba. A program elutasítja a service-role és secret kulcsokat. A projekt nyilvános kulcsa nem jogosít privát adatok olvasására.

## Tagság

A szervező az oldal saját felületén létrehozhat résztvevőt, letilthatja és újra engedélyezheti a hozzáférését, valamint új jelszót állíthat be. A résztvevő saját jelszavát is módosíthatja. A kezdeti jelszót privát csatornán kell átadni. Nincs nyilvános regisztráció vagy e-mail-küldés.

## Adatvédelem és ellenőrzés

Minden adatos tábla RLS-védett. Anonim felhasználó nem olvashatja őket; aktív tagok közvetlen API-n át csak olvasási jogot kapnak. Módosítást kizárólag a jogosultságot ellenőrző függvény végezhet. A szervezői szerepkört tag nem módosíthatja. Letiltott felhasználó hozzáférését az aktuális adatbázisállapot alapján ellenőrizzük, nem csak a tokenbe mentett régi szerepkör alapján.

A munkamenet az adott böngészőlap sessionStorage tárhelyében él. Kijelentkezéskor a felület és a helyi token törlődik; a kliens lejárat előtt frissítést kér. A csomaglista eszközönként és felhasználónként helyi adat. A felület nem támogat offline hozzáférést a privát tartalomhoz.

A GitHub Pages kódja és a belépőoldal nyilvános; a tagság és a privát utazási tartalom az adatbázisban marad. A belépés nem akadályozza meg, hogy egy jogosult résztvevő saját másolatot készítsen.

Ellenőrzés: `npm test` és `npm run check`. Élesítéskor valódi tesztfiókokkal is vizsgálandó a szervezői és tagi belépés, anonim/letiltott hozzáférés megtagadása, bejegyzés, hozzászólás, kedvelés, kiemelés, törlés, tagkezelés és kijelentkezés. A GitHub Pages URL megléte önmagában nem jelenti a Supabase-projekt sikeres beállítását.

Az alkalmazás fényképei és betűkészletei külső szolgáltatásból töltődnek be. Az Útravaló nem tartalmaz külső hivatkozást. A forrásjegyzék a helyi, repón kívüli dokumentációban marad.
