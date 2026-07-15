/**
 * CDP Session: persistent WebSocket to Chrome's browser endpoint.
 * Auto-injects sessionId for the active target on every call.
 *
 * Connect with `flatten: true` so all sessions share one WS (no nested
 * Target.sendMessageToTarget envelopes).
 *
 * Detection priority:
 *  1. DevToolsActivePort file scan (standard Chrome/Chromium)
 *  2. HTTP port scan on 9222-9225 (Dia, Arc, Vivaldi, Opera — browsers
 *     that don't write DevToolsActivePort but serve /json/version)
 */

import { bindDomains, type Domains, type Transport } from './generated.ts';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

export type ConnectOptions = {
  /** Full WS URL: ws://host:port/devtools/browser/<id>. */
  wsUrl?: string;
  /** Read DevToolsActivePort from profile dir. Polls up to 30s. */
  profileDir?: string;
  /** Connect by debug port. Fetches /json/version to get WS URL. */
  port?: number;
  /** Per-candidate WS-open timeout in ms. Default 5000. */
  timeoutMs?: number;
};

export type DetectedBrowser = {
  name: string;
  profileDir: string;
  port: number;
  wsPath: string;
  wsUrl: string;
  mtimeMs: number;
};

export class Session implements Transport {
  private ws?: WebSocket;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private activeSessionId: string | undefined;
  private eventListeners: Array<(method: string, params: unknown, sessionId?: string) => void> = [];

  domains!: Domains;

  constructor() {
    this.domains = bindDomains(this);
    for (const k of Object.keys(this.domains) as (keyof Domains)[]) {
      (this as any)[k] = this.domains[k];
    }
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 5_000;

    if (opts.port) {
      const wsUrl = await discoverByPort(opts.port);
      await this.openWs(wsUrl, timeoutMs);
      return;
    }
    if (opts.wsUrl || opts.profileDir) {
      const wsUrl = await resolveWsUrl(opts);
      await this.openWs(wsUrl, timeoutMs);
      return;
    }

    const browsers = await detectBrowsers();
    if (browsers.length === 0) {
      const help = buildNoBrowserHelp();
      throw new Error(help);
    }
    const errors: string[] = [];
    for (const b of browsers) {
      try {
        await this.openWs(b.wsUrl, timeoutMs);
        return;
      } catch (e) {
        errors.push(`  ${b.name} @ ${b.wsUrl}: ${e instanceof Error ? e.message : e}`);
      }
    }
    throw new Error(
      `No browser accepted connection.\n` +
      `If one of these is yours, click "Allow" then retry, or pass { timeoutMs: 30000 }:\n` +
      `${errors.join('\n')}`,
    );
  }

  private openWs(wsUrl: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((res, rej) => {
      const ws = new WebSocket(wsUrl);
      let done = false;
      const finish = (err?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) { try { ws.close(); } catch { /* ignore */ } rej(err); }
        else res();
      };
      const timer = setTimeout(() => finish(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      ws.addEventListener('open', () => finish());
      ws.addEventListener('error', (e) => finish(new Error(`WS error: ${(e as any)?.message ?? 'connect failed (403 or port closed)'}`)));
      ws.addEventListener('message', (e) => this.onMessage(String(e.data)));
      ws.addEventListener('close', () => {
        for (const [, p] of this.pending) p.reject(new Error('CDP socket closed'));
        this.pending.clear();
        finish(new Error('WS closed before open (403 or port closed)'));
      });
      this.ws = ws;
    });
  }

  isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }
  close(): void { this.ws?.close(); }

  async use(targetId: string): Promise<string> {
    const r = await this._call('Target.attachToTarget', { targetId, flatten: true }) as { sessionId: string };
    this.activeSessionId = r.sessionId;
    return r.sessionId;
  }

  setActiveSession(sessionId: string | undefined): void { this.activeSessionId = sessionId; }
  getActiveSession(): string | undefined { return this.activeSessionId; }

  onEvent(fn: (method: string, params: unknown, sessionId?: string) => void): () => void {
    this.eventListeners.push(fn);
    return () => { this.eventListeners = this.eventListeners.filter(x => x !== fn); };
  }

