import { Plugin, showMessage, Dialog, Menu } from "siyuan";
import "./index.scss";
import { IAIConfig, IConversation, IMessage } from "./types/index";

const STORAGE_NAME = "ai-config";
const CONVERSATIONS_KEY = "conversations";

export default class AISidePlugin extends Plugin {
    private config: IAIConfig;
    private conversations: IConversation[] = [];
    private currentConversation: IConversation | null = null;
    private isLoading: boolean = false;

    async onload() {
        // 加载配置
        this.config = await this.loadData(STORAGE_NAME) || {
            baseUrl: "https://api.djxx.online/v1/chat/completions",
            apiKey: "",
            model: "gpt-3.5-turbo",
            maxContextLength: 10,
            systemPrompt: "You are a helpful assistant."
        };
        
        // 加载对话历史
        this.conversations = await this.loadData(CONVERSATIONS_KEY) || [];

        // 添加顶栏按钮
        this.addTopBar({
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16 13H13V16C13 16.55 12.55 17 12 17C11.45 17 11 16.55 11 16V13H8C7.45 13 7 12.55 7 12C7 11.45 7.45 11 8 11H11V8C11 7.45 11.45 7 12 7C12.55 7 13 7.45 13 8V11H16C16.55 11 17 11.45 17 12C17 12.55 16.55 13 16 13Z" fill="currentColor"/>
            </svg>`,
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                this.showChatDialog();
            }
        });
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    private createNewConversation(): IConversation {
        // 查找是否已存在空对话
        const emptyConversation = this.conversations.find(c => c.messages.length === 0);
        if (emptyConversation) {
            return emptyConversation;
        }

        // 如果当前对话是空的,直接返回
        if (this.currentConversation && this.currentConversation.messages.length === 0) {
            return this.currentConversation;
        }

        const conversation: IConversation = {
            id: this.generateId(),
            title: "新对话",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.conversations.unshift(conversation);
        return conversation;
    }

    private saveConversations() {
        // 过滤掉没有消息的对话
        this.conversations = this.conversations.filter(conv => conv.messages.length > 0);
        this.saveData(CONVERSATIONS_KEY, this.conversations);
    }

    private async sendMessage(content: string): Promise<string | null> {
        if (!this.config.apiKey) {
            showMessage(this.i18n.apiKeyRequired);
            return null;
        }

        try {
            this.isLoading = true;
            const response = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: "system",
                            content: this.config.systemPrompt
                        },
                        {
                            role: "user",
                            content: content
                        }
                    ],
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error: any) {
            showMessage("API请求失败: " + (error.message || "未知错误"));
            console.error(error);
            return null;
        } finally {
            this.isLoading = false;
        }
    }

    private showChatDialog() {
        const dialog = new Dialog({
            title: "AI Chat",
            content: `<div class="ai-chat-container">
                <div class="chat-sidebar">
                    <div class="sidebar-header">
                        <button class="b3-button b3-button--outline" aria-label="${this.i18n.newChat}">
                            <svg><use xlink:href="#iconPlus"></use></svg>
                            <span>${this.i18n.newChat}</span>
                        </button>
                    </div>
                    <div class="conversation-list" role="list"></div>
                </div>
                <div class="chat-main">
                    <div class="chat-header">
                        <div class="header-info">
                            <h2 class="header-title">AI Chat</h2>
                            <span class="header-subtitle">与AI助手对话</span>
                        </div>
                        <div class="header-actions">
                            <button class="b3-button b3-button--outline" 
                                aria-label="${this.i18n.clearChat}" 
                                data-tooltip="${this.i18n.clearChat}">
                                <svg><use xlink:href="#iconTrashcan"></use></svg>
                            </button>
                            <button class="b3-button b3-button--outline" 
                                aria-label="${this.i18n.settings}" 
                                data-tooltip="${this.i18n.settings}">
                                <svg><use xlink:href="#iconSettings"></use></svg>
                            </button>
                        </div>
                    </div>
                    <div class="chat-history" role="log"></div>
                    <div class="chat-input">
                        <div class="input-container">
                            <textarea 
                                class="b3-text-field" 
                                placeholder="${this.i18n.inputPlaceholder}" 
                                aria-label="消息输入框"
                                rows="1"
                            ></textarea>
                            <button class="send-button b3-button b3-button--text" aria-label="${this.i18n.send}">
                                <svg><use xlink:href="#iconSend"></use></svg>
                            </button>
                        </div>
                    </div>
                </div>
</div>`,
            width: "960px",
            height: "800px"
        });

        // 获取DOM元素
        const historyElement = dialog.element.querySelector(".chat-history") as HTMLElement;
        const inputElement = dialog.element.querySelector("textarea") as HTMLTextAreaElement;
        const sendButton = dialog.element.querySelector(".send-button") as HTMLButtonElement;
        const clearButton = dialog.element.querySelector('.header-actions .b3-button:first-child') as HTMLButtonElement;
        const settingsButton = dialog.element.querySelector('.header-actions .b3-button:last-child') as HTMLButtonElement;
        const newChatButton = dialog.element.querySelector(".sidebar-header .b3-button") as HTMLButtonElement;
        const conversationList = dialog.element.querySelector(".conversation-list") as HTMLElement;

        // 如果没有当前对话,创建新对话
        if (!this.currentConversation) {
            this.currentConversation = this.createNewConversation();
        }

        // 渲染初始状态
        this.renderConversationList(conversationList);
        this.renderCurrentConversation(historyElement);

        // 清空当前对话
        clearButton.addEventListener('click', () => {
            if (!this.currentConversation || this.currentConversation.messages.length === 0) return;
            
            this.currentConversation.messages = [];
            this.currentConversation.updatedAt = Date.now();
            // 从对话列表中移除
            this.conversations = this.conversations.filter(c => c.id !== this.currentConversation.id);
            this.saveConversations();
            this.renderConversationList(conversationList);
            this.renderCurrentConversation(historyElement);
        });

        // 设置按钮
        settingsButton.addEventListener('click', () => {
            this.showSettingsDialog();
        });

        // 新建对话
        newChatButton.addEventListener("click", () => {
            this.currentConversation = this.createNewConversation();
            this.renderConversationList(conversationList);
            this.renderCurrentConversation(historyElement);
        });

        // 发送消息
        const handleSend = async () => {
            if (this.isLoading || !this.currentConversation) return;

            const content = inputElement.value.trim();
            if (!content) return;

            sendButton.disabled = true;
            sendButton.innerHTML = '<svg><use xlink:href="#iconLoading"></use></svg>';
            sendButton.classList.add('loading');

            // 添加用户消息
            const userMessage: IMessage = {
                role: 'user',
                content: content,
                timestamp: Date.now()
            };
            this.currentConversation.messages.push(userMessage);
            this.currentConversation.updatedAt = Date.now();
            
            // 更新标题 - 只在第一条消息时更新
            if (this.currentConversation.messages.length === 1) {
                this.currentConversation.title = content.slice(0, 20) + (content.length > 20 ? "..." : "");
                // 只在有消息时才添加到对话列表
                if (!this.conversations.some(c => c.id === this.currentConversation.id)) {
                    this.conversations.unshift(this.currentConversation);
                }
            }
            
            this.renderConversationList(conversationList);
            this.renderCurrentConversation(historyElement);
            this.saveConversations();  // 这里会过滤空对话
            
            // 清空输入框
            inputElement.value = '';

            // 发送请求
            const response = await this.sendMessage(content);
            if (response) {
                const assistantMessage: IMessage = {
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                };
                this.currentConversation.messages.push(assistantMessage);
                this.currentConversation.updatedAt = Date.now();
                this.renderCurrentConversation(historyElement);
                this.saveConversations();
            }

            sendButton.disabled = false;
            sendButton.innerHTML = '<svg><use xlink:href="#iconSend"></use></svg>';
            sendButton.classList.remove('loading');
        };

        // 绑定发送事件
        sendButton.addEventListener("click", handleSend);
        
        // 支持Enter发送
        inputElement.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // 删除对话处理
        const handleDeleteConversation = (id: string) => {
            this.conversations = this.conversations.filter(c => c.id !== id);
            if (this.currentConversation?.id === id) {
                this.currentConversation = this.conversations[0] || null;
            }
            this.saveConversations();
            this.renderConversationList(conversationList);
            this.renderCurrentConversation(historyElement);
        };

        // 对话列表点击事件委托
        conversationList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const item = target.closest('.conversation-item') as HTMLElement;
            if (!item) return;

            const id = item.getAttribute('data-id');
            if (!id) return;

            // 处理删除按钮点击
            if (target.closest('[data-action="delete"]')) {
                handleDeleteConversation(id);
                return;
            }

            // 处理对话切换
            this.currentConversation = this.conversations.find(c => c.id === id) || null;
            this.renderConversationList(conversationList);
            this.renderCurrentConversation(historyElement);
        });
    }

    private renderConversationList(container: HTMLElement) {
        const html = this.conversations.map(conv => {
            const isActive = this.currentConversation?.id === conv.id;
            const date = new Date(conv.updatedAt).toLocaleDateString();
            return `
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     data-id="${conv.id}" 
                     role="button" 
                     tabindex="0">
                    <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
                    <div class="conversation-meta">${date}</div>
                    <div class="conversation-actions">
                        <button class="b3-button b3-button--outline" data-action="delete">删除</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;

        // 添加事件监听
        container.querySelectorAll('.conversation-item').forEach(item => {
            // 切换对话
            item.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-action="delete"]')) {
                    return;
                }
                const id = item.getAttribute('data-id');
                this.currentConversation = this.conversations.find(c => c.id === id) || null;
                this.renderConversationList(container);
                const historyElement = container.closest('.ai-chat-container').querySelector('.chat-history') as HTMLElement;
                this.renderCurrentConversation(historyElement);
            });

            // 删除对话
            const deleteBtn = item.querySelector('[data-action="delete"]');
            deleteBtn?.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                this.conversations = this.conversations.filter(c => c.id !== id);
                if (this.currentConversation?.id === id) {
                    this.currentConversation = this.conversations[0] || null;
                }
                this.saveConversations();
                this.renderConversationList(container);
                const historyElement = container.closest('.ai-chat-container').querySelector('.chat-history') as HTMLElement;
                this.renderCurrentConversation(historyElement);
            });
        });
    }

    private renderCurrentConversation(container: HTMLElement) {
        if (!this.currentConversation) {
            container.innerHTML = '<div class="empty-message">选择或创建一个对话</div>';
            return;
        }

        const html = this.currentConversation.messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            return `
                <div class="message ${msg.role}" role="listitem">
                    <div class="message-header">
                        <span class="message-role">${msg.role === 'user' ? '用户' : 'AI'}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="content">${this.escapeHtml(msg.content)}</div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private showSettingsDialog() {
        const dialog = new Dialog({
            title: "Settings",
            content: `<div class="ai-settings-dialog">
                <div class="dialog-content">
                    <div class="config-section">
                        <div class="section-header">
                            <h3 class="section-title">基础设置</h3>
                        </div>
                        <div class="config-grid">
                            <div class="config-item">
                                <label for="baseUrl">
                                    <svg><use xlink:href="#iconLink"></use></svg>
                                    API 地址
                                </label>
                                <div class="input-wrapper">
                                    <input type="text" id="baseUrl" class="b3-text-field" 
                                        value="${this.escapeHtml(this.config.baseUrl)}">
                                </div>
                            </div>
                            <div class="config-item">
                                <label for="apiKey">
                                    <svg><use xlink:href="#iconKey"></use></svg>
                                    API Key
                                </label>
                                <div class="input-wrapper">
                                    <input type="password" id="apiKey" class="b3-text-field" 
                                        value="${this.escapeHtml(this.config.apiKey)}">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="config-section">
                        <div class="section-header">
                            <h3 class="section-title">模型设置</h3>
                        </div>
                        <div class="config-grid">
                            <div class="config-item">
                                <label for="model">
                                    <svg><use xlink:href="#iconSparkles"></use></svg>
                                    模型选择
                                </label>
                                <div class="input-wrapper">
                                    <input type="text" id="model" class="b3-text-field" 
                                        placeholder="输入模型名称，如: gpt-3.5-turbo"
                                        value="${this.escapeHtml(this.config.model)}">
                                </div>
                            </div>
                            <div class="config-item">
                                <label for="systemPrompt">
                                    <svg><use xlink:href="#iconMark"></use></svg>
                                    系统提示词
                                </label>
                                <div class="input-wrapper">
                                    <textarea id="systemPrompt" class="b3-text-field" 
                                        rows="3">${this.escapeHtml(this.config.systemPrompt)}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="b3-button b3-button--cancel">取消</button>
                    <button class="b3-button b3-button--text">保存设置</button>
                </div>
            </div>`,
            width: "680px",
            height: "auto"
        });

        const saveButton = dialog.element.querySelector(".b3-button--text") as HTMLButtonElement;
        const cancelButton = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;

        saveButton.addEventListener("click", () => {
            const baseUrl = (dialog.element.querySelector('#baseUrl') as HTMLInputElement).value;
            const apiKey = (dialog.element.querySelector('#apiKey') as HTMLInputElement).value;
            const model = (dialog.element.querySelector('#model') as HTMLInputElement).value;
            const systemPrompt = (dialog.element.querySelector('#systemPrompt') as HTMLTextAreaElement).value;

            this.config = {
                ...this.config,
                baseUrl,
                apiKey,
                model,
                systemPrompt
            };

            this.saveData(STORAGE_NAME, this.config);
            dialog.destroy();
            showMessage("设置已保存");
        });

        cancelButton.addEventListener("click", () => {
            dialog.destroy();
        });
    }

    onunload() {
        // 清理工作
        this.saveData(STORAGE_NAME, this.config);
        this.saveData(CONVERSATIONS_KEY, this.conversations);
    }
}