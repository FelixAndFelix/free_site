Software sollte Probleme lösen, intuitiv und leicht für den Anwender zu verstehen sein und dabei die triade der Softwarenetwicklung hochhalten: Modularität, Testbarkeit/Dokumentation und Skalierbarkeit.
Die folgenden Schritte sind ein Dialog des Entwicklers mit der Software.
Ziele des Dokuments sind:
- Nutzer zentrierte entwicklung
- Fokus auf MVP und Kernfunktione
- Festlegen der Grundzüge und abwähgung der Technologien
- Eingrenzen des Scopes: Was will ich was will ich nicht?
- Iterative Entwicklung auf Grundlage eines MVP
Für die einzelnen entwicklungsschritte stellt man sich Fragen um seine Ziele und Strategie dort hin genauer kennen zu lernen. Es geht um einen inneren Dialog mit dem Produkt.

## Begriffsbuch
User: Ein Studet der die webapp verwendet
Vote: Eine abstimmung die ein Student zu einem Modul gib
Kurs: Jahrgangskurs in dem der Student ist
Modul / Vorlesung: Ein Modul welche in einer Vorlesung vorgestllt wird. Beide begriffe meinen die geliche Entität.
System: Die gesamte Anwendung als laufendes produktivsystem
Container: Einzelner Teil des Systems welcher einen Aufgabenbereich übernimmt (Frontend, Backend, Datenbank). Jeder Container ist Selbstendig deploybar.
Component: Einzelne Aufgaben inerhalb eines Containers der eine spezielle aufgabe übernimt. Diese sind nicht selbstständig deploybar.
deployment: Ein Produktivsystem welches man auf dem gelichen weg erreicht wie der Endnutzer.


## Ist Analyse
Bisher Tauschen sich Studenten in gesprächen über die Machbarketeit von Modulen aus. Diese einschätzung ändern sich konstant und dauernd weshalb es schwer ist die einschätzungen zu einem generellen Meinungsbild zusammenzufassen. Bisher ändern sich Meinungen Täglich afgrund von neuen erfahrungen in den Vorlesungen. 

## 1) Anforderungen
- Was für ein Problem löst meine Anwendung?
    - Das genaue erheben von einschätzungen zu Fächern währen eines Semesters.
    - Speichern der einschätzungen über das Semester um Langzeitansichten zu erhalten.
- Für wen ist meine Anwendung?
    - Studenten der DHBW.
- Warum mache ich das Projekt
    - Sammeln von erfahrung im bereich des Softwareengineering. 
    - Ein Projekt welches man von grund auf entwickelt. 
    - Deployen von einem produkt was tatsächlich ein problem für mich löst.
    - Erlernen von Best Practice während des Entwicklungsprozesses.
    - Make ore Buy ist somit entschieden: Make für die erfahrung. 
    - Damit man Daten über die Vorlesungen über die vielen Semester sammeln kann. Es entsteht ein Moudl Logbuch.
- Als Anwender will ich .... Tuen um ... Ziele zu erreichen.
    1. Als Anwender will ich zur Machbarkeit aktuellen Modulen aus dem semester abstimmen um meine meinung einzubringen.
    2. Als Anwender will ich auf meinem Profiel alle Module nach Semester gruppiert sehn um eine übersicht über meine Module haben.
    3. Als Anwender will ich beim Klicken auf eine Abstimmung eine Detailansicht habe um mehr zu diesem modul zu sehne.
    4. Als Anwender will ich mein Vote über eine eingefärbten Buttons abgeben um zu sehne was meine aktuelle meinung zum Modul ist und ob ich bereits abgestimmt habe.
    5. Als Anwender will ich meinen Vote in einem Balkendiagramm sehen um eine schnelle übersicht über das Modul zu bekommen
    6. Als Anwender will ich eine Login Funktion haben um mich als Student für den entsprechenden Kurs anzumelden.
    7. Als Anwender will ich meinen Account wider löschen können aus privaten gründen.
    8. Als Anwender will ich die Webapp auch unterwegs mobil aufrufen um meine meinung über Module anzuschauen.

- Abuse Case und Evel user behavior: 
    - Als Evel user will ich die Abstimmung durch mehrfachabstimmung manipulieren um die Statistik zu zerstören.
    - Als Angreifer will ich Accounts sperren in dem ich passworte oft falsch eingebe um Nutzer zu sperren.
    - Als Angreifer will ich viele Accounts erstellen die als Datenleiche das System aufblähen um dei Datenbank zu füllen.
    - Als Angreifer will ich Versuchen über das abfangen der API den name eine Admin accounts zu erhalten um sein Passwort zu Brut Forcen.

