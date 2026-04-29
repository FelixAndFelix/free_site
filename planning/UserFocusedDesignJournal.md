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

- User: Ein Student, der die Web-App verwendet.
- Vote: Eine Abstimmung, die ein Student zu einem Modul gibt.
- Kurs: Jahrgangskurs, in dem der Student ist.
- Modul: Ein Modul, welches in einzelnen Vorlesungen vorgestellt wird. Beide Begriffe meinen die gleiche Entität.
- Magic Link: Ein per E-Mail versendeter Link mit einem kryptografisch signierten Token zur Authentifizierung.
- JWT (JSON Web Token): Ein zustandsloser Token, der lokal im Browser gespeichert wird und die Berechtigung zum Abstimmen nachweist.
- Hash_ID: Ein im Backend deterministisch erzeugter Wert (`HMAC-SHA256`), der einen Vote eindeutig einer Person zuordnet, ohne deren Identität preiszugeben.
- System: Die gesamte Anwendung als laufendes Produktivsystem.
- Container: Einzelner Teil des Systems, welcher einen Aufgabenbereich übernimmt (Frontend, Backend, Datenbank). Jeder Container ist selbstständig deploybar.
- Component: Einzelne Aufgaben innerhalb eines Containers, die eine spezielle Aufgabe übernimmt. Diese sind nicht selbstständig deploybar.
- Deployment: Ein Produktivsystem, welches man auf dem gleichen Weg erreicht wie der Endnutzer.

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
  1. Als Anwender will ich meine DHBW-Mail eingeben, um einen Magic Link zur Identifikation zu erhalten.
  2. Als Anwender will ich zur Machbarkeit aktueller Module aus dem Semester abstimmen, um meine Meinung einzubringen.
  3. Als Anwender will ich auf einer Übersicht alle Module nach Semester gruppiert sehen, um eine Übersicht über meine Module zu haben.
  4. Als Anwender will ich beim Klicken auf eine Abstimmung eine Detailansicht haben, um mehr zu diesem Modul zu sehen.
  5. Als Anwender will ich mein Vote über einen eingefärbten Button abgeben, um zu sehen, was meine aktuelle Meinung zum Modul ist und ob ich bereits abgestimmt habe.
  6. Als Anwender will ich meine Stimme jederzeit ändern können, um auf neue Erfahrungen im Modul zu reagieren.
  7. Als Anwender will ich meinen Vote in einem Balkendiagramm sehen, um eine schnelle Übersicht über das Modul zu bekommen.
  8. Als Anwender will ich die Web-App auch unterwegs mobil aufrufen, um meine Meinung über Module anzuschauen.
  9. Als Admin will ich Module für Kurse erstellen um zu verhindern, dass jeder eine Abstimmung erstellt.
  10. Als Admin will ich über eine fest hinterlegte E-Mail-Adresse Admin-Rechte erhalten.
   

- Abuse Case und Evil User Behavior:
  1. Als Evil User will ich die Abstimmung durch Mehrfachabstimmung manipulieren. -> *Verhindert durch Hash_ID pro E-Mail/Modul.*
  2. Als Angreifer will ich den E-Mail-Service als Spam-Schleuder missbrauchen. -> *Verhindert durch Cloudflare Spam Protection & Rate Limiting.*
  3. Als Angreifer will ich gefälschte Abstimmungs-Requests senden. -> *Verhindert durch kryptografische JWT-Signaturprüfung.*
  4. Als Angreifer will ich versuchen, über das Abfangen der API den Namen eines Admin-Accounts zu erhalten, um sein Passwort zu bruteforcen. -> *Entfällt durch passwortlose Magic Links.*

## 2) Datenmodell

- Was sind meine Daten?
  - **Votes:** `hash_id` (PK), `kurs_id`, `modul_id`, `vote_value`, `zeitstempel`. Speichert die anonymisierte Abstimmungsentscheidung.
  - **Kommentar:** `text`, `zeitstempel`, `modul_id`, `hash_id`.
  - *Hinweis:* Es werden keine Tabellen für "Studenten" mit Passwörtern oder Klarnamen geführt. Die Identität existiert nur transient im Backend während der Hash-Generierung.

- Wie werden diese Daten erhoben?
  - E-Mail-Adresse wird transient zur Erzeugung des JWT und der `hash_id` genutzt.
  - Vote und Kommentare entstehen durch die entsprechenden Schaltflächen auf der Oberfläche.
- Wie werde ich die Daten anwenden / abrufen?
  - Das Backend berechnet die `hash_id` aus dem signierten JWT und führt ein `UPSERT` in der Datenbank aus, um bestehende Stimmen zu aktualisieren.
- Wie interagieren die Daten untereinander?
  - Aggregation der Votes pro Modul für die Diagrammanzeige.
  - Kommentare werden dem entsprechenden Modul zugeordnet.

## 3) MVP Idee

- Ist das Feature wirklich eine Kernfunktion?
  Kernfunktionen:
- User können über Module abstimmen.
- Identifikation über DHBW-Mail und Magic Link (passwortlos).
- Speichern der abgestimmten Werte über eine deterministische `hash_id`.
- Ein User kann eine Abstimmung pro Modul tätigen (und überschreiben).
- Diagramm-Ansicht der aggregierten Votes.

Folgende Features nach der Erstimplementierung / Deployment:

- Kommentarfunktion.
- Langzeitgraphen der Votes eines Moduls.
- Private Profileinstellungen für User.
- Aufzählung der eigenen Module in der "Mein Profil"-Ansicht.

