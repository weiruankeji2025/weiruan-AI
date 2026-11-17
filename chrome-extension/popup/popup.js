/**
 * ============================================
 * 威软AI聚合 (WeiRuan AI Aggregator)
 * Chrome Extension - Popup Script
 * ============================================
 * 版权所有 (C) 2024 威软科技
 *
 * 本软件受版权法保护。未经作者书面许可，
 * 禁止修改、分发或用于商业目的。
 *
 * 作者：威软科技开发
 * ============================================
 */

// AI平台配置
const CONFIG = {
    version: '1.0.0',
    author: '威软科技开发',
    copyright: '© 2024 威软科技 - 修改代码需要作者许可',

    platforms: {
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            defaultModel: 'gpt-4o-mini',
            authType: 'Bearer'
        },
        anthropic: {
            name: 'Claude',
            baseUrl: 'https://api.anthropic.com/v1',
            models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
            defaultModel: 'claude-3-haiku-20240307',
            authType: 'x-api-key'
        },
        siliconflow: {
            name: 'SiliconFlow',
            baseUrl: 'https://api.siliconflow.cn/v1',
            models: ['deepseek-ai/DeepSeek-V2.5', 'Qwen/Qwen2.5-72B-Instruct'],
            defaultModel: 'deepseek-ai/DeepSeek-V2.5',
            authType: 'Bearer'
        },
        ohmygpt: {
            name: 'OhMyGPT',
            baseUrl: 'https://api.ohmygpt.com/v1',
            models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet'],
            defaultModel: 'gpt-4o-mini',
            authType: 'Bearer'
        },
        deepseek: {
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com/v1',
            models: ['deepseek-chat', 'deepseek-coder'],
            defaultModel: 'deepseek-chat',
            authType: 'Bearer'
        },
        moonshot: {
            name: 'Kimi',
            baseUrl: 'https://api.moonshot.cn/v1',
            models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
            defaultModel: 'moonshot-v1-8k',
            authType: 'Bearer'
        },
        zhipu: {
            name: '智谱GLM',
            baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
            models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
            defaultModel: 'glm-4-flash',
            authType: 'Bearer'
        },
        qwen: {
            name: '通义千问',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
            models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
            defaultModel: 'qwen-turbo',
            authType: 'Bearer'
        },
        baichuan: {
            name: '百川AI',
            baseUrl: 'https://api.baichuan-ai.com/v1',
            models: ['Baichuan2-Turbo', 'Baichuan2-Turbo-192k'],
            defaultModel: 'Baichuan2-Turbo',
            authType: 'Bearer'
        },
        minimax: {
            name: 'MiniMax',
            baseUrl: 'https://api.minimax.chat/v1',
            models: ['abab6.5-chat', 'abab5.5-chat'],
            defaultModel: 'abab6.5-chat',
            authType: 'Bearer'
        }
    }
};

// 存储管理
class StorageManager {
    static async get(key, defaultValue = null) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    }

    static async set(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    static async getApiKeys() {
        return await this.get('apiKeys', {});
    }

    static async setApiKey(platform, key) {
        const keys = await this.getApiKeys();
        keys[platform] = key;
        await this.set('apiKeys', keys);
    }

    static async getSettings() {
        return await this.get('settings', {
            theme: 'dark',
            defaultPlatform: 'openai',
            enableCollaboration: true
        });
    }

    static async setSettings(settings) {
        await this.set('settings', settings);
    }
}

// AI客户端
class AIClient {
    constructor(platform, apiKey) {
        this.platform = platform;
        this.apiKey = apiKey;
        this.config = CONFIG.platforms[platform];
    }

