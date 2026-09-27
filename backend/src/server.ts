import { createApp } from "./app";
import { createAuthRouter } from "./auth/routes";
import { loadConfig } from "./config";
import { createDatabase } from "./database";
import { createSendMail } from "./mail";

const config = loadConfig(process.env);
if (config.allowedEmailDomains.length === 0) console.warn("ALLOWED_EMAIL_DOMAINS is empty: nobody can register");

const database = createDatabase(config.databaseUrl);
await database.runMigrations();

const authRouter = createAuthRouter({
  db: database.db,
  sendMail: createSendMail(config),
  allowedEmailDomains: config.allowedEmailDomains,
  secureCookies: config.isProduction,
});

createApp({ checkDatabase: database.check, authRouter, trustProxy: config.trustProxy }).listen(config.port, () => {
  console.log(`backend listening on port ${config.port}`);
});
