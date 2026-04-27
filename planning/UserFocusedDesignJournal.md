Software sollte Probleme lösen, intuitiv und leicht für den Anwender zu verstehen sein und dabei die Triade der Softwareentwicklung hochhalten: Modularität, Testbarkeit/Dokumentation und Skalierbarkeit.
Die folgenden Schritte sind ein Dialog des Entwicklers mit der Software.
Ziele des Dokuments sind:
- Nutzerzentrierte Entwicklung
- Fokus auf MVP und Kernfunktionen
- Festlegen der Grundzüge und Abwägung der Technologien
- Eingrenzen des Scopes: Was will ich, was will ich nicht?
- Iterative Entwicklung auf Grundlage eines MVP
Für die einzelnen Entwicklungsschritte stellt man sich Fragen, um seine Ziele und Strategie dorthin genauer kennenzulernen. Es geht um einen inneren Dialog mit dem Produkt.

## Begriffsbuch
User: Ein Student, der die Web-App verwendet.
Vote: Eine Abstimmung, die ein Student zu einem Modul gibt.
Kurs: Jahrgangskurs, in dem der Student ist.
Modul: Ein Modul, welches in einzelnen Vorlesungen vorgestellt wird. Beide Begriffe meinen die gleiche Entität.
System: Die gesamte Anwendung als laufendes Produktivsystem.
Container: Einzelner Teil des Systems, welcher einen Aufgabenbereich übernimmt (Frontend, Backend, Datenbank). Jeder Container ist selbstständig deploybar.
Component: Einzelne Aufgaben innerhalb eines Containers, die eine spezielle Aufgabe übernimmt. Diese sind nicht selbstständig deploybar.
Deployment: Ein Produktivsystem, welches man auf dem gleichen Weg erreicht wie der Endnutzer.


## Ist-Analyse
Bisher tauschen sich Studenten in Gesprächen über die Machbarkeit von Modulen aus. Diese Einschätzungen ändern sich konstant und dauernd, weshalb es schwer ist, die Einschätzungen zu einem generellen Meinungsbild zusammenzufassen. Bisher ändern sich Meinungen täglich aufgrund von neuen Erfahrungen in den Vorlesungen. 

## 1) Anforderungen
- Was für ein Problem löst meine Anwendung?
    - Das genaue Erheben von Einschätzungen zu Fächern während eines Semesters.
    - Speichern der Einschätzungen über das Semester, um Langzeitansichten zu erhalten.
- Für wen ist meine Anwendung?
    - Studenten der DHBW.
- Warum mache ich das Projekt?
    - Sammeln von Erfahrung im Bereich des Softwareengineering. 
    - Ein Projekt, welches man von Grund auf entwickelt. 
    - Deployen von einem Produkt, was tatsächlich ein Problem für mich löst.
    - Erlernen von Best Practice während des Entwicklungsprozesses.
    - Make or Buy ist somit entschieden: Make für die Erfahrung. 
    - Damit man Daten über die Vorlesungen über die vielen Semester sammeln kann. Es entsteht ein Modul-Logbuch.
- Als Anwender will ich ... tun, um ... Ziele zu erreichen.
    1. Als Anwender will ich zur Machbarkeit aktueller Module aus dem Semester abstimmen, um meine Meinung einzubringen.
    2. Als Anwender will ich auf meinem Profil alle Module nach Semester gruppiert sehen, um eine Übersicht über meine Module zu haben.
    3. Als Anwender will ich beim Klicken auf eine Abstimmung eine Detailansicht haben, um mehr zu diesem Modul zu sehen.
    4. Als Anwender will ich mein Vote über einen eingefärbten Button abgeben, um zu sehen, was meine aktuelle Meinung zum Modul ist und ob ich bereits abgestimmt habe.
    5. Als Anwender will ich meinen Vote in einem Balkendiagramm sehen, um eine schnelle Übersicht über das Modul zu bekommen.
    6. Als Anwender will ich eine Login-Funktion haben, um mich als Student für den entsprechenden Kurs anzumelden.
    7. Als Anwender will ich meinen Account wieder löschen können aus privaten Gründen.
    8. Als Anwender will ich die Web-App auch unterwegs mobil aufrufen, um meine Meinung über Module anzuschauen.

