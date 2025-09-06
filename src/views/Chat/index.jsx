import { useContext, useRef, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext.jsx"
import CodeBlock from "../../components/CodeBlock.jsx";
import {
  Container, Sidebar, SidebarContent, NewChatButton, ModelBox,
  ActiveModel, ServerStatus, Main, AreaMain, Header, HeaderLeft,
  SidebarToggle, ConnectionStatus, StatusDot, HeaderRight, ModelSelect,
  Messages, EmptyState, Emoji, MessageContainer, MessageWrapper, Avatar,
  MessageContent, MessageHeader, ModelTag, MessageText, Loading, Spinner,
  Timestamp, InputArea, InputWrapper, TextArea, SendButton, Disclaimer
} from "./styles";
import logo from "../../../public/logobranca.png"

export default function Chat() {
  const {
    messages,
    isConnected,
    isGenerating,
    selectedModel,
    setSelectedModel,
    models,
    sendMessage,
    clearChat,
  } = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    sendMessage(input);
    setInput("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Container>
      <Sidebar open={sidebarOpen}>
        <SidebarContent>
          <NewChatButton onClick={clearChat}>➕ Nova conversa</NewChatButton>
          <ModelBox>
            <h3>Modelo Ativo</h3>
            <ActiveModel>{selectedModel}</ActiveModel>
          </ModelBox>
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
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </ModelSelect>
          </HeaderRight>
        </Header>

        <AreaMain>
          <Messages>
            {messages.length === 0 ? (
              <EmptyState>
                <Emoji src={logo} alt="SofiaAI" />
                <h2>Como posso ajudar você hoje?</h2>
              </EmptyState>
            ) : (
              messages.map((msg, i) => (
                <MessageContainer key={i} role={msg.role}>
                  <MessageWrapper>
                    <MessageContent>
                      <MessageHeader>
                        {msg.role === "user" ? "Você" : msg.role === "error" ? "Erro" : "SofiaAI"}
                      </MessageHeader>
                      <MessageText role={msg.role}>
                        {msg.text.includes("```") ? (
                          msg.text.split("```").map((block, i) => {
                            if (i % 2 === 1) {
                              const [lang, ...code] = block.split("\n");
                              return <CodeBlock key={i} language={lang} value={code.join("\n")} />;
                            }
                            return <span key={i}>{block}</span>;
                          })
                        ) : (
                          msg.role === "assistant" && isGenerating ? (
                            <Loading>
                              <Spinner /> Pensando...
                            </Loading>
                          ) : (
                            msg.text
                          )
                        )}
                      </MessageText>

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
                onClick={handleSend}
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
