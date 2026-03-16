import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { AppDatabase } from './database';
import { LabelGenerator } from './labelGenerator';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// FIX 7: require() at top level — avoids ESM/CJS dynamic import issues in Electron main
let _printFn: ((file: string, opts?: { printerName?: string }) => Promise<void>) | null = null;

function getPrintFn(): (file: string, opts?: { printerName?: string }) => Promise<void> {
  if (_printFn) return _printFn;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('pdf-to-printer') as { print: (f: string, o?: any) => Promise<void> };
    _printFn = (file, opts) => mod.print(file, opts);
  } catch {
    // Fallback: shell lpr / powershell
    _printFn = async (file: string, opts?: { printerName?: string }) => {
      const p = opts?.printerName;
      if (process.platform === 'win32') {
        const printer = p ? `-printer "${p}"` : '';
        execSync(`powershell -command "Start-Process -FilePath '${file}' -Verb Print -Wait ${printer}"`);
      } else {
        const printer = p ? `-d "${p}"` : '';
        execSync(`lpr ${printer} "${file}"`);
      }
    };
  }
  return _printFn!;
}

export class PrintQueue extends EventEmitter {
  private queue: any[]         = [];
  private processing           = false;
  private seenEventIds         = new Set<string>();
  public  pendingCount         = 0;

  constructor(private db: AppDatabase, private labelGen: LabelGenerator) {
    super();
    this.startRetryLoop();
  }

  async addJob(order: any): Promise<any | null> {
    // Deduplicate by event_id
    if (order.event_id && this.seenEventIds.has(order.event_id)) return null;
    if (order.event_id) {
      this.seenEventIds.add(order.event_id);
      if (this.seenEventIds.size > 3000) {
        const first = this.seenEventIds.values().next().value;
        this.seenEventIds.delete(first);
      }
    }

    const job = {
      job_id:           uuid(),
      event_id:         order.event_id,
      session_id:       order.session_id || 'default',
      account_id:       order.account_id || 1,
      username:         (order.username  || 'unknown').slice(0, 60),
      item_description: (order.item_description || 'Unknown Item').slice(0, 120),
      price:            Math.max(0, order.price ?? 0),
      sale_type:        order.sale_type === 'GIVEAWAY' ? 'GIVEAWAY' : 'SOLD',
      source:           order.source     || 'extension',
      status:           'pending',
      attempts:         0,
      is_reprint:       order.is_reprint ?? false,
      created_at:       new Date().toISOString(),
      printed_at:       null,
    };

    this.db.saveJob(job);
    this.queue.push(job);
    this.pendingCount++;
    this.processNext();
    return job;
  }

  async reprint(jobId: string): Promise<any | null> {
    const original = this.queue.find(j => j.job_id === jobId)
      ?? this.db.getJobById(jobId);
    if (!original) return null;

    return this.addJob({
      username:         original.username,
      item_description: original.item_description,
      price:            original.price,
      sale_type:        original.sale_type,
      source:           original.source,
      session_id:       original.session_id,
      is_reprint:       true,
    });
  }

  private async processNext() {
    if (this.processing) return;
    const job = this.queue.find(j => j.status === 'pending');
    if (!job) return;

    this.processing = true;
    job.status = 'printing';
    this.emit('job-update', { ...job });

    let tmpPath: string | null = null;
    try {
      const settings  = this.getSettings();
      const pdfBuffer = await this.labelGen.generate({
        username:         job.username,
        item_description: job.item_description,
        price:            job.price,
        sale_type:        job.sale_type,
        is_reprint:       job.is_reprint,
        settings,
      });

      tmpPath = path.join(os.tmpdir(), `se-label-${job.job_id}.pdf`);
      fs.writeFileSync(tmpPath, pdfBuffer);

      // FIX 7: correct printerName option key
      const print       = getPrintFn();
      const printerName = settings.printer_name;
      await print(tmpPath, printerName ? { printerName } : undefined);

      job.status     = 'printed';
      job.printed_at = new Date().toISOString();
      this.db.updateJobStatus(job.job_id, 'printed', job.printed_at);
      this.pendingCount = Math.max(0, this.pendingCount - 1);
      this.emit('job-update', { ...job });

    } catch (err: any) {
      console.error('[PrintQueue] Error:', err.message);
      job.attempts++;
      job.status = job.attempts >= 10 ? 'failed' : 'pending';
      this.db.updateJobStatus(job.job_id, job.status);
      this.emit('job-update', { ...job });
      if (job.status !== 'failed') this.emit('printer-offline');
    } finally {
      if (tmpPath) try { fs.unlinkSync(tmpPath); } catch {}
      this.processing = false;
      setTimeout(() => this.processNext(), 300);
    }
  }

  private startRetryLoop() {
    setInterval(() => {
      if (!this.processing && this.queue.some(j => j.status === 'pending')) {
        this.processNext();
      }
    }, 15_000);
  }

  private getSettings(): any {
    const raw = this.db.getSettings();
    return {
      printer_name:    raw.printer_name    || '',
      label_width_mm:  parseFloat(raw.label_width_mm  || '101.6'),
      label_height_mm: parseFloat(raw.label_height_mm || '152.4'),
      logo_path:       raw.logo_path       || '',
      logo_position:   (raw.logo_position  || 'top-left') as 'top-left'|'top-center'|'top-right',
      sold_color:      raw.sold_color      || '#22c55e',
      giveaway_color:  raw.giveaway_color  || '#f59e0b',
      font_scale:      (raw.font_scale     || 'medium') as 'small'|'medium'|'large',
    };
  }
}
