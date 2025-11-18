# 静脉检测系统 - 测试框架和集成方案

## 概述

本文档描述了静脉检测系统的完整测试框架和集成方案，包括前后端集成、测试用例、性能优化、错误处理、系统监控和端到端测试。

## 目录结构

```
├── tests/                          # 测试文件目录
│   ├── unit/                       # 单元测试
│   │   ├── videoUpload.test.js     # 视频上传测试
│   │   └── veinDetection.test.js   # 静脉检测功能测试
│   ├── integration/                # 集成测试
│   │   └── systemIntegration.test.js # 系统集成测试
│   ├── e2e/                        # 端到端测试
│   │   └── e2e-test-runner.js      # E2E测试执行器
│   ├── performance/                # 性能测试
│   │   └── performanceOptimization.test.js # 性能优化测试
│   └── setup.js                    # 测试环境设置
├── scripts/                        # 脚本文件目录
│   ├── deploy.sh                   # 部署和维护脚本
│   ├── errorHandler.js             # 错误处理和日志记录
│   └── monitor.js                  # 系统监控和健康检查
└── config/                         # 配置文件目录
    ├── proxy/
    │   └── nginx.conf              # Nginx反向代理配置
    ├── cors.config.js              # CORS跨域配置
    └── test/
        └── jest.config.js          # Jest测试配置
```

## 功能特性

### 1. 前后端集成配置

#### Nginx反向代理配置
- **位置**: `config/proxy/nginx.conf`
- **功能**: 
  - 前端静态文件代理
  - API请求代理
  - 视频流代理
  - WebSocket支持
  - CORS配置
  - 缓存配置
  - 健康检查端点

#### CORS跨域配置
- **位置**: `config/cors.config.js`
- **支持环境**: 开发环境和生产环境
- **特性**:
  - 动态环境配置
  - 预检请求处理
  - 认证头支持
  - 断点续传支持

### 2. 测试用例开发

#### 视频上传测试 (`tests/unit/videoUpload.test.js`)
- ✅ 文件格式验证测试
- ✅ 文件大小限制测试
- ✅ 断点续传测试
- ✅ 并发上传测试
- ✅ 元数据提取测试
- ✅ 进度跟踪测试
- ✅ 错误处理测试

#### 静脉检测功能测试 (`tests/unit/veinDetection.test.js`)
- ✅ 检测算法初始化测试
- ✅ 参数验证测试
- ✅ ROI区域处理测试
- ✅ 多算法性能测试
- ✅ 特征提取分析测试
- ✅ 置信度评估测试
- ✅ 性能优化测试
- ✅ 错误处理测试

#### 系统集成测试 (`tests/integration/systemIntegration.test.js`)
- ✅ 健康检查集成
- ✅ API接口集成
- ✅ WebSocket集成
- ✅ 跨域处理集成
- ✅ 性能集成测试
- ✅ 错误处理集成

#### 端到端测试 (`tests/e2e/e2e-test-runner.js`)
- ✅ 视频上传流程测试
- ✅ 静脉检测流程测试
- ✅ ROI交互测试
- ✅ 错误处理测试
- ✅ 响应式设计测试
- ✅ 可访问性测试
- ✅ 性能测试

#### 性能优化测试 (`tests/performance/performanceOptimization.test.js`)
- ✅ 视频帧缓存策略测试
- ✅ 检测算法优化测试
- ✅ 内存管理优化测试
- ✅ 性能监控测试
- ✅ 资源使用优化测试

### 3. 性能优化方案

#### 视频帧缓存策略
- **缓存算法**: LRU (最近最少使用)
- **缓存大小**: 最多100帧，50MB内存限制
- **特性**:
  - 自动内存管理
  - 缓存命中率优化
  - 内存溢出处理

#### 检测算法优化
- **并行检测**: 支持4个工作线程
- **自适应算法选择**: 根据图像质量选择最优算法
- **批处理优化**: 批量处理提升性能
- **动态阈值调整**: 根据图像特性调整参数

