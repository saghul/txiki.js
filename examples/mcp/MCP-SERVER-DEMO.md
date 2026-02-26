# MCP Server Demo

## 概述

这是一个用于 txiki.js 的 MCP (Model Context Protocol) Server demo，允许 AI Agent 通过标准化协议与 Express + ORM 应用程序交互。

## 功能

### 可用工具 (Tools)

1. **list_users** - 列出所有用户
2. **get_user** - 根据 ID 获取用户
3. **find_user_by_email** - 根据邮箱查找用户
4. **create_user** - 创建新用户
5. **update_user** - 更新用户
6. **delete_user** - 删除用户
7. **list_posts** - 列出所有帖子
8. **get_post** - 根据 ID 获取帖子
9. **get_user_posts** - 获取用户的所有帖子
10. **search_posts** - 搜索帖子（关键词）
11. **create_post** - 创建新帖子
12. **get_stats** - 获取数据库统计信息

### 可用资源 (Resources)

1. **users://all** - 所有用户数据
2. **posts://all** - 所有帖子数据
3. **stats://overview** - 数据库概览统计

## 运行

```bash
# 启动 MCP Server
./build/tjs serve examples/mcp-server-demo.js -p 9000
```

## API 端点

### GET /
获取服务器信息

```bash
curl http://localhost:9000/
```

### GET /tools
列出所有可用工具

```bash
curl http://localhost:9000/tools
```

### GET /resources
列出所有可用资源

```bash
curl http://localhost:9000/resources
```

### POST /mcp
执行 MCP 请求

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "list_users",
      "arguments": {}
    }
  }'
```

## 使用示例

### 列出所有用户

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "list_users",
      "arguments": {}
    }
  }'
```

### 获取统计信息

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_stats",
      "arguments": {}
    }
  }'
```

### 创建新用户

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "create_user",
      "arguments": {
        "name": "Eve",
        "email": "eve@example.com"
      }
    }
  }'
```

### 获取用户的帖子

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_user_posts",
      "arguments": {
        "userId": 1
      }
    }
  }'
```

### 搜索帖子

```bash
curl -X POST http://localhost:9000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "search_posts",
      "arguments": {
        "query": "post"
      }
    }
  }'
```

## AI Agent 集成

AI Agent 可以通过以下步骤与 MCP Server 交互：

1. **发现** - 调用 `GET /tools` 和 `GET /resources` 获取可用工具和资源
2. **执行** - 使用 `POST /mcp` 调用具体工具
3. **查询** - 读取资源获取数据快照

### Agent 请求示例

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_user",
    "arguments": {
      "name": "AI User",
      "email": "ai@example.com"
    }
  }
}
```

## 架构

- **MCPServer 类**: 提供 MCP 协议实现
- **数据库层**: 使用 txiki-orm 进行数据操作
- **HTTP 接口**: 通过 HTTP 暴露 MCP 功能

## 技术栈

- txiki.js JavaScript 运行时
- txiki-ORM (对象关系映射)
- Model Context Protocol (MCP)
- HTTP API

## 相关项目

- [txiki-express](../txiki-express/) - Express 框架
- [txiki-orm](../txiki-orm/) - ORM 库
- [express-orm-demo](./express-orm-demo.js) - Express + ORM 示例应用