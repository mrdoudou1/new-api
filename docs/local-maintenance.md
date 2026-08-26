# New API 本地部署与更新说明

> 本文记录当前 `/opt/new-api` 的源码基线、本地修改、部署方式和后续更新流程。更新前请先阅读本文，避免直接拉取官方镜像后丢失本地 Codex 兼容补丁。

## 1. 当前状态

- 项目路径：`/opt/new-api`
- Git 远程：`https://github.com/QuantumNous/new-api.git`
- 当前分支：`main`
- 官方基线提交：`2d8e50bf36e94200b809dfb39e73624ec48b1e23`
- 基线提交：`refactor(web): prevent credential autofill in usage log filters (#6966)`
- 最近正式标签：`v1.0.0-rc.25`
- 当前部署镜像：`new-api:latest-codex-id-compat-20260826-cachehit95`
- 当前容器：`new-api`，端口映射由 compose 和 `.env` 决定，当前健康状态正常

当前源码是：

```text
官方最新 main
+ 本地 Codex Responses API input[].id 兼容补丁
+ 本地使用日志「缓存命中」列
+ 本地 Docker Compose 部署配置
```

## 2. 本地代码修改

### 2.1 `relay/responses_input_sanitizer.go`

新增 Responses API 请求清洗函数 `sanitizeResponsesInput`，用于处理 Codex 历史 rollout 中 `input[].id` 与 `type` 前缀不匹配的问题。

ID 前缀映射包括：

```text
message                 -> msg_
function_call           -> fc_
function_call_output    -> fco_
custom_tool_call        -> ctc_
custom_tool_call_output  -> ctco_
reasoning               -> rs_
compaction               -> rs_
web_search_call          -> ws_
file_search_call         -> fs_
computer_call            -> cu_
computer_call_output     -> cuo_
image_generation_call    -> ig_
```

处理规则：

- 合法 ID：原样保留
- 普通历史项 ID 前缀错误：只删除 `id`，保留内容和关联字段
- `reasoning` / `compaction` 的错误历史项：丢弃整个项目，因为其中可能包含无法安全重放的供应商加密状态
- 标量字符串 input：原样保留
- 不修改客户端原始请求；调用前先对 Responses 请求做 `DeepCopy`

### 2.2 `relay/responses_input_sanitizer_test.go`

新增 3 组测试，覆盖：

- `custom_tool_call` 使用错误 ID 前缀时删除 ID
- `reasoning` 错误项被丢弃
- 合法 ID、普通字段和标量 input 保持不变

### 2.3 `relay/responses_handler.go`

在 `ResponsesHelper` 中的处理顺序为：

```text
DeepCopy(responsesReq)
    -> sanitizeResponsesInput(request.Input)
    -> ModelMappedHelper
    -> 上游请求转换和转发
```

该补丁只处理 `/v1/responses` 处理链路，不改变模型路由、渠道顺序、用户/用户组路由或缓存配置。

### 2.4 使用日志「缓存命中」列

在使用日志表格的 Tokens 和费用中间新增「缓存命中」列，显示本次请求的缓存命中率：

```text
cache_tokens / prompt_tokens
```

颜色分档：

- `>= 95%`：绿色
- `80% ~ 94%`：蓝色
- `50% ~ 79%`：琥珀色
- `1% ~ 49%`：红色
- `0%`：灰色
- 无输入 token：显示 `-`

相关文件：

- `web/src/features/usage-logs/lib/format.ts`
- `web/src/features/usage-logs/components/cache-hit-rate-cell.tsx`
- `web/src/features/usage-logs/components/columns/common-logs-columns.tsx`
- `web/src/features/usage-logs/components/usage-logs-mobile-card.tsx`

## 3. 本地部署配置修改

`docker-compose.yml` 与官方示例不同的重点：

- `new-api` 使用本地镜像：`new-api:latest-codex-id-compat-20260826`
- 设置 `pull_policy: never`，防止 Compose 尝试拉取不存在的本地镜像
- 使用项目根目录 `.env` 提供数据库和 Redis 等连接配置
- 保留 `host.docker.internal` 映射，用于连接宿主机 MySQL
- 端口使用 `${HOST_PORT:-3000}:${PORT:-3000}`
- Redis 仍由 compose 管理，但更新 New API 时不要重建或清理 Redis
- 项目数据和日志分别挂载到 `./data` 和 `./logs`

敏感配置位置：

```text
/opt/new-api/.env
```

