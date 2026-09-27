import { createAdminRouter } from "./admin/routes";
import { createApp } from "./app";
import { createAuthRouter } from "./auth/routes";
import { loadConfig } from "./config";
import { ensureCourse } from "./courses";
import { createDatabase } from "./database";
import { createSendMail } from "./mail";
import { createEventHub } from "./voting/events";
import { createVotingRouter } from "./voting/routes";

const config = loadConfig(process.env);
if (config.allowedEmailDomains.length === 0) console.warn("ALLOWED_EMAIL_DOMAINS is empty: nobody can register");

const database = createDatabase(config.databaseUrl);
await database.runMigrations();
if (config.initialCourseJoinCode) {
  const created = await ensureCourse(database.db, config.initialCourseName, config.initialCourseJoinCode);
  if (created) console.log(`created course ${config.initialCourseName}`);
}

const authRouter = createAuthRouter({
  db: database.db,
  sendMail: createSendMail(config),
  allowedEmailDomains: config.allowedEmailDomains,
  secureCookies: config.isProduction,
  appUrl: config.appUrl,
  instanceLabel: config.instanceLabel,
  adminSetupCode: config.adminSetupCode,
});

const events = createEventHub();

createApp({
  checkDatabase: database.check,
  authRouter,
  adminRouter: createAdminRouter({ db: database.db, events }),
  votingRouter: createVotingRouter({ db: database.db, events }),
  trustProxy: config.trustProxy,
}).listen(config.port, () => {
  console.log(`backend listening on port ${config.port}`);
});
