/**
 * SQLite database for Scanner signals
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.SCANNER_DB_PATH || path.join(__dirname, '../../scanner.db');

class SignalsDB {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Connected to database: ${DB_PATH}`);
          resolve();
        }
      });
    });
  }

  async init() {
    const run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };

    // Create signals table
    await run(`
      CREATE TABLE IF NOT EXISTS signals (
        signal_id TEXT PRIMARY KEY,
        ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        published_at DATETIME,
        source_type TEXT,
        source_name TEXT,
        source_id TEXT,
        url TEXT,
        headline TEXT,
        raw_text TEXT,
        summary_3bullets TEXT,
        tags TEXT,
        jurisdiction TEXT,
        state TEXT,
        county TEXT,
        city TEXT,
        asset_type_guess TEXT,
        company_entities TEXT,
        site_entities TEXT,
        location_hint TEXT,
        lat REAL,
        lon REAL,
        lane TEXT DEFAULT 'CONTEXT',
        event_type TEXT,
        commitment_hint TEXT DEFAULT 'NONE',
        confidence TEXT DEFAULT 'LOW',
        dedupe_key TEXT,
        status TEXT DEFAULT 'NEW',
        candidate_project_id TEXT,
        review_notes_1line TEXT,
        requires_followup INTEGER DEFAULT 0,
        change_type TEXT,
        previous_ref TEXT,
        first_seen_at DATETIME,
        last_seen_at DATETIME,
        recurrence_14d INTEGER DEFAULT 0,
        recurrence_90d INTEGER DEFAULT 0,
        situation_key TEXT
      )
    `);
    
    // Add situation_key column if it doesn't exist (migration for existing databases)
    try {
      await run(`ALTER TABLE signals ADD COLUMN situation_key TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }
    
    // Create index for situation_key lookups
    await run(`CREATE INDEX IF NOT EXISTS idx_situation_key ON signals(situation_key)`);
    
    // Add new columns if they don't exist (migration for existing databases)
    try {
      await run(`ALTER TABLE signals ADD COLUMN first_seen_at DATETIME`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await run(`ALTER TABLE signals ADD COLUMN last_seen_at DATETIME`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await run(`ALTER TABLE signals ADD COLUMN recurrence_14d INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await run(`ALTER TABLE signals ADD COLUMN recurrence_90d INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Create source_snapshots table
    await run(`
      CREATE TABLE IF NOT EXISTS source_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        source_type TEXT,
        query TEXT,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        raw_payload TEXT
      )
    `);

    // Create indexes
    await run(`CREATE INDEX IF NOT EXISTS idx_dedupe_key ON signals(dedupe_key)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_url ON signals(url)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_lane ON signals(lane)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_status ON signals(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_source_type ON signals(source_type)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_snapshot_source ON source_snapshots(source_type, query)`);

    console.log('✅ Database tables initialized');
  }

  async insertSignal(signal) {
    const run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };
    
    const fields = Object.keys(signal).join(', ');
    const placeholders = Object.keys(signal).map(() => '?').join(', ');
    const values = Object.values(signal);

    await run(
      `INSERT OR REPLACE INTO signals (${fields}) VALUES (${placeholders})`,
      values
    );
  }

  async insertSnapshot(snapshot) {
    const run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };
    
    await run(
      `INSERT INTO source_snapshots (snapshot_id, source_type, query, raw_payload) VALUES (?, ?, ?, ?)`,
      [snapshot.snapshot_id, snapshot.source_type, snapshot.query, snapshot.raw_payload]
    );
  }

  async getSignals(filters = {}) {
    const all = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    
    let query = 'SELECT * FROM signals WHERE 1=1';
    const params = [];

    if (filters.lane) {
      query += ' AND lane = ?';
      params.push(filters.lane);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.source_type) {
      query += ' AND source_type = ?';
      params.push(filters.source_type);
    }
    if (filters.limit) {
      query += ' ORDER BY ingested_at DESC LIMIT ?';
      params.push(filters.limit);
    }

    return await all(query, params);
  }

  async getSignalByDedupeKey(dedupeKey) {
    const get = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    return await get('SELECT * FROM signals WHERE dedupe_key = ?', [dedupeKey]);
  }

  async getLatestSnapshot(sourceType, query) {
    const get = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    return await get(
      'SELECT * FROM source_snapshots WHERE source_type = ? AND query = ? ORDER BY captured_at DESC LIMIT 1',
      [sourceType, query]
    );
  }

  async getSignalByUrl(url) {
    const get = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    return await get('SELECT * FROM signals WHERE url = ? LIMIT 1', [url]);
  }

  async getSignalBySourceId(sourceType, sourceId) {
    const get = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    };
    return await get(
      'SELECT * FROM signals WHERE source_type = ? AND source_id = ? LIMIT 1',
      [sourceType, sourceId]
    );
  }

  async getSignalsByFuzzyHeadline(headline, threshold = 0.8) {
    const all = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    // Simple LIKE-based fuzzy matching (can be enhanced with FTS later)
    // Extract first 20 chars for pattern matching
    const pattern = `%${headline.substring(0, 30).trim()}%`;
    return await all(
      'SELECT * FROM signals WHERE headline LIKE ? ORDER BY ingested_at DESC LIMIT 10',
      [pattern]
    );
  }

  async getSignalsByCompanyAndLocation(company, county, days = 30) {
    const all = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const companyPattern = `%${company}%`;
    
    // Use company_entities column (metadata is not a column, it's stored in other fields)
    return await all(
      `SELECT * FROM signals 
       WHERE company_entities LIKE ?
       AND county = ?
       AND ingested_at >= ?
       ORDER BY ingested_at DESC`,
      [companyPattern, county, cutoffDate.toISOString()]
    );
  }

  async updateSignalStatus(signalId, status) {
    const run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };
    
    await run(
      `UPDATE signals SET status = ? WHERE signal_id = ?`,
      [status, signalId]
    );
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default SignalsDB;

