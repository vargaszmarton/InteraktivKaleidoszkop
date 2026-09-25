# Dobby — A varázslat a kezedben

Statikus, GitHub Pages-kompatibilis élmény az eredeti Dobby spritesheet használatával. Nincs buildlépés vagy backend.

## Indítás és publikálás

A projekt gyökerét kiszolgáló helyi HTTP-szerveren nyisd meg a `/dobby-portal/` útvonalat. GitHub Pages esetén a repository közzétett gyökeréből ugyanez az útvonal: `https://vargaszmarton.github.io/InteraktivKaleidoszkop/dobby-portal/` (a fájlok feltöltése és a Pages publikálása után).

## Irányítás

- Egérmozgás: Dobby és a portál mozgatása; kattintás vagy Space: szikrarobbanás; görgetés: méretezés.
- Érintés: húzás; két ujjal távolság és szög alapján méretezés és forgatás.
- Kamera bekapcsolása után legfeljebb két kéz követése. Mutatóujj: mozgatás; hüvelyk- és mutatóujj csippentése: szikrák; két kéz távolsága/szöge: méret/forgatás.
- Lumos, Kozmosz, Főnix: három színvilág. A kamera ugyanazzal a gombbal leállítható.

A kamera HTTPS-en vagy localhoston működik. A videó helyben kerül feldolgozásra; a MediaPipe 0.10.21 csomag és a modell külső CDN-ről töltődik be. A betűk Google Fonts-ról érkeznek, hálózat nélkül rendszerbetű a tartalék. GPU-hiba esetén CPU-feldolgozásra vált. Kameraengedély vagy modellbetöltési hiba esetén az egér és érintés tovább működik.

A kézfelismerés API-referenciája: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js

## Ellenőrzés

JavaScript szintaxis: `node --check dobby-portal/script.js`. Böngészőben ellenőrizhető a három világ, szikraeffekt, kamera hibaüzenet és mobilnézet. A valódi egy-/kétkezes pontosság fizikai kamerás kézi próbát igényel.

