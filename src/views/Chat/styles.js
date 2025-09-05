import styled, { keyframes } from "styled-components";

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

export const Container = styled.div`
  width: 100vw;
  display: flex;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #343541;
  color: #fff;
`;

export const Sidebar = styled.div`
  width: ${(props) => (props.open ? "260px" : "0px")};
  background-color: #202123;
  transition: width 0.3s ease;
  overflow: hidden;
  border-right: 1px solid #565869;
`;

export const SidebarContent = styled.div`
  padding: 16px;
  height: 100%;
`;

export const NewChatButton = styled.button`
  width: 100%;
  padding: 12px 16px;
  background-color: transparent;
  border: 1px solid #565869;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 16px;
`;

export const ModelBox = styled.div`
  margin-bottom: 20px;
  h3 {
    font-size: 12px;
    color: #8e8ea0;
    margin: 0 0 8px 0;
    text-transform: uppercase;
  }
`;

export const ActiveModel = styled.div`
  padding: 8px 12px;
  background-color: #40414f;
  border-radius: 6px;
  font-size: 14px;
`;

export const ServerStatus = styled.div`
  font-size: 12px;
  color: #8e8ea0;
  div {
    margin-bottom: 4px;
  }
`;

export const Main = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  flex-direction: column;
  /* border: 1px solid red; */
`;
export const AreaMain = styled.div`
  max-width: 900px;
  width: 100%;   
  flex: 1;   
  display: flex;
  flex-direction: column;
`;

export const Header = styled.div`
  width: 97%;
  padding: 12px 16px;
  border-bottom: 1px solid #565869;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #343541;
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
`;

export const SidebarToggle = styled.button`
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  font-size: 16px;
`;

export const ConnectionStatus = styled.div`
  font-size: 11px;
  color: ${(props) => (props.connected ? "#10a37f" : "#ef4444")};
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) => (props.connected ? "#10a37f" : "#ef4444")};
`;

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const ModelSelect = styled.select`
  padding: 8px 12px;
  background-color: #40414f;
  border: 1px solid #565869;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
`;

export const Messages = styled.div`
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;

  /* scrollbar custom */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #565869;
    border-radius: 3px;
  }
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
`;

export const Emoji = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

export const MessageContainer = styled.div`
  padding: 24px 0;
  background-color: ${(props) =>
  props.role === "assistant" || props.role === "error" ? "#444654" : "#343541"};
`;

export const MessageWrapper = styled.div`
  max-width: 768px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  gap: 16px;
`;

export const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: ${(props) =>
        props.role === "user" ? "#5436da" : props.role === "error" ? "#ef4444" : "#10a37f"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  color: #fff;
`;

export const MessageContent = styled.div`
  flex: 1;
  min-width: 0;
`;

export const MessageHeader = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #e5e5e7;
  margin-bottom: 8px;
`;

export const ModelTag = styled.span`
  margin-left: 8px;
  font-size: 11px;
  color: #8e8ea0;
  font-weight: 400;
`;

export const MessageText = styled.div`
  font-size: 16px;
  line-height: 1.6;
  color: ${(props) => (props.role === "error" ? "#ff6b6b" : "#e5e5e7")};
  white-space: pre-wrap;
  word-break: break-word;
`;

export const Loading = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #8e8ea0;
  font-size: 14px;
`;

export const Spinner = styled.div`
  width: 12px;
  height: 12px;
  border: 2px solid #8e8ea0;
  border-top: 2px solid transparent;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

export const Timestamp = styled.div`
  font-size: 11px;
  color: #8e8ea0;
  margin-top: 8px;
`;

export const InputArea = styled.div`
  width: 98%;
  padding: 5px;
  background-color: #343541;
  /* border-top: 1px solid #565869; */
  /* border: 1px solid green ; */
`;

export const InputWrapper = styled.div`
  margin: 0 auto;
  position: relative;
  display: flex;
  background-color: #40414f;
  border-radius: 12px;
  border: 1px solid #565869;
  overflow: hidden;
`;

export const TextArea = styled.textarea`
  flex: 1;
  padding: 16px 20px;
  background-color: transparent;
  border: none;
  color: #fff;
  font-size: 16px;
  outline: none;
  resize: none;
  min-height: 24px;
  max-height: 120px;
  font-family: inherit;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #565869;
    border-radius: 2px;
  }
`;

export const SendButton = styled.button`
  padding: 16px 20px;
  background-color: ${(props) => (props.generating || !props.hasInput ? "transparent" : "#10a37f")};
  color: ${(props) => (props.generating || !props.hasInput ? "#8e8ea0" : "#fff")};
  border: none;
  cursor: ${(props) => (props.generating || !props.hasInput ? "not-allowed" : "pointer")};
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
`;

export const Disclaimer = styled.div`
  font-size: 12px;
  color: #8e8ea0;
  text-align: center;
  margin-top: 12px;
`;
