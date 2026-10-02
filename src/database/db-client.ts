import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';

export class DatabaseClient {
  private static instance: DatabaseClient;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      console.error('[DatabaseClient] Unexpected pool error:', err.message);
    });
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 AS ping');
      return res.rows.length > 0 && res.rows[0].ping === 1;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export const db = DatabaseClient.getInstance();