- Abuse Case und Evil User Behavior: 
    - Als Evil User will ich die Abstimmung durch Mehrfachabstimmung manipulieren, um die Statistik zu zerstören.
    - Als Angreifer will ich Accounts sperren, indem ich Passwörter oft falsch eingebe, um Nutzer zu sperren.
    - Als Angreifer will ich viele Accounts erstellen, die als Datenleiche das System aufblähen, um die Datenbank zu füllen.
    - Als Angreifer will ich versuchen, über das Abfangen der API den Namen eines Admin-Accounts zu erhalten, um sein Passwort zu bruteforcen.

## 2) Datenmodell
- Was sind meine Daten?
    - Auch wenn die Applikation nicht groß und komplex werden soll, fallen dennoch notwendige Nutzerdaten diverser Entitäten an, welche für die Web-App untereinander interagieren müssen. 
    - **Studenten:** Username, einzigartiger Identifier (Username reicht aus Sicherheitsgründen nicht, da man versuchen könnte, den Account zu knacken, wenn das System sagt: "Name bereits vergeben"), Passwort für ihren Account, Uni und Kurs (nach DHBW Vorbild).
    - **Abstimmungsentität:** Ein Vote, den ein Student zu einem Fach abgibt. Speichert den Abstimmungswert, Zeitstempel. 
    - **Kommentar:** Text, Zeitstempel, UserID, ModulID

- Wie werden diese Daten erhoben?
    - Studentendaten werden beim Erstellen eines Accounts erhoben. 
    - Vote und Kommentare entstehen durch die entsprechenden Schaltflächen auf der Oberfläche während der Verwendung der Software.
- Wie werde ich die Daten anwenden / abrufen?
    - Abfragen aus der Datenbank, um Langzeitgraphen zu berechnen bzw. Votes / Kommentare mit UserID zu versetzen.
    - Speichern in einer zwischengeschalteten Cache-Struktur möglich. Daten, welche oft abgefragt, aber nicht neu berechnet werden müssen, z. B. Kommentare, sind so schnell ladbar.
- Wie interagieren die Daten untereinander?
    - Für Langzeitanzeigen werden die Votes über den Zeitraum abgefragt.
    - Kommentare zum passenden Modul speichern, um sie in der Detailansicht zu laden.
    - Votes in den Diagrammen werden von allen Usern angezeigt. Der User hat aber immer die Macht über seinen Vote.

## 3) MVP Idee
- Ist das Feature wirklich eine Kernfunktion?
Kernfunktionen: 
- User können über Module abstimmen.
- User können sich mit ihrer Uni und ihrem Kurs anmelden. 
- Speichern der abgestimmten Werte in den Diagrammen, auch wenn der User die Webseite verlässt.
- Ein User kann eine Abstimmung pro Modul tätigen. 
- User können durch Klicken auf ein Diagramm die Detailansicht zu diesem Kurs-Abstimmungs-Diagramm sehen.

Folgende Features nach der Erstimplementierung / Deployment:
- Kommentarfunktion.
- Langzeitgraphen der Votes eines Moduls. 
- Private Profileinstellungen für User.
- Aufzählung der eigenen Module in der "Mein Profil"-Ansicht.
- 

## 4) User Interaktion Design
--> Siehe Stitch-Prototyp

## 5) Skala
- Sollen echte Nutzer auf die Anwendung?
    - Ja.
- Wie viele Anwender sollen es werden?
    - Kursintern: 25
    - Mehrere Kurse: 40
- Ist es eine Studien-, Hobby-, Portfolio-Anwendung?
    - Hobbyarbeit, die ein aktuelles Problem löst. Die Anwendung ist zum Lernen gedacht.