## 2) Datenmodell
- Was sind meine Daten?
    - Auch wenn die Applikation nicht groß und komplex werden soll fallen dennoch notwendige unserdaten diverser entitäten an welche für die web app untereinander interagieren müssen. 
    - **Studenten:** username, Einzigartiger Identifyer (Username reicht aus sicherheitsgründen nicht, da man versuchen könnet den Account zu kancken wenn das System sagt: "Name bereits vergeben"), Passwort für ihren account, Uni und Kurs (nach DHBW vorbild).
    - **Abstimmungentität:** ein vote den ein Student zu einem Fach abgibt. Speichert den Abstimmungswerte, Zeitsetmpel. 
    - **Kommentar:** Text, Zeitsempel, userID, ModulID

- Wie werden diese Daten erhoben?
    - Studentendaten werden beim erstellen eines Accounts erhoben. 
    - Vote und kommentare entstehen durch die entsprechenden Schaltflächen auf der Oberfläche während der verwendung der Software.
- Wie werde ich die Daten anwenden / Abrufen
    - Abfragen aus der Datenbank um langzeitgraphen zu berechen bzw votes / kommentaren mit userid zu versetzen.
    - Speichern in einer zwischengeschalteten Cash Struktur möglich. Daten welche oft abgefragt aber nicht neu berechent werdne müsssen, z.b. kommentare sind so schnell ladbar.
- Wie interagieren die Daten untereinander?
    - für langzeitanzeigen werden die Votes einer über den Zeitraum abgefraget.
    - Kommentare zu passendem Modul speichern um sie in der Detailansicht zu laden.
    - Votes in den diagrammen werden von allen Usern angezeigt. Der User hat aber immer die Macht über seinen Vote.

## 3) MVP Idee
- Ist das Feature wirklich eine Kern Funktion?
Kernfunktionen: 
- User können über Module abstimmen.
- User können sich mit ihrer uni und kurs anmelden. 
- Speichern der Abgestimmten Werte in den Diagrammen auch wenn der user die webseite verlässt.
- Ein User kann eine Abstimmung pro Modul tätigen. 
- User können durch klicken auf ein Diagramm die Detailansicht zu deisem Kurs-Abstimmungs Diagramm sehen.

Folgende Features nach der Erstimplementierung / deployment :
- Kommentarfunktion.
- Langzeitgraphen der Votes eines Moduls. 
- Private Profieleinstellungen für user.
- Aufzählung der eigenen Module in der Mein Profiel ansicht.
- 

## 4) User Interaktion Design
--> Siehe Stitch Prototyp

## 5) Skala
- Sollen echte Nutzer auf die Anwendung?
    - ja 
- Wie viele Anwender sollen es werden?
    - Kurs intern: 25
    - Mehrere Kurse: 40
- Ist es ein Studien, Hobby, Portfolio Anwendung?
    - Hobbyarbeit die ein aktuelles problem löst. Die anwendung ist zum lernen gedacht.
- Verwende ich es in 1,6, 12 Monaten noch?
    - ja
    - hoffentlich bis ende des Studiums somit 1,5 Jahre als Zeithorizont. 
    - Nach der Erstimplemntierung (Technischer Durchstich) und dessen deplyment wird das system weiterentwickelt / gewartet. 

## 6) High Level Architektur
- welche generellen Komponenten hat die Anwendung (Frontend, Backend, DB, ....)?
    - Frontend
    - Backend
    - Cache
    - Datenbank Relational
    - API Frontend zu Backende
    - API Backend zu Datenbank / Cache
    - Kapselung der Container in eigenen Dockerfiles.
- Wie sieht die Kommunikation zwischen diesen Teilen aus?
    - API kommunikation unter den containern.
    - Die API anfragen werden über eine netzwerk an die korrekten Ports des anderen Containers geleitet.
    - Frontent Port ist für die User zugänglich (hinter reverse Proxy). Andere Ports werden Serverintern versteckt.
- Welche Tool sollen wie eingebunden werden.
    - 
- Welches sind die Kritischen Bestandteile meiner Architektur?
    - 
**Bis hier hin waren alle Überlegungen nicht Technisch**

## Sicherheit
- Welche Angriffsvektoren gib es nach Strive?
- Least Privilege: Hat jede Komponente wirklich nur die minimal notwendigen Rechte auf die Daten?
- Unvertrauenswürdigkeit: Wie behandelt das System Eingaben, die zwar syntaktisch korrekt, aber semantisch bösartig sind?

## Datenminimirung & Rollen vergabe
- Welche Daten müssen User von sich Preisgeben?
- Kann ich diese Daten Minimieren oder Pseudonymisieren?
- Sind diese Daten Personenbezogen und wie gehe ich damit um?
- Wie kann ich das "Recht auf Vergessenwerden" auf den Technischen Komponenten umsetzen?

