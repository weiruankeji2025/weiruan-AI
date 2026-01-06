/**
 * ============================================
 * 威软AI聚合 (WeiRuan AI Aggregator)
 * Chrome Extension - Background Service Worker
 * ============================================
 * 版权所有 (C) 2024 威软科技
 *
 * 本软件受版权法保护。未经作者书面许可，
 * 禁止修改、分发或用于商业目的。
 *
 * 作者：威软科技开发
 * ============================================
 */

// 安装时初始化
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('威软AI聚合已安装');

        // 初始化默认设置
        chrome.storage.local.set({
            settings: {
                theme: 'dark',
                defaultPlatform: 'openai',
                enableCollaboration: true
            },
            apiKeys: {},
            chatHistory: []
        });
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'API_REQUEST') {
        handleAPIRequest(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开启
    }

    if (request.type === 'GET_API_KEYS') {
        chrome.storage.local.get(['apiKeys'], (result) => {
            sendResponse({ apiKeys: result.apiKeys || {} });
        });
        return true;
    }

    if (request.type === 'SAVE_API_KEY') {
        chrome.storage.local.get(['apiKeys'], (result) => {
            const apiKeys = result.apiKeys || {};
            apiKeys[request.platform] = request.key;
            chrome.storage.local.set({ apiKeys }, () => {
                sendResponse({ success: true });
            });
        });
        return true;
    }
});

// 处理API请求
async function handleAPIRequest(data) {
    const { url, method, headers, body } = data;

    const response = await fetch(url, {
        method: method || 'POST',
        headers: headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return await response.json();
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'weiruan-ai-query',
        title: '使用威软AI聚合查询',
        contexts: ['selection']
    });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'weiruan-ai-query' && info.selectionText) {
        chrome.storage.local.set({
            selectedText: info.selectionText
        }, () => {
            chrome.action.openPopup();
        });
    }
});

console.log('威软AI聚合 - 后台服务已启动');