    async chat(messages, model = null, options = {}) {
        const selectedModel = model || this.config.defaultModel;
        const streaming = typeof options.onDelta === 'function';
        const headers = { 'Content-Type': 'application/json' };
        if (this.config.authType === 'Bearer') headers.Authorization = 'Bearer ' + this.apiKey;
        if (this.config.authType === 'x-api-key') {
            headers['x-api-key'] = this.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        }

        const body = this.platform === 'anthropic'
            ? { model: selectedModel, max_tokens: options.maxTokens || 4096, stream: streaming,
                messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })) }
            : { model: selectedModel, messages, temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens || 4096, stream: streaming };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);
        try {
            const endpoint = this.platform === 'anthropic' ? '/messages' : '/chat/completions';
            const response = await fetch(this.config.baseUrl + endpoint, {
                method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal
            });

            if (!response.ok) {
                const raw = await response.text();
                let errorData = {};
                try { errorData = JSON.parse(raw); } catch {}
                throw new Error(errorData.error?.message || errorData.message || ('HTTP ' + response.status));
            }

            if (streaming && response.body && response.body.getReader && (response.headers.get('content-type') || '').includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let content = '';
                const handleLine = (line) => {
                    const value = line.trim();
                    if (!value.startsWith('data:')) return;
                    const payload = value.slice(5).trim();
                    if (!payload || payload === '[DONE]') return;
                    let event;
                    try { event = JSON.parse(payload); } catch { return; }
                    let delta = '';
                    if (this.platform === 'anthropic') {
                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') delta = event.delta.text || '';
                    } else {
                        delta = event.choices?.[0]?.delta?.content || '';
                        if (Array.isArray(delta)) delta = delta.map(part => part.text || '').join('');
                    }
                    if (delta) {
                        content += delta;
                        options.onDelta(delta);
                    }
                };
                while (true) {
                    const chunk = await reader.read();
                    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || '';
                    lines.forEach(handleLine);
                    if (chunk.done) break;
                }
                if (buffer) handleLine(buffer);
                if (!content.trim()) throw new Error('模型没有返回文本内容，请检查服务商是否支持流式输出');
                return { success: true, content, model: selectedModel, platform: this.platform };
            }

            const data = await response.json();
            const content = this.platform === 'anthropic'
                ? data.content?.filter(item => item.type === 'text').map(item => item.text).join('\n')
                : data.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) throw new Error('服务商没有返回可显示的文本');
            if (streaming) options.onDelta(content);
            return { success: true, content, model: selectedModel, platform: this.platform, usage: data.usage };
        } catch (error) {
            const message = error.name === 'AbortError' ? '请求超时（120秒），请检查网络后重试' : (error.message || '网络请求失败');
            throw { success: false, error: message, platform: this.platform };
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

// 协作引擎
class CollaborationEngine {
    async decomposeTask(mainTask, aiClients) {
        const decomposer = aiClients[0];
        const prompt = `你是一个任务分解专家。请将以下任务分解为可以并行执行的子任务。

主任务: ${mainTask}

请以JSON格式返回，格式：
{
    "subtasks": [
        {"id": 1, "title": "子任务标题", "description": "详细描述", "expertise": "专业领域"}
    ]
}

只返回JSON。`;

        try {
            const response = await decomposer.chat([{ role: 'user', content: prompt }]);
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
                    return parsed.subtasks.slice(0, 8).map((task, index) => ({
                        id: task.id ?? index + 1,
                        title: String(task.title || `子任务 ${index + 1}`),
                        description: String(task.description || task.title || ''),
                        expertise: String(task.expertise || 'general')
                    }));
                }
            }
        } catch (e) {
            console.error('任务分解失败:', e);
        }

        return [{ id: 1, title: mainTask, description: mainTask, expertise: 'general' }];
    }

    assignTasks(subtasks, aiClients) {
        return subtasks.map((task, index) => ({
            task: task,
            client: aiClients[index % aiClients.length]
        }));
    }

    async executeCollaboration(mainTask, selectedPlatforms) {
        const apiKeys = await StorageManager.getApiKeys();
        const aiClients = [];

        for (const platform of selectedPlatforms) {
            if (apiKeys[platform]) {
                aiClients.push(new AIClient(platform, apiKeys[platform]));
            }
        }

        if (aiClients.length === 0) {
            throw new Error('没有可用的AI平台');
        }

        const subtasks = await this.decomposeTask(mainTask, aiClients);
        const assignments = this.assignTasks(subtasks, aiClients);

        const results = await Promise.allSettled(
            assignments.map(async (assignment) => {
                const prompt = `你正在参与协作项目。任务：
标题: ${assignment.task.title}
描述: ${assignment.task.description}

请完成任务并提供输出。`;

                return {
                    task: assignment.task,
                    platform: assignment.client.platform,
                    response: await assignment.client.chat([{ role: 'user', content: prompt }])
                };
            })
        );

        const completedResults = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
        const failures = results
            .filter(r => r.status === 'rejected')
            .map((r, index) => ({
                message: r.reason?.error || r.reason?.message || '未知错误',
                index: index + 1
            }));

        if (completedResults.length === 0) {
            throw new Error(failures.map(item => item.message).join('；') || '所有协作任务均未成功');
        }

        const summaryClient = aiClients[0];
        const summaryPrompt = `请汇总以下子任务结果：

${completedResults.map(r => `
### ${r.task.title} (${CONFIG.platforms[r.platform].name})
${r.response.content}
`).join('\n')}

请提供完整汇总报告。`;

        const summary = await summaryClient.chat([{ role: 'user', content: summaryPrompt }]);

        return {
            subtasks: subtasks,
            results: completedResults,
            failures,
            summary: summary.content
        };
    }
}

