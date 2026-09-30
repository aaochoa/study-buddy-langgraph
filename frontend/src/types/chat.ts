export type MessageIntent = 'chat' | 'code' | 'rag' | null;

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    intent?: MessageIntent;
    modelUsed?: string | null;
    isStreaming?: boolean;
    error?: string | null;
}

export interface ChatSession {
    id: string; // LangGraph thread_id
    title: string;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
}

export interface HealthResponse {
    status: string;
    primary_model?: string;
    all_configured_models?: string[];
}

export interface SystemHealth {
    isOnline: boolean;
    status?: string;
    primaryModel?: string;
    allConfiguredModels?: string[];
    lastChecked?: number;
    error?: string;
}

export interface SSECallbacks {
    onSession?: (data: { thread_id: string }) => void;
    onIntent?: (data: { intent: MessageIntent }) => void;
    onToken?: (data: { token: string }) => void;
    onDone?: (data: { status: string; thread_id: string }) => void;
    onError?: (err: Error) => void;
}
