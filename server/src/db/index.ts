import { drizzle } from 'drizzle-orm/d1';
import type { Bindings } from '../bindings';
export const database = (env: Bindings) => drizzle(env.DB);