本文不记录 `.env` 的密码、Token、DSN 明文或其他凭据。

## 4. 测试与构建

宿主机没有安装 Go，使用临时 Go 容器执行格式化和测试：

```bash
docker run --rm \
  -v /opt/new-api:/src \
  -w /src \
  golang:1.25.1-alpine \
  sh -c 'gofmt -w relay/responses_input_sanitizer.go relay/responses_input_sanitizer_test.go relay/responses_handler.go && go test ./relay/...'
```

测试通过后构建本地镜像：

```bash
cd /opt/new-api
docker build -t new-api:latest-codex-id-compat-YYYYMMDD .
```

修改 `docker-compose.yml` 中的镜像标签后，先检查 compose：

```bash
docker compose config --quiet
```

## 5. 后续推荐更新流程

### 5.1 更新前检查和备份

```bash
cd /opt/new-api

git status --short --branch
git fetch origin main
cp -a docker-compose.yml docker-compose.yml.bak.$(date +%Y%m%d%H%M%S)
cp -a .env .env.bak.$(date +%Y%m%d%H%M%S)
```

数据库备份也应按现有运维流程执行。不要删除 `data/`、`logs/` 或数据库卷。

### 5.2 查看官方更新

```bash
git log --oneline HEAD..origin/main
git diff HEAD..origin/main --stat
```

如果官方已经合并同等的 Codex `input[].id` 清洗逻辑，先确认实现范围，再决定是否移除本地重复补丁：

```bash
grep -RniE 'sanitizeResponsesInput|responsesItemIDPrefixes|custom_tool_call' relay
```

不要仅因官方发布了新版本就直接覆盖本地补丁。需要确认官方实现确实覆盖同一个问题。

### 5.3 以官方 main 为基线更新

本项目原则：保留部署配置和必要的 Codex 补丁，丢弃无关的旧二开。

推荐先保存当前补丁文件，然后再更新代码：

```bash
cd /opt/new-api
cp -a relay/responses_input_sanitizer.go /tmp/responses_input_sanitizer.go.bak
cp -a relay/responses_input_sanitizer_test.go /tmp/responses_input_sanitizer_test.go.bak
```

更新过程中不要使用会覆盖 `.env` 的操作。若 Git 更新遇到本地修改冲突，应先停止，检查冲突内容后再处理；不要使用 `git reset --hard` 清理，除非已经确认备份和恢复方案。

更新后必须重新检查：

```bash
git status --short --branch
git log -3 --oneline --decorate
grep -RniE 'sanitizeResponsesInput|responsesItemIDPrefixes|custom_tool_call' relay
```

### 5.4 测试、构建和仅更新 New API

```bash
docker run --rm \
  -v /opt/new-api:/src \
  -w /src \
  golang:1.25.1-alpine \
  sh -c 'gofmt -w relay/responses_input_sanitizer.go relay/responses_input_sanitizer_test.go relay/responses_handler.go && go test ./relay/...'
```

测试通过后：

```bash
cd /opt/new-api
docker build -t new-api:latest-codex-id-compat-YYYYMMDD .
# 将 docker-compose.yml 的 image 改为上面的新标签
docker compose config --quiet
docker compose up -d new-api
```

不要用下面的命令替代上述流程：

```bash
docker compose pull
docker compose up -d
```

直接拉取官方镜像可能会绕过本地编译补丁；全量 `up -d` 也可能触碰不需要更新的依赖服务。

## 6. 部署后验证

```bash
cd /opt/new-api
docker ps --filter name=new-api --filter name=redis

docker inspect new-api \
  --format 'image={{.Config.Image}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}'

curl -f http://127.0.0.1:${HOST_PORT:-3000}/api/status
```

确认：

- `new-api` 使用新本地镜像并为 `healthy`
- Redis 容器没有被重建或重启
- `.env` 未被覆盖
- `/api/status` 返回成功
- 如有真实 Codex 请求，使用新会话做一次 `/v1/responses` 回归

## 7. 重要边界

- 本地补丁只修复网关转发前能够看到的错误 `input[].id`
- 它不能修复 Codex 本地已经损坏的 rollout 文件
- 已经损坏的旧会话仍可能需要新建
- 正常请求的 ID、`prompt_cache_key`、`prompt_cache_options`、`prompt_cache_retention` 不会被修改
- 本地补丁不负责模型路由、渠道切换、用户/用户组路由或缓存策略
- 如官方未来合并同等补丁，应优先使用官方实现，并删除重复本地代码