#### 内存管理优化
- **自动垃圾回收**: 内存使用超过100MB时触发
- **对象池复用**: 减少对象创建和销毁开销
- **内存泄漏检测**: 监控内存使用趋势

### 4. 错误处理和日志记录

#### 错误分类系统 (`scripts/errorHandler.js`)
- **错误类型**:
  - VALIDATION_ERROR: 验证错误
  - NETWORK_ERROR: 网络错误
  - PROCESSING_ERROR: 处理错误
  - SYSTEM_ERROR: 系统错误
  - TIMEOUT_ERROR: 超时错误
  - STORAGE_ERROR: 存储错误
  - PERMISSION_ERROR: 权限错误
  - CONFIGURATION_ERROR: 配置错误

#### 严重性级别
- **CRITICAL**: 关键错误，立即通知
- **HIGH**: 高级错误，快速通知
- **MEDIUM**: 中级错误，标准日志
- **LOW**: 低级错误，常规日志

#### 日志系统
- **格式**: JSON格式，便于解析
- **分级**: error, warn, info, debug
- **轮转**: 按日期轮转，自动清理
- **目标**: 控制台、文件、监控系统

#### 错误恢复机制
- **网络错误恢复**: 检查连接、重置连接池
- **存储错误恢复**: 检查磁盘空间、清理临时文件
- **处理错误恢复**: 清理缓存、强制垃圾回收

### 5. 系统监控和健康检查

#### 监控指标 (`scripts/monitor.js`)
- **服务监控**: 
  - Frontend服务 (端口3000)
  - Backend服务 (端口8000) 
  - Video服务 (端口8080)
  - 数据库服务 (端口5432)

- **系统资源监控**:
  - CPU使用率
  - 内存使用率
  - 磁盘使用率
  - 网络统计

- **应用指标监控**:
  - 请求计数
  - 响应时间
  - 错误率
  - 活跃连接数

#### 健康检查
- **检查间隔**: 30秒
- **超时设置**: 5秒
- **重试机制**: 最多3次重试
- **告警阈值**:
  - CPU: 80%
  - 内存: 85%
  - 磁盘: 90%
  - 响应时间: 2000ms

#### 告警系统
- **告警类型**: 服务不健康、阈值超标
- **通知方式**: 邮件、Slack、Webhook、短信
- **告警管理**: 确认、解决、清理

### 6. 部署和维护脚本

#### 部署脚本 (`scripts/deploy.sh`)
- **依赖检查**: Docker、Docker Compose、Node.js等
- **环境设置**: 创建目录、设置权限
- **端口检查**: 检查端口占用情况
- **服务管理**: 启动、停止、重启服务
- **数据库管理**: 迁移、备份、恢复

#### 主要功能
```bash
# 检查系统环境
./scripts/deploy.sh check

# 部署系统
./scripts/deploy.sh redeploy

# 启动服务
./scripts/deploy.sh start

# 监控服务
./scripts/deploy.sh monitor

# 备份数据
./scripts/deploy.sh backup

# 查看日志
./scripts/deploy.sh logs [service]

# 清理系统
./scripts/deploy.sh cleanup
```

## 测试执行

### 运行所有测试
```bash
# 安装依赖
npm install

# 运行所有测试
npm test

# 运行特定类型测试
npm run test:unit          # 单元测试
npm run test:integration   # 集成测试
npm run test:e2e          # 端到端测试
npm run test:performance  # 性能测试

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行性能测试
npm run test:benchmark
```

### E2E测试执行
```bash
# 启动测试环境
npm run test:e2e:setup

# 运行E2E测试
npm run test:e2e

# 生成测试报告
npm run test:e2e:report
```

### 性能测试
```bash
# 运行性能基准测试
npm run test:benchmark

# 内存使用分析
npm run test:memory

# CPU使用分析
npm run test:cpu
```

