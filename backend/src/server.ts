import { createAdminRouter } from "./admin/routes";
import { createApp } from "./app";
import { deleteExpiredRecords } from "./auth/accounts";
import { createAuthRouter } from "./auth/routes";
import { loadConfig } from "./config";
import { ensureCourse } from "./courses";
import { createDatabase } from "./database";
import { createJoinRouter } from "./join/routes";
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

const events = createEventHub();

const authRouter = createAuthRouter({
  db: database.db,
  sendMail: createSendMail(config),
  allowedEmailDomains: config.allowedEmailDomains,
  secureCookies: config.isProduction,
  appUrl: config.appUrl,
  instanceLabel: config.instanceLabel,
  adminSetupCode: config.adminSetupCode,
  onAccountDeleted: events.userLeftCourse,
});

// Hourly, and once at start: expired email codes and sessions are removed, not only rejected.
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
/** Deletes expired records and logs how many; a failure is logged and retried next hour. */
async function cleanUp() {
  try {
    const deleted = await deleteExpiredRecords(database.db, new Date());
    if (deleted.emailCodes || deleted.sessions) {
      console.log(`cleanup: deleted ${deleted.emailCodes} expired email codes, ${deleted.sessions} expired sessions`);
    }
  } catch (error) {
    console.error("cleanup failed", error);
  }
}
await cleanUp();
setInterval(cleanUp, CLEANUP_INTERVAL_MS).unref();

createApp({
  checkDatabase: database.check,
  authRouter,
  adminRouter: createAdminRouter({ db: database.db, events }),
  joinRouter: createJoinRouter({ db: database.db, events }),
  votingRouter: createVotingRouter({ db: database.db, events }),
  trustProxy: config.trustProxy,
}).listen(config.port, () => {
  console.log(`backend listening on port ${config.port}`);
});