// UI控制器
class UIController {
    constructor() {
        this.selectedPlatform = null;
        this.collaborationEngine = new CollaborationEngine();
        this.sessions = [];
        this.currentSessionId = null;
        this.isSending = false;
        this.init();
    }

    async init() {
        await this.renderPlatforms();
        await this.renderSettings();
        await this.loadSessions();
        this.bindEvents();
        chrome.storage.local.get(['selectedText'], result => {
            if (result.selectedText) {
                document.getElementById('chat-input').value = result.selectedText;
                chrome.storage.local.remove('selectedText');
            }
        });
    }

    async loadSessions() {
        this.sessions = await StorageManager.get('chatSessions', []);
        if (!Array.isArray(this.sessions)) this.sessions = [];
        if (this.sessions.length) this.currentSessionId = this.sessions[0].id;
        else this.createNewChat(false);
        this.selectedPlatform = this.getCurrentSession()?.platform || null;
        document.querySelectorAll('.platform-btn').forEach(button => {
            button.classList.toggle('selected', button.dataset.platform === this.selectedPlatform);
        });
        this.renderHistory();
        this.renderMessages();
    }

    getCurrentSession() {
        return this.sessions.find(item => item.id === this.currentSessionId) || null;
    }

    async persistSessions() {
        this.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        this.sessions = this.sessions.slice(0, 50).map(item => ({
            ...item, messages: (item.messages || []).slice(-80)
        }));
        await StorageManager.set('chatSessions', this.sessions);
        this.renderHistory();
    }

    createNewChat(persist = true) {
        const id = 'chat-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        this.sessions.unshift({ id, title: '新对话', platform: this.selectedPlatform, messages: [], updatedAt: Date.now() });
        this.currentSessionId = id;
        this.renderMessages();
        this.renderHistory();
        if (persist) this.persistSessions();
    }

    switchConversation(id) {
        if (!this.sessions.some(item => item.id === id)) return;
        this.currentSessionId = id;
        const session = this.getCurrentSession();
        this.selectedPlatform = session.platform || null;
        document.querySelectorAll('.platform-btn').forEach(button => {
            button.classList.toggle('selected', button.dataset.platform === this.selectedPlatform);
        });
        this.renderMessages();
        this.renderHistory();
    }

    async clearCurrentChat() {
        const session = this.getCurrentSession();
        if (!session) return;
        session.messages = [];
        session.title = '新对话';
        session.updatedAt = Date.now();
        await this.persistSessions();
        this.renderMessages();
    }

