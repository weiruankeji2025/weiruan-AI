/**
 * ============================================
 * 威软AI聚合 (WeiRuan AI Aggregator)
 * Chrome Extension - Content Script
 * ============================================
 * 版权所有 (C) 2024 威软科技
 *
 * 本软件受版权法保护。未经作者书面许可，
 * 禁止修改、分发或用于商业目的。
 *
 * 作者：威软科技开发
 * ============================================
 */

(function() {
    'use strict';

    // 创建浮动按钮
    function createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'weiruan-ai-float-btn';
        button.innerHTML = `
            <div class="weiruan-float-icon">威</div>
            <div class="weiruan-float-tooltip">威软AI聚合</div>
        `;

        button.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        });

        document.body.appendChild(button);
    }

    // 创建快速查询面板
    function createQuickPanel() {
        const panel = document.createElement('div');
        panel.id = 'weiruan-ai-quick-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="weiruan-quick-header">
                <span class="weiruan-quick-title">威软AI聚合</span>
                <button class="weiruan-quick-close">&times;</button>
            </div>
            <div class="weiruan-quick-body">
                <textarea class="weiruan-quick-input" placeholder="输入您的问题..."></textarea>
                <button class="weiruan-quick-send">发送</button>
            </div>
            <div class="weiruan-quick-result"></div>
        `;

        const closeBtn = panel.querySelector('.weiruan-quick-close');
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        document.body.appendChild(panel);
        return panel;
    }

    // 监听选中文本
    document.addEventListener('mouseup', (e) => {
        const selection = window.getSelection().toString().trim();
        if (selection && selection.length > 0 && selection.length < 1000) {
            // 可以在这里显示快速操作按钮
        }
    });

    // 快捷键支持
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+W 打开威软AI聚合
        if (e.ctrlKey && e.shiftKey && e.key === 'W') {
            e.preventDefault();
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        }
    });

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        // 可选：创建浮动按钮
        // createFloatingButton();

        console.log('威软AI聚合 - 内容脚本已加载');
    }
})();
