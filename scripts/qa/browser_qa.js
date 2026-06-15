#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const net = require("net");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const APP_DIR = path.join(ROOT, "app");
const ISSUES_DIR = path.join(ROOT, "issues", "qa");
const NPM = "npm";
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const DEFAULT_SCENARIOS = [
  { name: "m3", fixture: "m3", expectKind: null },
  { name: "m4", fixture: "m4", expectKind: null },
  { name: "m6", fixture: "m6", expectKind: null },
];

class ScenarioError extends Error {
  constructor(message, kind, step) {
    super(message);
    this.name = "ScenarioError";
    this.kind = kind;
    this.step = step;
  }
}

function parseArgs(argv) {
  const out = { fixture: null, expectFailure: false, expectKind: "data" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--fixture" && argv[i + 1]) {
      out.fixture = argv[++i];
    } else if (arg === "--expect-failure") {
      out.expectFailure = true;
    } else if (arg === "--expect-kind" && argv[i + 1]) {
      out.expectKind = argv[++i];
    } else if (!arg.startsWith("-") && !out.fixture) {
      out.fixture = arg;
    }
  }
  return out;
}

function npmRun(args, opts = {}) {
  const result = spawnSync(NPM, args, {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env },
    shell: true,
    ...opts,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${NPM} ${args.join(" ")}`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((err) => {
        if (err) reject(err);
        else if (!port) reject(new Error("Failed to reserve a free port."));
        else resolve(port);
      });
    });
  });
}

async function waitForHttp(url, timeoutMs = 90_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError ? lastError.message : "unknown error"}`);
}

function pickEdgePath() {
  for (const candidate of EDGE_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Microsoft Edge was not found on this machine.");
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function killProcessTree(pid) {
  if (!pid) return;
  const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    shell: true,
  });
  if (result.error) {
    try {
      process.kill(pid);
    } catch {
      // ignore
    }
  }
}

async function terminateChild(child, timeoutMs = 2_000) {
  if (!child || child.exitCode !== null) return;
  child.unref?.();
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(timeoutMs),
  ]);
  if (child.exitCode === null && child.pid) {
    killProcessTree(child.pid);
  }
  try {
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.stdin?.destroy();
  } catch {
    // ignore
  }
}

function encodeFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = crypto.randomBytes(4);
  let headerLength = 2;
  if (payload.length >= 126 && payload.length < 65536) headerLength += 2;
  if (payload.length >= 65536) headerLength += 8;
  const out = Buffer.alloc(headerLength + 4 + payload.length);
  out[0] = 0x81; // FIN + text
  let offset = 2;
  if (payload.length < 126) {
    out[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    out[1] = 0x80 | 126;
    out.writeUInt16BE(payload.length, 2);
    offset = 4;
  } else {
    out[1] = 0x80 | 127;
    out.writeBigUInt64BE(BigInt(payload.length), 2);
    offset = 10;
  }
  mask.copy(out, offset);
  for (let i = 0; i < payload.length; i++) {
    out[offset + 4 + i] = payload[i] ^ mask[i % 4];
  }
  return out;
}

function formatExceptionDetails(details) {
  if (!details) return "Runtime exception";
  const parts = [];
  if (details.text) parts.push(details.text);
  if (details.exception?.description) parts.push(details.exception.description);
  if (details.exception?.className) parts.push(`class=${details.exception.className}`);
  if (details.exception?.preview?.properties?.length) {
    const preview = details.exception.preview.properties
      .slice(0, 4)
      .map((property) => `${property.name}=${property.value || property.type || ""}`)
      .join(", ");
    if (preview) parts.push(`preview=${preview}`);
  }
  if (details.stackTrace?.callFrames?.length) {
    const frame = details.stackTrace.callFrames[0];
    if (frame) parts.push(`at ${frame.url || "<anonymous>"}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`);
  }
  return parts.filter(Boolean).join(" | ") || "Runtime exception";
}

