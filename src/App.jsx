import { useState, useEffect, useRef } from "react";

function App() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gmm_v3");
  const [serverStatus, setServerStatus] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const modelos = {
    phi: { name: "Phi v1", desc: "Modelo compacto e eficiente" },
    gmm_v3: { name: "GMM v3", desc: "Versão mais avançada (Recomendado)" },
    gmm_v2: { name: "GMM v2", desc: "Versão intermediária" },
    gmm_v1: { name: "GMM v1", desc: "Versão inicial" }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchServerStatus = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/status");
      if (res.ok) {
        const status = await res.json();
        setServerStatus(status);
      }
    } catch (err) {
      console.warn("Não foi possível obter status do servidor:", err.message);
    }
  };

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const connectWebSocket = () => {
      const socket = new WebSocket("ws://localhost:3000/ws");

      socket.onopen = () => {
        console.log("✅ Conectado ao servidor SofiaAI");
        setWs(socket);
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "token") {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                updated[updated.length - 1].text += data.text;
              }
              return updated;
            });
          } else if (data.type === "done") {
            console.log("✅ Resposta finalizada");
            setIsGenerating(false);
          } else if (data.type === "error") {
            console.error("❌ Erro:", data.message);
            setMessages((prev) => [...prev, {
              role: "error",
              text: data.message,
              timestamp: new Date().toLocaleTimeString()
            }]);
            setIsGenerating(false);
          } else if (data.type === "info") {
            console.log("ℹ️ Info:", data.message);
          }
        } catch (err) {
          console.error("Erro ao processar mensagem:", err);
          setIsGenerating(false);
        }
      };

      socket.onclose = () => {
        console.log("❌ Desconectado do servidor");
        setWs(null);
        setIsConnected(false);
        setIsGenerating(false);

        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`🔄 Tentando reconectar em ${delay / 1000}s (${reconnectAttempts.current}/${maxReconnectAttempts})`);

          setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else {
          console.error("❌ Máximo de tentativas de reconexão atingido");
          setMessages(prev => [...prev, {
            role: "error",
            text: "Conexão perdida. Recarregue a página para tentar novamente.",
            timestamp: new Date().toLocaleTimeString()
          }]);
        }
      };

      socket.onerror = (error) => {
        console.error("Erro no WebSocket:", error);
        setIsConnected(false);
        setIsGenerating(false);
      };

      return socket;
    };

    const socket = connectWebSocket();
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const sendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket não está conectado");
      return;
    }

    const message = input.trim();
    if (!message || isGenerating) {
      return;
    }

    setMessages((prev) => [...prev, {
      role: "user",
      text: message,
      timestamp: new Date().toLocaleTimeString()
    }]);

    setMessages((prev) => [...prev, {
      role: "assistant",
      text: "",
      model: selectedModel,
      timestamp: new Date().toLocaleTimeString()
    }]);

    ws.send(JSON.stringify({
      prompt: message,
      modelo: selectedModel === "gmm_v3" ? "sofiaai_gmm_v3:latest" : 
              selectedModel === "gmm_v2" ? "sofiaai_gmm_v2:latest" : 
              selectedModel === "gmm_v1" ? "sofiaai_gmm_v1:latest" : 
              "sofiaai_phi_v1:latest"
    }));

    setInput("");
    setIsGenerating(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const newChat = () => {
    clearChat();
    setSidebarOpen(false);
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#343541",
      color: "#fff"
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? "260px" : "0px",
        backgroundColor: "#202123",
        transition: "width 0.3s ease",
        overflow: "hidden",
        borderRight: "1px solid #565869"
      }}>
        <div style={{ padding: "16px", height: "100%" }}>
          <button
            onClick={newChat}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: "transparent",
              border: "1px solid #565869",
              borderRadius: "6px",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              marginBottom: "16px"
            }}
          >
            <span>➕</span> Nova conversa
          </button>

          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ fontSize: "12px", color: "#8e8ea0", margin: "0 0 8px 0", textTransform: "uppercase" }}>
              Modelo Ativo
            </h3>
            <div style={{
              padding: "8px 12px",
              backgroundColor: "#40414f",
              borderRadius: "6px",
              fontSize: "14px"
            }}>
              {modelos[selectedModel]?.name}
            </div>
          </div>

          {serverStatus && (
            <div style={{ fontSize: "12px", color: "#8e8ea0" }}>
              <div style={{ marginBottom: "4px" }}>
                Status: {serverStatus.ollama === 'connected' ? '🟢 Online' : '🔴 Offline'}
              </div>
              <div>Conexões: {serverStatus.conexoes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #565869",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#343541"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "16px"
              }}
            >
              ☰
            </button>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
              SofiaAI
            </h1>
            <div style={{
              fontSize: "11px",
              color: isConnected ? "#10a37f" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isConnected ? "#10a37f" : "#ef4444"
              }}></div>
              {isConnected ? "Conectado" : "Desconectado"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isGenerating}
              style={{
                padding: "8px 12px",
                backgroundColor: "#40414f",
                border: "1px solid #565869",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "14px",
                cursor: isGenerating ? "not-allowed" : "pointer"
              }}
            >
              {Object.entries(modelos).map(([key, model]) => (
                <option key={key} value={key} style={{ backgroundColor: "#40414f" }}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "0"
        }}>
          {messages.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              padding: "40px"
            }}>
              <div style={{
                fontSize: "48px",
                marginBottom: "16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>
                🤖
              </div>
              <h2 style={{ fontSize: "32px", fontWeight: "600", margin: "0 0 8px 0" }}>
                Como posso ajudar você hoje?
              </h2>
              <p style={{ fontSize: "16px", color: "#8e8ea0", margin: 0 }}>
                Escolha um modelo e comece uma conversa
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{
                padding: "24px 0",
                backgroundColor: msg.role === "assistant" || msg.role === "error" ? "#444654" : "#343541"
              }}>
                <div style={{
                  maxWidth: "768px",
                  margin: "0 auto",
                  padding: "0 20px",
                  display: "flex",
                  gap: "16px"
                }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "4px",
                    backgroundColor: msg.role === "user" ? "#5436da" : msg.role === "error" ? "#ef4444" : "#10a37f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    flexShrink: 0,
                    color: "#fff"
                  }}>
                    {msg.role === "user" ? "👤" : msg.role === "error" ? "⚠️" : "🤖"}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#e5e5e7",
                      marginBottom: "8px"
                    }}>
                      {msg.role === "user" ? "Você" : msg.role === "error" ? "Erro" : "SofiaAI"}
                      {msg.model && (
                        <span style={{
                          marginLeft: "8px",
                          fontSize: "11px",
                          color: "#8e8ea0",
                          fontWeight: "400"
                        }}>
                          • {modelos[msg.model]?.name || msg.model}
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: "16px",
                      lineHeight: "1.6",
                      color: msg.role === "error" ? "#ff6b6b" : "#e5e5e7",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
                      {msg.text || (msg.role === "assistant" && isGenerating ? (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#8e8ea0",
                          fontSize: "14px"
                        }}>
                          <div style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #8e8ea0",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite"
                          }}></div>
                          Pensando...
                        </div>
                      ) : "")}
                    </div>
                    
                    {msg.timestamp && (
                      <div style={{
                        fontSize: "11px",
                        color: "#8e8ea0",
                        marginTop: "8px"
                      }}>
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: "20px",
          backgroundColor: "#343541",
          borderTop: "1px solid #565869"
        }}>
          <div style={{
            maxWidth: "768px",
            margin: "0 auto",
            position: "relative"
          }}>
            <div style={{
              display: "flex",
              backgroundColor: "#40414f",
              borderRadius: "12px",
              border: "1px solid #565869",
              overflow: "hidden"
            }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected || isGenerating}
                style={{
                  flex: 1,
                  padding: "16px 20px",
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: "16px",
                  outline: "none",
                  resize: "none",
                  minHeight: "24px",
                  maxHeight: "120px",
                  fontFamily: "inherit"
                }}
                placeholder={
                  !isConnected
                    ? "Conectando ao servidor..."
                    : isGenerating
                      ? "Aguarde a resposta..."
                      : "Envie uma mensagem..."
                }
                rows={1}
              />
              
              <button
                onClick={sendMessage}
                disabled={!isConnected || isGenerating || !input.trim()}
                style={{
                  padding: "16px 20px",
                  backgroundColor: (!isConnected || isGenerating || !input.trim()) 
                    ? "transparent" 
                    : "#10a37f",
                  color: (!isConnected || isGenerating || !input.trim()) 
                    ? "#8e8ea0" 
                    : "#fff",
                  border: "none",
                  cursor: (!isConnected || isGenerating || !input.trim()) 
                    ? "not-allowed" 
                    : "pointer",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s"
                }}
              >
                {isGenerating ? "⏳" : "➤"}
              </button>
            </div>
            
            <div style={{
              fontSize: "12px",
              color: "#8e8ea0",
              textAlign: "center",
              marginTop: "12px"
            }}>
              SofiaAI pode cometer erros. Considere verificar informações importantes.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        textarea {
          overflow-y: auto;
        }
        
        textarea::-webkit-scrollbar {
          width: 4px;
        }
        
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        
        textarea::-webkit-scrollbar-thumb {
          background: #565869;
          border-radius: 2px;
        }
        
        div::-webkit-scrollbar {
          width: 8px;
        }
        
        div::-webkit-scrollbar-track {
          background: #343541;
        }
        
        div::-webkit-scrollbar-thumb {
          background: #565869;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default App;