- Verwende ich es in 1, 6, 12 Monaten noch?
    - Ja.
    - Hoffentlich bis Ende des Studiums, somit 1,5 Jahre als Zeithorizont. 
    - Nach der Erstimplementierung (Technischer Durchstich) und dessen Deployment wird das System weiterentwickelt / gewartet. 

## 6) High Level Architektur
- Welche generellen Container hat das System (Frontend, Backend, DB, ...)? (Am besten in einem C4-Modell)
    - Frontend
    - Backend
    - Datenbank relational
    - Kapselung der Container in eigenen Dockerfiles.
- Wie sieht die Kommunikation zwischen diesen Teilen aus (Wer muss mit wem verbunden werden)?
    - Frontend - Backend
    - Backend - Datenbank
- Welches sind die kritischen Bestandteile meiner Architektur, ohne die die Applikation gar nicht läuft?
    - Datenbank: Da sie alle Votes speichert.
    - Backend: Da es die User handelt und ihre Anfragen verarbeitet.
    - Kommunikation zwischen Datenbank und Backend.

**Bis hierhin waren alle Überlegungen nicht technisch.**

## Sicherheit
- Welche Angriffsvektoren gibt es nach STRIDE?
    - Siehe Notiz.
- Least Privilege: Hat jede Komponente wirklich nur die minimal notwendigen Rechte auf die Daten?
    - Ja. Jeder User kann Votes abgeben und hat sonst keinen weiteren Zugriff auf kursübergreifende Aktionen.
- Unvertrauenswürdigkeit: Wie behandelt das System Eingaben, die zwar syntaktisch korrekt, aber semantisch bösartig sind?
    - Keine reine Übernahme von Eingaben in Datenbank-Abfragen (Sanitizer).
    - Keine KI-Einbindung in der Software. Somit auch keine Vorkehrung zu Prompt Injection und Jailbreaking.

## Datenminimierung & Rollenvergabe
- Welche Daten müssen User von sich preisgeben?
    - Username
- Kann ich diese Daten minimieren oder pseudonymisieren?
    - Für den Login keine E-Mail als Identifier nötig. Username kann ein Pseudonym sein.
- Sind diese Daten personenbezogen und wie gehe ich damit um?
    - Durch Nutzerverhalten kann man trotz Pseudonym eine Person ausfindig machen.
    - Verwendung von Echtnamen ist außerhalb der Kontrolle. Per Default wird dieser aber auch nicht erfragt / erzwungen.
- Wie kann ich das "Recht auf Vergessenwerden" auf den technischen Komponenten umsetzen?
    - Eine spezielle Backend-Funktion, welche die Daten aus der Datenbank löscht.
    - Löschkaskadierung in der Datenbank.
    - Updaten der Diagrammen.
    - Wird getriggert, wenn man auf "Account löschen" klickt.

- Welche Rollen gibt es?
    - User
    - Admin
- Wie werden diese Rollen an User vergeben?
    - Default Deny. User haben beim Erstellen eines Accounts keine Rechte, außer Votes abzugeben.
    - Admin rollen werden fest in docker env vergeben nicht beantragt.
- Wie werden User Identifiziert?
    - Besitz-basiert statt Identitäts-basiert. Ein Einmal-Token (Voucher) beweist die Zugehörigkeit zum Kurs, ohne die Person zu benennen.
- Wie werden User Authentifiziert?
    - Passwort
-  Wie stellt man sicher, dass die Rollenvergabe kein Single Point of Failure wird?
    - Durch die feste vergabe können verschiedene personen auf die Rolle zugreifen. 
    Bei einem solchen Kleinen system ist der Angriffsvektor über die Harte vergabe in kauf zu nehmen, da ein Vier-Augen-Prinzip überkompliziert ist.
(Besitz-basiert statt Identitäts-basiert. Ein Einmal-Token (Voucher) beweist die Zugehörigkeit zum Kurs, ohne die Person zu benennen.)

