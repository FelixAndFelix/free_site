# Architektur-Guide: Login für Studenten-WebApp

Verbindliche Entscheidungen stehen in `Decisions.md`. Dieses Dokument beschreibt die Abläufe.

## 1. Konzept & Flow

Die Identifikation erfolgt über eine bestätigte DHBW-E-Mail, die Autorisierung für einen Kurs über einen Kurs-Code. Login mit Passwort, optional mit Passkey (WebAuthn).

### Registrierungs-Flow

1. Nutzer gibt `E-Mail`, `Username` und `Kurs-Code` (z.B. `INF24B-7KQ2XMPA`) ein.
2. Backend prüft die Domain der E-Mail gegen `ALLOWED_EMAIL_DOMAINS` (exakter Match), ob der `Username` den Regeln entspricht und frei ist und ob der `Kurs-Code` existiert. Sonst Abbruch, es wird keine Mail gesendet.
3. Backend sendet einen 6-stelligen E-Mail-Code (10 Minuten gültig, einmalig, 5 Fehlversuche).
4. Nutzer gibt den Code ein und setzt ein Passwort (mindestens 10 Zeichen, Argon2id).
5. Backend legt `User` an, trägt ihn in `course_members` ein und startet eine Session.
6. Optional: Nutzer legt einen Passkey an.

### Login-Flow

1. Nutzer gibt E-Mail und Passwort ein, oder wählt "Login mit Passkey".
2. Backend verifiziert das Passwort (Argon2id) bzw. die WebAuthn-Signatur.
3. Bei Erfolg wird eine serverseitige Session gestartet (`HttpOnly`-Cookie).
4. Antworten sind unabhängig davon generisch, ob die E-Mail existiert.

### Passwort-Reset

1. Nutzer gibt die E-Mail ein, das Backend antwortet immer gleich.
2. Existiert die E-Mail, wird ein E-Mail-Code gesendet.
3. Nach korrektem Code setzt der Nutzer ein neues Passwort. Alle Sessions des Users werden widerrufen.

---

## 2. Benötigter Tech-Stack

- **Passwort:** `argon2` (Argon2id).
- **Passkeys (Nicht selbst schreiben!):** `simplewebauthn` (Backend + Frontend-Pakete).
- **Mail:** Transaktionaler Anbieter hinter `sendMail`.
- **Datenbank:** PostgreSQL mit Drizzle ORM.

---

## 3. Datenbank-Schema (Minimalbeispiel)

### Table: `users`

- `id` (UUID, Primary Key)
- `email` (String, Unique, lowercase)
- `username` (String, eindeutig ohne Groß-/Kleinschreibung, 3–20 Zeichen; wird statt der E-Mail angezeigt)
- `password_hash` (String)
- `role` (`user` | `admin`)
- `created_at` (Timestamp)

### Table: `email_codes`

- `email`, `purpose` (`register` | `reset`), `code_hash`, `expires_at`, `attempts`, `created_at`

### Table: `passkey_credentials` (optional)

_(Ein User kann mehrere Geräte/Keys haben!)_

- `credential_id` (String/Base64, Primary Key) - _Wird vom Gerät generiert_
- `public_key` (Bytes/Base64) - _Um Signaturen zu prüfen_
- `user_id` (UUID, Foreign Key zu `users.id`)
- `sign_count` (Integer) - _Wichtig gegen Klon-Attacken_
- `transports` (Array of Strings) - _z.B. ["internal", "hybrid"] für UI-Hinweise_

### Table: `courses`

- `id` (UUID, Primary Key)
- `name` (String, z.B. "Datenbanken 101")
- `join_code` (String, Unique, z.B. "DB-24X7")

### Table: `course_members` (Mapping-Table)

- `course_id` (UUID)
- `user_id` (UUID)

---

## 4. Wichtige Sicherheits- & UX-Regeln

1.  **Rate Limiting:** Send-Code-Endpunkt: 5 pro IP/Stunde plus Limit pro E-Mail (1 Code pro 60 Sekunden). Login: 5 Fehlversuche pro E-Mail, danach wachsende Verzögerung bis 15 Minuten, keine dauerhafte Sperre.
2.  **User ID Buffer:** Die WebAuthn API verlangt die `user.id` als `Buffer` (bzw. `Uint8Array`). Niemals die E-Mail als WebAuthn-ID verwenden, sondern die UUID.
3.  **Account Management:** Nach dem Login gibt es eine Profilseite ("Meine Geräte"), auf der optional weitere Passkeys hinzugefügt werden (`navigator.credentials.create()`).
4.  **Recovery:** Läuft über den Passwort-Reset per E-Mail-Code. Ein separater Recovery-Code entfällt.
