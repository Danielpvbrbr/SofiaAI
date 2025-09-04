import fetch from "node-fetch";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const modelos = [
  "sofiaai_gmm_v1:latest",
  "sofiaai_gmm_v2:latest",
  "sofiaai_gmm_v3:latest",
  "sofiaai_phi_v1:latest",
];

async function gerarResposta(modelo, prompt) {
  try {
    console.log("🔄 Gerando resposta...\n");

    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        prompt: prompt,
        stream: false // Desabilita streaming para facilitar o parsing
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.text();
    // console.log("📡 Resposta bruta:", data); // Debug

    // O Ollama pode retornar múltiplas linhas JSON quando stream=false
    const lines = data.trim().split('\n');
    let resposta = '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            resposta += json.response;
          }
        } catch (parseErr) {
          console.log("⚠️ Erro ao parsear linha:", line);
        }
      }
    }

    if (!resposta) {
      console.log("❌ Nenhuma resposta encontrada na saída do modelo");
      return ask();
    }

    console.log("🤖 Resposta:");
    // Simula digitação
    for (const char of resposta) {
      process.stdout.write(char);
      await new Promise(r => setTimeout(r, 20));
    }
    console.log("\n");

  } catch (err) {
    console.error("❌ Erro detalhado:", err.message);

    // Verifica se é erro de conexão
    if (err.code === 'ECONNREFUSED') {
      console.error("🔌 Ollama não está rodando! Execute: ollama serve");
    }

    // Verifica se o modelo existe
    if (err.message.includes('404') || err.message.includes('not found')) {
      console.error(`📦 Modelo '${modelo}' não encontrado!`);
      console.error("💡 Modelos disponíveis: ollama list");
      console.error(`💡 Para baixar: ollama pull ${modelo}`);
    }
  }

  ask();
}

function ask() {
  rl.question(`\n📝 Escolha modelo [0-${modelos.length - 1}] ou 'exit':\n> `, (input) => {
    if (input.toLowerCase() === "exit" || input.toLowerCase() === "sair") {
      console.log("👋 Encerrando SofiaAI...");
      rl.close();
      return;
    }

    const parts = input.trim().split(" ");
    const indice = parts[0];
    const prompt = parts.slice(1).join(" ");

    // Validações
    if (!indice || indice === '') {
      console.log("⚠️ Digite o índice do modelo!");
      return ask();
    }

    const modelo = modelos[parseInt(indice)];
    if (!modelo) {
      console.log(`⚠️ Modelo inválido! Use 0-${modelos.length - 1}`);
      return ask();
    }

    if (!prompt || prompt.trim() === '') {
      console.log("⚠️ Digite um prompt após o índice do modelo!");
      return ask();
    }

    console.log(`\n🎯 Usando modelo: ${modelo}`);
    console.log(`📝 Prompt: ${prompt}`);
    gerarResposta(modelo, prompt);
  });
}

// Função para testar conexão com Ollama
async function testarConexao() {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    if (res.ok) {
      const data = await res.json();
      console.log("✅ Ollama conectado!");
      console.log("📦 Modelos instalados:", data.models?.map(m => m.name) || []);
      return true;
    }
  } catch (err) {
    console.error("❌ Erro ao conectar com Ollama:", err.message);
    console.error("💡 Certifique-se que o Ollama está rodando: ollama serve");
    return false;
  }
}

// Inicialização
console.log("🤖 SofiaAI iniciando...");
console.log("🔍 Testando conexão com Ollama...");

testarConexao().then((conectado) => {
  console.log("\n📋 Modelos configurados:");
  modelos.forEach((m, i) => console.log(`[${i}] ${m}`));
  console.log("\n💡 Como usar: <índice> <pergunta>");
  console.log("💡 Exemplo: 0 Olá SofiaAI, como você está?");

  if (!conectado) {
    console.log("\n⚠️ Ollama não está acessível, mas você pode tentar mesmo assim...");
  }

  ask();
});