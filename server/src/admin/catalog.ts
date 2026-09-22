import { Hono } from 'hono';
import type { AdminEnv } from './security';
import { facilityRouter } from './catalog/facilities';
import { studentRouter } from './catalog/students';
import { courseRouter } from './catalog/courses';
import { resourceRouter } from './catalog/resources';

export const catalogRouter = new Hono<AdminEnv>();
catalogRouter.route('/', facilityRouter);
catalogRouter.route('/', studentRouter);
catalogRouter.route('/', courseRouter);
catalogRouter.route('/', resourceRouter);
