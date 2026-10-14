// Minimal headless-Chrome driver (DevTools protocol) used by the offline tools. No npm packages.
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function openPage(url, { width = 1280, height = 900, port = 9334 } = {}) {
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(os.tmpdir(), 'f1ch-cdp-' + port)}`, `--window-size=${width},${height}`, url], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 60 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* not up yet */ } if (!page) await sleep(250); }
  if (!page) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {};
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
    return r.result.result.value;
  };
  await sleep(800);
  return { evaluate, send, close: () => { try { ws.close(); } catch (e) { /* closing */ } proc.kill(); } };
}
