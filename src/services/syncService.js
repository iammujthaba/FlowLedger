import { db } from '../db/db';

class SyncService {
  constructor() {
    this.syncing = false;
    this.listeners = new Set();
    this.status = navigator.onLine ? 'idle' : 'offline'; // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
    this.lastSyncTime = localStorage.getItem('flowledger_last_sync') || null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setStatus('idle');
        this.sync();
      });
      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });
    }
  }

  getScriptUrl() {
    return localStorage.getItem('flowledger_script_url') || '';
  }

  setScriptUrl(url) {
    localStorage.setItem('flowledger_script_url', url.trim());
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ status: this.status, lastSyncTime: this.lastSyncTime });
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) =>
      fn({ status: this.status, lastSyncTime: this.lastSyncTime })
    );
  }

  setStatus(status) {
    this.status = status;
    this.notify();
  }

  /**
   * Enqueue a local change for background sync
   */
  async enqueue(entity, entityId, action, payload) {
    await db.syncQueue.add({
      entity, // 'transactions' | 'loans' | 'vault'
      entityId,
      action, // 'upsert' | 'delete'
      payload,
      createdAt: new Date().toISOString(),
    });

    if (navigator.onLine && this.getScriptUrl()) {
      this.sync();
    }
  }

  /**
   * Run bidirectional sync
   */
  async sync() {
    const url = this.getScriptUrl();
    if (!url) {
      this.setStatus('not_configured');
      return { success: false, message: 'Google Apps Script URL is not set.' };
    }

    if (!navigator.onLine) {
      this.setStatus('offline');
      return { success: false, message: 'You are currently offline.' };
    }

    if (this.syncing) return;
    this.syncing = true;
    this.setStatus('syncing');

    try {
      // 1. PUSH: Gather queued local items
      const queueItems = await db.syncQueue.toArray();
      const txToPush = [];
      const loansToPush = [];
      const vaultToPush = [];

      for (const item of queueItems) {
        if (item.entity === 'transactions') txToPush.push(item.payload);
        else if (item.entity === 'loans') loansToPush.push(item.payload);
        else if (item.entity === 'vault') vaultToPush.push(item.payload);
      }

      if (txToPush.length > 0 || loansToPush.length > 0 || vaultToPush.length > 0) {
        const pushRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sync',
            transactions: txToPush,
            loans: loansToPush,
            vault: vaultToPush,
          }),
        });

        const pushData = await pushRes.json();
        if (pushData.status === 'success') {
          // Clear processed queue items
          await db.syncQueue.clear();
        }
      }

      // 2. PULL: Fetch any changes since last sync
      const pullUrl = `${url}?action=pull${this.lastSyncTime ? `&since=${encodeURIComponent(this.lastSyncTime)}` : ''}`;
      const pullRes = await fetch(pullUrl);
      const pullData = await pullRes.json();

      if (pullData.status === 'success') {
        if (pullData.transactions && pullData.transactions.length > 0) {
          for (const tx of pullData.transactions) {
            if (tx.isDeleted) {
              await db.transactions.delete(tx.id);
            } else {
              await db.transactions.put({
                ...tx,
                amount: Number(tx.amount),
                syncStatus: 'synced',
              });
            }
          }
        }

        if (pullData.loans && pullData.loans.length > 0) {
          for (const loan of pullData.loans) {
            if (loan.isDeleted) {
              await db.loans.delete(loan.id);
            } else {
              await db.loans.put({
                ...loan,
                amount: Number(loan.amount),
                remainingAmount: Number(loan.remainingAmount),
                syncStatus: 'synced',
              });
            }
          }
        }

        if (pullData.vault && pullData.vault.length > 0) {
          for (const v of pullData.vault) {
            let val = v.value;
            try {
              if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                val = JSON.parse(val);
              }
            } catch {
              // keep as string
            }
            await db.vault.put({ key: v.key, value: val, updatedAt: v.updatedAt });
          }
        }

        const now = pullData.serverTime || new Date().toISOString();
        this.lastSyncTime = now;
        localStorage.setItem('flowledger_last_sync', now);
      }

      this.setStatus('synced');
      return { success: true };
    } catch (err) {
      console.error('[SyncService] Sync failed:', err);
      this.setStatus('error');
      return { success: false, error: err.message };
    } finally {
      this.syncing = false;
    }
  }
}

export const syncService = new SyncService();

