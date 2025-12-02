import { app } from "./app.js";
import { db } from "./providers/db.provider.js";
import { logger, logError } from "./logger/index.js";

const port = 3000;

async function main() {
  logger.info('Initializing Privacy Pools Relayer', { port });
  
  await db.init();
  logger.info('Database initialized successfully');
  
  // Start the server
  app.listen(port, () => {
    logger.info(`Server running at http://localhost:${port}`, { port });
  });
}

main().catch((e) => {
  logError(e as Error, { context: 'server_startup' });
  process.exit(1);
});