function decodeFrames(buffer, onText) {
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let len = second & 0x7f;
    let header = 2;
    if (len === 126) {
      if (offset + 4 > buffer.length) break;
      len = buffer.readUInt16BE(offset + 2);
      header += 2;
    } else if (len === 127) {
      if (offset + 10 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(offset + 2));
      header += 8;
    }
    const maskBytes = masked ? 4 : 0;
    if (offset + header + maskBytes + len > buffer.length) break;
    let payload = buffer.subarray(offset + header + maskBytes, offset + header + maskBytes + len);
    if (masked) {
      const mask = buffer.subarray(offset + header, offset + header + 4);
      const unmasked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ mask[i % 4];
      payload = unmasked;
    }
    if (opcode === 0x1) onText(payload.toString("utf8"));
    if (opcode === 0x8) return { closed: true, bytes: offset + header + maskBytes + len };
    offset += header + maskBytes + len;
  }
  return { closed: false, bytes: offset };
}

class WebSocketClient {
  constructor(url) {
    this.url = new URL(url);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.openPromise = null;
    this.closePromise = null;
    this.onMessage = null;
    this.onClose = null;
  }

  async connect() {
    const port = Number(this.url.port || 80);
    const host = this.url.hostname;
    const key = crypto.randomBytes(16).toString("base64");
    const request =
      `GET ${this.url.pathname}${this.url.search} HTTP/1.1\r\n` +
      `Host: ${host}:${port}\r\n` +
      "Connection: Upgrade\r\n" +
      "Upgrade: websocket\r\n" +
      "Sec-WebSocket-Version: 13\r\n" +
      `Sec-WebSocket-Key: ${key}\r\n\r\n`;

    this.socket = net.createConnection({ host, port });
    await new Promise((resolve, reject) => {
      const onError = (err) => reject(err);
      let handshake = Buffer.alloc(0);
      this.socket.once("error", onError);
      this.socket.once("connect", () => {
        this.socket.write(request);
        const onData = (chunk) => {
          handshake = Buffer.concat([handshake, chunk]);
          const text = handshake.toString("utf8");
          const split = text.indexOf("\r\n\r\n");
          if (split < 0) return;
          this.socket.removeListener("data", onData);
          this.socket.removeListener("error", onError);
          const header = text.slice(0, split);
          if (!header.startsWith("HTTP/1.1 101 ")) {
            reject(new Error(`WebSocket upgrade failed: ${header.split("\r\n")[0]}`));
            return;
          }
          const extra = handshake.subarray(split + 4);
          this.buffer = extra;
          this.socket.on("error", () => {
            // Ignore socket-level resets during browser shutdown.
          });
          this.socket.on("data", (data) => this._handleData(data));
          this.socket.on("close", () => {
            this.onClose?.();
          });
          resolve();
        };
        this.socket.on("data", onData);
      });
    });
  }

  _handleData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    const result = decodeFrames(this.buffer, (text) => this.onMessage?.(text));
    this.buffer = this.buffer.subarray(result.bytes);
  }

  send(text) {
    this.socket.write(encodeFrame(text));
  }

  close() {
    try {
      this.socket?.end();
    } catch {
      // ignore
    }
  }
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = new Map();
    this.ws.onMessage = (text) => this._handleMessage(text);
  }

  _handleMessage(text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.id) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message || "CDP error"));
      else pending.resolve(msg.result);
      return;
    }
    if (msg.method) {
      const handlers = this.events.get(msg.method);
      if (handlers) {
        for (const handler of handlers) handler(msg.params);
      }
    }
  }

  send(method, params = {}) {
    const id = ++this.seq;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, new Set());
    this.events.get(method).add(handler);
    return () => this.events.get(method)?.delete(handler);
  }
}

