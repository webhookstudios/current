#!/usr/bin/env node
// Current's connector for Claude's apps: an MCP server on stdin/stdout (newline-delimited JSON-RPC)
// that passes each tool call to the running Current over a local socket that only this user can open.
// Plain Node, no packages, so it runs from Claude's desktop app, from Claude Code, or as
//   ELECTRON_RUN_AS_NODE=1 /usr/lib/current/current /usr/lib/current/resources/app/mcp/bridge.js
// Current answers only while Tools › Assistant › "Let Claude edit in Current" is on.
'use strict';
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSION = '1.0.0';
const BEAT_MS = +process.env.CURRENT_BRIDGE_BEAT_MS || 5000; // progress notes while a slow tool runs
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']; // newest first

// Current's user-data folder holds the socket (Electron's userData for the app name "Current").
function socketPath() {
  if (process.env.CURRENT_ASSISTANT_SOCKET) return path.resolve(process.env.CURRENT_ASSISTANT_SOCKET);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Current', 'assistant.sock');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Current', 'assistant.sock');
}

const NOT_OPEN = 'Current is not open, or "Let Claude edit in Current" is switched off (in Current: Tools › Assistant). Ask the person to open Current with their project and switch it on, then try again.';

// One request to Current: send a line, wait for the answering line.
function ask(message, { timeoutMs = 15 * 60 * 1000, onWait } = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(socketPath());
    let buf = '', done = false, beat = null;
    const finish = (err, value) => {
      if (done) return;
      done = true;
      clearTimeout(limit); clearInterval(beat);
      sock.destroy();
      err ? reject(err) : resolve(value);
    };
    const limit = setTimeout(() => finish(new Error('Current took too long to answer.')), timeoutMs);
    sock.setEncoding('utf8');
    sock.on('connect', () => {
      sock.write(JSON.stringify({ id: 1, ...message }) + '\n');
      if (onWait) beat = setInterval(onWait, BEAT_MS);
    });
    sock.on('data', (d) => {
      buf += d;
      const i = buf.indexOf('\n');
      if (i < 0) return;
      try { finish(null, JSON.parse(buf.slice(0, i)).result); } catch (e) { finish(e); }
    });
    sock.on('error', () => finish(new Error(NOT_OPEN)));
    sock.on('close', () => finish(new Error(NOT_OPEN)));
  });
}

// The tools, instructions and prompts: from Current when it is open (always current), else the copy
// that ships next to this file.
let saved = null;
function savedCatalog() {
  if (!saved) saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
  return saved;
}
async function catalog() {
  try { return (await ask({ method: 'catalog' }, { timeoutMs: 2000 })) || savedCatalog(); } catch { return savedCatalog(); }
}

const send = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const result = (id, value) => send({ jsonrpc: '2.0', id, result: value });
const error = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

// Current's tool results ({ ok, content: [text | image{data, mediaType}] }) in MCP's shape.
function toMcp(out) {
  const content = (out?.content || []).map((c) => (c.type === 'image' ? { type: 'image', data: c.data, mimeType: c.mediaType || 'image/jpeg' } : { type: 'text', text: c.text }));
  return { content: content.length ? content : [{ type: 'text', text: 'Done.' }], isError: !out?.ok };
}

function fillPrompt(p, args = {}) {
  return p.template.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (_, k, dflt) => (String(args[k] ?? '').trim() || dflt || ''));
}

async function handle(msg) {
  if (msg.id === undefined || msg.id === null) return; // a notification: nothing to answer
  const { id, method, params = {} } = msg;
  try {
    switch (method) {
      case 'initialize': {
        const want = params.protocolVersion;
        const cat = await catalog();
        return result(id, {
          protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
          serverInfo: { name: 'current', title: 'Current', version: VERSION },
          instructions: cat.instructions,
        });
      }
      case 'ping': return result(id, {});
      case 'tools/list': return result(id, { tools: (await catalog()).tools });
      case 'prompts/list': return result(id, { prompts: (await catalog()).prompts.map(({ name, title, description, arguments: a }) => ({ name, title, description, arguments: a })) });
      case 'prompts/get': {
        const p = (await catalog()).prompts.find((x) => x.name === params.name);
        if (!p) return error(id, -32602, `There is no prompt called ${params.name}.`);
        const missing = p.arguments.filter((a) => a.required && !String(params.arguments?.[a.name] ?? '').trim());
        if (missing.length) return error(id, -32602, `Missing: ${missing.map((a) => a.name).join(', ')}.`);
        return result(id, { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: fillPrompt(p, params.arguments) } }] });
      }
      case 'tools/call': {
        const token = params._meta?.progressToken;
        let n = 0;
        const onWait = token === undefined ? null : () => send({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, progress: ++n, message: 'Current is working…' } });
        try {
          return result(id, toMcp(await ask({ method: 'call', name: params.name, input: params.arguments || {} }, { onWait })));
        } catch (e) {
          return result(id, { content: [{ type: 'text', text: e.message }], isError: true });
        }
      }
      default: return error(id, -32601, `Unknown method ${method}.`);
    }
  } catch (e) {
    return error(id, -32603, e.message);
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => {
  buf += d;
  for (let i; (i = buf.indexOf('\n')) >= 0;) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
