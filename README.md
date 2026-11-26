# LPrint

**LP + Print** – turn a WAV or MP3 into a 3D-printable, playable record (STL).
**LP + Print** – verwandelt WAV oder MP3 in eine 3D-druckbare, abspielbare Schallplatte (STL).

[🇬🇧 English](#english) · [🇩🇪 Deutsch](#deutsch)

---

## English

### What it is

LPrint is a single HTML page. Open `index.html` in a browser, load an audio file, and it computes a real spiral record groove and saves it as a binary STL that you can slice and print. Nothing is uploaded – all audio processing and mesh generation runs locally in your browser (in a Web Worker).

The interface is available in 10 languages: English (default), Deutsch, Español, Français, Português, Русский, 中文, 日本語, हिन्दी, العربية.

### Features

- **Input:** WAV, MP3 and anything else your browser can decode (FLAC, OGG, M4A …), plus a built-in test signal (1 kHz on both channels, left only, right only, then a 50 Hz–10 kHz sweep).
- **Real record groove:** a continuous spiral 90° V-groove with lead-in and lead-out spiral.
- **Mono or stereo:** mono is cut laterally; stereo uses the standard 45/45 system (inner wall = left channel, outer wall = right channel).
- **RIAA cutting curve,** so the record sounds right through a normal phono input.
- **Trackability limits:** the level is set so the groove never exceeds the maximum excursion or the maximum slope a stylus can follow (and, in stereo, the vertical component).
- **Fit to length:** the excursion shrinks automatically so the audio fits on the chosen disc; if it can't fit, LPrint tells you the maximum playing time.
- **Presets** for 5″, 7″, 10″, 12″ discs, 33⅓ / 45 / 78 rpm, and for printers: Bambu Lab P1S (0.2 / 0.4 mm nozzle), resin 16K / 12K / 8K / 4K.
- **Preview:** the computed disc, a true-scale “microscope” top view of three adjacent groove turns, a readout (playing time, groove pitch, excursion, level, treble limit outside/inside, triangle count, file size) and an audio preview of the filtered signal.
- **Output:** a watertight, consistently oriented binary STL inside a ZIP, together with a `parameter.txt` describing every setting.

### Usage

1. Open `index.html` in a desktop browser (Chrome, Edge, Firefox, Safari). Files can be large – a computer is recommended.
2. Choose an audio file or click “Use a test signal”.
3. Pick record size, speed, mono/stereo and your printer.
4. Click **1 · Compute groove**, check the readout and the microscope view, optionally listen to the preview.
5. Click **2 · Create & save STL**. You get `name_45rpm_mono.zip` containing the STL.

Tip: start with the test signal on a 7″ to see what your printer can resolve before printing a whole song.

### Printing on a Bambu Lab P1S (FDM)

- Use the **0.2 mm nozzle** – it resolves about twice the treble of the 0.4 mm nozzle.
- PLA on a smooth PEI plate, groove side up, layer height 0.06 mm, line width 0.22 mm.
- Bambu Studio: **arc fitting off**, resolution 0.012 mm or lower, X-Y compensation 0, **ironing off**.
- Outer wall 30–40 mm/s, acceleration 1000–2000 mm/s², “Precise wall” on, seam at the back.
- Bed is 256 mm: 5″, 7″ and 10″ fit, 12″ does not.

### Printing on a resin printer

- Flat on the build plate, groove side up; the grooves form in the last layers.
- Smallest layer height (10–25 µm), anti-aliasing on.
- No supports on the top surface. Wash well, clean the grooves with a soft brush, post-cure.
- A 7″ (175 mm) needs a build plate of at least ~220 mm; otherwise choose 5″.

### Playback

- Place the stylus by hand into the wide lead-in groove. The groove ends in a lead-out spiral – lift the arm at the end.
- Test with a cheap conical stylus, not your good one. Normal tracking force.
- Play through a phono input with RIAA. Without a phono preamp, switch the RIAA option off.

### What to expect (honestly)

A printed record will not sound like vinyl. The shortest wavelength a printer can form is roughly 2–3 times its smallest detail, so the treble limit depends on groove speed:

| Printer | Typical treble limit (45 rpm) | Playing time 7″ / 10″ at 45 rpm |
|---|---|---|
| P1S, 0.2 mm nozzle | ~0.5–1.2 kHz | ~40 s / ~80 s |
| P1S, 0.4 mm nozzle | ~0.3–0.6 kHz | shorter |
| Resin 12K–16K | ~4–8 kHz | several minutes |

FDM records sound like a very old gramophone or a telephone: music and voices are recognisable, with clear noise. 78 rpm, large radii and short tracks give the best results. Mono is more robust than stereo. These numbers are estimates from the geometry, not measurements of printed records.

### How it works

1. **Decode & resample:** the browser decodes the file; it is resampled so that one revolution is an exact whole number of samples (`N = sample rate × 60 / rpm`).
2. **Filters:** high-pass, 4th-order Butterworth low-pass (auto: set from printer detail size and groove speed), optional compressor, short fades.
3. **RIAA:** combined with a first-order 50 Hz high-pass, the RIAA recording curve becomes a simple shelf `(1 + s·75 µs) / (1 + s·318 µs)` applied to the groove displacement.
4. **Layout:** groove pitch = groove width + 2 × excursion + land. Lead-in at 1.5 mm/rev, lead-out at 2 mm/rev.
5. **Level:** one global gain, the smallest of: max excursion, max slope (displacement change per arc length at the local radius) and, in stereo, max vertical component.
6. **Mesh:** per sample three points (outer top edge, groove bottom, inner top edge). Adjacent turns share their edges, so the surface is closed by construction. Outer rim, label area, center hole and bottom close the solid. Triangles are written in chunks so files of several hundred MB stay manageable.

### Files

| Path | Purpose |
|---|---|
| `index.html` | The finished, self-contained app (built from `src/`). Just open it. |
| `src/template.html` | Page layout, styles and UI logic |
| `src/core.js` | Audio processing, groove layout and STL generation (runs in a Web Worker) |
| `src/i18n.js` | Translations for all 10 languages |
| `build.js` | Inlines `core.js` and `i18n.js` into `index.html` |
| `test/mesh-check.js` | Generates test records and checks the mesh is watertight |

### Development

Requires Node.js (no dependencies).

```bash
node build.js            # rebuild index.html after editing src/
node test/mesh-check.js  # check meshes are closed and correctly oriented
```

To host it, enable GitHub Pages for this repository (branch `main`, root folder); the app is then available at the repository's Pages URL.

### Limitations

- The translations other than English and German were AI-generated and have not yet been reviewed by native speakers.
- The STL must stay below 4 GB (ZIP limit); lower the sample rate for long audio.
- Results depend heavily on printer calibration. Treat every setting as a starting point.

---

## Deutsch

### Was es ist

LPrint ist eine einzige HTML-Seite. Öffne `index.html` im Browser, lade eine Audiodatei, und die Seite berechnet eine echte Spiralrille und speichert sie als binäre STL, die du slicen und drucken kannst. Nichts wird hochgeladen – die gesamte Audioverarbeitung und Mesh-Erzeugung läuft lokal im Browser (in einem Web Worker).

Die Oberfläche gibt es in 10 Sprachen: English (Standard), Deutsch, Español, Français, Português, Русский, 中文, 日本語, हिन्दी, العربية.

### Funktionen

- **Eingabe:** WAV, MP3 und alles, was dein Browser dekodieren kann (FLAC, OGG, M4A …), dazu ein eingebautes Testsignal (1 kHz auf beiden Kanälen, nur links, nur rechts, dann Sweep 50 Hz–10 kHz).
- **Echte Plattenrille:** durchgehende Spiral-V-Rille mit 90°, Einlauf- und Auslaufspirale.
- **Mono oder Stereo:** Mono wird seitlich geschnitten, Stereo nutzt das übliche 45/45-Verfahren (innere Flanke = linker Kanal, äußere Flanke = rechter Kanal).
- **RIAA-Schneidekennlinie,** damit die Platte am normalen Phono-Eingang richtig klingt.
- **Abtastbarkeit:** Der Pegel wird so gesetzt, dass die Rille weder die maximale Auslenkung noch die maximale Steigung überschreitet, der eine Nadel folgen kann (bei Stereo auch den Vertikalanteil).
- **An Länge anpassen:** Die Auslenkung wird automatisch verkleinert, damit das Audio auf die Platte passt. Passt es gar nicht, nennt LPrint die maximale Spielzeit.
- **Vorlagen** für 5″, 7″, 10″, 12″, für 33⅓ / 45 / 78 U/min und für Drucker: Bambu Lab P1S (0,2- / 0,4-mm-Düse), Resin 16K / 12K / 8K / 4K.
- **Vorschau:** die berechnete Platte, eine maßstabsgetreue „Mikroskop“-Draufsicht auf drei benachbarte Windungen, Messwerte (Spielzeit, Rillenabstand, Auslenkung, Pegel, Höhengrenze außen/innen, Dreiecke, Dateigröße) und eine Hörprobe des gefilterten Signals.
- **Ausgabe:** eine geschlossene, einheitlich orientierte binäre STL in einer ZIP-Datei, zusammen mit `parameter.txt`, die alle Einstellungen beschreibt.

### Bedienung

1. `index.html` in einem Desktop-Browser öffnen (Chrome, Edge, Firefox, Safari). Die Dateien können groß werden – ein Computer ist empfehlenswert.
2. Audiodatei wählen oder „Test-Signal verwenden“ klicken.
3. Plattengröße, Geschwindigkeit, Mono/Stereo und Drucker wählen.
4. **1 · Rille berechnen** klicken, Messwerte und Mikroskop-Ansicht prüfen, eventuell die Vorschau anhören.
5. **2 · STL erzeugen & speichern** klicken. Du bekommst `name_45rpm_mono.zip` mit der STL.

Tipp: Beginne mit dem Testsignal auf einer 7″-Platte, um zu sehen, was dein Drucker auflöst, bevor du ein ganzes Lied druckst.

### Drucken auf dem Bambu Lab P1S (FDM)

- Nimm die **0,2-mm-Düse** – sie schafft ungefähr doppelt so viele Höhen wie die 0,4-mm-Düse.
- PLA auf glatter PEI-Platte, Rillenseite nach oben, Schichthöhe 0,06 mm, Linienbreite 0,22 mm.
- Bambu Studio: **Arc Fitting aus**, Auflösung 0,012 mm oder kleiner, X-Y-Kompensation 0, **Ironing aus**.
- Äußere Wand 30–40 mm/s, Beschleunigung 1000–2000 mm/s², „Precise Wall“ an, Naht hinten.
- Das Druckbett hat 256 mm: 5″, 7″ und 10″ passen, 12″ nicht.

### Drucken auf einem Resin-Drucker

- Flach aufs Druckbett, Rillenseite nach oben; die Rillen entstehen in den letzten Schichten.
- Kleinste Schichthöhe (10–25 µm), Anti-Aliasing an.
- Keine Supports auf der Oberseite. Gut waschen, Rillen mit weicher Bürste reinigen, nachhärten.
- Eine 7″ (175 mm) braucht ein Druckbett von mindestens ca. 220 mm, sonst 5″ wählen.

### Abspielen

- Nadel von Hand in die breite Einlaufrille setzen. Die Rille endet in einer Auslaufspirale – am Ende den Arm anheben.
- Mit einer günstigen konischen Nadel testen, nicht mit der guten. Normale Auflagekraft.
- Über einen Phono-Eingang mit RIAA abspielen. Ohne Phono-Vorverstärker die RIAA-Option ausschalten.

### Was du erwarten kannst (ehrlich)

Eine gedruckte Platte klingt nicht wie Vinyl. Die kürzeste Wellenlänge, die ein Drucker formen kann, liegt bei etwa dem 2- bis 3-Fachen seines kleinsten Details. Die Höhengrenze hängt deshalb von der Rillengeschwindigkeit ab:

| Drucker | Typische Höhengrenze (45 U/min) | Spielzeit 7″ / 10″ bei 45 U/min |
|---|---|---|
| P1S, 0,2-mm-Düse | ca. 0,5–1,2 kHz | ca. 40 s / ca. 80 s |
| P1S, 0,4-mm-Düse | ca. 0,3–0,6 kHz | kürzer |
| Resin 12K–16K | ca. 4–8 kHz | mehrere Minuten |

FDM-Platten klingen wie ein sehr altes Grammophon oder ein Telefon: Musik und Stimmen sind erkennbar, mit deutlichem Rauschen. 78 U/min, große Radien und kurze Stücke bringen die besten Ergebnisse. Mono ist robuster als Stereo. Die Zahlen sind aus der Geometrie geschätzt, nicht an gedruckten Platten gemessen.

### So funktioniert es

1. **Dekodieren & Resampling:** Der Browser dekodiert die Datei; sie wird so umgetastet, dass eine Umdrehung genau einer ganzen Zahl von Samples entspricht (`N = Abtastrate × 60 / U/min`).
2. **Filter:** Hochpass, Butterworth-Tiefpass 4. Ordnung (auto: aus Detailgröße des Druckers und Rillengeschwindigkeit), optionaler Kompressor, kurze Blenden.
3. **RIAA:** Zusammen mit einem 50-Hz-Hochpass 1. Ordnung wird die RIAA-Aufnahmekurve zu einem einfachen Shelf `(1 + s·75 µs) / (1 + s·318 µs)`, angewendet auf die Rillenauslenkung.
4. **Layout:** Rillenabstand = Rillenbreite + 2 × Auslenkung + Steg. Einlauf mit 1,5 mm/Umdrehung, Auslauf mit 2 mm/Umdrehung.
5. **Pegel:** eine globale Verstärkung, der kleinste Wert aus: maximale Auslenkung, maximale Steigung (Auslenkungsänderung pro Bogenlänge am jeweiligen Radius) und bei Stereo maximaler Vertikalanteil.
6. **Mesh:** pro Sample drei Punkte (äußere Oberkante, Rillengrund, innere Oberkante). Benachbarte Windungen teilen sich ihre Kanten, daher ist die Oberfläche von vornherein geschlossen. Außenrand, Etikettfläche, Mittelloch und Unterseite schließen den Körper. Die Dreiecke werden in Blöcken geschrieben, damit auch Dateien mit mehreren hundert MB handhabbar bleiben.

### Dateien

| Pfad | Zweck |
|---|---|
| `index.html` | Die fertige, eigenständige App (aus `src/` gebaut). Einfach öffnen. |
| `src/template.html` | Seitenlayout, Styles und Bedienlogik |
| `src/core.js` | Audioverarbeitung, Rillenlayout und STL-Erzeugung (läuft im Web Worker) |
| `src/i18n.js` | Übersetzungen für alle 10 Sprachen |
| `build.js` | Bettet `core.js` und `i18n.js` in `index.html` ein |
| `test/mesh-check.js` | Erzeugt Testplatten und prüft, ob das Mesh geschlossen ist |

### Entwicklung

Benötigt Node.js (keine Abhängigkeiten).

```bash
node build.js            # index.html nach Änderungen in src/ neu bauen
node test/mesh-check.js  # prüfen, ob die Meshes geschlossen und richtig orientiert sind
```

Zum Hosten GitHub Pages für dieses Repository aktivieren (Branch `main`, Ordner Root); die App ist dann unter der Pages-Adresse des Repositorys erreichbar.

### Einschränkungen

- Die Übersetzungen außer Englisch und Deutsch wurden mit KI erstellt und noch nicht von Muttersprachlern geprüft.
- Die STL muss unter 4 GB bleiben (ZIP-Grenze); bei langem Audio die Abtastrate senken.
- Die Ergebnisse hängen stark von der Kalibrierung des Druckers ab. Alle Einstellungen sind Startwerte.
