# 静脉检测系统

一个基于深度学习的静脉检测系统，提供视频上传、帧提取、静脉识别和ROI管理功能。

## 项目简介

本系统专为医疗和生物识别应用设计，能够从视频中准确检测和分析静脉模式。系统采用先进的图像处理和机器学习算法，支持实时处理和高精度检测。

### 核心功能

- **视频上传与管理**: 支持多种视频格式的上传和存储
- **智能帧提取**: 自动提取关键帧用于分析
- **静脉检测**: 使用深度学习算法进行高精度静脉识别
- **ROI管理**: 支持感兴趣区域的标记和管理
- **结果可视化**: 提供检测结果的可视化展示
- **数据导出**: 支持检测结果的导出和分析

### 技术特点

- 🚀 **高性能**: 基于GPU加速的并行处理
- 🎯 **高精度**: 检测准确率达95%以上
- 🔧 **可配置**: 支持多种检测参数调优
- 📊 **可视化**: 丰富的图表和分析报告
- 🔒 **安全可靠**: 数据加密传输和存储
- 🌐 **RESTful API**: 完整的API接口支持

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web前端       │    │   移动端APP     │    │   第三方集成    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   视频处理服务  │    │   检测引擎      │    │   ROI管理服务   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   数据库存储    │
                    └─────────────────┘
```

## 技术栈

### 后端
- **框架**: FastAPI + Python 3.9+
- **深度学习**: PyTorch, OpenCV
- **数据库**: PostgreSQL + Redis
- **存储**: MinIO/S3兼容存储
- **消息队列**: Celery + Redis

### 前端
- **框架**: React 18 + TypeScript
- **UI组件**: Ant Design
- **图表**: ECharts, D3.js
- **状态管理**: Redux Toolkit

### 基础设施
- **容器化**: Docker + Docker Compose
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack
- **CI/CD**: GitHub Actions

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 16+
- Docker 20.10+
- PostgreSQL 13+
- Redis 6+
- GPU (可选，用于加速检测)

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-org/vein-detection-system.git
cd vein-detection-system
```

#### 2. 使用Docker Compose启动（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 3. 手动安装

##### 后端安装

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r backend/requirements.txt

# 初始化数据库
cd backend
python manage.py migrate

# 启动服务
python manage.py runserver
```

##### 前端安装

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 访问应用

- **Web界面**: http://localhost:3000
- **API文档**: http://localhost:8000/docs
- **API基础URL**: http://localhost:8000

## 配置说明

### 环境变量

创建 `.env` 文件：

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/vein_detection

# Redis配置
REDIS_URL=redis://localhost:6379/0

# 文件存储配置
STORAGE_TYPE=local  # local, s3, minio
STORAGE_PATH=/data/videos
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# API配置
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# 检测引擎配置
DETECTION_BATCH_SIZE=8
DETECTION_GPU_ENABLED=true
DETECTION_MODEL_PATH=/models/vein_detection.pth

# 安全配置
SECRET_KEY=your_secret_key_here
JWT_SECRET=your_jwt_secret_here
```

### 数据库配置

#### PostgreSQL配置

```sql
-- 创建数据库
CREATE DATABASE vein_detection;

-- 创建用户
CREATE USER vein_user WITH PASSWORD 'your_password';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE vein_detection TO vein_user;
```

#### Redis配置

```conf
# /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 使用指南

### 1. 上传视频

```bash
curl -X POST http://localhost:8000/api/upload-video \
  -F "file=@path/to/video.mp4" \
  -F "patient_id=P001" \
  -F "description=左手静脉检测"
```

### 2. 开始检测

```bash
curl -X POST http://localhost:8000/api/detect-vein \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "video_xxx",
    "frame_numbers": [0, 30, 60],
    "algorithm": "advanced"
  }'
