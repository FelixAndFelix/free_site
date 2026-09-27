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
- Username: Öffentlicher Name eines Users (3–20 Zeichen), der in der App statt der E-Mail angezeigt wird.
- Vote: Eine Abstimmung, die ein Student zu einem Modul gibt.
- Kurs: Jahrgangskurs, in dem der Student ist.
- Modul: Ein Modul, welches in einzelnen Vorlesungen vorgestellt wird. Beide Begriffe meinen die gleiche Entität.
- E-Mail-Code: Ein 6-stelliger, einmaliger Code, der an die DHBW-Mail gesendet wird (Registrierung und Passwort-Reset).
- Passkey: Optionales WebAuthn-Schlüsselpaar auf dem Gerät des Users. Der Public Key liegt im Backend, der User bestätigt per Biometrie oder Geräte-PIN.
- Kurs-Code: Ein Beitrittscode eines Kurses (z.B. `WS24-123`), der zur Registrierung berechtigt.
- Session: Serverseitig in PostgreSQL gespeichert, im Browser nur als opake ID in einem `HttpOnly`-Cookie.
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
  1. Als Anwender will ich mich mit meiner DHBW-Mail, einem Username und dem Kurs-Code registrieren, die Mail per Code bestätigen und ein Passwort setzen, um abstimmen zu können.
  1c. Als Anwender will ich in der App unter meinem Username statt meiner E-Mail erscheinen, damit meine E-Mail nicht überall angezeigt wird.
  1a. Als Anwender will ich mich mit E-Mail und Passwort oder optional per Passkey einloggen.
  1b. Als Anwender will ich mein Passwort per E-Mail-Code zurücksetzen können, um bei Vergessen nicht meinen Zugang zu verlieren.
  2. Als Anwender will ich zur Machbarkeit aktueller Module aus dem Semester abstimmen, um meine Meinung einzubringen.
  3. Als Anwender will ich auf einer Übersicht alle Module nach Semester gruppiert sehen, um eine Übersicht über meine Module zu haben.
  4. Als Anwender will ich beim Klicken auf eine Abstimmung eine Detailansicht haben, um mehr zu diesem Modul zu sehen.
  5. Als Anwender will ich mein Vote über einen eingefärbten Button abgeben, um zu sehen, was meine aktuelle Meinung zum Modul ist und ob ich bereits abgestimmt habe.
  6. Als Anwender will ich meine Stimme jederzeit ändern können, um auf neue Erfahrungen im Modul zu reagieren.
  7. Als Anwender will ich meinen Vote in einem Balkendiagramm sehen, um eine schnelle Übersicht über das Modul zu bekommen.
  8. Als Anwender will ich die Web-App auch unterwegs mobil aufrufen, um meine Meinung über Module anzuschauen.
  9. Als Admin will ich Module für Kurse erstellen um zu verhindern, dass jeder eine Abstimmung erstellt.
  10. Als Admin will ich über einen geheimen Setup-Code (Umgebungsvariable) bei der Registrierung Admin-Rechte erhalten.
  11. Als Anwender will ich optional Passkeys für meine Geräte hinterlegen, um mich schneller einzuloggen.
   

- Abuse Case und Evil User Behavior:
  1. Als Evil User will ich die Abstimmung durch Mehrfachabstimmung manipulieren. -> *Verhindert durch Primärschlüssel `(user_id, module_id)`. Mehrere Accounts sind nur mit einem gültigen Kurs-Code möglich.*
  2. Als Angreifer will ich Kurs-Codes oder den Admin-Setup-Code per Brute-Force erraten. -> *Verhindert durch striktes Rate Limiting des Registrierungs-Endpunkts (z.B. 5 Versuche pro IP/Stunde), lange zufällige Codes und Cloudflare.*
  3. Als Angreifer will ich gefälschte Abstimmungs-Requests senden. -> *Verhindert durch serverseitig geprüfte Session und WebAuthn-Signaturprüfung beim Passkey-Login.*
  4. Als Angreifer will ich Passwörter bruteforcen. -> *Erschwert durch Argon2id, Login-Rate-Limit (5 Fehlversuche pro E-Mail, danach wachsende Verzögerung bis 15 Minuten, keine dauerhafte Sperre) und Cloudflare.*
  5. Als Angreifer will ich eine Session per XSS stehlen. -> *Erschwert durch `HttpOnly`-Cookie, das nicht per JavaScript lesbar ist.*
  6. Als Angreifer will ich den Mail-Versand als Spam-Schleuder missbrauchen. -> *Verhindert durch Domain-Allowlist (vor dem Versand geprüft), Rate Limits pro IP und pro Adresse (1 Code pro 60 Sekunden) und Cloudflare.*
  7. Als Angreifer will ich per Login oder Reset herausfinden, wer registriert ist. -> *Verhindert durch identische generische Antworten unabhängig davon, ob die E-Mail existiert.*
  8. Als Angreifer will ich den E-Mail-Code erraten. -> *Verhindert durch 6 Stellen aus einem CSPRNG, 10 Minuten Gültigkeit, Einmalnutzung und Invalidierung nach 5 Fehlversuchen.*

