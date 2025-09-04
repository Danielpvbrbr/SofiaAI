import express from 'express';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Configuração de CORS
app.use(cors());
app.use(express.json());

// Configuração dos modelos SofiaAI
const MODELOS = {
  phi: "sofiaai_phi_v1:latest",
  gmm_v3: "sofiaai_gmm_v3:latest",
  gmm_v2: "sofiaai_gmm_v2:latest",
  gmm_v1: "sofiaai_gmm_v1:latest"
};

const MODELO_DEFAULT = MODELOS.gmm_v3; // Modelo padrão
const OLLAMA_URL = "http://localhost:11434";

// WebSocket Server
const wss = new WebSocketServer({
  server,
  path: '/ws'
});

// Função para testar conexão com Ollama
async function testarOllama() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      console.log("Ollama conectado!");
      console.log("Modelos disponíveis:", data.models?.map(m => m.name) || []);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Erro ao conectar com Ollama:", err.message);
    return false;
  }
}

// Função para gerar resposta com streaming
async function gerarRespostaStream(modelo, prompt, ws) {
  try {
    console.log(`Gerando resposta com modelo: ${modelo}`);
    console.log(`Prompt: ${prompt}`);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        prompt: prompt,
        stream: true, // Habilita streaming
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Processa o stream de resposta
    const reader = res.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // Mantém a última linha no buffer caso esteja incompleta
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);

            if (data.response) {
              // Envia cada token para o cliente
              ws.send(JSON.stringify({
                type: 'token',
                text: data.response
              }));
            }

            if (data.done) {
              // Finaliza o streaming
              ws.send(JSON.stringify({
                type: 'done'
              }));
              console.log("Resposta finalizada");
            }
          } catch (parseErr) {
            console.warn("Erro ao parsear linha:", line);
          }
        }
      }
    });

    reader.on('end', () => {
      // Processa qualquer conteúdo restante no buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.response) {
            ws.send(JSON.stringify({
              type: 'token',
              text: data.response
            }));
          }
        } catch (parseErr) {
          console.warn("Erro ao parsear buffer final");
        }
      }

      ws.send(JSON.stringify({ type: 'done' }));
    });

    reader.on('error', (err) => {
      console.error("Erro no stream:", err);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Erro no streaming: ${err.message}`
      }));
    });

  } catch (err) {
    console.error("Erro ao gerar resposta:", err.message);

    let errorMessage = "Erro interno do servidor";

    if (err.code === 'ECONNREFUSED') {
      errorMessage = "Ollama não está rodando. Execute: ollama serve";
    } else if (err.message.includes('404') || err.message.includes('not found')) {
      errorMessage = `Modelo '${modelo}' não encontrado. Execute: ollama pull ${modelo}`;
    } else {
      errorMessage = err.message;
    }

    ws.send(JSON.stringify({
      type: 'error',
      message: errorMessage
    }));
  }
}

// Conexões WebSocket
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Nova conexão WebSocket de ${clientIp}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { prompt, modelo } = data;

      if (!prompt || prompt.trim() === '') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Prompt não pode estar vazio'
        }));
        return;
      }

      // Use o modelo especificado ou o padrão
      const modeloEscolhido = modelo || MODELO_DEFAULT;

      console.log(`Mensagem recebida de ${clientIp}: "${prompt.substring(0, 50)}..."`);

      await gerarRespostaStream(modeloEscolhido, prompt, ws);

    } catch (err) {
      console.error("Erro ao processar mensagem:", err);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erro ao processar mensagem'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Conexão WebSocket fechada: ${clientIp}`);
  });

  ws.on('error', (err) => {
    console.error(`Erro na conexão WebSocket ${clientIp}:`, err);
  });

  // Envia mensagem de boas-vindas
  ws.send(JSON.stringify({
    type: 'info',
    message: 'Conectado ao SofiaAI WebSocket Server!'
  }));
});

// Rotas HTTP para informações
app.get('/api/status', async (req, res) => {
  const ollamaOk = await testarOllama();
  res.json({
    status: 'online',
    ollama: ollamaOk ? 'connected' : 'disconnected',
    modelos: Object.values(MODELOS),
    conexoes: wss.clients.size
  });
});

app.get('/api/modelos', (req, res) => {
  res.json({
    modelos: MODELOS,
    default: MODELO_DEFAULT
  });
});

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    name: 'SofiaAI WebSocket Server',
    status: 'running',
    endpoints: {
      websocket: '/ws',
      status: '/api/status',
      modelos: '/api/modelos'
    }
  });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`SofiaAI WebSocket Server rodando na porta ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`API: http://localhost:${PORT}`);

  // Testa conexão com Ollama
  const ollamaOk = await testarOllama();
  if (!ollamaOk) {
    console.warn("Ollama não está acessível. Certifique-se de executar: ollama serve");
  }

  console.log("\nModelos configurados:");
  Object.entries(MODELOS).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log(`\nModelo padrão: ${MODELO_DEFAULT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Encerrando servidor...');
  server.close(() => {
    console.log('Servidor encerrado com sucesso');
    process.exit(0);
  });
});

export default app;