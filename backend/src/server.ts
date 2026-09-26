import { createApp } from "./app";
import { createDatabase } from "./database";

const port = Number(process.env.PORT ?? 3000);
const database = createDatabase(process.env.DATABASE_URL ?? "");

createApp({ checkDatabase: database.check }).listen(port, () => {
  console.log(`backend listening on port ${port}`);
});