    renderHistory() {
        const select = document.getElementById('history-select');
        if (!select) return;
        select.replaceChildren();
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = (session.title || '新对话') + ' · ' + new Date(session.updatedAt).toLocaleDateString();
            option.selected = session.id === this.currentSessionId;
            select.appendChild(option);
        });
    }

    appendMessage(role, content, platform) {
        const container = document.getElementById('chat-messages');
        const article = document.createElement('article');
        article.className = 'message ' + (role === 'user' ? 'user' : 'assistant');
        if (role !== 'user') {
            const meta = document.createElement('div');
            meta.className = 'message-platform';
            meta.textContent = CONFIG.platforms[platform || this.selectedPlatform]?.name || 'AI 助手';
            article.appendChild(meta);
        }
        const body = document.createElement('div');
        body.className = 'message-content';
        body.textContent = content || '';
        article.appendChild(body);
        container.appendChild(article);
        container.scrollTop = container.scrollHeight;
        return body;
    }

    renderMessages() {
        const container = document.getElementById('chat-messages');
        const session = this.getCurrentSession();
        container.replaceChildren();
        if (!session || !session.messages || !session.messages.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            const icon = document.createElement('span');
            icon.className = 'empty-icon';
            icon.textContent = '✦';
            const title = document.createElement('p');
            title.textContent = '选择 AI 模型，开始一场新对话';
            const hint = document.createElement('small');
            hint.textContent = '聊天记录会自动保存在本地';
            empty.append(icon, title, hint);
            container.appendChild(empty);
            return;
        }
        session.messages.forEach(item => this.appendMessage(item.role, item.content, item.platform));
        container.scrollTop = container.scrollHeight;
    }

    async renderPlatforms() {
        const apiKeys = await StorageManager.getApiKeys();
        const platformSelect = document.getElementById('platform-select');
        platformSelect.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) =>
            '<button class="platform-btn ' + (apiKeys[key] ? '' : 'disabled') + '" data-platform="' + key + '" ' +
            (apiKeys[key] ? '' : 'disabled') + '>' + platform.name + '</button>'
        ).join('');
        const collabPlatforms = document.getElementById('collab-platforms');
        collabPlatforms.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) =>
            '<label class="checkbox-item ' + (apiKeys[key] ? '' : 'disabled') + '">' +
            '<input type="checkbox" id="collab-' + key + '" value="' + key + '" ' +
            (apiKeys[key] ? '' : 'disabled') + '><span>' + platform.name + '</span></label>'
        ).join('');
        if (this.selectedPlatform) {
            const selected = platformSelect.querySelector('[data-platform="' + this.selectedPlatform + '"]');
            if (selected && !selected.disabled) selected.classList.add('selected');
        }
    }

    async renderSettings() {
        const apiKeys = await StorageManager.getApiKeys();
        const apiSettings = document.getElementById('api-settings');
        apiSettings.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) =>
            '<div class="api-item"><label for="api-' + key + '">' + platform.name + '</label>' +
            '<input type="password" id="api-' + key + '" autocomplete="off" placeholder="输入 API 密钥" ' +
            'value="' + this.escapeAttribute(apiKeys[key] || '') + '"></div>'
        ).join('');
    }

    bindEvents() {
        document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => this.switchTab(tab.dataset.tab)));
        document.getElementById('platform-select').addEventListener('click', event => {
            const button = event.target.closest('.platform-btn');
            if (!button || button.disabled) return;
            this.selectedPlatform = button.dataset.platform;
            document.querySelectorAll('.platform-btn').forEach(item => item.classList.toggle('selected', item === button));
            const session = this.getCurrentSession();
            if (session) {
                session.platform = this.selectedPlatform;
                this.persistSessions();
            }
        });
        document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        document.getElementById('chat-new').addEventListener('click', () => this.createNewChat());
        document.getElementById('history-select').addEventListener('change', event => this.switchConversation(event.target.value));
        document.getElementById('chat-clear').addEventListener('click', () => this.clearCurrentChat());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('collab-start').addEventListener('click', () => this.startCollaboration());
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
        document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === 'panel-' + tabName));
    }

    async sendMessage() {
        if (this.isSending) return;
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;
        if (!this.selectedPlatform) {
            this.switchTab('settings');
            alert('请先配置 API 密钥，并选择一个 AI 平台。');
            return;
        }
        const apiKeys = await StorageManager.getApiKeys();
        if (!apiKeys[this.selectedPlatform]) {
            this.switchTab('settings');
            alert('请先配置该平台的 API 密钥。');
            return;
        }

        if (!this.getCurrentSession()) this.createNewChat(false);
        const session = this.getCurrentSession();
        session.platform = this.selectedPlatform;
        if (!session.messages.length) session.title = message.slice(0, 28);
        session.messages.push({ role: 'user', content: message, platform: this.selectedPlatform, time: Date.now() });
        this.appendMessage('user', message);
        const assistantBody = this.appendMessage('assistant', '正在连接模型…', this.selectedPlatform);
        input.value = '';

        const sendButton = document.getElementById('chat-send');
        this.isSending = true;
        sendButton.disabled = true;
        sendButton.innerHTML = '生成中…';
        let answer = '';
        try {
            const client = new AIClient(this.selectedPlatform, apiKeys[this.selectedPlatform]);
            const history = session.messages.slice(-21).map(item => ({ role: item.role, content: item.content }));
            await client.chat(history, null, {
                onDelta: delta => {
                    answer += delta;
                    assistantBody.textContent = answer;
                    const messages = document.getElementById('chat-messages');
                    messages.scrollTop = messages.scrollHeight;
                }
            });
            if (!answer.trim()) throw new Error('模型未返回内容');
            session.messages.push({ role: 'assistant', content: answer, platform: this.selectedPlatform, time: Date.now() });
        } catch (error) {
            const errorText = error.error || error.message || '请求失败';
            assistantBody.textContent = '请求失败：' + errorText;
            session.messages.push({ role: 'assistant', content: '请求失败：' + errorText, platform: this.selectedPlatform, time: Date.now() });
        } finally {
            session.updatedAt = Date.now();
            await this.persistSessions();
            this.isSending = false;
            sendButton.disabled = false;
            sendButton.textContent = '发送 ↑';
            input.focus();
        }
    }

    async startCollaboration() {
        const task = document.getElementById('collab-task').value.trim();
        if (!task) return alert('请输入项目或任务描述');
        const selectedPlatforms = Array.from(document.querySelectorAll('#collab-platforms input:checked')).map(input => input.value);
        if (selectedPlatforms.length < 2) return alert('请至少选择2个 AI 平台进行协作');
        const resultDiv = document.getElementById('collab-result');
        const outputDiv = document.getElementById('collab-output');
        const startButton = document.getElementById('collab-start');
        resultDiv.style.display = 'block';
        outputDiv.textContent = '正在分解任务并分配给各 AI…';
        startButton.disabled = true;
        try {
            const result = await this.collaborationEngine.executeCollaboration(task, selectedPlatforms);
            let output = '=== 任务分解 ===\n' + result.subtasks.map((item, index) => (index + 1) + '. ' + item.title).join('\n');
            output += '\n\n=== 各 AI 完成情况 ===\n';
            result.results.forEach(item => { output += '\n【' + CONFIG.platforms[item.platform].name + '】' + item.task.title + '\n' + item.response.content + '\n'; });
            if (result.failures && result.failures.length) output += '\n部分任务失败：\n' + result.failures.map(item => item.message).join('\n');
            output += '\n=== 汇总报告 ===\n' + result.summary;
            outputDiv.textContent = output;
        } catch (error) {
            outputDiv.textContent = '协作失败：' + (error.message || error);
        } finally {
            startButton.disabled = false;
        }
    }

    async saveSettings() {
        const apiKeys = await StorageManager.getApiKeys();
        for (const key of Object.keys(CONFIG.platforms)) {
            const input = document.getElementById('api-' + key);
            if (!input) continue;
            const value = input.value.trim();
            if (value) apiKeys[key] = value;
            else delete apiKeys[key];
        }
        await StorageManager.set('apiKeys', apiKeys);
        if (this.selectedPlatform && !apiKeys[this.selectedPlatform]) this.selectedPlatform = null;
        await this.renderPlatforms();
        const button = document.getElementById('save-settings');
        button.textContent = '已保存 ✓';
        setTimeout(() => { button.textContent = '保存设置'; }, 1600);
    }

    escapeAttribute(value) {
        return String(value).replace(/[&"'<>]/g, char => ({
            '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'
        })[char]);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new UIController();

    console.log(`
    ╔═══════════════════════════════════════════╗
    ║       威软AI聚合 v${CONFIG.version}              ║
    ║       WeiRuan AI Aggregator               ║
    ║                                           ║
    ║       ${CONFIG.copyright}       ║
    ║       作者：${CONFIG.author}                ║
    ╚═══════════════════════════════════════════╝
    `);
});
