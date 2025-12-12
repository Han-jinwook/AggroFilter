import { Hono } from 'hono';
import { handle } from 'hono/vercel';

export const runtime = 'nodejs';

import users from './users';


const app = new Hono().basePath('/api');

const routes = app.route('/users', users);

export type AppType = typeof routes;

export const GET = handle(app);
export const POST = handle(app);
