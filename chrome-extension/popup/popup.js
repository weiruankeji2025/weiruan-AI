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

            if (streaming && response.body && response.body.getReader) {
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
        this.init();
    }

    async init() {
        await this.renderPlatforms();
        await this.renderSettings();
        this.bindEvents();

        // 将右键菜单传入的选中文本带入输入框，并立即清理暂存数据
        chrome.storage.local.get(['selectedText'], (result) => {
            if (result.selectedText) {
                const input = document.getElementById('chat-input');
                input.value = result.selectedText;
                chrome.storage.local.remove('selectedText');
                input.focus();
            }
        });
    }

    async renderPlatforms() {
        const apiKeys = await StorageManager.getApiKeys();

        // 渲染聊天平台选择
        const platformSelect = document.getElementById('platform-select');
        platformSelect.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) => `
            <button class="platform-btn ${apiKeys[key] ? '' : 'disabled'}"
                    data-platform="${key}"
                    ${apiKeys[key] ? '' : 'disabled'}>
                ${platform.name}
            </button>
        `).join('');

        // 渲染协作平台选择
        const collabPlatforms = document.getElementById('collab-platforms');
        collabPlatforms.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) => `
            <div class="checkbox-item ${apiKeys[key] ? '' : 'disabled'}">
                <input type="checkbox" id="collab-${key}" value="${key}"
                    ${apiKeys[key] ? '' : 'disabled'}>
                <label for="collab-${key}">${platform.name}</label>
            </div>
        `).join('');
    }

    async renderSettings() {
        const apiKeys = await StorageManager.getApiKeys();
        const apiSettings = document.getElementById('api-settings');

        apiSettings.innerHTML = Object.entries(CONFIG.platforms).map(([key, platform]) => `
            <div class="api-item">
                <label>${platform.name}</label>
                <input type="password" id="api-${key}"
                    placeholder="输入API密钥"
                    value="${apiKeys[key] || ''}">
            </div>
        `).join('');
    }

    bindEvents() {
        // 标签切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // 平台选择
        document.getElementById('platform-select').addEventListener('click', (e) => {
            if (e.target.classList.contains('platform-btn') && !e.target.classList.contains('disabled')) {
                document.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('selected'));
                e.target.classList.add('selected');
                this.selectedPlatform = e.target.dataset.platform;
            }
        });

        // 发送消息
        document.getElementById('chat-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 保存设置
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

        // 开始协作
        document.getElementById('collab-start').addEventListener('click', () => this.startCollaboration());
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabName}`);
        });
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;
        if (!this.selectedPlatform) {
            alert('请先选择一个AI平台');
            return;
        }

        const apiKeys = await StorageManager.getApiKeys();
        if (!apiKeys[this.selectedPlatform]) {
            alert('请先配置该平台的API密钥');
            return;
        }

        const messagesDiv = document.getElementById('chat-messages');
        const sendBtn = document.getElementById('chat-send');

        // 清除空状态
        const emptyState = messagesDiv.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        // 添加用户消息
        messagesDiv.innerHTML += `
            <div class="message user">${this.escapeHtml(message)}</div>
        `;

        input.value = '';

        // 显示加载状态
        const loadingId = 'loading-' + Date.now();
        messagesDiv.innerHTML += `
            <div class="message assistant" id="${loadingId}">
                <div class="message-platform">${CONFIG.platforms[this.selectedPlatform].name}</div>
                <span class="spinner"></span> 正在思考...
            </div>
        `;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        sendBtn.disabled = true;
        sendBtn.querySelector('.btn-text').style.display = 'none';
        sendBtn.querySelector('.btn-loading').style.display = 'flex';

        try {
            const client = new AIClient(this.selectedPlatform, apiKeys[this.selectedPlatform]);
            const response = await client.chat([{ role: 'user', content: message }]);

            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="message-platform">${CONFIG.platforms[this.selectedPlatform].name}</div>
                    ${this.escapeHtml(response.content)}
                `;
            }
        } catch (error) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="message-platform">${CONFIG.platforms[this.selectedPlatform].name}</div>
                    <span style="color: #ff6b6b;">错误: ${error.error || error.message || '请求失败'}</span>
                `;
            }
        }

        sendBtn.disabled = false;
        sendBtn.querySelector('.btn-text').style.display = 'inline';
        sendBtn.querySelector('.btn-loading').style.display = 'none';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async startCollaboration() {
        const taskInput = document.getElementById('collab-task');
        const task = taskInput.value.trim();

        if (!task) {
            alert('请输入项目或任务描述');
            return;
        }

        const selectedPlatforms = [];
        document.querySelectorAll('#collab-platforms input:checked').forEach(cb => {
            selectedPlatforms.push(cb.value);
        });

        if (selectedPlatforms.length < 2) {
            alert('请至少选择2个AI平台进行协作');
            return;
        }

        const resultDiv = document.getElementById('collab-result');
        const outputDiv = document.getElementById('collab-output');
        const startBtn = document.getElementById('collab-start');

        resultDiv.style.display = 'block';
        outputDiv.textContent = '正在分解任务并分配给各AI...\n';

        startBtn.disabled = true;
        startBtn.querySelector('.btn-text').style.display = 'none';
        startBtn.querySelector('.btn-loading').style.display = 'flex';

        try {
            const result = await this.collaborationEngine.executeCollaboration(task, selectedPlatforms);

            let output = '=== 任务分解 ===\n';
            result.subtasks.forEach((st, i) => {
                output += `${i + 1}. ${st.title}\n`;
            });

            output += '\n=== 各AI完成情况 ===\n';
            result.results.forEach(r => {
                output += `\n【${CONFIG.platforms[r.platform].name}】${r.task.title}\n`;
                output += `${r.response.content}\n`;
                output += '---\n';
            });

            output += '\n=== 汇总报告 ===\n';
            output += result.summary;

            outputDiv.textContent = output;
        } catch (error) {
            outputDiv.textContent = `协作失败: ${error.message || error}`;
        }

        startBtn.disabled = false;
        startBtn.querySelector('.btn-text').style.display = 'inline';
        startBtn.querySelector('.btn-loading').style.display = 'none';
    }

    async saveSettings() {
        const apiKeys = await StorageManager.getApiKeys();

        // 一次性写入，允许清空密钥，避免逐个平台重复读写存储
        for (const key of Object.keys(CONFIG.platforms)) {
            const input = document.getElementById(`api-${key}`);
            if (input) {
                const value = input.value.trim();
                if (value) apiKeys[key] = value;
                else delete apiKeys[key];
            }
        }

        await StorageManager.set('apiKeys', apiKeys);
        if (this.selectedPlatform && !apiKeys[this.selectedPlatform]) {
            this.selectedPlatform = null;
        }
        await this.renderPlatforms();
        const saveButton = document.getElementById('save-settings');
        saveButton.textContent = '已保存 ✓';
        setTimeout(() => { saveButton.textContent = '保存设置'; }, 1800);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
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
