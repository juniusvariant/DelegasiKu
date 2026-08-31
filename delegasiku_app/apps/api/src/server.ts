// API service entry point
// WP-04 will implement the full server logic

import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();

  try {
    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`API server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