- Welche Rollen gibt es?
- Wie werden deise Rollen an User vergeben und wie stellt man sicher, das die Rollenvergabe kein Sigle Point of Failiur wird?

## 7) Stack
- Welche Tools kann ich für welchen teil der Architektur verwenden: Frontend: Reakt, ...
- Wie arbeiten die einzelnen Tools zusammen?
- Welche bekannten Tools währen für die Aufgabe geeignet?
- Wie kann ich die Anwendung deployen? --> Deployment Path
Nach der Festlegung der, Anwendungsfälle, Funktionen, Skala, Navigation und der generellen Architektur, kann man nun die Tools für die Anforderungen aussuchen.

## 8) Einstieg in die Entwicklung
1. Anlegen der Ordnerstruktur
2. Festlegen von Entwicklungsmaximen: Sprache, Commit und Branch conventions, Kiss, Clean Code, ...
    - siehe @./DevelopingRules.md 
3. Aufsetzen der Datenstruktur. Dabei die in 6. bestimmten Kritischsten Elementen zuerst!
4. Aufsetzen eine User Story Backlock mit Kanban board zum Projektmanagement (Epics, User Storys, Tasks, Bug / Refactoring Report)

## 9) Iterative Weiterentwicklung
Ab der Implementierung des MVP und dessen Diplomiert können weiter Features hinzugefügt werden die in 4. gestrichen wurden.

### Test Driven Development Zyklos
1. 

----


I. Domäne & Semantik (Das Fundament)
Wahrheitsquelle: Welches Teilsystem hält die unanfechtbare Wahrheit über einen Datensatz (Single Source of Truth)?

Invariante: Welche Bedingung im System darf niemals (unter keinen Umständen) verletzt werden?

Grenzziehung: Wo endet die Verantwortung dieser Software und beginnt die Verantwortung eines externen Systems/Menschen?

II. Anforderungen & Qualität (ISO 25010 Fokus)
Degradierung: Wie sieht der "Graceful Degradation"-Plan aus? Welche Funktionen bleiben erhalten, wenn die Primärdatenquelle ausfällt?

Latenz-Budget: Was ist die maximal akzeptable Zeit zwischen einer Nutzeraktion und der sichtbaren Bestätigung?

Evolvierbarkeit: Wie aufwendig ist es, eine Kern-Entität im Datenmodell nach dem ersten produktiven Jahr zu ändern?

III. Sicherheit & Integrität (Security by Design)
Least Privilege: Hat jede Komponente wirklich nur die minimal notwendigen Rechte auf die Daten?

Unvertrauenswürdigkeit: Wie behandelt das System Eingaben, die zwar syntaktisch korrekt, aber semantisch bösartig sind?

Audit-Trail: Können wir im Schadensfall zweifelsfrei rekonstruieren, wer was wann warum geändert hat, ohne die Privatsphäre zu verletzen?


Shutterstock bild
Entdecken
IV. Architektur & Interaktion (Struktur)
Zustandslosigkeit: Kann jede Instanz meines Dienstes jede Anfrage bearbeiten, oder gibt es "sticky" Informationen, die eine Skalierung behindern?

Idempotenz: Was passiert, wenn eine Operation (z.B. ein Vote oder ein Kauf) aufgrund eines Netzwerkfehlers zweimal gesendet wird?

Vertragstreue: Sind die Schnittstellen (APIs) so definiert, dass Konsumenten bei einer internen Änderung nicht "brechen"?

V. Ökonomie & Strategie (Wirtschaftlichkeit)
Opportunitätskosten: Was bauen wir nicht, während wir an Feature X arbeiten?

Wartungshorizont: Wie hoch sind die geschätzten Kosten, um das System über die geplante Lebensdauer am Laufen zu halten (Total Cost of Ownership)?

Make-or-Buy: Existiert eine Open-Source-Komponente, die 80% des Problems löst, und rechtfertigen die restlichen 20% eine Eigenentwicklung?

VI. Operationalisierung & DevOps (Betrieb)
Observability: Wie unterscheiden wir zwischen "System ist langsam" und "System ist fehlerhaft", bevor ein Nutzer anruft?

Rollback-Strategie: Wie machen wir eine fehlerhafte Datenbank-Migration im laufenden Betrieb rückgängig?

Reproduzierbarkeit: Ist die Entwicklungsumgebung identisch zur Produktionsumgebung (Parity)?

VII. Mensch & Prozess (UX & Team)
Fehler-Affordanz: Verhindert das UI-Design durch seine Struktur bereits, dass Nutzer falsche Eingaben machen?

Wissensmonopole: Was passiert mit dem Projekt, wenn der Hauptentwickler morgen kündigt (Bus-Faktor)?

Feedback-Zyklus: Wie schnell fließt die Erkenntnis aus einer echten Nutzerinteraktion zurück in die Anforderungsliste?