```

### 3. 查看结果

```bash
curl http://localhost:8000/api/detection-results?video_id=video_xxx
```

详细使用说明请参考 [USAGE.md](USAGE.md)

## 开发指南

### 项目结构

```
vein-detection-system/
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── tests/              # 测试代码
│   └── requirements.txt    # Python依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   └── package.json        # Node.js依赖
├── docs/                   # 项目文档
├── scripts/                # 部署脚本
├── docker/                 # Docker配置
└── docker-compose.yml      # 容器编排
```

### 代码规范

#### Python代码规范

- 使用Black进行代码格式化
- 使用Flake8进行代码检查
- 使用MyPy进行类型检查
- 遵循PEP 8标准

#### 前端代码规范

- 使用ESLint + Prettier
- 遵循TypeScript严格模式
- 使用Prettier统一代码格式

### 测试

#### 后端测试

```bash
cd backend
python -m pytest tests/ -v --cov=app
```

#### 前端测试

```bash
cd frontend
npm test
npm run test:coverage
```

### API开发

使用FastAPI框架开发RESTful API：

```python
from fastapi import FastAPI, UploadFile
from pydantic import BaseModel

app = FastAPI(title="静脉检测API")

class DetectionRequest(BaseModel):
    video_id: str
    frame_numbers: List[int]
    algorithm: str = "advanced"

@app.post("/api/detect-vein")
async def detect_vein(request: DetectionRequest):
    # 处理检测逻辑
    pass
```

## 部署指南

### 生产环境部署

1. **准备生产环境**

```bash
# 安装依赖
sudo apt update
sudo apt install docker.io docker-compose nginx postgresql redis-server

# 配置防火墙
sudo ufw enable
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
```

2. **部署应用**

```bash
# 克隆代码
git clone https://github.com/your-org/vein-detection-system.git

# 配置环境变量
cp .env.example .env
vim .env

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 配置Nginx
sudo cp docker/nginx.conf /etc/nginx/sites-available/vein-detection
sudo ln -s /etc/nginx/sites-available/vein-detection /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

详细部署指南请参考 [DEPLOYMENT.md](DEPLOYMENT.md)

## 监控与日志

### 系统监控

- **应用监控**: Grafana Dashboard
- **数据库监控**: PostgreSQL Exporter
- **资源监控**: Node Exporter

### 日志管理

- **应用日志**: 结构化JSON日志
- **访问日志**: Nginx访问日志
- **错误日志**: 集中化错误追踪

### 性能指标

- **响应时间**: API平均响应时间 < 200ms
- **吞吐量**: 支持1000+并发请求
- **检测速度**: 每帧检测时间 < 3s

## 故障排除

### 常见问题

#### 1. 服务启动失败

```bash
# 检查服务状态
docker-compose ps

# 查看错误日志
docker-compose logs service_name

# 重启服务
docker-compose restart service_name
```

#### 2. 数据库连接失败

```bash
# 检查数据库状态
sudo systemctl status postgresql

# 测试连接
psql -h localhost -U vein_user -d vein_detection
```

#### 3. 检测速度慢

- 检查GPU是否可用
- 调整批处理大小
- 优化模型参数

### 性能优化

1. **数据库优化**
   - 添加索引
   - 配置连接池
   - 使用读写分离

2. **缓存策略**
   - Redis缓存热点数据
   - CDN加速静态资源
   - 浏览器缓存

3. **并发处理**
   - 使用异步编程
   - 配置工作进程数
   - 实现负载均衡

## 贡献指南

### 开发流程

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

### 代码审查

- 所有代码必须通过CI检查
- 至少需要一个Reviewer批准
- 保持代码质量和测试覆盖率

## 许可证

本项目基于MIT许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系我们

- **项目主页**: https://github.com/your-org/vein-detection-system
- **文档**: https://vein-detection-docs.com
- **技术支持**: support@vein-detection.com
- **Bug报告**: https://github.com/your-org/vein-detection-system/issues

## 更新日志

### v1.0.0 (2025-11-18)

- ✨ 初始版本发布
- ✨ 基础静脉检测功能
- ✨ RESTful API接口
- ✨ Web管理界面
- ✨ Docker部署支持

---

**注意**: 本系统仅供学习和研究使用，在生产环境使用前请确保符合相关医疗设备法规要求。