## 7) Stack
- Welche Tools kann ich für die einzelnen Container der Architektur verwenden (kurz begründet)?
    - Frontend: JavaScript mit React, da die Abstimmungen interaktiv sind und einzelne wiederverwendbare Kacheln werden sollen.
    - Backend: ?
    - DB: PostgreSQL, da es Bezug zur Datenbankvorlesung hat.
- Wie arbeiten die einzelnen Tools zusammen (Technisch konkrete Kommunikation)?
    - API-Kommunikation unter den Containern.
    - Die API-Anfragen werden über ein Netzwerk an die korrekten Ports des anderen Containers geleitet.
    - Frontend-Port ist für die User zugänglich (hinter Reverse-Proxy). Andere Ports werden serverintern versteckt.
- Wie kann ich die Anwendung deployen? --> Deployment Path
    - Main-Branch ist über GitHub Actions (bei Merge oder Push) mit einem Runner auf dem Produktionssystem verbunden, welcher das System-Image neu baut, hochfährt, das alte Image ersetzt und löscht. 
    - Voller CI/CD-Testaufruf mit anschließendem automatischem Deployment. Voraussetzung: Tests laufen durch.
Nach der Festlegung der Anwendungsfälle, Funktionen, Skala, Navigation und der generellen Architektur kann man nun die Tools für die Anforderungen aussuchen.

## 8) Einstieg in die Entwicklung
1. Anlegen der Ordnerstruktur
2. Festlegen von Entwicklungsmaximen: Sprache, Commit- und Branch-Conventions, KISS, Clean Code, ...
    - Siehe @./DevelopingRules.md 
3. Aufsetzen der Datenstruktur. Dabei die in 6. bestimmten kritischsten Elemente zuerst!
4. Aufsetzen eines User Story Backlogs mit Kanban-Board zum Projektmanagement (Epics, User Stories, Tasks, Bug / Refactoring Report)

## 9) Iterative Weiterentwicklung
Ab der Implementierung des MVP und dessen Deployment können weitere Features hinzugefügt werden, die in 4. gestrichen wurden.

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


Shutterstock Bild
Entdecken
IV. Architektur & Interaktion (Struktur)
Zustandslosigkeit: Kann jede Instanz meines Dienstes jede Anfrage bearbeiten, oder gibt es "sticky" Informationen, die eine Skalierung behindern?

Idempotenz: Was passiert, wenn eine Operation (z. B. ein Vote oder ein Kauf) aufgrund eines Netzwerkfehlers zweimal gesendet wird?

Vertragstreue: Sind die Schnittstellen (APIs) so definiert, dass Konsumenten bei einer internen Änderung nicht "brechen"?

V. Ökonomie & Strategie (Wirtschaftlichkeit)
Opportunitätskosten: Was bauen wir nicht, während wir an Feature X arbeiten?

Wartungshorizont: Wie hoch sind die geschätzten Kosten, um das System über die geplante Lebensdauer am Laufen zu halten (Total Cost of Ownership)?

Make-or-Buy: Existiert eine Open-Source-Komponente, die 80 % des Problems löst, und rechtfertigen die restlichen 20 % eine Eigenentwicklung?

VI. Operationalisierung & DevOps (Betrieb)
Observability: Wie unterscheiden wir zwischen "System ist langsam" und "System ist fehlerhaft", bevor ein Nutzer anruft?

Rollback-Strategie: Wie machen wir eine fehlerhafte Datenbank-Migration im laufenden Betrieb rückgängig?

Reproduzierbarkeit: Ist die Entwicklungsumgebung identisch zur Produktionsumgebung (Parity)?

VII. Mensch & Prozess (UX & Team)
Fehler-Affordanz: Verhindert das UI-Design durch seine Struktur bereits, dass Nutzer falsche Eingaben machen?

Wissensmonopole: Was passiert mit dem Projekt, wenn der Hauptentwickler morgen kündigt (Bus-Faktor)?

Feedback-Zyklus: Wie schnell fließt die Erkenntnis aus einer echten Nutzerinteraktion zurück in die Anforderungsliste?
