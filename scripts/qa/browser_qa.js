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
const NODE = process.execPath;
const NEXT_BIN = path.join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const DEFAULT_SCENARIOS = [
  { name: "m1", fixture: "m1", expectKind: null },
  { name: "m2", fixture: "m2", expectKind: null },
  { name: "m3", fixture: "m3", expectKind: null },
  { name: "m4", fixture: "m4", expectKind: null },
  { name: "m5", fixture: "m5", expectKind: null },
  { name: "m6", fixture: "m6", expectKind: null },
  { name: "m7", fixture: "m7", expectKind: null },
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

function nextRun(args, opts = {}) {
  const result = spawnSync(NODE, [NEXT_BIN, ...args], {
    cwd: APP_DIR,
    stdio: "inherit",
    env: { ...process.env },
    ...opts,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${NODE} ${NEXT_BIN} ${args.join(" ")}`);
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

function createProcessTelemetry(name, child, extra = {}) {
  const telemetry = {
    name,
    pid: child?.pid ?? null,
    startedAt: new Date().toISOString(),
    exitCode: null,
    exitSignal: null,
    closeCode: null,
    closeSignal: null,
    stdout: [],
    stderr: [],
    events: [],
    ...extra,
  };
  if (!child) return telemetry;
  child.stdout?.on("data", (chunk) => telemetry.stdout.push(chunk.toString("utf8")));
  child.stderr?.on("data", (chunk) => telemetry.stderr.push(chunk.toString("utf8")));
  child.on("exit", (code, signal) => {
    telemetry.exitCode = code;
    telemetry.exitSignal = signal;
    telemetry.events.push({ event: "exit", at: new Date().toISOString(), code, signal });
  });
  child.on("close", (code, signal) => {
    telemetry.closeCode = code;
    telemetry.closeSignal = signal;
    telemetry.events.push({ event: "close", at: new Date().toISOString(), code, signal });
  });
  child.on("error", (error) => {
    telemetry.events.push({ event: "error", at: new Date().toISOString(), message: error.message });
  });
  return telemetry;
}

function createHarnessFailureResult({ name, fixture, step, error, startedAt, expectedFailure }) {
  return {
    name,
    fixture,
    status: "failed",
    classification: "tooling",
    failedStep: step,
    error: error instanceof Error ? error.message : String(error),
    steps: [],
    startedAt,
    finishedAt: new Date().toISOString(),
    consoleErrors: [],
    runtimeErrors: [],
    expectedFailure,
  };
}

function buildRunReport({
  runId,
  args,
  appUrl,
  appPort,
  debugPort,
  startedAt,
  results,
  serverTelemetry,
  browserTelemetry,
}) {
  return {
    runId,
    appUrl,
    appPort,
    debugPort,
    startedAt,
    finishedAt: new Date().toISOString(),
    requestedFixture: args.fixture,
    expectFailure: args.expectFailure,
    results,
    server: serverTelemetry,
    browser: browserTelemetry,
  };
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
  let target = null;
  try {
    const newRes = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(targetUrl)}`, {
      method: "PUT",
      cache: "no-store",
    });
    if (newRes.ok) {
      target = await newRes.json();
    }
  } catch {
    // Older Edge builds may not support /json/new reliably; fall back to the
    // existing page target below.
  }
  if (!target) {
    const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { cache: "no-store" });
    if (!listRes.ok) throw new Error(`Failed to enumerate targets: HTTP ${listRes.status}`);
    const targets = await listRes.json();
    target = targets.find((item) => item.type === "page") || targets[0];
  }
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
  await waitFor(cdp, () => evaluateBoolean(cdp, "document.readyState === 'complete'"), 90_000);
  return { cdp, ws, runtimeErrors, consoleErrors };
}