  waitFor<T = unknown>(method: string, predicate?: (params: T) => boolean, timeoutMs = 30_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeoutMs);
      const unsub = this.onEvent((m, params) => {
        if (m !== method) return;
        if (predicate && !predicate(params as T)) return;
        clearTimeout(timer);
        unsub();
        resolve(params as T);
      });
    });
  }

  _call(method: string, params: unknown = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected. Call session.connect(...) first.'));
    }
    const id = this.nextId++;
    const msg: Record<string, unknown> = { id, method, params: params ?? {} };
    if (this.activeSessionId && !isBrowserLevel(method)) {
      msg.sessionId = this.activeSessionId;
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(msg));
    });
  }

  private onMessage(raw: string): void {
    let m: any;
    try { m = JSON.parse(raw); } catch { return; }
    if (typeof m.id === 'number') {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.error) p.reject(new CdpError(m.error.code, m.error.message, m.error.data));
      else p.resolve(m.result);
    } else if (m.method) {
      for (const fn of this.eventListeners) {
        try { fn(m.method, m.params, m.sessionId); } catch { /* ignore */ }
      }
    }
  }
}

export class CdpError extends Error {
  constructor(public code: number, message: string, public data?: unknown) {
    super(`CDP ${code}: ${message}`);
    this.name = 'CdpError';
  }
}

function isBrowserLevel(method: string): boolean {
  return method.startsWith('Browser.') || method.startsWith('Target.');
}

export async function resolveWsUrl(opts: ConnectOptions): Promise<string> {
  if (opts.wsUrl) return opts.wsUrl;
  if (opts.profileDir) {
    const { port, path } = await readDevToolsActivePort(opts.profileDir);
    return `ws://127.0.0.1:${port}${path}`;
  }
  throw new Error('resolveWsUrl needs { wsUrl } or { profileDir }.');
}

async function readDevToolsActivePort(profileDir: string): Promise<{ port: number; path: string }> {
  const deadline = Date.now() + 30_000;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const text = (await Bun.file(`${profileDir}/DevToolsActivePort`).text()).trim();
      const [portStr, path] = text.split('\n');
      const port = Number(portStr);
      if (!Number.isFinite(port)) throw new Error(`malformed port line: ${portStr}`);
      if (!path || !path.startsWith('/devtools/')) {
        throw new Error(`missing/invalid path line: ${JSON.stringify(text)}`);
      }
      return { port, path };
    } catch (e) {
      lastErr = e;
      await Bun.sleep(250);
    }
  }
  throw new Error(`Could not read ${profileDir}/DevToolsActivePort after 30s: ${lastErr}`);
}

export type PageTarget = { targetId: string; title: string; url: string; type: string };
export async function listPageTargets(session: Session): Promise<PageTarget[]> {
  const { targetInfos } = await session.domains.Target.getTargets({});
  return (targetInfos as PageTarget[]).filter(
    t => t.type === 'page' && !t.url.startsWith('chrome://') && !t.url.startsWith('devtools://')
  );
}

export async function detectBrowsers(): Promise<DetectedBrowser[]> {
  const detected: DetectedBrowser[] = [];
  const seenPorts = new Set<number>();

  // Method 1: DevToolsActivePort file scan (standard Chrome)
  for (const { name, profileDir } of getBrowserCandidates()) {
    const parsed = await tryReadDevToolsActivePort(profileDir);
    if (!parsed) continue;
    seenPorts.add(parsed.port);
    detected.push({
      name,
      profileDir,
      port: parsed.port,
      wsPath: parsed.path,
      wsUrl: `ws://127.0.0.1:${parsed.port}${parsed.path}`,
      mtimeMs: parsed.mtimeMs,
    });
  }

  // Method 2: HTTP port scan (Dia, Arc, Opera, Vivaldi — no DevToolsActivePort)
  const ports = [9222, 9223, 9224, 9225];
  const results = await Promise.allSettled(
    ports.filter(p => !seenPorts.has(p)).map(port => probePort(port))
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      detected.push(r.value);
    }
  }

  detected.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return detected;
}

type BrowserCandidate = { name: string; profileDir: string };

