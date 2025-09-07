import { createContext, useState, useEffect, useRef } from "react";

export const AuthContext = createContext({});

export default function AuthProvider({ children, apiBaseUrl = "http://20.66.88.228:4000" }) {
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
    const currentResponseRef = useRef(""); // Buffer para a resposta atual

    // Atualiza ref sempre que o modelo muda
    useEffect(() => {
        selectedModelRef.current = selectedModel;
    }, [selectedModel]);

    const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/ws";

    const normalizeModels = (rawList) => {
        if (!Array.isArray(rawList)) return [];
        return rawList.map((item) => (typeof item === "string" ? item : item?.name || String(item)));
    };

    const fetchModels = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/api/models`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
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

                    if (data.type === "start") {
                        // Nova geração iniciada - limpa o buffer
                        currentResponseRef.current = "";
                        console.log("Iniciando geração com modelo:", data.model);
                        
                    } else if (data.type === "token") {
                        // Adiciona token ao buffer
                        currentResponseRef.current += data.text;
                        
                        // Atualiza a última mensagem assistant com o conteúdo completo do buffer
                        setMessages((prev) => {
                            const updated = [...prev];
                            const lastIndex = updated.length - 1;
                            
                            if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                                // Atualiza a mensagem existente com todo o conteúdo acumulado
                                updated[lastIndex] = {
                                    ...updated[lastIndex],
                                    text: currentResponseRef.current,
                                    model: selectedModelRef.current
                                };
                            }
                            return updated;
                        });
                        
                    } else if (data.type === "done") {
                        console.log("Geração finalizada:", data.stats);
                        setIsGenerating(false);
                        // Limpa o buffer após finalizar
                        currentResponseRef.current = "";
                        
                    } else if (data.type === "error") {
                        console.error("Erro do servidor:", data.message);
                        setMessages((prev) => [
                            ...prev,
                            { 
                                role: "error", 
                                text: data.message, 
                                timestamp: new Date().toLocaleTimeString() 
                            },
                        ]);
                        setIsGenerating(false);
                        currentResponseRef.current = "";
                        
                    } else if (data.type === "connected") {
                        console.log("Conectado ao servidor:", data.mode);
                        
                    } else if (data.type === "info") {
                        console.log("Info do servidor:", data.message);
                    }
                    
                } catch (err) {
                    console.warn("Erro ao parsear mensagem WS:", err);
                    setIsGenerating(false);
                    currentResponseRef.current = "";
                }
            };

            socket.onclose = (ev) => {
                console.log("WebSocket fechado", ev.reason || ev.code);
                socketRef.current = null;
                setIsConnected(false);
                setIsGenerating(false);
                currentResponseRef.current = "";
                attemptReconnect();
            };

            socket.onerror = (err) => {
                console.error("Erro no WebSocket:", err);
                setIsConnected(false);
                setIsGenerating(false);
                currentResponseRef.current = "";
            };

            return socket;
            
        } catch (err) {
            console.error("Falha ao criar WebSocket:", err);
            setIsConnected(false);
            setIsGenerating(false);
            attemptReconnect();
        }
    };

    const sendMessage = (text) => {
        const message = (text || "").trim();
        if (!message) return;
        if (isGenerating) {
            console.warn("Já existe uma geração em andamento");
            return;
        }

        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket não está conectado");
            setMessages((prev) => [
                ...prev,
                { 
                    role: "error", 
                    text: "WebSocket desconectado. Tentando reconectar...", 
                    timestamp: new Date().toLocaleTimeString() 
                },
            ]);
            if (!socketRef.current) connectWebSocket();
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        
        // Adiciona mensagem do usuário e placeholder para assistant
        setMessages((prev) => [
            ...prev,
            { role: "user", text: message, timestamp },
            { 
                role: "assistant", 
                text: "", 
                model: selectedModelRef.current, 
                timestamp,
                generating: true // Flag para identificar que está sendo gerada
            },
        ]);

        // Limpa o buffer antes de enviar nova mensagem
        currentResponseRef.current = "";

        try {
            socket.send(JSON.stringify({ 
                prompt: message, 
                modelo: selectedModelRef.current 
            }));
            setIsGenerating(true);
        } catch (err) {
            console.error("Erro ao enviar via WebSocket:", err);
            setIsGenerating(false);
            currentResponseRef.current = "";
            setMessages((prev) => [
                ...prev.slice(0, -1), // Remove a mensagem placeholder
                { 
                    role: "error", 
                    text: "Erro ao enviar mensagem", 
                    timestamp 
                }
            ]);
        }
    };

    const clearChat = () => {
        setMessages([]);
        currentResponseRef.current = "";
    };

    const newChat = () => {
        clearChat();
        if (models.length > 0) {
            setSelectedModel(models[0]);
        }
    };

    useEffect(() => {
        (async () => {
            await fetchModels();
            await fetchServerStatus();
            connectWebSocket();
            statusIntervalRef.current = setInterval(fetchServerStatus, 30000);
        })();

        return () => {
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch (e) { 
                    console.warn("Erro ao fechar WebSocket:", e);
                }
            }
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
            }
            currentResponseRef.current = "";
        };
    }, [apiBaseUrl]);

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