## 2) Datenmodell

- Was sind meine Daten?
  - **users:** `id` (UUID), `email` (unique, lowercase), `username` (eindeutig ohne Groß-/Kleinschreibung, wird statt der E-Mail angezeigt), `password_hash` (Argon2id), `role` (`user`/`admin`), `created_at`.
  - **email_codes:** `email`, `purpose` (`register`/`reset`), `code_hash`, `expires_at`, `attempts`, `created_at`.
  - **passkey_credentials (optional):** `credential_id`, `public_key`, `user_id`, `sign_count`, `transports`.
  - **courses:** `id`, `name`, `join_code`. **course_members:** `course_id`, `user_id`.
  - **modules:** `id`, `course_id`, `name`, `semester`.
  - **sessions:** `id`, `user_id`, `expires_at`.
  - **votes:** `user_id`, `module_id`, `vote_value` (`free`/`possible`/`impossible`), `updated_at`. PK `(user_id, module_id)`.
  - **Kommentar (nach MVP):** `text`, `zeitstempel`, `module_id`, `user_id`.
  - *Hinweis:* Die E-Mail wird im Klartext gespeichert, weil das System Mails senden können muss. Votes hängen an der `user_id` und sind damit für den Betreiber mit DB-Zugriff einer E-Mail zuordenbar. Das muss im Datenschutz-Screen offen stehen. Passwörter werden nur als Argon2id-Hash gespeichert.

- Wie werden diese Daten erhoben?
  - E-Mail, Kurs-Code und Passwort bei der Registrierung, der optionale Passkey wird auf dem Gerät des Users erzeugt.
  - Vote und Kommentare entstehen durch die entsprechenden Schaltflächen auf der Oberfläche.
- Wie werde ich die Daten anwenden / abrufen?
  - Das Backend liest die `user_id` aus der Session und führt ein `UPSERT` in der Datenbank aus, um bestehende Stimmen zu aktualisieren.
- Wie interagieren die Daten untereinander?
  - Aggregation der Votes pro Modul für die Diagrammanzeige.
  - Kommentare werden dem entsprechenden Modul zugeordnet.

## 3) MVP Idee

- Ist das Feature wirklich eine Kernfunktion?
  Kernfunktionen:
- User können über Module abstimmen.
- Registrierung über DHBW-Mail (Domain-Allowlist), E-Mail-Code, Kurs-Code und Passwort. Login mit Passwort, Passwort-Reset per E-Mail-Code. Passkeys sind optional und kommen als letzter Schritt.
- Speichern der abgestimmten Werte pro `user_id` und Modul.
- Ein User kann eine Abstimmung pro Modul tätigen (und überschreiben).
- Diagramm-Ansicht der aggregierten Votes.

Folgende Features nach der Erstimplementierung / Deployment:

- Kommentarfunktion.
- Langzeitgraphen der Votes eines Moduls.
- Private Profileinstellungen für User.
- Aufzählung der eigenen Module in der "Mein Profil"-Ansicht.

## 4) User Interaktion Design
- Welche Screens werden benötigt?
  1. Login-, Registrierungs- und Passwort-Reset-Screens (E-Mail, Kurs-Code, E-Mail-Code, Passwort).
  2. Main Screen mit Übersicht über alle Kacheln.
  3. Detailansicht eines Kurses mit Langzeitgraph und Kommentaren.
  4. Minimalistischer Info-Screen (Datenschutzhinweise).

--> Die Screens werden neu entworfen, der alte Stitch-Prototyp wird verworfen.

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
  - Datenbank: Da sie alle Votes, Nutzer und Sessions speichert.
  - Backend: Passwort-Verifikation und Session-Prüfung.
  - Mail-Provider: Versand der E-Mail-Codes (Registrierung und Reset).
  - Cloudflare Tunnel: Einziger Zugang von außen zum Homeserver.

