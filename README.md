# 威软AI聚合 (WeiRuan AI Aggregator)

> 聚合多个热门AI平台，支持API接口调用，多AI分工协作

**版权所有 (C) 2024 威软科技 - 修改代码需要作者许可**

**作者：威软科技开发**

---

## 功能特点

- **多平台聚合**：支持 OpenAI、Claude、DeepSeek、Kimi、智谱GLM、通义千问等 10+ 主流AI平台
- **API接口支持**：集成 SiliconFlow、OhMyGPT 等第三方API平台
- **智能协作**：多AI分工协作，高效完成复杂任务
- **安全可靠**：API密钥本地存储，数据安全有保障
- **双版本提供**：油猴脚本版 + Chrome插件版

## 支持的AI平台

| 平台 | 模型 |
|------|------|
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo |
| Anthropic | Claude-3-opus, Claude-3-sonnet, Claude-3-haiku |
| SiliconFlow | DeepSeek-V2.5, Qwen2.5-72B, Llama-3.1-405B |
| OhMyGPT | GPT-4o, Claude-3 系列 |
| DeepSeek | DeepSeek-chat, DeepSeek-coder |
| Moonshot (Kimi) | moonshot-v1-8k/32k/128k |
| 智谱AI | GLM-4, GLM-4-flash, GLM-3-turbo |
| 通义千问 | qwen-turbo, qwen-plus, qwen-max |
| 百川AI | Baichuan2-Turbo |
| MiniMax | abab6.5-chat |

## 安装指南

### 油猴脚本版

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击 Tampermonkey 图标 -> 创建新脚本
3. 复制 `tampermonkey/weiruan-ai-aggregator.user.js` 的内容并粘贴
4. 保存脚本（Ctrl+S）
5. 刷新任意网页，点击右下角的浮动按钮即可使用

### Chrome插件版

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `chrome-extension` 文件夹
5. **生成图标**：打开 `chrome-extension/icons/generate-icons.html`，下载生成的图标文件
6. 点击浏览器工具栏的扩展图标即可使用

## 使用说明

### 单AI对话

1. 在设置中配置对应平台的API密钥
2. 在对话页面选择一个AI平台
3. 输入问题并发送

### 多AI协作

1. 配置多个平台的API密钥
2. 切换到"协作"标签页
3. 描述您的项目或任务
4. 选择参与协作的AI（至少2个）
5. 点击"开始协作"

协作流程：
1. 系统会自动分解任务为子任务
2. 各AI并行处理分配的子任务
3. 系统汇总所有结果生成最终报告

## 项目结构

```
weiruan-AI/
├── tampermonkey/
│   └── weiruan-ai-aggregator.user.js    # 油猴脚本
├── chrome-extension/
│   ├── manifest.json                     # 插件配置
│   ├── popup/
│   │   ├── popup.html                    # 弹出界面
│   │   ├── popup.css                     # 样式
│   │   └── popup.js                      # 逻辑
│   ├── js/
│   │   ├── background.js                 # 后台脚本
│   │   └── content.js                    # 内容脚本
│   ├── css/
│   │   └── content.css                   # 注入样式
│   └── icons/
│       ├── icon.svg                      # SVG图标
│       └── generate-icons.html           # 图标生成器
├── LICENSE                               # 许可证
└── README.md                             # 说明文档
```

## 许可证

本软件受版权法保护。未经威软科技书面许可，禁止修改、分发或用于商业目的。

详见 [LICENSE](LICENSE) 文件。

## 联系方式

- 作者：威软科技开发
- Email：weiruan2025@gmail.com

---

**威软科技 WeiRuan Technology** | 修改代码需要作者许可
