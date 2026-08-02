import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import * as billing from '@/models/Billing';
import * as org from '@/models/Org';
import * as system from '@/models/System';

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with Next.js Boilerplate
export const createDbConnection = () => {
  const pool = new Pool({
    connectionString: Env.DATABASE_URL,
  });

  pool.on('error', (error) => {
    logger.error(`Database pool error: ${error.message}`);
  });

  // Composed here rather than in a barrel module: the lint rule forbids
  // re-export hubs, and drizzle only needs the table objects at runtime.
  return drizzle({
    client: pool,
    schema: { ...org, ...billing, ...system },
  });
};