function getBrowserCandidates(): BrowserCandidate[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const list: BrowserCandidate[] = [];
  const push = (name: string, profileDir: string) => list.push({ name, profileDir });

  if (process.platform === 'darwin') {
    const base = `${home}/Library/Application Support`;
    push('Google Chrome',          `${base}/Google/Chrome`);
    push('Chromium',               `${base}/Chromium`);
    push('Microsoft Edge',         `${base}/Microsoft Edge`);
    push('Brave',                  `${base}/BraveSoftware/Brave-Browser`);
    push('Arc',                    `${base}/Arc/User Data`);
    push('Dia',                    `${base}/Dia/User Data`);
    push('Vivaldi',                `${base}/Vivaldi`);
    push('Opera',                  `${base}/com.operasoftware.Opera`);
    push('Comet',                  `${base}/Comet`);
    push('Google Chrome Canary',   `${base}/Google/Chrome Canary`);
  } else if (process.platform === 'linux') {
    const cfg = `${home}/.config`;
    push('Google Chrome',          `${cfg}/google-chrome`);
    push('Chromium',               `${cfg}/chromium`);
    push('Microsoft Edge',         `${cfg}/microsoft-edge`);
    push('Brave',                  `${cfg}/BraveSoftware/Brave-Browser`);
    push('Vivaldi',                `${cfg}/vivaldi`);
    push('Opera',                  `${cfg}/opera`);
    push('Google Chrome Canary',   `${cfg}/google-chrome-unstable`);
  } else if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? `${home}\\AppData\\Local`;
    push('Google Chrome',          `${local}\\Google\\Chrome\\User Data`);
    push('Chromium',               `${local}\\Chromium\\User Data`);
    push('Microsoft Edge',         `${local}\\Microsoft\\Edge\\User Data`);
    push('Brave',                  `${local}\\BraveSoftware\\Brave-Browser\\User Data`);
    push('Arc',                    `${local}\\Arc\\User Data`);
    push('Dia',                    `${local}\\Dia\\User Data`);
    push('Vivaldi',                `${local}\\Vivaldi\\User Data`);
    push('Opera',                  `${local}\\Opera Software\\Opera Stable`);
    push('Google Chrome Canary',   `${local}\\Google\\Chrome SxS\\User Data`);
  }
  return list;
}

async function tryReadDevToolsActivePort(
  profileDir: string,
): Promise<{ port: number; path: string; mtimeMs: number } | undefined> {
  try {
    const file = Bun.file(`${profileDir}/DevToolsActivePort`);
    const [text, mtimeMs] = await Promise.all([file.text(), file.lastModified]);
    const [portStr, path] = text.trim().split('\n');
    const port = Number(portStr);
    if (!Number.isFinite(port)) return undefined;
    if (!path || !path.startsWith('/devtools/')) return undefined;
    return { port, path, mtimeMs: mtimeMs as number };
  } catch {
    return undefined;
  }
}

async function probePort(port: number): Promise<DetectedBrowser | null> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(800),
    });
    if (!resp.ok) return null;
    const info = await resp.json();
    return {
      name: cleanBrowserName(info.Browser || `Chromium`),
      profileDir: '',
      port,
      wsPath: info.webSocketDebuggerUrl.replace(/^ws:\/\/[^\/]+/, ''),
      wsUrl: info.webSocketDebuggerUrl,
      mtimeMs: Date.now(),
    };
  } catch {
    return null;
  }
}

async function discoverByPort(port: number): Promise<string> {
  // Method 1: HTTP /json/version (--remote-debugging-port flag)
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const info = await resp.json();
      return info.webSocketDebuggerUrl;
    }
  } catch { /* fall through */ }

  // Method 2: Scan DevToolsActivePort files (Chrome 144+ inspect mode, no HTTP)
  const home = process.env.HOME ?? '';
  const candidates = [
    `${home}/Library/Application Support/Dia/User Data`,
    `${home}/Library/Application Support/Arc/User Data`,
    `${home}/Library/Application Support/Google/Chrome`,
    `${home}/Library/Application Support/Chromium`,
    `${home}/Library/Application Support/Microsoft Edge`,
    `${home}/Library/Application Support/BraveSoftware/Brave-Browser`,
  ];
  for (const dir of candidates) {
    try {
      const file = Bun.file(`${dir}/DevToolsActivePort`);
      const text = await file.text();
      const [p, wsPath] = text.trim().split('\n');
      if (Number(p) === port && wsPath?.startsWith('/devtools/')) {
        return `ws://127.0.0.1:${port}${wsPath}`;
      }
    } catch { /* no file or not matching */ }
  }

  throw new Error(`No browser on port ${port}. Enable CDP from chrome://inspect or start with --remote-debugging-port=${port}`);
}

function cleanBrowserName(raw: string): string {
  return raw.replace(/^Chrome\//, '').replace(/^Chromium\//, '').trim();
}

function buildNoBrowserHelp(): string {
  const home = process.env.HOME ?? '';
  const known = [];
  for (const c of getBrowserCandidates()) {
    known.push(c.name);
  }
  const uniq = [...new Set(known)];
  return [
    `No running browser with remote debugging detected.`,
    ``,
    `How to enable:`,
    `  Chrome/Edge/Brave: open chrome://inspect/#remote-debugging → toggle ON`,
    `  Dia: dia://inspect/#remote-debugging → toggle ON`,
    `  Terminal: <browser> --remote-debugging-port=9222`,
    ``,
    `Or pass options explicitly:`,
    `  session.connect({ port: 9222 })`,
    `  session.connect({ wsUrl: "ws://127.0.0.1:9222/devtools/browser/<id>" })`,
    `  session.connect({ profileDir: "/path/to/profile" })`,
    ``,
    `Browsers scanned: ${uniq.join(', ')}`,
  ].join('\n');
}
