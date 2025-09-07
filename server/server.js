import express from 'express';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import cors from 'cors';
import { createServer } from 'http';
import http from 'http';
import path from "path";
import { fileURLToPath } from "url";

// Corrige __dirname no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 Configurações principais
const CONFIG = {
  KEEP_ALIVE: "60m",
  MAX_CONNECTIONS: 20,
  KEEP_ALIVE_TIMEOUT: 60000,
  MODEL_OPTIONS: {
    num_ctx: 4096,
    num_batch: 64,
    num_gpu: -1,
    num_thread: -1,
    use_mmap: true,
    use_mlock: true,
    num_keep: -1,
    repeat_penalty: 1.0,
    temperature: 0.4,
    top_p: 0.9,
    top_k: 40,
    flash_attention: true,
    low_vram: false,
    main_gpu: 0
  }
};

const OLLAMA_URL = "http://localhost:11434";

// 🔥 Agent otimizado
const ultraAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 500,
  maxSockets: CONFIG.MAX_CONNECTIONS,
  freeSocketTimeout: CONFIG.KEEP_ALIVE_TIMEOUT
});

const app = express();
const server = createServer(app);
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: '10mb' }));

// Caminho do build do frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath)); // serve arquivos est�ticos
const wss = new WebSocketServer({
  server, path: '/ws',
  perMessageDeflate: false,
  clientTracking: true,
  maxPayload: 100 * 1024 * 1024
});

class ModelCache {
  constructor() {
    this.loaded = new Map();
    this.loading = new Map();
    this.lastAccess = new Map();
    this.stats = new Map();
  }

  isLoaded(m) { return this.loaded.has(m); }
  updateAccess(m) { this.lastAccess.set(m, Date.now()); }

  async ensureLoaded(model) {
    if (this.isLoaded(model)) return this.updateAccess(model), true;
    if (this.loading.has(model)) return await this.loading.get(model);

    const p = this.loadModel(model);
    this.loading.set(model, p);

    try {
      const ok = await p;
      if (ok) {
        this.loaded.set(model, true);
        this.updateAccess(model);
        this.stats.set(model, { loads: (this.stats.get(model)?.loads || 0) + 1 });
      }
      return ok;
    } finally { this.loading.delete(model); }
  }

  async loadModel(model) {
    const body = JSON.stringify({ model, prompt: "1", stream: false, options: { num_predict: 1 } });
    return new Promise((resolve) => {
      const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST', agent: ultraAgent, headers: { 'Content-Type': 'application/json' } }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.write(body); req.end();
    });
  }

  getStats() {
    return { loaded: [...this.loaded.keys()], lastAccess: Object.fromEntries(this.lastAccess), stats: Object.fromEntries(this.stats) };
  }
}
const modelCache = new ModelCache();


async function generate(model, prompt, ws) {
  if (!await modelCache.ensureLoaded(model)) return ws.send(JSON.stringify({ type: 'error', message: `Falha ao carregar ${model}` }));

  const body = JSON.stringify({ model, prompt, stream: true, keep_alive: CONFIG.KEEP_ALIVE, options: CONFIG.MODEL_OPTIONS });
  const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST', agent: ultraAgent, headers: { 'Content-Type': 'application/json', 'Accept': 'application/x-ndjson' } }, (res) => {
    let buffer = '', tokens = 0, firstTokenTime = null, start = Date.now();

    ws.send(JSON.stringify({ type: 'start', model }));

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n'); buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);

        if (data.response) {
          if (firstTokenTime === null) firstTokenTime = Date.now();
          tokens++;
          ws.send(JSON.stringify({ type: 'token', text: data.response }));
        }

        if (data.done) {
          const total = Date.now() - start, ttft = firstTokenTime ? (firstTokenTime - start) : 0;
          ws.send(JSON.stringify({ type: 'done', stats: { tokens, total, ttft } }));
        }
      }
    });
  });
  req.on('error', e => ws.send(JSON.stringify({ type: 'error', message: e.message })));
  req.write(body); req.end();
}

wss.on('connection', (ws, req) => {
  console.log(`🚀 Conexão: ${req.socket.remoteAddress}`);
  ws.isAlive = true;
  ws.on('pong', () => ws.isAlive = true);

  ws.on('message', async (msg) => {
    const { prompt, modelo } = JSON.parse(msg.toString());
    if (!prompt?.trim()) return ws.send(JSON.stringify({ type: 'error', message: 'Prompt vazio' }));

    const models = await getModels();
    const selected = modelo && models.includes(modelo) ? modelo : models[0];
    if (!selected) return ws.send(JSON.stringify({ type: 'error', message: 'Nenhum modelo disponível' }));

    generate(selected, prompt, ws);
  });

  ws.send(JSON.stringify({ type: 'connected', mode: 'ULTRA_FAST' }));
});

setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
}, 15000);

let cache = [], lastFetch = 0;
async function getModels() {
  if (cache.length && Date.now() - lastFetch < 60000) return cache;
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { agent: ultraAgent });
    if (r.ok) { const d = await r.json(); cache = d.models?.map(m => m.name) || []; lastFetch = Date.now(); }
  } catch { }
  return cache;
}

app.get('/api/status', async (req, res) => {
  res.json({ status: 'ok', models: await getModels(), cache: modelCache.getStats(), connections: wss.clients.size });
});
app.get('/api/models', async (req, res) => res.json({ models: await getModels() }));
app.post('/api/preload/:model', async (req, res) => res.json({ success: await modelCache.ensureLoaded(req.params.model) }));

app.get('*', (req, res) => { //Modo deploy
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, async () => {
  console.log(`🚀 SofiaAI UltraFast rodando em http://localhost:${PORT}`);
  const models = await getModels();
  if (models.length) await modelCache.ensureLoaded(models[0]);
});
