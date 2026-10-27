// Client for tools/render_server/server.py (reached through an SSH tunnel on localhost).
// Keeps at most one request in flight and always renders the most recent parameters.
export class LiveRenderer {
  constructor(port, pill) {
    this.url = `http://localhost:${port}`;
    this.pill = pill;
    this.online = null;
    this.busy = false;
    this.pending = null;
    this.ready = this.check();
  }
  async check() {
    try {
      const r = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(2500) });
      this.online = r.ok;
    } catch { this.online = false; }
    this.setPill();
    return this.online;
  }
  setPill(text) {
    if (!this.pill) return;
    this.pill.classList.toggle('on', !!this.online);
    this.pill.classList.toggle('off', this.online === false);
    this.pill.querySelector('b').textContent = text || (this.online ? 'live renderer · GPU' : 'live renderer offline');
  }
  /** request a render; onDone(dataUrl, ms, cached) is called only for the latest request */
  render(params, onDone, onStart) {
    this.pending = { params, onDone, onStart };
    if (!this.busy) this.next();
  }
  async next() {
    const job = this.pending;
    if (!job) return;
    this.pending = null;
    this.busy = true;
    job.onStart?.();
    this.setPill('rendering…');
    try {
      const r = await fetch(`${this.url}/render`, { method: 'POST', body: JSON.stringify(job.params), signal: AbortSignal.timeout(60000) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (!this.pending) job.onDone(`data:image/png;base64,${d.png}`, d.ms, d.cached);
      this.online = true;
    } catch (e) {
      console.warn('live render failed', e);
      this.online = false;
    }
    this.busy = false;
    this.setPill();
    if (this.pending) this.next();
  }
}
