/**
 * Admin session routes (§12.1 — seeded demo admin)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes, timingSafeEqual } from 'crypto';
import { UnauthorizedError } from '@dku/shared';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Seeded demo admin (per §12.1; in production this comes from a secret store)
const DEMO_ADMIN = {
  email: 'admin@delegasiku.demo',
  password: 'demo-admin-password',
};

export async function sessionRoutes(app: FastifyInstance) {
  app.post('/api/session/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const emailMatch =
      timingSafeEqual(
        Buffer.from(body.email.padEnd(64).slice(0, 64)),
        Buffer.from(DEMO_ADMIN.email.padEnd(64).slice(0, 64))
      ) && body.password === DEMO_ADMIN.password;

    if (!emailMatch) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const sessionId = randomBytes(32).toString('base64url');
    // Session stored in Valkey in the final version; for now issue a cookie token
    reply.setCookie('dku_admin_session', sessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8, // 8h
    });

    request.log.info({ admin: DEMO_ADMIN.email }, 'Admin logged in (demo)');
    return { authenticated: true, admin: { email: DEMO_ADMIN.email } };
  });

  app.post('/api/session/logout', async (_request, reply) => {
    reply.clearCookie('dku_admin_session', { path: '/' });
    return { authenticated: false };
  });
}