async function openPage(debugPort, targetUrl) {
  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { cache: "no-store" });
  if (!listRes.ok) throw new Error(`Failed to enumerate targets: HTTP ${listRes.status}`);
  const targets = await listRes.json();
  const target = targets.find((item) => item.type === "page") || targets[0];
  if (!target?.webSocketDebuggerUrl) throw new Error("No debuggable page target was found.");
  const ws = new WebSocketClient(target.webSocketDebuggerUrl);
  await ws.connect();
  const cdp = new CdpSession(ws);
  const runtimeErrors = [];
  const consoleErrors = [];

  cdp.on("Runtime.exceptionThrown", (event) => {
    const msg = formatExceptionDetails(event?.exceptionDetails);
    runtimeErrors.push(msg);
  });
  cdp.on("Log.entryAdded", (event) => {
    const entry = event?.entry;
    if (!entry || entry.level !== "error") return;
    const text = `${entry.text || ""} ${entry.url || ""}`.trim();
    if (!text) return;
    if (text.includes("fonts.googleapis.com") || text.includes("fonts.gstatic.com") || text.includes("favicon.ico")) return;
    consoleErrors.push(text);
  });
  cdp.on("Runtime.consoleAPICalled", (event) => {
    if (event?.type !== "error") return;
    const text = (event.args || [])
      .map((arg) => (typeof arg.value === "string" ? arg.value : ""))
      .join(" ")
      .trim();
    if (text) consoleErrors.push(text);
  });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitFor(cdp, () => evaluateBoolean(cdp, "document.readyState === 'complete'"), 90_000);
  return { cdp, ws, runtimeErrors, consoleErrors };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    const msg = result.exceptionDetails.text || "Evaluation failed";
    throw new Error(msg);
  }
  return result.result?.value;
}

async function evaluateBoolean(cdp, expression) {
  return Boolean(await evaluate(cdp, expression));
}

async function waitFor(cdp, check, timeoutMs, stepName) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      if (await check()) return;
    } catch (err) {
      last = err;
    }
    await sleep(250);
  }
  throw new ScenarioError(`Timed out waiting for ${stepName || "condition"}${last ? `: ${last.message}` : ""}`, "tooling", stepName || "wait");
}

async function exists(cdp, selector) {
  return evaluateBoolean(cdp, `document.querySelector(${JSON.stringify(selector)}) !== null`);
}

async function textContains(cdp, text) {
  const needle = JSON.stringify(text);
  return evaluateBoolean(cdp, `document.body && document.body.innerText.includes(${needle})`);
}

async function click(cdp, selector) {
  const expr = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center" });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`;
  const ok = await evaluateBoolean(cdp, expr);
  if (!ok) throw new ScenarioError(`Missing clickable element: ${selector}`, "app", `click ${selector}`);
}

async function fillInput(cdp, selector, value) {
  const expr = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value") || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    if (desc && desc.set) desc.set.call(el, ${JSON.stringify(value)});
    else el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
  const ok = await evaluateBoolean(cdp, expr);
  if (!ok) throw new ScenarioError(`Missing input: ${selector}`, "app", `fill ${selector}`);
}

async function selectValue(cdp, selector, value) {
  const expr = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
  const ok = await evaluateBoolean(cdp, expr);
  if (!ok) throw new ScenarioError(`Missing select: ${selector}`, "app", `select ${selector}`);
}

async function getInputValue(cdp, selector) {
  return evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    return el ? el.value : null;
  })()`);
}

async function captureScreenshot(cdp, file) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
}

function scenarioUrl(port, fixture) {
  return `http://127.0.0.1:${port}/?qaFixture=${encodeURIComponent(fixture)}&qaMode=mock`;
}

