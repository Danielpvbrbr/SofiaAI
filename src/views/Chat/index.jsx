import { useState, useEffect, useRef } from "react";
import {
  Container,
  Sidebar,
  SidebarContent,
  NewChatButton,
  ModelBox,
  ActiveModel,
  ServerStatus,
  Main,
  AreaMain,
  Header,
  HeaderLeft,
  SidebarToggle,
  ConnectionStatus,
  StatusDot,
  HeaderRight,
  ModelSelect,
  Messages,
  EmptyState,
  Emoji,
  MessageContainer,
  MessageWrapper,
  Avatar,
  MessageContent,
  MessageHeader,
  ModelTag,
  MessageText,
  Loading,
  Spinner,
  Timestamp,
  InputArea,
  InputWrapper,
  TextArea,
  SendButton,
  Disclaimer
} from "./styles";

export default function Chat() {
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
                if (!updated[updated.length - 1].text.includes(data.text)) {
                  updated[updated.length - 1].text += data.text;
                }
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

    if (!message || isGenerating) return;
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: message,
        timestamp: new Date().toLocaleTimeString()
      },
      {
        role: "assistant",
        text: "",
        model: selectedModel,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

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

  const clearChat = () => setMessages([]);
  const newChat = () => { clearChat(); setSidebarOpen(false); };

  return (
    <Container>
      <Sidebar open={sidebarOpen}>
        <SidebarContent>
          <NewChatButton onClick={newChat}>➕ Nova conversa</NewChatButton>
          <ModelBox>
            <h3>Modelo Ativo</h3>
            <ActiveModel>{modelos[selectedModel]?.name}</ActiveModel>
          </ModelBox>
          {serverStatus && (
            <ServerStatus>
              <div>Status: {serverStatus.ollama === 'connected' ? '🟢 Online' : '🔴 Offline'}</div>
              <div>Conexões: {serverStatus.conexoes}</div>
            </ServerStatus>
          )}
        </SidebarContent>
      </Sidebar>

      <Main>
        <Header>
          <HeaderLeft>
            <SidebarToggle onClick={() => setSidebarOpen(!sidebarOpen)}>☰</SidebarToggle>
            <h1>SofiaAI</h1>
            <ConnectionStatus connected={isConnected}>
              <StatusDot connected={isConnected} />
              {isConnected ? "Conectado" : "Desconectado"}
            </ConnectionStatus>
          </HeaderLeft>
          <HeaderRight>
            <ModelSelect
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isGenerating}
            >
              {Object.entries(modelos).map(([key, model]) => (
                <option key={key} value={key}>{model.name}</option>
              ))}
            </ModelSelect>
          </HeaderRight>
        </Header>
        <AreaMain>

          <Messages>
            {messages.length === 0 ? (
              <EmptyState>
                <Emoji>🤖</Emoji>
                <h2>Como posso ajudar você hoje?</h2>
                <p>Escolha um modelo e comece uma conversa</p>
              </EmptyState>
            ) : (
              messages.map((msg, i) => (
                <MessageContainer key={i} role={msg.role}>
                  <MessageWrapper>
                    <Avatar role={msg.role}>
                      {msg.role === "user" ? "👤" : msg.role === "error" ? "⚠️" : "🤖"}
                    </Avatar>
                    <MessageContent>
                      <MessageHeader>
                        {msg.role === "user" ? "Você" : msg.role === "error" ? "Erro" : "SofiaAI"}
                        {msg.model && <ModelTag>• {modelos[msg.model]?.name || msg.model}</ModelTag>}
                      </MessageHeader>
                      <MessageText role={msg.role}>
                        {msg.text || (msg.role === "assistant" && isGenerating ? (
                          <Loading>
                            <Spinner /> Pensando...
                          </Loading>
                        ) : "")}
                      </MessageText>
                      {msg.timestamp && <Timestamp>{msg.timestamp}</Timestamp>}
                    </MessageContent>
                  </MessageWrapper>
                </MessageContainer>
              ))
            )}
            <div ref={messagesEndRef} />
          </Messages>

          <InputArea>
            <InputWrapper>
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected || isGenerating}
                placeholder={!isConnected ? "Conectando ao servidor..." : isGenerating ? "Aguarde a resposta..." : "Envie uma mensagem..."}
              />
              <SendButton
                onClick={sendMessage}
                disabled={!isConnected || isGenerating || !input.trim()}
                generating={isGenerating}
                hasInput={!!input.trim()}
              >
                {isGenerating ? "⏳" : "➤"}
              </SendButton>
            </InputWrapper>
            <Disclaimer>SofiaAI pode cometer erros. Considere verificar informações importantes.</Disclaimer>
          </InputArea>
        </AreaMain>
      </Main>
    </Container>
  );
}


