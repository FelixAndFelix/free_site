# Entwicklungsregeln für Software

In diesem Dokument werden grundlegende Prinzipien und Best Practices für die Softwareentwicklung festgehalten. Das Ziel ist es, einen sauberen, wartbaren und robusten Code während der Implementierung der vorgegebenen Anforderungen zu gewährleisten.

## Projekt Sprache
Englisch

## Git Commit
Die Commit Message dint zur Dokumentation was geändert wird und sollte klar beschreiben was dieser Commit gemacht hat.
- changed: anpassungen an Datein, Code und dokumentationen.
- added: Hinzufügen von neune Features oder Datein
- refactord: Unveränderte äusere Funktionsweise des Codes, jedoch mit anderer Interner Struktur. Inklusive Refactoring report.
- fixed: direkt in relation zu einem offenen Bug Ticket. Inklusive Bug fix report.

## Git Branching Modell

Wir verwenden ein einfaches, aber robustes Branching-Modell, um die Entwicklung organisiert und stabil zu halten.

### Kernprinzipien

1.  **`main`:** Dieser Branch enthält ausschließlich **produktionsreifen Code**. Es wird niemals direkt auf `main` gearbeitet.
2.  **`develop`:** Der Haupt-Integrationsbranch. Alle neuen Features werden hier zusammengeführt. Er repräsentiert den aktuellen Entwicklungsstand für das nächste Release.
3.  **`feature/*`:** Für jede neue Funktion wird ein eigener Branch von `develop` erstellt. Dies isoliert die Arbeit und verhindert Konflikte.

### Workflow Git Branching

- **Start:** Ein neuer Feature-Branch wird immer vom aktuellen `develop`-Branch abgezweigt (`git switch -c feature/mein-feature`).
- **Entwicklung:** Commits werden regelmäßig auf dem Feature-Branch gemacht.
- **Abschluss:** Wenn das Feature fertig ist, wird der Feature-Branch in den develob Branch gemerged / rebased. Dazu:  
  1. auf dem Aktuellen Feature branch alle änderungen des Develop Branches holen (Code Branch)
      ```bash
      git checkout feature-branch
      git pull origin Code
      ```
  2. Manuelles Lösen von eventuellen Merge Konfilikten. Diese Passieren auf dem Feature Branch und kolidieren somit nicht mit dem Entwicklungscode der Anwendung.
  3. Pushen des Konfiliktfreien Feature Branch
      ```bash
      git push origin feature-branch
      ```
  4. Erstellen eines Pull Request in Github zum mergen des Feature Branches in den Entwicklungs (Code) Branch.
  Source: feature-branch und Target: code

### Naming convention branches
- feature/my_featur discription of feature that is implementet in this branch 
- refactoring/refactored_feature
- fix/fixed_bug

### Schaubild: Branch-Architektur

```
main:    --------------------------------------------o (Release v1.0)
           ^
           | (Merge)
develop: --o-----------o-------------------o---------o------>
             \         / \                 /
              \       /   \               /
feature/a:     `-----`     \             /
                            \           /
feature/b:                   `---------`
```

## Clean Code

Clean Code ist Code, der leicht zu lesen, zu verstehen und zu warten ist.

### Aussagekräftige Namen

Variablen, Funktionen und Klassen sollten Namen haben, die ihren Zweck klar beschreiben.

**Schlecht:**
```javascript
let d = 10; // was ist d?
function proc(a, b) { ... } // was macht proc?
```

**Gut:**
```javascript
let elapsedTimeInDays = 10;
function calculateSum(a, b) { ... }
```
### Einrücken
Eingerückt wird mit doppeltem Tab für eine Unterzeile.
Vorteil: Wenn der Code aus dem Fenster Geht merkt man automatisch, dass der Code zu Lang oder zu Vielschichtig ist.
```python
def add_function(self, a: int, b: int) -> int:
    return a + b:
```

### Variablen Konventionen
snake case
```python
raum_temperatur = 20
```

### Funktionen

- **Eine Aufgabe pro Funktion:** Jede Funktion sollte genau eine Aufgabe erledigen.
- **Kurz halten:** Funktionen sollten so kurz wie möglich sein.
- **Wenig Argumente:** Je weniger Argumente eine Funktion hat, desto einfacher ist sie zu verwenden.