async function openPageWithRetry(debugPort, targetUrl, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (attempt > 1) await sleep(500 * attempt);
      return await openPage(debugPort, targetUrl);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Failed to attach to the browser page.");
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

async function clickByText(cdp, selector, text) {
  const expr = `(() => {
    const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const match = nodes.find((node) => (node.textContent || "").includes(${JSON.stringify(text)}));
    if (!match) return false;
    match.scrollIntoView({ block: "center", inline: "center" });
    match.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`;
  const ok = await evaluateBoolean(cdp, expr);
  if (!ok) throw new ScenarioError(`Missing clickable text "${text}" in ${selector}`, "app", `click text ${text}`);
}

async function fillInput(cdp, selector, value) {
  const expr = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const inputDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const textAreaDesc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    const desc =
      el instanceof HTMLTextAreaElement
        ? textAreaDesc
        : el instanceof HTMLInputElement
          ? inputDesc
          : null;
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
  const page = await openPageWithRetry(ctx.debugPort, pageUrl);
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
    if (name === "m1") {
      await step("open m1 thesis memory and review state", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m1-thesis"]'), 90_000, "library item");
        await click(page.cdp, '[data-qa="library-analysis-qa-m1-thesis"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="review-panel"]'), 30_000, "review panel");
        const body = String(await evaluate(page.cdp, "document.body.innerText"));
        if (!body.includes("Confirmed thesis memory should render")) throw new ScenarioError("thesis summary missing", "app", "m1 thesis memory");
        if (!body.includes("Margins stay resilient")) throw new ScenarioError("assumption missing", "app", "m1 thesis memory");
        if (!body.includes("Cost inflation breaks")) throw new ScenarioError("breaker missing", "app", "m1 thesis memory");
        const status = String(await evaluate(page.cdp, "document.querySelector('[data-qa=\"review-status\"]')?.textContent || ''"));
        if (!status.includes("Overdue")) throw new ScenarioError(`review status did not show overdue state: ${status}`, "app", "m1 review state");
      });

      await step("edit event-driven review state and persist after reload", "app", async () => {
        const today = new Date().toISOString().slice(0, 10);
        await selectValue(page.cdp, '[data-qa="review-cadence"]', "event_driven");
        await fillInput(page.cdp, '[data-qa="review-next-due"]', "2026-07-20");
        await fillInput(page.cdp, '[data-qa="review-last-reviewed"]', "2026-06-10");
        await click(page.cdp, '[data-qa="review-mark-reviewed"]');
        await sleep(900);
        let cadence = await getInputValue(page.cdp, '[data-qa="review-cadence"]');
        let due = await getInputValue(page.cdp, '[data-qa="review-next-due"]');
        let reviewed = await getInputValue(page.cdp, '[data-qa="review-last-reviewed"]');
        if (cadence !== "event_driven") throw new ScenarioError(`Review cadence did not update: ${cadence}`, "app", "m1 review edit");
        if (due !== "2026-07-20") throw new ScenarioError(`Event-driven due date should stay manual: ${due}`, "app", "m1 review edit");
        if (reviewed !== today) throw new ScenarioError(`Reviewed date did not update to today: ${reviewed}`, "app", "m1 review edit");

        await page.cdp.send("Page.reload", { ignoreCache: true });
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-analysis-qa-m1-thesis"]'), 60_000, "analysis item after reload");
        await click(page.cdp, '[data-qa="library-analysis-qa-m1-thesis"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="review-panel"]'), 30_000, "review panel after reload");
        cadence = await getInputValue(page.cdp, '[data-qa="review-cadence"]');
        due = await getInputValue(page.cdp, '[data-qa="review-next-due"]');
        reviewed = await getInputValue(page.cdp, '[data-qa="review-last-reviewed"]');
        const body = String(await evaluate(page.cdp, "document.body.innerText"));
        if (cadence !== "event_driven") throw new ScenarioError(`Review cadence did not persist: ${cadence}`, "app", "m1 reload");
        if (due !== "2026-07-20") throw new ScenarioError(`Review due date did not persist: ${due}`, "app", "m1 reload");
        if (reviewed !== today) throw new ScenarioError(`Reviewed date did not persist: ${reviewed}`, "app", "m1 reload");
        if (!body.includes("Event-driven dates stay manual.")) throw new ScenarioError("event-driven helper text missing", "app", "m1 reload");
        if (!body.includes("Confirmed thesis memory should render")) throw new ScenarioError("thesis summary missing after reload", "app", "m1 reload");
      });
    } else if (name === "m2") {
      await step("create and persist real estate manual asset", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-new-manual"]'), 90_000, "manual entrypoint");
        await click(page.cdp, '[data-qa="agenda-new-manual"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-template-real_estate"]'), 30_000, "manual dialog");
        await click(page.cdp, '[data-qa="manual-template-real_estate"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-asset-panel"]'), 30_000, "manual asset panel");
        await fillInput(page.cdp, ".tp-title", "QA Manual Real Estate");
        await fillInput(page.cdp, '[data-qa="manual-asset-name"]', "Cikarang Warehouse");
        await fillInput(page.cdp, 'textarea[placeholder="Why this asset matters, what must be true, and what could break."]', "Warehouse roll-up with repricing optionality.");
        await fillInput(page.cdp, '[data-qa="manual-valuation-amount"]', "125000000000");
        await fillInput(page.cdp, '[data-qa="manual-valuation-date"]', "2026-06-01");
        await fillInput(page.cdp, '[data-qa="manual-valuation-source"]', "Sponsor mark");
        await fillInput(page.cdp, '[data-qa="manual-pricing-freshness"]', "Quarterly appraisal");
        await fillInput(page.cdp, '[data-qa="manual-liquidity"]', "Illiquid");
        await fillInput(page.cdp, '[data-qa="manual-expected-duration"]', "3-5 years");
        await fillInput(page.cdp, '[data-qa="manual-portfolio-role"]', "Yield compounder");
        await fillInput(page.cdp, '[data-qa="manual-sizing-intent"]', "Pilot position");
        await fillInput(page.cdp, '[data-qa="manual-macro-dependencies"]', "Rates\nIndustrial demand");
        await fillInput(page.cdp, '[data-qa="manual-risk-note-real_estate_vacancy_tenant"]', "Tenant rollover is concentrated in 2027.");
        await selectValue(page.cdp, '[data-qa="review-cadence"]', "monthly");
        await fillInput(page.cdp, '[data-qa="review-next-due"]', "2026-07-15");
        await fillInput(page.cdp, '[data-qa="evidence-note-title"]', "Broker tour note");
        await click(page.cdp, '[data-qa="evidence-add-note"]');
        await waitFor(page.cdp, () => textContains(page.cdp, "Broker tour note"), 30_000, "manual evidence note");
        await sleep(900);
        await page.cdp.send("Page.reload", { ignoreCache: true });
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library"]'), 60_000, "library after reload");
        await clickByText(page.cdp, '[data-qa^="library-analysis-"]', "QA Manual Real Estate");
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-asset-panel"]'), 30_000, "manual panel after reload");
        const title = await getInputValue(page.cdp, ".tp-title");
        const assetName = await getInputValue(page.cdp, '[data-qa="manual-asset-name"]');
        const valuationSource = await getInputValue(page.cdp, '[data-qa="manual-valuation-source"]');
        const cadence = await getInputValue(page.cdp, '[data-qa="review-cadence"]');
        const due = await getInputValue(page.cdp, '[data-qa="review-next-due"]');
        if (title !== "QA Manual Real Estate") throw new ScenarioError(`Manual title did not persist: ${title}`, "app", "real estate reload");
        if (assetName !== "Cikarang Warehouse") throw new ScenarioError(`Manual asset name did not persist: ${assetName}`, "app", "real estate reload");
        if (valuationSource !== "Sponsor mark") throw new ScenarioError(`Manual valuation source did not persist: ${valuationSource}`, "app", "real estate reload");
        if (cadence !== "monthly") throw new ScenarioError(`Review cadence did not persist: ${cadence}`, "app", "real estate reload");
        if (due !== "2026-07-15") throw new ScenarioError(`Review due date did not persist: ${due}`, "app", "real estate reload");
        const body = await evaluate(page.cdp, "document.body.innerText");
        if (!String(body).includes("MANUAL ASSET")) throw new ScenarioError("manual state label missing", "app", "real estate reload");
        if (String(body).includes("⚡ RUN AI")) throw new ScenarioError("engine-only run action rendered for manual asset", "app", "real estate reload");
      });

      await step("create macro, startup, and conventional manual assets", "app", async () => {
        await click(page.cdp, '[data-qa="library-agenda"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-new-manual"]'), 30_000, "agenda manual action");
        await click(page.cdp, '[data-qa="agenda-new-manual"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-template-macro_view"]'), 30_000, "macro dialog");
        await click(page.cdp, '[data-qa="manual-template-macro_view"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-asset-panel"]'), 30_000, "macro manual panel");
        await fillInput(page.cdp, ".tp-title", "QA Manual Macro View");
        await fillInput(page.cdp, '[data-qa="manual-asset-name"]', "Rates Regime");
        await fillInput(page.cdp, '[data-qa="manual-risk-note-macro_rates_fx"]', "Higher-for-longer rates pressure duration assets.");
        await sleep(700);

        await click(page.cdp, '[data-qa="library-agenda"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-new-manual"]'), 30_000, "agenda manual action");
        await click(page.cdp, '[data-qa="agenda-new-manual"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-template-startup"]'), 30_000, "startup dialog");
        await click(page.cdp, '[data-qa="manual-template-startup"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-asset-panel"]'), 30_000, "startup manual panel");
        await fillInput(page.cdp, ".tp-title", "QA Manual Startup");
        await fillInput(page.cdp, '[data-qa="manual-asset-name"]', "Fintech SeedCo");
        await fillInput(page.cdp, '[data-qa="manual-risk-note-startup_dilution_funding"]', "Next round likely comes at flat terms.");
        await sleep(700);

        await click(page.cdp, '[data-qa="library-agenda"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-new-manual"]'), 30_000, "agenda manual action");
        await click(page.cdp, '[data-qa="agenda-new-manual"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-template-conventional_business"]'), 30_000, "conventional dialog");
        await click(page.cdp, '[data-qa="manual-template-conventional_business"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="manual-asset-panel"]'), 30_000, "conventional manual panel");
        await fillInput(page.cdp, ".tp-title", "QA Manual Conventional");
        await fillInput(page.cdp, '[data-qa="manual-asset-name"]', "Regional Distributor");
        await fillInput(page.cdp, '[data-qa="manual-risk-note-balance_sheet_burn"]', "Working-capital swings remain underwritten manually.");
        const body = await evaluate(page.cdp, "document.body.innerText");
        if (!String(body).includes("MANUAL ASSET")) throw new ScenarioError("startup/conventional path did not stay manual", "app", "manual creation variants");
      });

      await step("manual assets excluded from portfolio composition picker", "app", async () => {
        await click(page.cdp, '[data-qa="library-agenda"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-new-portfolio"]'), 30_000, "agenda portfolio action");
        await click(page.cdp, '[data-qa="agenda-new-portfolio"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="portfolio-view"]'), 30_000, "portfolio view");
        const optionText = await evaluate(page.cdp, `(() => {
          const select = document.querySelector('.tp-add-holding select');
          return select ? Array.from(select.options).map((option) => option.textContent || "").join(" | ") : "";
        })()`);
        if (!String(optionText).includes("No more analyses to add")) {
          throw new ScenarioError(`Manual assets leaked into the portfolio picker: ${optionText}`, "app", "portfolio picker exclusion");
        }
      });
    } else if (name === "m3") {
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
    } else if (name === "m5") {
      await step("agenda opens as the default home", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-view"]'), 90_000, "agenda home");
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-agenda"]'), 30_000, "agenda sidebar entry");
      });

      await step("agenda ranks overdue work above softer overlap signals", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-row-analysis-qa-m5-stale"]'), 30_000, "stale row");
        const titles = await evaluate(page.cdp, `Array.from(document.querySelectorAll('.agenda-row-title')).map((node) => node.textContent || "")`);
        if (!Array.isArray(titles) || titles[0] !== "QA M5 Stale Contradiction") {
          throw new ScenarioError(`Agenda ranking unexpected: ${JSON.stringify(titles)}`, "app", "agenda ranking");
        }
        if (titles.includes("QA M5 Quiet Name")) {
          throw new ScenarioError("quiet name should not surface in the ranked queue", "data", "agenda ranking");
        }
      });

      await step("agenda shows plain-language contradiction and drift reasons", "app", async () => {
        const body = await evaluate(page.cdp, "document.body.innerText");
        if (!String(body).includes("contradictory evidence item")) {
          throw new ScenarioError("contradiction reason copy missing", "app", "agenda reasons");
        }
        if (!String(body).includes("Valuation stance drifted from UNDERVALUED to FAIR")) {
          throw new ScenarioError("valuation drift reason copy missing", "app", "agenda reasons");
        }
        if (String(body).includes("news alert") || String(body).includes("price alert")) {
          throw new ScenarioError("generic alert copy leaked into Agenda", "app", "agenda reasons");
        }
      });

      await step("contradictory evidence filter narrows the queue", "app", async () => {
        await click(page.cdp, '[data-qa="agenda-filter-contradictory_evidence"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-row-analysis-qa-m5-stale"]'), 10_000, "contradiction filter row");
        const rowCount = await evaluate(page.cdp, "document.querySelectorAll('.agenda-row').length");
        if (rowCount !== 1) throw new ScenarioError(`Contradiction filter returned ${rowCount} rows`, "app", "contradiction filter");
      });

      await step("agenda row opens the analysis detail view", "app", async () => {
        await click(page.cdp, '[data-qa="agenda-row-analysis-qa-m5-stale"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="analysis-view"]'), 30_000, "analysis detail");
        const title = await getInputValue(page.cdp, ".tp-title");
        if (title !== "QA M5 Stale Contradiction") {
          throw new ScenarioError(`Agenda row opened the wrong analysis: ${title}`, "app", "analysis open");
        }
      });

      await step("sidebar agenda entry returns to the queue", "app", async () => {
        await click(page.cdp, '[data-qa="library-agenda"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-view"]'), 30_000, "agenda return");
      });

      await step("due-now filter includes the overdue portfolio follow-up", "app", async () => {
        await click(page.cdp, '[data-qa="agenda-filter-due_now"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-row-portfolio-qa-m5-portfolio"]'), 10_000, "portfolio due row");
      });

      await step("agenda portfolio row opens the portfolio detail view", "app", async () => {
        await click(page.cdp, '[data-qa="agenda-row-portfolio-qa-m5-portfolio"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="portfolio-view"]'), 30_000, "portfolio detail");
        const title = await getInputValue(page.cdp, ".tp-title");
        if (title !== "QA M5 Portfolio Follow-Up") {
          throw new ScenarioError(`Agenda row opened the wrong portfolio: ${title}`, "app", "portfolio open");
        }
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
    } else if (name === "m7") {
      await step("agenda exposes investigate idea and triage entry", "app", async () => {
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-view"]'), 90_000, "agenda home");
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="agenda-investigate-idea"]'), 30_000, "investigate idea action");
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="library-triage"]'), 30_000, "triage sidebar entry");
      });

      await step("investigate idea opens triage without creating a library record", "app", async () => {
        const beforeCount = Number(await evaluate(page.cdp, "document.querySelectorAll('[data-qa^=\"library-analysis-\"]').length"));
        await click(page.cdp, '[data-qa="agenda-investigate-idea"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="idea-triage-view"]'), 30_000, "idea triage");
        const afterCount = Number(await evaluate(page.cdp, "document.querySelectorAll('[data-qa^=\"library-analysis-\"]').length"));
        if (beforeCount !== 0 || afterCount !== 0) {
          throw new ScenarioError(`Triage should not create Library records: before=${beforeCount} after=${afterCount}`, "app", "triage entry");
        }
      });

      await step("casual text returns no candidates and no saved record", "app", async () => {
        await fillInput(page.cdp, '[data-qa="triage-prompt"]', "hi there");
        await click(page.cdp, '[data-qa="triage-run"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="triage-result"]'), 30_000, "triage result");
        const body = String(await evaluate(page.cdp, "document.body.innerText"));
        const libraryCount = Number(await evaluate(page.cdp, "document.querySelectorAll('[data-qa^=\"library-analysis-\"]').length"));
        if (!body.includes("No case file opened")) throw new ScenarioError("casual triage response missing non-persistent message", "app", "casual triage");
        if (await exists(page.cdp, '[data-qa="triage-candidates"]')) throw new ScenarioError("casual triage should not render candidates", "app", "casual triage");
        if (libraryCount !== 0) throw new ScenarioError(`casual triage created ${libraryCount} library records`, "app", "casual triage");
      });

      await step("Indonesian stock screen returns candidates without persistence", "app", async () => {
        await fillInput(page.cdp, '[data-qa="triage-prompt"]', "any Indonesian stocks worth digging into?");
        await click(page.cdp, '[data-qa="triage-run"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="triage-candidate-idx-bbca"]'), 30_000, "bbca candidate");
        const body = String(await evaluate(page.cdp, "document.body.innerText"));
        const libraryCount = Number(await evaluate(page.cdp, "document.querySelectorAll('[data-qa^=\"library-analysis-\"]').length"));
        if (!body.includes("not buy/sell recommendations")) throw new ScenarioError("triage framing copy missing", "app", "broad triage");
        if (libraryCount !== 0) throw new ScenarioError(`broad triage created ${libraryCount} library records`, "app", "broad triage");
      });

      await step("add to watchlist creates a saved draft", "app", async () => {
        await click(page.cdp, '[data-qa="triage-watch-idx-bbca"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa^="library-analysis-"]'), 30_000, "saved watchlist draft");
        const titles = await evaluate(page.cdp, `Array.from(document.querySelectorAll('[data-qa^="library-analysis-"] .library-item-title')).map((node) => node.textContent || "")`);
        if (!Array.isArray(titles) || !titles.includes("BBCA thesis case")) {
          throw new ScenarioError(`watchlist draft missing from Library: ${JSON.stringify(titles)}`, "app", "watchlist save");
        }
      });

      await step("direct asset prompt starts a case explicitly", "app", async () => {
        await fillInput(page.cdp, '[data-qa="triage-prompt"]', "analyze TLKM");
        await click(page.cdp, '[data-qa="triage-run"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="triage-candidate-direct-tlkm"]'), 30_000, "direct asset candidate");
        await click(page.cdp, '[data-qa="triage-start-direct-tlkm"]');
        await waitFor(page.cdp, () => exists(page.cdp, '[data-qa="analysis-view"]'), 30_000, "case file view");
        const title = await getInputValue(page.cdp, ".tp-title");
        const body = String(await evaluate(page.cdp, "document.body.innerText"));
        if (title !== "TLKM thesis case") throw new ScenarioError(`unexpected case title: ${title}`, "app", "start case");
        if (!body.includes("DRAFT THESIS")) throw new ScenarioError("draft thesis stage label missing", "app", "start case");
        if (!body.includes("Build the case file")) throw new ScenarioError("case file draft copy missing", "app", "start case");
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
  const startedAt = new Date().toISOString();
  const resultDir = path.join(ISSUES_DIR, runId);
  const reportPath = path.join(resultDir, "report.json");
  ensureDir(resultDir);
  const distDir = `.next-qa-${runId}`;
  const tsconfigPath = path.join(APP_DIR, "tsconfig.json");
  const tsconfigSnapshot = fs.readFileSync(tsconfigPath, "utf8");
  const appPort = await getFreePort();
  const debugPort = await getFreePort();

  cleanupDir(path.join(APP_DIR, distDir));
  nextRun(["build", "--webpack"], { env: { ...process.env, NEXT_DIST_DIR: distDir } });
  const appUrl = `http://127.0.0.1:${appPort}`;
  const edgePath = pickEdgePath();
  const profileBase = createTempDir("jp-qa-profile-");
  const browserArgs = [
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=" + debugPort,
    `--user-data-dir=${profileBase}`,
    "about:blank",
  ];
  const server = spawn(NODE, [NEXT_BIN, "start", "-p", String(appPort), "-H", "127.0.0.1"], {
    cwd: APP_DIR,
    stdio: "pipe",
    env: { ...process.env, NEXT_DIST_DIR: distDir },
  });
  const browser = spawn(edgePath, browserArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.unref();
  browser.unref();
  const serverTelemetry = createProcessTelemetry("next-start", server, {
    command: NODE,
    args: [NEXT_BIN, "start", "-p", String(appPort), "-H", "127.0.0.1"],
  });
  const browserTelemetry = createProcessTelemetry("edge", browser, {
    path: edgePath,
    debugPort,
    userDataDir: profileBase,
    args: browserArgs,
  });
  const scenarios = args.fixture
    ? [{ name: args.fixture, fixture: args.fixture, expectKind: args.expectFailure ? args.expectKind : null }]
    : DEFAULT_SCENARIOS;
  let results = [];
  let finalError = null;
  let summaryMessage = null;

  try {
    try {
      await waitForHttp(appUrl, 120_000);
    } catch (error) {
      results = [
        createHarnessFailureResult({
          name: scenarios[0]?.name || "startup",
          fixture: scenarios[0]?.fixture || null,
          step: "app startup",
          error,
          startedAt,
          expectedFailure: Boolean(args.expectFailure),
        }),
      ];
      throw error;
    }

    try {
      await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 120_000);
    } catch (error) {
      results = [
        createHarnessFailureResult({
          name: scenarios[0]?.name || "startup",
          fixture: scenarios[0]?.fixture || null,
          step: "browser startup",
          error,
          startedAt,
          expectedFailure: Boolean(args.expectFailure),
        }),
      ];
      throw error;
    }

    for (const scenario of scenarios) {
      const result = await runScenario(scenario, { runId, appPort, debugPort });
      results.push(result);
      if (result.status === "failed" && !args.expectFailure) break;
      if (args.expectFailure) break;
    }

    const failed = results.find((item) => item.status === "failed");

    if (args.expectFailure) {
      if (!failed) {
        throw new Error("The intentionally broken fixture did not fail.");
      }
      if (failed.classification !== args.expectKind) {
        throw new Error(`Broken fixture failed as ${failed.classification}, expected ${args.expectKind}.`);
      }
      summaryMessage = `QA expected failure recorded as ${failed.classification} at ${failed.failedStep}.`;
      return;
    }

    if (failed) {
      throw new Error(`QA failed in ${failed.name} at ${failed.failedStep}: ${failed.error}`);
    }

    summaryMessage = `QA passed for ${results.length} scenario(s). Report: ${path.join(resultDir, "report.json")}`;
  } catch (error) {
    finalError = error;
    if (!results.length) {
      results = [
        createHarnessFailureResult({
          name: scenarios[0]?.name || "startup",
          fixture: scenarios[0]?.fixture || null,
          step: "harness",
          error,
          startedAt,
          expectedFailure: Boolean(args.expectFailure),
        }),
      ];
    }
  } finally {
    await terminateChild(server);
    await terminateChild(browser);
    writeJson(
      reportPath,
      buildRunReport({
        runId,
        args,
        appUrl,
        appPort,
        debugPort,
        startedAt,
        results,
        serverTelemetry,
        browserTelemetry,
      }),
    );
    try {
      fs.writeFileSync(tsconfigPath, tsconfigSnapshot, "utf8");
    } catch {
      // ignore
    }
    cleanupDir(path.join(APP_DIR, distDir));
    cleanupDir(profileBase);
  }

  if (finalError) throw finalError;
  if (summaryMessage) console.log(summaryMessage);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
