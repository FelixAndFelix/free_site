import { Link } from "react-router";
import { VOTE_COOLDOWN_MINUTES } from "@free-site/shared";
import { BackLink } from "../BackLink";

const CONTACT = "mail@felixkarg.de";
const LAST_UPDATED = "27 September 2026";

/** What is stored, why and for how long; kept in line with the code (see planning/Decisions.md). */
const STORED_DATA = [
  ["DHBW email address", "Login, sending codes, proving you are a DHBW student", "Until you delete your account"],
  ["Username", "Shown to others instead of your email", "Until you delete your account"],
  ["Password", "Login. Stored only as an Argon2id hash; nobody can read it", "Until you delete your account"],
  ["Course and role", "Which modules you see; admin rights", "Until you delete your account"],
  [
    "Language",
    "Your interface language, which is also the language of the emails we send you",
    "Until you delete your account",
  ],
  [
    "Language choice in your browser",
    "Remembers your language on this device before you log in. It stays in your browser and is never sent to us",
    "Until you clear your browser data",
  ],
  ["Your votes", "The totals and charts of your course", "Until you delete your account or the module is deleted"],
  [
    "Vote history",
    "The charts over time. Stored without any link to you: module, old vote, new vote and time only",
    "Kept, also after your account is deleted, because it cannot be linked to you",
  ],
  ["Session cookie", "Keeps you logged in", "30 days, or until you log out"],
  ["Email codes", "Confirming your email and resetting your password", "10 minutes"],
  ["IP address", "Limits against abuse, e.g. too many code requests", "In memory only, until the next server restart"],
];

/** The privacy information, reachable without logging in. */
export function PrivacyPage() {
  return (
    <article className="stack prose">
      <BackLink to="/">Back</BackLink>
      <h1>Privacy</h1>
      <p className="muted">Last updated: {LAST_UPDATED}</p>

      <section className="card">
        <h2>Who runs FreeSite</h2>
        <p>
          FreeSite is a private, non-commercial project by a DHBW student. It is not run by or affiliated with the
          DHBW. Responsible for the processing of your data (controller under the GDPR): Felix Karg,{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>

      <section className="card">
        <h2>The short version</h2>
        <ul>
          <li>Other users only ever see totals, never who voted what.</li>
          <li>
            <strong>The operator can link your votes to your email address</strong>, because both are stored in the
            same database. They do not look at individual votes and never share them.
          </li>
          <li>No tracking, no analytics, no advertising, no cookies except the login cookie.</li>
          <li>
            You can delete your account yourself at any time under <Link to="/account">Account</Link>.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>What is stored and why</h2>
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Purpose</th>
                <th scope="col">Kept</th>
              </tr>
            </thead>
            <tbody>
              {STORED_DATA.map(([data, purpose, kept]) => (
                <tr key={data}>
                  <th scope="row">{data}</th>
                  <td data-label="Purpose">{purpose}</td>
                  <td data-label="Kept">{kept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          You can change your vote on a module once every {VOTE_COOLDOWN_MINUTES} minutes; the time of your last change
          is stored with the vote for this. Expired codes and sessions are deleted automatically every hour.
        </p>
        <p>
          <strong>Legal basis:</strong> providing the service you signed up for (Art. 6(1)(b) GDPR); protection
          against abuse and securing the service (legitimate interest, Art. 6(1)(f) GDPR).
        </p>
      </section>

      <section className="card">
        <h2>Who else processes data</h2>
        <ul>
          <li>
            <strong>Hosting:</strong> the app and its database run on a private server in Germany.
          </li>
          <li>
            <strong>Cloudflare, Inc. (USA):</strong> every request passes through Cloudflare, which protects the site
            and delivers it securely. Cloudflare therefore processes your IP address and the requests you make.
          </li>
          <li>
            <strong>Resend, Inc. (USA):</strong> sends the emails with your codes and therefore processes your email
            address and the email content.
          </li>
        </ul>
        <p>
          Both companies may process data outside the EU. Nothing is sold or passed on to anyone else.
        </p>
      </section>

      <section className="card">
        <h2>Your rights</h2>
        <p>
          Under the GDPR you have the right to access your data, to have it corrected or deleted, to restrict or object
          to its processing and to receive it in a portable format. Write to{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. You can delete your account yourself under{" "}
          <Link to="/account">Account</Link>; this removes your email, username, password and votes.
        </p>
        <p>You also have the right to lodge a complaint with a data protection supervisory authority.</p>
      </section>

      <section className="card">
        <h2>Security</h2>
        <p>
          Found a security problem? Please report it to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> (see{" "}
          <a href="/.well-known/security.txt">security.txt</a>).
        </p>
      </section>
    </article>
  );
}