**Schlecht (macht zu viel):**
```javascript
function getUserDataAndCreateReport(userId) {
  // 1. Daten von der API abrufen
  // 2. Daten validieren
  // 3. Bericht im PDF-Format erstellen
  // 4. Bericht per E-Mail senden
}
```

**Gut (aufgeteilt in mehrere Funktionen):**
```javascript
function getUserData(userId) { ... }
function validateUserData(user) { ... }
function createPdfReport(user) { ... }
function sendEmail(report) { ... }
```

### Kommentare

- **docString** Jede methode bzw. Funktion sollte einen doc String nach dem folgenden format habe. Er stellt klar was die Funktion tut und welche Parameter als In / Output verwendet werden.
  ```jsx
  /**
  * Kurze Beschreibung der Komponente.
  * @param {{name: string, role: string}} props
  */
  ```

- **Kommentare erklären das *Warum*, nicht das *Was***: Guter Code ist selbsterklärend. Kommentare sollten nur dann verwendet werden, wenn die Logik komplex ist und eine Erklärung benötigt, warum sie auf eine bestimmte Weise implementiert wurde.
- **Vermeide auskommentierten Code:** Auskommentierter Code sollte gelöscht werden. Versionskontrollsysteme wie Git können alte Versionen wiederherstellen.

## Responsive Design
```javascript
/* Mobile First */
.container {
  width: 100%;
  padding: 1rem;
}

/* Desktop */
@media (min-width: 768px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
}
```

## KISS (Keep It Simple, Stupid)

**Prinzip:** Alles sollte so einfach wie möglich gehalten werden. Komplexität sollte nur dann hinzugefügt werden, wenn sie absolut notwendig ist. Einfacher Code ist leichter zu verstehen, zu debuggen und zu warten.

**Beispiel:**

Angenommen, der Name eines Benutzers muss formatiert werden.

**Schlecht (unnötig komplex):**
```javascript
function formatUserName(firstName, lastName) {
  if (firstName && lastName) {
    return `Nachname: ${lastName}, Vorname: ${firstName}`;
  } else if (firstName) {
    return `Vorname: ${firstName}`;
  } else if (lastName) {
    return `Nachname: ${lastName}`;
  } else {
    return 'Unbekannter Benutzer';
  }
}
```

**Gut (einfach und klar):**
```javascript
function formatUserName(firstName, lastName) {
  if (!firstName && !lastName) {
    return 'Unbekannter Benutzer';
  }
  return `${firstName || ''} ${lastName || ''}`.trim();
}
```

---

## DRY (Don't Repeat Yourself)

**Prinzip:** Code-Wiederholungen sind zu vermeiden. Jedes Stück Wissen oder Logik in einem System sollte eine einzige, eindeutige und maßgebliche Repräsentation haben. Code-Duplizierung führt zu Inkonsistenzen und erschwert die Wartung.

**Beispiel:**

**Schlecht (Code-Wiederholung):**
```javascript
function calculateRectangleArea(length, width) {
  return length * width;
}

function printRectangleDetails(length, width) {
  const area = length * width; // Wiederholte Logik
  console.log(`Länge: ${length}, Breite: ${width}, Fläche: ${area}`);
}
```

**Gut (Logik wiederverwenden):**
```javascript
function calculateRectangleArea(length, width) {
  return length * width;
}

function printRectangleDetails(length, width) {
  const area = calculateRectangleArea(length, width); // Wiederverwendung
  console.log(`Länge: ${length}, Breite: ${width}, Fläche: ${area}`);
}
```

---

## YAGNI (You Ain't Gonna Need It)

**Prinzip:** Es sollte keine Funktionalität implementiert werden, von der nur angenommen wird, dass sie in Zukunft benötigt wird. Der Fokus sollte auf den aktuellen Anforderungen liegen. Dies vermeidet unnötigen Code und Komplexität.

**Beispiel:**

Ein einfacher Taschenrechner wird entwickelt.

**Schlecht (Überentwicklung):**
Ein Entwickler fügt neben den Grundrechenarten auch gleich trigonometrische und logarithmische Funktionen hinzu, "nur für den Fall, dass sie später gebraucht werden".

**Gut (Fokus auf das Notwendige):**
Es werden nur die Addition, Subtraktion, Multiplikation und Division implementiert, wie es die aktuellen Anforderungen vorsehen. Weitere Funktionen können bei Bedarf später hinzugefügt werden.