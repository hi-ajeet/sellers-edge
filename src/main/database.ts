import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';

// FIX 1+6: Use Database type from the module correctly
type DB = ReturnType<typeof Database>;

const DB_PATH = path.join(app.getPath('userData'), 'sellers-edge.db');
const ENC_KEY = crypto.createHash('sha256')
  .update('sellers-edge-v1-' + process.platform).digest();

function encrypt(text: string): string {
  if (!text) return '';
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(data: string): string {
  if (!data) return '';
  try {
    const [ivHex, tagHex, encHex] = data.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
  } catch { return ''; }
}

export class AppDatabase {
  private db!: DB;

  init() {
    this.db = new Database(DB_PATH);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        name               TEXT NOT NULL,
        account_number     TEXT,
        email_encrypted    TEXT,
        password_encrypted TEXT,
        notes              TEXT,
        created_at         TEXT DEFAULT (datetime('now')),
        last_used          TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        account_id INTEGER,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at   TEXT
      );

      CREATE TABLE IF NOT EXISTS print_jobs (
        job_id           TEXT PRIMARY KEY,
        session_id       TEXT,
        account_id       INTEGER,
        username         TEXT,
        item_description TEXT,
        price            REAL,
        sale_type        TEXT,
        source           TEXT DEFAULT 'extension',
        status           TEXT DEFAULT 'pending',
        attempts         INTEGER DEFAULT 0,
        is_reprint       INTEGER DEFAULT 0,
        created_at       TEXT DEFAULT (datetime('now')),
        printed_at       TEXT
      );
    `);
  }

  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  saveSettings(settings: Record<string, string>): boolean {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const tx   = this.db.transaction((s: Record<string, string>) => {
      for (const [k, v] of Object.entries(s)) stmt.run(k, String(v ?? ''));
    });
    tx(settings);
    return true;
  }

  // ── Accounts ─────────────────────────────────────────────────────────────────
  getAccounts() {
    const rows = this.db.prepare('SELECT * FROM accounts ORDER BY name ASC').all() as any[];
    return rows.map(r => ({
      ...r,
      email:    r.email_encrypted    ? decrypt(r.email_encrypted)    : '',
      password: r.password_encrypted ? decrypt(r.password_encrypted) : '',
    }));
  }

  saveAccount(account: any): boolean {
    if (account.id) {
      this.db.prepare(`
        UPDATE accounts SET name=?, account_number=?, email_encrypted=?,
        password_encrypted=?, notes=?, last_used=datetime('now') WHERE id=?
      `).run(
        account.name, account.account_number || '',
        account.email    ? encrypt(account.email)    : '',
        account.password ? encrypt(account.password) : '',
        account.notes || '', account.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO accounts (name, account_number, email_encrypted, password_encrypted, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        account.name, account.account_number || '',
        account.email    ? encrypt(account.email)    : '',
        account.password ? encrypt(account.password) : '',
        account.notes || ''
      );
    }
    return true;
  }

  deleteAccount(id: number): boolean {
    this.db.prepare('DELETE FROM accounts WHERE id=?').run(id);
    return true;
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────
  startSession(sessionId: string, accountId = 1): void {
    this.db.prepare(
      'INSERT OR IGNORE INTO sessions (session_id, account_id) VALUES (?, ?)'
    ).run(sessionId, accountId);
  }

  endSession(sessionId: string): void {
    this.db.prepare(
      "UPDATE sessions SET ended_at=datetime('now') WHERE session_id=?"
    ).run(sessionId);
  }

  getAllSessions(): any[] {
    return this.db.prepare(`
      SELECT s.*,
        COUNT(j.job_id) as total_labels,
        SUM(CASE WHEN j.sale_type='SOLD'     AND j.is_reprint=0 THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN j.sale_type='GIVEAWAY' AND j.is_reprint=0 THEN 1 ELSE 0 END) as giveaway_count
      FROM sessions s
      LEFT JOIN print_jobs j ON j.session_id = s.session_id
      GROUP BY s.session_id
      ORDER BY s.started_at DESC
    `).all();
  }

  // ── Print Jobs ────────────────────────────────────────────────────────────────
  saveJob(job: any): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO print_jobs
        (job_id, session_id, account_id, username, item_description, price,
         sale_type, source, status, attempts, is_reprint, created_at, printed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.job_id, job.session_id, job.account_id ?? 1,
      job.username, job.item_description, job.price ?? 0,
      job.sale_type, job.source ?? 'extension',
      job.status ?? 'pending', job.attempts ?? 0,
      job.is_reprint ? 1 : 0,
      job.created_at ?? new Date().toISOString(),
      job.printed_at ?? null
    );
  }

  getJobById(jobId: string): any | null {
    return this.db.prepare('SELECT * FROM print_jobs WHERE job_id=?').get(jobId) ?? null;
  }

  updateJobStatus(jobId: string, status: string, printedAt?: string): void {
    this.db.prepare(
      'UPDATE print_jobs SET status=?, attempts=attempts+1, printed_at=? WHERE job_id=?'
    ).run(status, printedAt ?? null, jobId);
  }

  getSessionLogs(sessionId: string): any[] {
    return this.db.prepare(
      'SELECT * FROM print_jobs WHERE session_id=? ORDER BY created_at DESC'
    ).all(sessionId);
  }

  exportSessionCSV(sessionId: string): string {
    const jobs   = this.getSessionLogs(sessionId) as any[];
    const header = 'Time,Username,Item Description,Price,Type,Status,Source\n';
    const rows   = jobs.map(j =>
      `"${j.created_at}","${j.username}","${(j.item_description || '').replace(/"/g, '""')}",` +
      `"$${(j.price || 0).toFixed(2)}","${j.sale_type}","${j.status}","${j.source || 'extension'}"`
    ).join('\n');
    return header + rows;
  }

  // ── Security ──────────────────────────────────────────────────────────────────
  verifyPin(pin: string): boolean {
    const stored = this.db.prepare("SELECT value FROM settings WHERE key='pin_hash'").get() as any;
    if (!stored?.value) return true;
    return crypto.createHash('sha256').update(pin).digest('hex') === stored.value;
  }

  setPin(pin: string): boolean {
    const hash = crypto.createHash('sha256').update(pin).digest('hex');
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pin_hash', hash);
    return true;
  }
}