async function runScenario({ name, fixture, expectKind }, ctx) {
  const startedAt = new Date().toISOString();
  const artifactDir = path.join(ISSUES_DIR, ctx.runId, name);
  ensureDir(artifactDir);
  const profileDir = createTempDir(`jp-qa-${name}-`);
  const steps = [];
  const pageUrl = scenarioUrl(ctx.appPort, fixture);
  const page = await openPage(ctx.debugPort, pageUrl);
  const log = (step, status, detail) => steps.push({ step, status, detail, at: new Date().toISOString() });

  async function step(label, kind, fn) {
    log(label, "started");
    try {
      const value = await fn();
      log(label, "passed");
      return value;
    } catch (err) {
      const error = err instanceof ScenarioError ? err : new ScenarioError(err.message || String(err), kind, label);
      log(label, "failed", error.message);
      throw error;
    }
  }

  try {
    if (name === "m3") {
      await step("open m3 analysis", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m3-stock"]'), 90_000, "library item");
        await click(page.cdp, '[data-qa="library-analysis-qa-m3-stock"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="analysis-view"]'), 60_000, "analysis view");
      });

      await step("verify stock provenance", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="stock-provenance"]'), 30_000, "stock provenance card");
        const price = await evaluate(page.cdp, `(() => document.querySelector('[data-qa="stock-field-price"]')?.innerText || '')()`);
        const eps = await evaluate(page.cdp, `(() => document.querySelector('[data-qa="stock-field-eps"]')?.innerText || '')()`);
        const invested = await evaluate(page.cdp, `(() => document.querySelector('[data-qa="stock-field-invested"]')?.innerText || '')()`);
        const roe = await evaluate(page.cdp, `(() => document.querySelector('[data-qa="stock-field-roe"]')?.innerText || '')()`);
        if (!String(price).includes("cited source")) throw new ScenarioError("price row did not render as cited source", "data", "verify stock provenance");
        if (!String(eps).includes("needs confirmation")) throw new ScenarioError("eps row did not remain a candidate", "data", "verify stock provenance");
        if (!String(invested).includes("derived helper")) throw new ScenarioError("invested row did not render as derived helper", "data", "verify stock provenance");
        if (!String(roe).includes("user provided")) throw new ScenarioError("roe row did not render as user provided", "data", "verify stock provenance");
      });

      await step("persist ticker", "app", async () => {
        await fillInput(page.cdp, '[placeholder="Ticker"]', "BBCA-QA");
        await sleep(900);
        await page.cdp.send("Page.reload", { ignoreCache: true });
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m3-stock"]'), 60_000, "analysis item after reload");
        await click(page.cdp, '[data-qa="library-analysis-qa-m3-stock"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[placeholder="Ticker"]'), 30_000, "ticker input");
        const ticker = await getInputValue(page.cdp, '[placeholder="Ticker"]');
        if (ticker !== "BBCA-QA") throw new ScenarioError(`Ticker did not persist: ${ticker}`, "app", "persist ticker");
      });
    } else if (name === "m4") {
      await step("open m4 evidence", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]'), 90_000, "library item");
        await click(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="evidence-locker"]'), 60_000, "evidence locker");
      });

      await step("verify seeded evidence", "app", async () => {
        await waitFor(
          page.cdp,
          () => exists(page.cdp, '[data-qa="evidence-promote-candidate-1"]'),
          30_000,
          "candidate queue",
        );
        await waitFor(page.cdp, () => textContains(page.cdp, "Q3 call note"), 30_000, "seeded evidence row");
      });

      await step("add note evidence", "app", async () => {
        await fillInput(page.cdp, '[data-qa="evidence-note-title"]', "QA note evidence");
        await click(page.cdp, '[data-qa="evidence-add-note"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "QA note evidence"), 30_000, "new note evidence");
        await click(page.cdp, '[data-qa="evidence-save"]');
        await sleep(300);
      });

      await step("promote candidate", "app", async () => {
        await click(page.cdp, '[data-qa="evidence-promote-candidate-1"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "Management commentary"), 30_000, "promoted candidate");
      });

      await step("reload evidence", "app", async () => {
        await sleep(900);
        await page.cdp.send("Page.reload", { ignoreCache: true });
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]'), 60_000, "analysis item after reload");
        await click(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "QA note evidence"), 30_000, "persisted evidence");
        await waitFor(page.cdp, () => textContains(page.cdp, "Management commentary"), 30_000, "persisted promoted candidate");
      });
    } else if (name === "m6") {
      await step("open m6 analysis", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m6-stock"]'), 90_000, "analysis item");
        await click(page.cdp, '[data-qa="library-analysis-qa-m6-stock"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="analysis-decision-ledger"]'), 60_000, "analysis ledger");
      });

      await step("analysis legacy render", "app", async () => {
        const body = await evaluate(page.cdp, "document.body.innerText");
        if (!String(body).includes("Legacy action preserved: APPROVE")) {
          throw new ScenarioError("analysis legacy entry did not render", "data", "analysis legacy render");
        }
        if (!String(body).includes("REVIEW DUE")) {
          throw new ScenarioError("analysis due-review badge missing", "data", "analysis legacy render");
        }
      });

      await step("analysis invalid commit", "app", async () => {
        await click(page.cdp, '[data-qa="analysis-decision-ledger"] [data-qa="decision-commit"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "Rationale is required."), 10_000, "analysis validation");
      });

      await step("analysis valid commit", "app", async () => {
        await fillInput(page.cdp, '#decision-rationale', "QA analysis decision");
        await fillInput(page.cdp, '#decision-trigger-date', "2026-06-30");
        await fillInput(page.cdp, '#decision-trigger-note', "Re-check after earnings");
        await click(page.cdp, '[data-qa="analysis-decision-ledger"] [data-qa="decision-commit"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "QA analysis decision"), 30_000, "analysis decision history");
      });

      await step("analysis review", "app", async () => {
        await click(page.cdp, '[data-qa="analysis-decision-ledger"] .decision-entry.is-due [data-qa="decision-review-open"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="analysis-decision-ledger"] [data-qa="decision-review-save"]'), 10_000, "analysis review form");
        await fillInput(page.cdp, '[data-qa="analysis-decision-ledger"] textarea[placeholder="What actually happened?"]', "Review captured in QA.");
        await click(page.cdp, '[data-qa="analysis-decision-ledger"] [data-qa="decision-review-save"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "REVIEWED"), 30_000, "analysis review saved");
      });

      await step("open m6 portfolio", "app", async () => {
        await click(page.cdp, '[data-qa="library-portfolio-p"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="portfolio-decision-ledger"]'), 60_000, "portfolio ledger");
      });

      await step("portfolio legacy render", "app", async () => {
        const body = await evaluate(page.cdp, "document.body.innerText");
        if (!String(body).includes("Legacy action preserved: HOLD")) {
          throw new ScenarioError("portfolio legacy entry did not render", "data", "portfolio legacy render");
        }
        if (!String(body).includes("REVIEW DUE")) {
          throw new ScenarioError("portfolio due-review badge missing", "data", "portfolio legacy render");
        }
      });

      await step("portfolio invalid commit", "app", async () => {
        await click(page.cdp, '[data-qa="portfolio-decision-ledger"] [data-qa="decision-commit"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "Rationale is required."), 10_000, "portfolio validation");
      });

      await step("portfolio valid commit", "app", async () => {
        await fillInput(page.cdp, '#decision-rationale', "QA portfolio decision");
        await fillInput(page.cdp, '#decision-trigger-date', "2026-06-30");
        await fillInput(page.cdp, '#decision-trigger-note', "Review portfolio concentration");
        await click(page.cdp, '[data-qa="portfolio-decision-ledger"] [data-qa="decision-commit"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "QA portfolio decision"), 30_000, "portfolio decision history");
      });

      await step("portfolio review", "app", async () => {
        await click(page.cdp, '[data-qa="portfolio-decision-ledger"] .decision-entry.is-due [data-qa="decision-review-open"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="portfolio-decision-ledger"] [data-qa="decision-review-save"]'), 10_000, "portfolio review form");
        await fillInput(page.cdp, '[data-qa="portfolio-decision-ledger"] textarea[placeholder="What actually happened?"]', "Portfolio review captured in QA.");
        await click(page.cdp, '[data-qa="portfolio-decision-ledger"] [data-qa="decision-review-save"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "REVIEWED"), 30_000, "portfolio review saved");
      });
    } else if (name === "broken-m4") {
      await step("open broken evidence fixture", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]'), 90_000, "library item");
        await click(page.cdp, '[data-qa="library-analysis-qa-m4-evidence"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="evidence-locker"]'), 60_000, "evidence locker");
      });

      await step("expect candidate queue", "data", async () => {
        if (!(await exists(page.cdp, '[data-qa="evidence-promote-candidate-1"]'))) {
          throw new ScenarioError("candidate queue is intentionally missing in the broken fixture", "data", "expect candidate queue");
        }
      });
    } else {
      throw new Error(`Unknown scenario: ${name}`);
    }

    if (page.runtimeErrors.length) {
      throw new ScenarioError(page.runtimeErrors.join(" | "), "app", "runtime errors");
    }

    const screenshot = path.join(artifactDir, "final.png");
    await captureScreenshot(page.cdp, screenshot);
    const finishedAt = new Date().toISOString();
    return {
      name,
      fixture,
      status: "passed",
      classification: null,
      steps,
      screenshot,
      startedAt,
      finishedAt,
      consoleErrors: page.consoleErrors,
      runtimeErrors: page.runtimeErrors,
      expectedFailure: Boolean(expectKind),
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const kind = error instanceof ScenarioError ? error.kind : "tooling";
    const failedStep = error instanceof ScenarioError ? error.step : "scenario";
    const screenshot = path.join(artifactDir, "failure.png");
    try {
      await captureScreenshot(page.cdp, screenshot);
    } catch {
      // ignore
    }
    return {
      name,
      fixture,
      status: "failed",
      classification: kind,
      failedStep,
      error: error instanceof Error ? error.message : String(error),
      steps,
      screenshot,
      startedAt,
      finishedAt: failedAt,
      consoleErrors: page.consoleErrors,
      runtimeErrors: page.runtimeErrors,
      expectedFailure: Boolean(expectKind),
    };
  } finally {
    page.ws.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const resultDir = path.join(ISSUES_DIR, runId);
  ensureDir(resultDir);
  const distDir = `.next-qa-${runId}`;
  const tsconfigPath = path.join(APP_DIR, "tsconfig.json");
  const tsconfigSnapshot = fs.readFileSync(tsconfigPath, "utf8");
  const appPort = await getFreePort();
  const debugPort = await getFreePort();

  cleanupDir(path.join(APP_DIR, distDir));
  npmRun(["run", "build", "--", "--webpack"], { env: { ...process.env, NEXT_DIST_DIR: distDir } });
  const appUrl = `http://127.0.0.1:${appPort}`;
  const edgePath = pickEdgePath();
  const profileBase = createTempDir("jp-qa-profile-");
  const server = spawn(NPM, ["run", "start", "--", "-p", String(appPort), "-H", "127.0.0.1"], {
    cwd: APP_DIR,
    stdio: "pipe",
    env: { ...process.env, NEXT_DIST_DIR: distDir },
    shell: true,
  });
  const browser = spawn(edgePath, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + debugPort, `--user-data-dir=${profileBase}`, "about:blank"], {
    stdio: "ignore",
    windowsHide: true,
  });
  server.unref();
  browser.unref();

  const serverLogs = [];
  server.stdout.on("data", (chunk) => serverLogs.push(chunk.toString("utf8")));
  server.stderr.on("data", (chunk) => serverLogs.push(chunk.toString("utf8")));

  try {
    await waitForHttp(appUrl, 120_000);
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 120_000);

    const scenarios = args.fixture
      ? [{ name: args.fixture, fixture: args.fixture, expectKind: args.expectFailure ? args.expectKind : null }]
      : DEFAULT_SCENARIOS;

    const results = [];
    for (const scenario of scenarios) {
      const result = await runScenario(scenario, { runId, appPort, debugPort });
      results.push(result);
      if (result.status === "failed" && !args.expectFailure) break;
      if (args.expectFailure) break;
    }

    const failed = results.find((item) => item.status === "failed");
    const report = {
      runId,
      appUrl,
      appPort,
      debugPort,
      startedAt: new Date().toISOString(),
      results,
      serverLogs,
    };
    writeJson(path.join(resultDir, "report.json"), report);

    if (args.expectFailure) {
      if (!failed) {
        throw new Error("The intentionally broken fixture did not fail.");
      }
      if (failed.classification !== args.expectKind) {
        throw new Error(`Broken fixture failed as ${failed.classification}, expected ${args.expectKind}.`);
      }
      console.log(`QA expected failure recorded as ${failed.classification} at ${failed.failedStep}.`);
      return;
    }

    if (failed) {
      throw new Error(`QA failed in ${failed.name} at ${failed.failedStep}: ${failed.error}`);
    }

    console.log(`QA passed for ${results.length} scenario(s). Report: ${path.join(resultDir, "report.json")}`);
  } finally {
    await terminateChild(server);
    await terminateChild(browser);
    try {
      fs.writeFileSync(tsconfigPath, tsconfigSnapshot, "utf8");
    } catch {
      // ignore
    }
    cleanupDir(path.join(APP_DIR, distDir));
    cleanupDir(profileBase);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
