export interface IAIConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    maxContextLength: number;
    systemPrompt: string;
}

export interface IMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface IConversation {
    id: string;
    title: string;
    messages: IMessage[];
    createdAt: number;
    updatedAt: number;
} 