# Architektur-Guide: Passkey-Login für Studenten-WebApp

## 1. Konzept & Flow

Diese WebApp verzichtet vollständig auf Passwörter und E-Mail-Adressen. Die Identifikation erfolgt über Passkeys (WebAuthn), die Autorisierung über eindeutige Kurs-Codes.

### Registrierungs-Flow

1. Nutzer ruft Registrierungsseite auf.
2. Nutzer gibt ein: `Anzeigename` (anonym) und `Kurs-Code` (z.B. `WS24-123`).
3. Backend prüft: Existiert `Kurs-Code`? (Wenn nein -> Abbruch).
4. Backend generiert `User_UUID` und sendet WebAuthn-Challenge ans Frontend.
5. Nutzer bestätigt biometrisch (Gerät erstellt Passkey).
6. Frontend sendet Public Key an Backend.
7. Backend speichert Public Key verknüpft mit `User_UUID`.
8. Backend trägt `User_UUID` in die Teilnehmerliste des Kurses ein.

### Login-Flow

1. Nutzer klickt auf "Login".
2. Backend sendet Challenge.
3. Nutzer bestätigt per Biometrie/Geräte-PIN (inkl. Cross-Device via QR-Code möglich).
4. Frontend sendet Signatur ans Backend.
5. Backend verifiziert Signatur mit gespeichertem Public Key.
6. Session wird gestartet (z.B. per JWT oder Session-Cookie).

---

## 2. Benötigter Tech-Stack

- **Kryptografie (Nicht selbst schreiben!):** \* _Node.js/TypeScript:_ `simplewebauthn` (Backend + Frontend-Pakete).
  - _Python/Django:_ `webauthn`
  - _Go:_ `go-webauthn`
- **Datenbank:** Relationale DB (PostgreSQL) oder NoSQL, solange Relationen sauber abbildbar sind.

---

## 3. Datenbank-Schema (Minimalbeispiel)

### Table: `users`

- `id` (UUID, Primary Key)
- `display_name` (String, z.B. "CodeNinja99")
- `created_at` (Timestamp)

### Table: `passkey_credentials`

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

1.  **Rate Limiting:** Den Registrierungs-Endpunkt strikt limitieren (z.B. max 5 Versuche pro IP/Stunde), um Brute-Forcing von Kurs-Codes zu verhindern.
2.  **User ID Buffer:** Die WebAuthn API verlangt die `user.id` als `Buffer` (bzw. `Uint8Array`). Niemals persönliche Daten wie E-Mails als ID verwenden (hier perfekt gelöst durch die anonyme UUID).
3.  **Account Management:** Nach dem Login muss es eine Profilseite geben ("Meine Geräte"). Hier ruft der Nutzer erneut `navigator.credentials.create()` auf, um z.B. sein iPad zum selben Account (`user_id`) hinzuzufügen.
4.  **Fallback / Recovery (Optional):** Da es keine E-Mail zum Zurücksetzen gibt, sollte beim Registrieren ein **einmaliger Recovery-Code** generiert werden (z.B. 16-stelliger String, gehasht in der DB gespeichert), den der Student sich ausdrucken/speichern muss, falls er sein Gerät verliert.
