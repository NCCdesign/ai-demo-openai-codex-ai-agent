import { createServer } from "./server.js";

const app = await createServer();

try {
  await app.start();
} catch (error) {
  app.fastify.log.error(error);
  process.exit(1);
}

