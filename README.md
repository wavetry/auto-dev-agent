# Auto Dev Agent

基于 [Anthropic 长时间运行 Agent 最佳实践](https://anthropic.com/engineering/effective-harnesses-for-long-running-agents)构建的自动持续开发测试系统。

通过 **Initializer Agent + Coding Agent** 双阶段架构，让 AI 跨多个上下文窗口增量式完成后端 API 项目的开发和测试。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator (调度器)                  │
│                                                         │
│   Session 1           Session 2..N                      │
│  ┌──────────────┐   ┌──────────────┐                    │
│  │  Initializer  │──>│  Coding      │──> ... ──> Done   │
│  │  Agent        │   │  Agent       │                    │
│  │              │   │              │                    │
│  │ - 分析需求    │   │ - 读取进度    │                    │
│  │ - 生成功能列表 │   │ - 选1个功能   │                    │
│  │ - 项目骨架    │   │ - 实现+测试   │                    │
│  │ - init.sh    │   │ - Git提交     │                    │
│  │ - Git初始化   │   │ - 更新进度    │                    │
│  └──────────────┘   └──────────────┘                    │
│                                                         │
│  共享状态：feature_list.json / agent-progress.txt / Git  │
└─────────────────────────────────────────────────────────┘
```

## 前置条件

- Node.js >= 18
- Git
- Anthropic API Key

## 安装

```bash
cd F:\git\auto-dev-agent
npm install
npm run build
```

## 配置 API Key

```bash
# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-xxxxx

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-xxxxx"

# Linux / Mac
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

也可以通过 `--api-key` 参数直接传入。

### 第三方 API 提供商（阿里云百炼等）

如果使用第三方 Anthropic 兼容 API，需要额外设置 base URL：

```bash
# Windows CMD
set ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic

# Windows PowerShell
$env:ANTHROPIC_BASE_URL="https://coding.dashscope.aliyuncs.com/apps/anthropic"

# Linux / Mac
export ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic
```

也可以通过 `--base-url` 参数直接传入。

## 命令一览

| 命令 | 说明 |
|------|------|
| `run` | 启动全新的自动开发流程 |
| `resume` | 中断后恢复开发 |
| `status` | 查看功能列表和完成状态 |
| `progress` | 查看每个会话的工作日志 |

## 使用方法

### 1. 启动自动开发 (`run`)

```bash
npx tsx src/cli.ts run \
  --spec "你的项目需求描述" \
  --project-dir /path/to/target-project \
  --test-url http://localhost:3000
```

**参数说明：**

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--spec <spec>` | 是 | - | 项目需求描述，可以是字符串或文件路径 |
| `--project-dir <dir>` | 否 | 当前目录 | 目标项目的生成目录 |
| `--api-key <key>` | 否 | 环境变量 | Anthropic API Key |
| `--base-url <url>` | 否 | 环境变量 | API base URL（第三方提供商如阿里云百炼） |
| `--model <model>` | 否 | `claude-sonnet-4-20250514` | 使用的模型 |
| `--max-sessions <n>` | 否 | `50` | 最大会话数 |
| `--max-tokens <n>` | 否 | `100000` | 每个会话的 token 上限 |
| `--test-url <url>` | 否 | `http://localhost:3000` | API 端到端测试地址 |
| `--session-delay <ms>` | 否 | `2000` | 会话间隔（毫秒） |
| `--no-auto-commit` | 否 | - | 关闭自动 Git 提交 |

**从文件读取需求：**

```bash
# 将需求写入文件
echo "构建一个博客系统 REST API..." > spec.txt

npx tsx src/cli.ts run --spec spec.txt --project-dir /path/to/blog-api
```

### 2. 中断后恢复 (`resume`)

如果进程中途停止（Ctrl+C、断网、关机等），可以随时恢复：

```bash
npx tsx src/cli.ts resume --project-dir /path/to/target-project
```

系统会自动从 `agent-progress.txt` 中读取上次停在哪个 session，接着往下做。

### 3. 查看进度 (`status`)

```bash
npx tsx src/cli.ts status --project-dir /path/to/target-project
```

输出示例：

```
Project: todo-api
Passing: 5
Failing: 12
Total: 17 (29%)

Features:
  [PASS] feat-001: 项目初始化和依赖安装
  [PASS] feat-002: Express 服务器启动和健康检查
  [FAIL] feat-003: 用户注册接口
  [FAIL] feat-004: 用户登录接口
  ...
```

### 4. 查看工作日志 (`progress`)

```bash
npx tsx src/cli.ts progress --project-dir /path/to/target-project
```

输出示例：

```
=== Session 1 | 2026-03-06T10:00:00.000Z ===
Feature: project-setup
Status: completed
Summary: 初始化项目骨架，创建 Express 服务器和健康检查端点
Files changed: package.json, src/server.js, init.sh
==================================================

=== Session 2 | 2026-03-06T10:05:00.000Z ===
Feature: user-registration
Status: completed
Summary: 实现用户注册接口，包含输入验证和密码哈希
Files changed: src/routes/auth.js, src/models/user.js
==================================================
```

## 完整示例

### 使用 Anthropic 官方 API

```bash
cd F:\git\auto-dev-agent

set ANTHROPIC_API_KEY=sk-ant-xxxxx

npx tsx src/cli.ts run ^
  --spec "Build a RESTful bookmark manager API with Node.js and Express. Features: user registration/login with JWT, CRUD bookmarks (url, title, tags), search by tag, pagination, rate limiting, input validation." ^
  --project-dir F:\git\bookmark-api ^
  --max-sessions 30 ^
  --test-url http://localhost:3000
```

### 使用阿里云百炼等第三方 API

```bash
cd F:\git\auto-dev-agent

set ANTHROPIC_API_KEY=你的百炼API-KEY
set ANTHROPIC_BASE_URL=https://coding.dashscope.aliyuncs.com/apps/anthropic

npx tsx src/cli.ts run ^
  --spec "构建一个 Todo REST API，支持增删改查、分页、JWT鉴权" ^
  --project-dir F:\git\todo-api ^
  --model glm-5 ^
  --max-sessions 30
```

也可以直接通过参数传入：

```bash
npx tsx src/cli.ts run ^
  --spec "你的需求" ^
  --project-dir F:\git\目标项目 ^
  --base-url https://coding.dashscope.aliyuncs.com/apps/anthropic ^
  --api-key 你的API-KEY ^
  --model glm-5
```

## 运行流程

```
Session 1 — Initializer Agent:
  ├── 分析需求 spec
  ├── 拆解为 N 个具体功能 → feature_list.json
  ├── 创建项目骨架（package.json、目录结构、基础服务器）
  ├── 生成 init.sh 启动脚本
  ├── git init + 首次提交
  └── 写入进度日志

Session 2..N — Coding Agent 循环:
  ├── 读取 agent-progress.txt + git log（了解上下文）
  ├── 读取 feature_list.json（选择最高优先级未完成功能）
  ├── 运行 init.sh 启动开发服务器
  ├── 健康检查 + 验证已有功能是否正常
  ├── 实现 1 个功能
  ├── 用 HTTP 请求做端到端测试
  ├── 测试通过 → 标记 feature.passes = true
  ├── git add + git commit（描述性提交信息）
  ├── 更新 agent-progress.txt
  └── 进入下一个 Session

终止条件:
  - 所有功能 passes = true
  - 达到 max-sessions 上限
  - 连续失败 3 次
```

## 目标项目中生成的文件

系统运行后，目标项目目录会包含：

```
target-project/
├── feature_list.json       # 功能列表（Agent 的任务清单）
├── agent-progress.txt      # 进度日志（跨会话传递上下文的关键）
├── init.sh                 # 环境启动脚本
├── package.json            # 项目依赖
├── src/                    # Agent 生成的业务代码
│   ├── server.js
│   ├── routes/
│   ├── models/
│   └── ...
└── .git/                   # 每个会话结束都有 commit 记录
```

## 项目源码结构

```
auto-dev-agent/
├── src/
│   ├── cli.ts                  # CLI 入口
│   ├── config.ts               # 配置管理
│   ├── orchestrator.ts         # 多会话循环调度器
│   ├── agents/
│   │   ├── initializer.ts      # 初始化 Agent
│   │   └── coder.ts            # 编码 Agent
│   ├── prompts/
│   │   ├── initializer.ts      # 初始化 Agent 的 prompt 模板
│   │   └── coder.ts            # 编码 Agent 的 prompt 模板
│   ├── tools/
│   │   ├── index.ts            # 工具注册与分发（16 个工具）
│   │   ├── bash.ts             # Shell 命令执行
│   │   ├── file-ops.ts         # 文件读写
│   │   ├── git.ts              # Git 操作
│   │   └── http-test.ts        # HTTP 端到端测试
│   └── utils/
│       ├── features.ts         # 功能列表管理
│       └── progress.ts         # 进度日志管理
├── package.json
└── tsconfig.json
```

## 设计原理

参考 Anthropic 文章总结的四个失败模式及对应解决方案：

| 问题 | Initializer Agent | Coding Agent |
|------|-------------------|--------------|
| Agent 过早宣布项目完成 | 创建 feature_list.json，列出所有功能，初始状态均为 `passes: false` | 每次开始时读取列表，选择未完成的功能 |
| 留下 bug 或未记录的进度 | 初始化 Git 仓库和 agent-progress.txt | 会话结尾 git commit + 写进度更新 |
| 功能未充分测试就标记完成 | 定义每个功能的验证步骤 | 用 http_test 做端到端测试后才标记通过 |
| 浪费时间搞清如何运行项目 | 生成 init.sh 启动脚本 | 开始时读取并执行 init.sh |