## 配置说明

### Jest配置 (`config/test/jest.config.js`)
- **测试环境**: Node.js
- **覆盖率阈值**: 行/函数/分支 80%
- **测试超时**: 30秒
- **并行执行**: 75%的CPU核心
- **报告格式**: HTML、XML、LCov

### 环境变量配置
```bash
# 必需的环境变量
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/vein_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
UPLOAD_PATH=/app/uploads
TEMP_PATH=/app/temp
CACHE_PATH=/app/cache

# 监控配置
MONITORING_INTERVAL=30000
ALERT_THRESHOLD_CPU=80
ALERT_THRESHOLD_MEMORY=85
ALERT_THRESHOLD_DISK=90
```

## 性能基准

### 系统性能指标
- **视频上传**: < 5秒 (100MB文件)
- **静脉检测**: < 2秒/帧 (1920x1080)
- **API响应**: < 200ms (95%分位数)
- **系统启动**: < 30秒
- **内存使用**: < 500MB (正常运行)
- **CPU使用**: < 70% (正常负载)

### 监控阈值
- **CPU使用率**: 80%
- **内存使用率**: 85%
- **磁盘使用率**: 90%
- **响应时间**: 2000ms
- **错误率**: 5%

## 故障排除

### 常见问题

1. **服务启动失败**
   ```bash
   # 检查端口占用
   lsof -i :8000
   
   # 查看服务日志
   ./scripts/deploy.sh logs backend
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库状态
   docker-compose ps database
   
   # 重启数据库
   docker-compose restart database
   ```

3. **内存泄漏检测**
   ```bash
   # 运行内存测试
   npm run test:memory
   
   # 检查内存使用
   ./scripts/deploy.sh monitor
   ```

4. **性能问题诊断**
   ```bash
   # 运行性能测试
   npm run test:benchmark
   
   # 查看系统监控
   ./scripts/deploy.sh monitor
   ```

### 日志分析
```bash
# 查看错误日志
tail -f logs/error-$(date +%Y-%m-%d).log

# 查看访问日志
tail -f logs/access-$(date +%Y-%m-%d).log

# 查看性能日志
tail -f logs/performance-$(date +%Y-%m-%d).log
```

## 最佳实践

### 测试最佳实践
1. **编写可维护的测试**: 使用描述性测试名称
2. **独立性测试**: 每个测试应该独立运行
3. **快速反馈**: 单元测试应该在毫秒级完成
4. **覆盖率监控**: 保持高代码覆盖率
5. **性能回归测试**: 定期运行性能基准测试

### 监控最佳实践
1. **分层监控**: 系统、应用、业务监控
2. **告警策略**: 避免告警疲劳
3. **日志管理**: 结构化日志，便于分析
4. **性能基准**: 建立性能基线
5. **容量规划**: 基于历史数据规划容量

### 部署最佳实践
1. **环境隔离**: 开发、测试、生产环境隔离
2. **自动化部署**: 减少人工操作错误
3. **回滚机制**: 快速回滚到稳定版本
4. **健康检查**: 部署后立即验证
5. **文档更新**: 及时更新部署文档

## 维护计划

### 日常维护
- **每日**: 检查系统健康状态
- **每日**: 查看错误日志和告警
- **每日**: 监控系统资源使用

### 周度维护
- **每周**: 清理临时文件和日志
- **每周**: 运行完整测试套件
- **每周**: 性能基准测试

### 月度维护
- **每月**: 数据备份验证
- **每月**: 依赖包安全更新
- **每月**: 性能优化评估

### 季度维护
- **每季度**: 容量规划评估
- **每季度**: 架构优化建议
- **每季度**: 灾难恢复演练

---

## 联系信息

- **开发团队**: 静脉检测系统开发组
- **文档版本**: v1.0.0
- **最后更新**: 2025-11-18

如有问题或建议，请联系开发团队或提交Issue。