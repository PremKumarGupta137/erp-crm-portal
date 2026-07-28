import { createApp } from './app';
import { env } from './env';
import { prisma } from './prisma';

async function main() {
  // Fail fast on boot if the database is unreachable, rather than on first request.
  await prisma.$connect();
  console.log('[db] connected');

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[api] allowed origins: ${env.corsOrigins.join(', ')}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
