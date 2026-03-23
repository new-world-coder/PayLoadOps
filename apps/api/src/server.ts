import { buildApp } from "./app.js";
import { createRepositoryWithFallback } from "./repository.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  const { repository, mode } = await createRepositoryWithFallback();
  const app = await buildApp({ repository });
  await app.listen({ port, host });
  app.log.info({ mode }, "API server started");
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
