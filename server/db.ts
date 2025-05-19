import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";
import { log } from './vite';

// Configure WebSocket for Neon Serverless
neonConfig.webSocketConstructor = ws;

// Use environment DATABASE_URL if available
const DATABASE_URL = process.env.DATABASE_URL;

export let useDatabase = false;
export let pool: Pool | null = null;
export let db: any = null;

const connectToDatabase = async () => {
  try {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    if (pool) {
      await pool.end();
    }

    pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 5000
    });

    // Simple test query
    await pool.query('SELECT 1');

    db = drizzle(pool, { schema });
    useDatabase = true;
    log("Connected to PostgreSQL database", "db");
  } catch (err) {
    log(`Error connecting to PostgreSQL: ${err}. Using in-memory storage instead.`, "db");
    useDatabase = false;
    if (pool) {
      await pool.end();
      pool = null;
    }
  }
};

// Initialize connection
connectToDatabase();

// Handle process shutdown
process.on('SIGTERM', async () => {
  if (pool) await pool.end();
});

// Export for testing purposes
export const getDb = () => db;