## 4) User Interaktion Design
- Welche Screens werden benötigt?
  1. Login Screen (Eingabe der DHBW-Mail).
  2. Main Screen mit Übersicht über alle Kacheln.
  3. Detailansicht eines Kurses mit Langzeitgraph und Kommentaren.
  4. Minimalistischer Info-Screen (Datenschutzhinweise).

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
  - Frontend (React)
  - Backend (Node.js/Express)
  - Datenbank (PostgreSQL)
  - Edge/Proxy (Cloudflare)
- Wie sieht die Kommunikation zwischen diesen Teilen aus (Wer muss mit wem verbunden werden)?
  - Frontend -> Cloudflare -> Backend
  - Backend -> Datenbank
- Welches sind die kritischen Bestandteile meiner Architektur, ohne die die Applikation gar nicht läuft?
  - Datenbank: Da sie alle Votes speichert.
  - Backend: Validierung der JWTs und Hashing.
  - Mail-Provider: Versand der Magic Links.

**Bis hierhin waren alle Überlegungen nicht technisch.**

## Sicherheit

- Welche Angriffsvektoren gibt es nach STRIDE?
  - Siehe Notiz.
- Least Privilege: Hat jede Komponente wirklich nur die minimal notwendigen Rechte auf die Daten?
  - Ja.
- Cloudflare Protection: Schutz des Magic-Link-Endpunkts vor Spam-Bots und DDoS-Angriffen.
- Unvertrauenswürdigkeit: Wie behandelt das System Eingaben, die zwar syntaktisch korrekt, aber semantisch bösartig sind?
  - JWT-Signaturprüfung (H-MAC) verhindert gefälschte Identitäten.
  - Sanitizer für Datenbank-Abfragen.

## Datenminimierung & Rollenvergabe

- Welche Daten müssen User von sich preisgeben?
  - DHBW E-Mail (wird nur transient verarbeitet).
- Kann ich diese Daten minimieren oder pseudonymisieren?
  - Ja, durch deterministisches Hashing: `HMAC-SHA256(Email + ModulID, Server_Pepper)`.
- Sind diese Daten personenbezogen und wie gehe ich damit um?
  - Die Votes sind technisch gesehen pseudonymisiert. Es werden keine Klarnamen oder Passwörter gespeichert.
- Wie kann ich das "Recht auf Vergessenwerden" auf den technischen Komponenten umsetzen?
  - Da keine Profile existieren, gibt es keine "Account-Löschung". User können ihre Stimmen manuell neutralisieren oder durch Leeren des LocalStorages den Bezug zu ihrer `hash_id` aufgeben.

- Welche Rollen gibt es?
  - User
  - Admin
- Wie werden diese Rollen an User vergeben?
  - User: Automatisch durch Besitz eines DHBW-Postfachs.
  - Admin: Identifikation über eine im Backend fest hinterlegte Liste erlaubter Admin-E-Mail-Adressen.
- Wie werden User Identifiziert?
  - Besitz-basiert: Wer Zugriff auf die DHBW-Mail hat, darf abstimmen.
- Wie werden User Authentifiziert?
  - Kryptografisch signierter JWT (Magic Link).
- Wie stellt man sicher, dass die Rollenvergabe kein Single Point of Failure wird? - Durch die feste Vergabe (Environment-Variablen) können verschiedene Personen auf die Rolle zugreifen.
  Bei einem solchen kleinen System ist der Angriffsvektor über die harte Vergabe in Kauf zu nehmen, da ein Vier-Augen-Prinzip überkompliziert ist.

## 7) Stack

- Welche Tools kann ich für die einzelnen Container der Architektur verwenden (kurz begründet)?
  - Frontend: JavaScript mit React, da die Abstimmungen interaktiv sind und einzelne wiederverwendbare Kacheln werden sollen.
  - Backend: ?
  - DB: PostgreSQL, da es Bezug zur Datenbankvorlesung hat.
- Wie arbeiten die einzelnen Tools zusammen (Technisch konkrete Kommunikation)?
  - API-Kommunikation unter den Containern.
  - Die API-Anfragen werden über ein Netzwerk an die korrekten Ports des anderen Containers geleitet.
  - Frontend-Port ist für die User zugänglich (hinter Reverse-Proxy). Andere Ports werden serverintern versteckt.
- Wie kann ich die Anwendung deployen? --> Deployment Path - Main-Branch ist über GitHub Actions (bei Merge oder Push) mit einem Runner auf dem Produktionssystem verbunden, welcher das System-Image neu baut, hochfährt, das alte Image ersetzt und löscht. - Voller CI/CD-Testaufruf mit anschließendem automatischem Deployment. Voraussetzung: Tests laufen durch.
  Nach der Festlegung der Anwendungsfälle, Funktionen, Skala, Navigation und der generellen Architektur kann man nun die Tools für die Anforderungen aussuchen.

## 8) Einstieg in die Entwicklung

1. Anlegen der Ordnerstruktur
2. Festlegen von Entwicklungsmaximen: Sprache, Commit- und Branch-Conventions, KISS, Clean Code, ...
   - Siehe [DevelopingRules.md](./DevelopingRules.md)
3. Aufsetzen der Datenstruktur. Dabei die in 6. bestimmten kritischsten Elemente zuerst!
4. Aufsetzen eines User Story Backlogs mit Kanban-Board zum Projektmanagement (Epics, User Stories, Tasks, Bug / Refactoring Report)

## 9) Iterative Weiterentwicklung

Ab der Implementierung des MVP und dessen Deployment können weitere Features hinzugefügt werden, die in 4. gestrichen wurden.