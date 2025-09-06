import { createContext, useState, useEffect, useRef } from "react";

export const AuthContext = createContext({});

export default function AuthProvider({ children, apiBaseUrl = "http://localhost:3000" }) {
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedModel, setSelectedModel] = useState(null);
    const [models, setModels] = useState([]);
    const [serverStatus, setServerStatus] = useState(null);

    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const socketRef = useRef(null);
    const statusIntervalRef = useRef(null);
    const selectedModelRef = useRef(selectedModel);

    // Atualiza ref sempre que o modelo muda (para usar dentro do onmessage)
    useEffect(() => {
        selectedModelRef.current = selectedModel;
    }, [selectedModel]);

    // Deriva wsUrl a partir da apiBaseUrl (http -> ws, https -> wss)
    const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/ws";

    // Normaliza lista de modelos (aceita array de strings ou array de objetos com .name)
    const normalizeModels = (rawList) => {
        if (!Array.isArray(rawList)) return [];
        return rawList.map((item) => (typeof item === "string" ? item : item?.name || String(item)));
    };

    // Busca modelos do backend
    const fetchModels = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/api/modelos`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // compatibilidade: { modelos } ou { models } ou array direto
            const raw = data.modelos || data.models || data;
            const lista = normalizeModels(raw);
            setModels(lista);
            if (lista.length > 0 && !selectedModel) {
                setSelectedModel(lista[0]);
            }
            return lista;
        } catch (err) {
            console.warn("Erro ao carregar modelos:", err.message || err);
            return [];
        }
    };

    // Busca status do servidor (e atualiza state)
    const fetchServerStatus = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/api/status`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setServerStatus(data);
            return data;
        } catch (err) {
            console.warn("Não foi possível obter status do servidor:", err.message || err);
            setServerStatus(null);
            return null;
        }
    };

    const attemptReconnect = () => {
        if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            console.log(`Tentativa de reconexão em ${delay}ms (tentativa ${reconnectAttempts.current})`);
            setTimeout(() => {
                connectWebSocket();
            }, delay);
        } else {
            console.error("Máximo de tentativas de reconexão atingido");
            setMessages((prev) => [
                ...prev,
                {
                    role: "error",
                    text: "Conexão perdida. Recarregue a página para tentar novamente.",
                    timestamp: new Date().toLocaleTimeString(),
                },
            ]);
        }
    };

    // Conecta websocket e define handlers
    const connectWebSocket = () => {
        try {
            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onopen = () => {
                console.log("WebSocket conectado:", wsUrl);
                reconnectAttempts.current = 0;
                setIsConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "token") {
                        // adiciona token ao último assistant (ou cria se não existir)
                        setMessages((prev) => {
                            const updated = [...prev];
                            const last = updated[updated.length - 1];

                            if (last && last.role === "assistant") {
                                // evita duplicação simples (quando servidor reenvia algo)
                                if (!last.text.includes(data.text)) {
                                    last.text += data.text;
                                }
                            } else {
                                updated.push({
                                    role: "assistant",
                                    text: data.text,
                                    model: selectedModelRef.current,
                                    timestamp: new Date().toLocaleTimeString(),
                                });
                            }
                            return updated;
                        });
                    } else if (data.type === "done") {
                        setIsGenerating(false);
                    } else if (data.type === "error") {
                        setMessages((prev) => [
                            ...prev,
                            { role: "error", text: data.message, timestamp: new Date().toLocaleTimeString() },
                        ]);
                        setIsGenerating(false);
                    } else if (data.type === "info") {
                        console.log("ℹInfo do servidor:", data.message);
                    }
                } catch (err) {
                    console.warn("Erro ao parsear mensagem WS:", err);
                    setIsGenerating(false);
                }
            };

            socket.onclose = (ev) => {
                console.log("WebSocket fechado", ev.reason || ev.code);
                socketRef.current = null;
                setIsConnected(false);
                setIsGenerating(false);

                // tenta reconectar
                attemptReconnect();
            };

            socket.onerror = (err) => {
                console.error("Erro no WebSocket:", err);
                setIsConnected(false);
                setIsGenerating(false);
            };

            // guarda o socket também no state (opcional)
            setTimeout(() => setIsConnected(socket.readyState === WebSocket.OPEN), 0);

            return socket;
        } catch (err) {
            console.error("Falha ao criar WebSocket:", err);
            setIsConnected(false);
            setIsGenerating(false);
            attemptReconnect();
        }
    };

    // Envia mensagem (usada pelo componente)
    const sendMessage = (text) => {
        const message = (text || "").trim();
        if (!message) return;
        if (isGenerating) return;

        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket não está conectado");
            setMessages((prev) => [
                ...prev,
                { role: "error", text: "WebSocket desconectado. Tentando reconectar...", timestamp: new Date().toLocaleTimeString() },
            ]);
            // opcional: tentar forçar reconexão
            if (!socketRef.current) connectWebSocket();
            return;
        }

        // adiciona mensagens locais (user + assistant placeholder)
        const timestamp = new Date().toLocaleTimeString();
        setMessages((prev) => [
            ...prev,
            { role: "user", text: message, timestamp },
            { role: "assistant", text: "", model: selectedModelRef.current, timestamp },
        ]);

        // envia para backend (campo 'modelo' no seu backend)
        try {
            socket.send(JSON.stringify({ prompt: message, modelo: selectedModelRef.current }));
            setIsGenerating(true);
        } catch (err) {
            console.error("Erro ao enviar via WebSocket:", err);
            setIsGenerating(false);
            setMessages((prev) => [...prev, { role: "error", text: "Erro ao enviar mensagem", timestamp }]);
        }
    };

    const clearChat = () => setMessages([]);
    const newChat = () => {
        clearChat();
        // opcional: resetar modelo para o primeiro disponível
        if (models.length > 0) setSelectedModel(models[0]);
    };

    // inicia conexão, fetch inicial, polling de status
    useEffect(() => {
        // buscar modelos e status, depois conectar WS
        (async () => {
            await fetchModels();
            await fetchServerStatus();
            connectWebSocket();
            // polling de status
            statusIntervalRef.current = setInterval(fetchServerStatus, 30000);
        })();

        return () => {
            // cleanup
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch (e) { }
            }
            if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiBaseUrl]); // se trocar apiBaseUrl, refaz tudo

    // expose everything the UI needs
    return (
        <AuthContext.Provider
            value={{
                messages,
                isConnected,
                isGenerating,
                selectedModel,
                setSelectedModel,
                models,
                serverStatus,
                sendMessage,
                clearChat,
                newChat,
                fetchModels,
                fetchServerStatus,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