**Bis hierhin waren alle Überlegungen nicht technisch.**

## Sicherheit

- Welche Angriffsvektoren gibt es nach STRIDE?
  - Siehe Notiz.
- Least Privilege: Hat jede Komponente wirklich nur die minimal notwendigen Rechte auf die Daten?
  - Ja.
- Cloudflare Protection: Schutz des Registrierungs-Endpunkts vor Bots und DDoS-Angriffen.
- Unvertrauenswürdigkeit: Wie behandelt das System Eingaben, die zwar syntaktisch korrekt, aber semantisch bösartig sind?
  - Serverseitig geprüfte Sessions und Argon2id-Passwortprüfung verhindern gefälschte Identitäten. Passkeys nutzen WebAuthn-Signaturprüfung.
  - Die E-Mail-Domain wird gegen `ALLOWED_EMAIL_DOMAINS` (exakter Match) geprüft, bevor eine Mail versendet wird.
  - Parametrisierte Datenbank-Abfragen über Drizzle ORM.

## Datenminimierung & Rollenvergabe

- Welche Daten müssen User von sich preisgeben?
  - DHBW-E-Mail, Username, Kurs-Code und ein Passwort.
- Kann ich diese Daten minimieren oder pseudonymisieren?
  - Nur eingeschränkt: Die E-Mail wird für den Mail-Versand im Klartext benötigt. `user_id` ist eine zufällige UUID, Passwörter werden nur gehasht gespeichert.
- Sind diese Daten personenbezogen und wie gehe ich damit um?
  - Ja. Die E-Mail ist personenbezogen, und Votes sind für den Betreiber damit einer Person zuordenbar. Das wird im Datenschutz-Screen offen benannt. Es werden nur transaktionale Mails versendet (Codes, ggf. Hinweis auf neuen Passkey).
- Wie kann ich das "Recht auf Vergessenwerden" auf den technischen Komponenten umsetzen?
  - Ein User kann seinen Account samt E-Mail, Passkeys und Votes löschen (`ON DELETE CASCADE` auf `user_id`).

- Welche Rollen gibt es?
  - User
  - Admin
- Wie werden diese Rollen an User vergeben?
  - User: Automatisch durch Registrierung mit einer bestätigten DHBW-Mail und einem gültigen Kurs-Code.
  - Admin: Registrierung mit dem geheimen `ADMIN_SETUP_CODE` (Umgebungsvariable). Bestehende Admins können weitere User befördern.
- Wie werden User Identifiziert?
  - Besitz-basiert: Wer Zugriff auf die DHBW-Mail hat und den Kurs-Code kennt, darf sich registrieren. Ein geleakter Kurs-Code wird durch Rotation ersetzt.
- Wie werden User Authentifiziert?
  - E-Mail und Passwort oder optional Passkey (WebAuthn), danach serverseitige Session mit `HttpOnly`-Cookie.
- Wie stellt man sicher, dass die Rollenvergabe kein Single Point of Failure wird? - Mehrere Admins können befördert werden, der Setup-Code wird nach dem ersten Admin rotiert.
  Bei einem solchen kleinen System ist der Angriffsvektor über die harte Vergabe in Kauf zu nehmen, da ein Vier-Augen-Prinzip überkompliziert ist.

## 7) Stack

- Welche Tools kann ich für die einzelnen Container der Architektur verwenden (kurz begründet)?
  - Frontend: JavaScript mit React, da die Abstimmungen interaktiv sind und einzelne wiederverwendbare Kacheln werden sollen.
  - Backend: Node.js, TypeScript, Express und Drizzle ORM, da `simplewebauthn` dort am besten unterstützt wird und derselbe Typ-Stack im Frontend genutzt wird.
  - Mail: Transaktionaler Anbieter (z.B. Resend oder Brevo) hinter einer einzigen `sendMail`-Funktion, mit SPF, DKIM und DMARC für `felixkarg.de`.
  - DB: PostgreSQL, da es Bezug zur Datenbankvorlesung hat.
- Wie arbeiten die einzelnen Tools zusammen (Technisch konkrete Kommunikation)?
  - API-Kommunikation unter den Containern.
  - Die API-Anfragen werden über ein Netzwerk an die korrekten Ports des anderen Containers geleitet.
  - Frontend-Port ist für die User zugänglich (hinter Cloudflare Tunnel unter `free.felixkarg.de`). Andere Ports werden serverintern versteckt.
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