import express from 'express';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());

const OLLAMA_URL = "http://localhost:11434";

// Função para listar modelos do Ollama dinamicamente
async function listarModelos() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
    const data = await res.json();
    return data.models?.map(m => m.name) || [];
  } catch (err) {
    console.error("Erro ao buscar modelos:", err.message);
    return [];
  }
}

// Função para escolher modelo padrão
async function getModeloPadrao() {
  const modelos = await listarModelos();
  if (modelos.length === 0) return null;
  return process.env.MODELO_DEFAULT || modelos[0];
}

// WebSocket Server
const wss = new WebSocketServer({
  server,
  path: '/ws'
});

// Função para gerar resposta (igual a sua, só tiramos dependência fixa de MODELOS)
async function gerarRespostaStream(modelo, prompt, ws) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.4,//→ deixa mais criativo ou conservador
          top_p: 0.9, //→ filtra por probabilidade cumulativa
          top_k: 40 //→ limita aos mais prováveis
        }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const reader = res.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) {
            ws.send(JSON.stringify({ type: 'token', text: data.response }));
          }
          if (data.done) {
            ws.send(JSON.stringify({ type: 'done' }));
          }
        } catch (err) {
          console.warn("Erro ao parsear linha:", line);
        }
      }
    });

    reader.on('end', () => {
      ws.send(JSON.stringify({ type: 'done' }));
    });

    reader.on('error', (err) => {
      console.error("Erro no stream:", err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    });

  } catch (err) {
    console.error("Erro ao gerar resposta:", err.message);
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  }
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Nova conexão WebSocket de ${clientIp}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { prompt, modelo } = data;

      if (!prompt || prompt.trim() === '') {
        ws.send(JSON.stringify({ type: 'error', message: 'Prompt não pode estar vazio' }));
        return;
      }

      const modelosDisponiveis = await listarModelos();
      const modeloEscolhido = modelo && modelosDisponiveis.includes(modelo)
        ? modelo
        : await getModeloPadrao();

      if (!modeloEscolhido) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nenhum modelo disponível no Ollama' }));
        return;
      }

      console.log(`Prompt de ${clientIp}: "${prompt.substring(0, 50)}..."`);
      console.log(`Usando modelo: ${modeloEscolhido}`);

      await gerarRespostaStream(modeloEscolhido, prompt, ws);

    } catch (err) {
      console.error("Erro ao processar mensagem:", err);
      ws.send(JSON.stringify({ type: 'error', message: 'Erro ao processar mensagem' }));
    }
  });

  ws.send(JSON.stringify({
    type: 'info',
    message: 'Conectado ao SofiaAI WebSocket Server!'
  }));
});

// 🔹 Endpoints HTTP
app.get('/api/status', async (req, res) => {
  const modelos = await listarModelos();
  res.json({
    status: 'online',
    ollama: modelos.length > 0 ? 'connected' : 'disconnected',
    modelos,
    conexoes: wss.clients.size
  });
});

app.get('/api/modelos', async (req, res) => {
  const modelos = await listarModelos();
  res.json({ modelos });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`SofiaAI WebSocket Server rodando na porta ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`API: http://localhost:${PORT}`);

  const modelos = await listarModelos();
  console.log("\nModelos encontrados no Ollama:");
  modelos.forEach(m => console.log(` - ${m}`));
  console.log(`\nModelo padrão: ${await getModeloPadrao()}`);
});
