import { Hono } from 'hono';

const app = new Hono().get('/', async (c) => {
  return c.json({
    error: 'Prisma integration has been rolled back',
  }, 501);
});

export default app;
