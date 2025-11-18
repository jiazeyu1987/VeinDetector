# 部署指南

本文档提供静脉检测系统的完整部署指南，包括开发环境、生产环境、容器化部署和云平台部署。

## 目录

- [部署架构](#部署架构)
- [环境准备](#环境准备)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker容器部署](#docker容器部署)
- [云平台部署](#云平台部署)
- [监控与运维](#监控与运维)
- [备份与恢复](#备份与恢复)
- [安全配置](#安全配置)
- [性能调优](#性能调优)
- [故障排除](#故障排除)

## 部署架构

### 生产环境架构图

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │    (Nginx)      │
                    └─────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   Web Server 1  │ │   Web Server 2  │ │   Web Server 3  │
    │   (React)       │ │   (React)       │ │   (React)       │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (FastAPI)     │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Video Service │    │ Detection     │    │  ROI Service  │
│  (FastAPI)    │    │ Engine        │    │   (FastAPI)   │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  PostgreSQL   │    │     Redis     │    │ File Storage  │
│   Database    │    │     Cache     │    │   (MinIO)     │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 组件说明

- **Load Balancer**: Nginx反向代理和负载均衡
- **Web Server**: React前端应用服务器
- **API Gateway**: FastAPI后端API服务
- **Services**: 专门的服务组件（视频处理、检测引擎、ROI管理）
- **Databases**: PostgreSQL主数据库和Redis缓存
- **Storage**: MinIO对象存储服务

## 环境准备

### 硬件要求

#### 开发环境
- **CPU**: 4核心以上
- **内存**: 8GB以上
- **存储**: 50GB可用空间
- **网络**: 100Mbps带宽

#### 生产环境
- **CPU**: 8核心以上
- **内存**: 16GB以上
- **存储**: 500GB SSD以上
- **网络**: 1Gbps带宽
- **GPU**: NVIDIA GTX 1060以上（推荐用于加速检测）

### 软件依赖

#### 基础软件

```bash
# Ubuntu 20.04/22.04 基础环境
sudo apt update
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    unzip \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
```

#### Python 3.9+

```bash
# 安装Python 3.9
sudo apt install -y python3.9 python3.9-dev python3-pip

# 设置默认Python版本
sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.9 1
sudo update-alternatives --install /usr/bin/pip pip /usr/bin/pip3.9 1
```

#### Node.js 16+

```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # v16.x.x
npm --version   # 8.x.x
```

#### Docker & Docker Compose

```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将用户添加到docker组
sudo usermod -aG docker $USER
newgrp docker
```

#### 数据库服务

```bash
# PostgreSQL 13+
sudo apt install -y postgresql postgresql-contrib

# Redis
sudo apt install -y redis-server

# 配置Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 系统配置

#### 优化系统参数

```bash
# 编辑系统配置
sudo vim /etc/sysctl.conf

# 添加以下配置
# 网络优化
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000

# 文件系统优化
fs.file-max = 2097152
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# 应用配置
sudo sysctl -p
```

#### 配置防火墙

```bash
# UFW防火墙配置
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许必要端口
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 3000/tcp

# 启用防火墙
sudo ufw enable
```

## 开发环境部署

### 1. 获取代码

```bash
# 克隆项目
git clone https://github.com/your-org/vein-detection-system.git
cd vein-detection-system

# 查看项目结构
ls -la
```

### 2. 后端部署

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 安装项目
pip install -e .

# 配置环境变量
cp .env.example .env
vim .env

# 初始化数据库
python manage.py migrate
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver
```

#### 环境变量配置

```env
# 数据库配置
DATABASE_URL=postgresql://vein_user:password@localhost:5432/vein_detection_dev

# Redis配置
REDIS_URL=redis://localhost:6379/0

# API配置
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True

# 文件存储
STORAGE_TYPE=local
STORAGE_PATH=./data/videos

# 安全配置
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production

# 检测引擎
DETECTION_BATCH_SIZE=2
DETECTION_GPU_ENABLED=false
DETECTION_MODEL_PATH=./models/vein_detection.pth
```

### 3. 前端部署

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 前端环境配置

```javascript
// .env.development
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_APP_VERSION=1.0.0-dev
VITE_DEBUG=true
```

### 4. 数据库初始化

```bash
# 连接数据库
psql -h localhost -U vein_user -d vein_detection_dev

# 创建必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

# 检查表结构
\dt

# 运行测试数据
\i scripts/test_data.sql
```

### 5. 启动服务

```bash
# 后端服务 (终端1)
cd backend && source venv/bin/activate && python manage.py runserver

# 前端服务 (终端2) 
cd frontend && npm run dev

# 监控服务 (终端3)
docker-compose -f docker-compose.dev.yml up -d
```

#### 开发服务验证

```bash
# 检查后端API
curl http://localhost:8000/health

# 检查前端
curl http://localhost:3000

# 检查数据库连接
python -c "from app.core.database import engine; print(engine.execute('SELECT 1').scalar())"

# 检查Redis
redis-cli ping
```

## 生产环境部署

### 1. 生产环境准备

```bash
# 创建生产用户
sudo useradd -m -s /bin/bash veinapp
sudo usermod -aG docker veinapp

# 创建应用目录
sudo mkdir -p /opt/vein-detection
sudo chown veinapp:veinapp /opt/vein-detection

# 切换到应用用户
sudo su - veinapp
```

### 2. 配置文件准备

#### Docker Compose 生产配置

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: vein-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/ssl:/etc/nginx/ssl
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - api
      - web
    networks:
      - vein-network

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: vein-web
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs/web:/var/log/nginx
    networks:
      - vein-network

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: vein-api
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://vein_user:${DB_PASSWORD}@postgres:5432/vein_detection
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_TYPE=s3
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs/api:/app/logs
      - ./data/videos:/app/data/videos
    networks:
      - vein-network
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  video-service:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: vein-video-service
    command: python -m app.services.video_service
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://vein_user:${DB_PASSWORD}@postgres:5432/vein_detection
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs/video:/app/logs
      - ./data/videos:/app/data/videos
    networks:
      - vein-network

  detection-service:
    build:
      context: ./backend
      dockerfile: Dockerfile.gpu
    container_name: vein-detection
    runtime: nvidia
    restart: unless-stopped
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - DETECTION_BATCH_SIZE=4
      - DETECTION_MODEL_PATH=/app/models/vein_detection.pth
    volumes:
      - ./logs/detection:/app/logs
      - ./data/videos:/app/data/videos
      - ./models:/app/models
    networks:
      - vein-network

  postgres:
    image: postgres:13
    container_name: vein-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=vein_detection
      - POSTGRES_USER=vein_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - vein-network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  redis:
    image: redis:alpine
    container_name: vein-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - vein-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  minio:
    image: minio/minio
    container_name: vein-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - vein-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  prometheus:
    image: prom/prometheus
    container_name: vein-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    volumes:
      - ./docker/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - vein-network

  grafana:
    image: grafana/grafana
    container_name: vein-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./docker/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    networks:
      - vein-network

volumes:
  postgres_data:
  redis_data:
  minio_data:
  prometheus_data:
  grafana_data:

networks:
  vein-network:
    driver: bridge
```

#### 环境变量文件

```env
# .env.production
# 数据库配置
DB_PASSWORD=your_secure_database_password

# Redis配置
REDIS_PASSWORD=your_redis_password

# MinIO配置
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your_minio_password

# S3存储配置
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your_s3_access_key
S3_SECRET_KEY=your_s3_secret_key

# 安全配置
SECRET_KEY=your_production_secret_key_min_32_chars
JWT_SECRET=your_production_jwt_secret_min_32_chars

# Grafana配置
GRAFANA_PASSWORD=your_grafana_admin_password

# SSL证书路径
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

### 3. Nginx配置

```nginx
# docker/nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # 上游服务器
    upstream api_backend {
        server api:8000;
        keepalive 32;
    }

    upstream web_backend {
        server web:3000;
        keepalive 32;
    }

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # 主服务器配置
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL配置
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        # 前端静态文件
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;

            # 缓存配置
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API代理
        location /api/ {
            proxy_pass http://api_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # 超时配置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # WebSocket支持
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # 文件上传配置
        client_max_body_size 500M;
        client_body_timeout 300s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        # 健康检查
        location /health {
            proxy_pass http://api_backend/health;
            access_log off;
        }
    }
}
```

### 4. 部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "开始部署静脉检测系统..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 变量
APP_DIR="/opt/vein-detection"
BACKUP_DIR="/opt/backups/vein-detection"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
if [[ $EUID -eq 0 ]]; then
   log_error "请不要使用root用户运行此脚本"
   exit 1
fi

# 创建必要目录
log_info "创建目录结构..."
sudo mkdir -p $APP_DIR
sudo mkdir -p $BACKUP_DIR
sudo chown -R veinapp:veinapp $APP_DIR
sudo chown -R veinapp:veinapp $BACKUP_DIR

# 备份现有数据
if [ -d "$APP_DIR/data" ]; then
    log_info "备份现有数据..."
    sudo -u veinapp tar -czf $BACKUP_DIR/backup_$TIMESTAMP.tar.gz -C $APP_DIR data
fi

# 停止服务
log_info "停止现有服务..."
docker-compose -f docker-compose.prod.yml down

# 更新代码
log_info "更新代码..."
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    sudo -u veinapp git pull origin main
else
    sudo -u veinapp git clone https://github.com/your-org/vein-detection-system.git $APP_DIR
fi

# 构建镜像
log_info "构建Docker镜像..."
cd $APP_DIR
sudo -u veinapp docker-compose -f docker-compose.prod.yml build --no-cache

# 启动服务
log_info "启动服务..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
log_info "等待服务启动..."
sleep 30

# 健康检查
log_info "执行健康检查..."
max_attempts=10
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -f http://localhost/health >/dev/null 2>&1; then
        log_info "服务启动成功!"
        break
    else
        log_warn "健康检查失败，重试中... (尝试 $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    log_error "服务启动失败，请检查日志"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# 清理旧镜像
log_info "清理旧镜像..."
docker image prune -f

log_info "部署完成!"
log_info "Web界面: https://your-domain.com"
log_info "API文档: https://your-domain.com/docs"
log_info "监控面板: http://your-domain.com:3001"
```

### 5. 系统服务配置

```bash
# /etc/systemd/system/vein-deployment.service
[Unit]
Description=Vein Detection System Deployment
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=veinapp
WorkingDirectory=/opt/vein-detection
ExecStart=/opt/vein-detection/scripts/deploy.sh
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
```

```bash
# 启用服务
sudo systemctl enable vein-deployment
sudo systemctl start vein-deployment

# 查看状态
sudo systemctl status vein-deployment
```

## Docker容器部署

### 开发环境Docker

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: vein_detection_dev
      POSTGRES_USER: vein_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: dev_minio_password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_dev_data:/data

volumes:
  postgres_dev_data:
  redis_dev_data:
  minio_dev_data:
```

### GPU支持配置

```dockerfile
# Dockerfile.gpu
FROM nvidia/cuda:11.8-devel-ubuntu20.04

# 设置工作目录
WORKDIR /app

# 安装Python依赖
RUN apt-get update && apt-get install -y \
    python3.9 \
    python3.9-dev \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 安装Python包
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 安装应用
RUN pip3 install -e .

# 设置环境变量
ENV PYTHONPATH=/app
ENV CUDA_VISIBLE_DEVICES=0

# 启动命令
CMD ["python", "-m", "app.services.detection_service"]
```

### 多阶段构建

```dockerfile
# Backend Dockerfile.prod
FROM python:3.9-slim as builder

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建虚拟环境
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 复制依赖文件
COPY requirements.txt .

# 安装Python包
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# 生产阶段
FROM python:3.9-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 复制虚拟环境
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 复制应用代码
WORKDIR /app
COPY . .

# 安装应用
RUN pip install -e .

# 创建非root用户
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动服务
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

## 云平台部署

### AWS部署

#### 使用ECS部署

```json
{
  "family": "vein-detection-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/vein-api:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://username:password@rds-endpoint:5432/database"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vein-detection",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### RDS配置

```bash
# 创建RDS PostgreSQL实例
aws rds create-db-instance \
    --db-instance-identifier vein-detection-db \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 13.7 \
    --master-username vein_user \
    --master-user-password your_password \
    --allocated-storage 100 \
    --storage-type gp2 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-subnet-group-name default
```

### Kubernetes部署

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vein-detection

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: vein-config
  namespace: vein-detection
data:
  DATABASE_URL: "postgresql://user:pass@postgres:5432/vein_detection"
  REDIS_URL: "redis://redis:6379/0"
  API_HOST: "0.0.0.0"
  API_PORT: "8000"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: vein-secrets
  namespace: vein-detection
type: Opaque
stringData:
  SECRET_KEY: "your-secret-key"
  JWT_SECRET: "your-jwt-secret"
  DB_PASSWORD: "your-db-password"

---
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: vein-detection
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        env:
        - name: POSTGRES_DB
          value: vein_detection
        - name: POSTGRES_USER
          value: vein_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: vein-secrets
              key: DB_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: vein-detection
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: vein-api:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: vein-config
        - secretRef:
            name: vein-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1"
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: vein-detection
spec:
  selector:
    app: api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000
  type: ClusterIP
```

## 监控与运维

### Prometheus配置

```yaml
# docker/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'vein-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Grafana仪表板

```json
{
  "dashboard": {
    "title": "静脉检测系统监控",
    "panels": [
      {
        "title": "API响应时间",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "检测任务队列",
        "type": "stat",
        "targets": [
          {
            "expr": "detection_queue_size",
            "legendFormat": "队列长度"
          }
        ]
      }
    ]
  }
}
```

### 日志管理

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: elasticsearch:7.15.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  kibana:
    image: kibana:7.15.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

  logstash:
    image: logstash:7.15.0
    volumes:
      - ./docker/logstash/pipeline:/usr/share/logstash/pipeline
    depends_on:
      - elasticsearch

  filebeat:
    image: elastic/filebeat:7.15.0
    user: root
    volumes:
      - ./docker/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - logstash
```

## 备份与恢复

### 数据库备份脚本

```bash
#!/bin/bash
# scripts/backup_database.sh

set -e

DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="vein_detection"
DB_USER="vein_user"
BACKUP_DIR="/opt/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    --format=custom \
    --verbose \
    --file="$BACKUP_DIR/vein_backup_$TIMESTAMP.dump"

# 压缩备份
gzip "$BACKUP_DIR/vein_backup_$TIMESTAMP.dump"

# 删除7天前的备份
find $BACKUP_DIR -name "vein_backup_*.dump.gz" -mtime +7 -delete

echo "数据库备份完成: vein_backup_$TIMESTAMP.dump.gz"
```

### 文件存储备份

```bash
#!/bin/bash
# scripts/backup_storage.sh

STORAGE_DIR="/opt/vein-detection/data/videos"
BACKUP_DIR="/opt/backups/storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 同步到远程存储
rsync -av --delete $STORAGE_DIR/ $BACKUP_DIR/storage_backup_$TIMESTAMP/

# 上传到云存储（可选）
# aws s3 sync $BACKUP_DIR/storage_backup_$TIMESTAMP/ s3://your-backup-bucket/vein-detection/

echo "文件存储备份完成: storage_backup_$TIMESTAMP"
```

### 恢复脚本

```bash
#!/bin/bash
# scripts/restore_database.sh

set -e

if [ $# -ne 1 ]; then
    echo "用法: $0 <backup_file>"
    echo "示例: $0 vein_backup_20231118_120000.dump.gz"
    exit 1
fi

BACKUP_FILE=$1
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="vein_detection"
DB_USER="vein_user"

# 检查备份文件是否存在
if [ ! -f "/opt/backups/database/$BACKUP_FILE" ]; then
    echo "错误: 备份文件不存在: /opt/backups/database/$BACKUP_FILE"
    exit 1
fi

# 停止应用服务
docker-compose -f docker-compose.prod.yml stop api video-service detection-service

# 恢复数据库
gunzip -c "/opt/backups/database/$BACKUP_FILE" | \
    pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --verbose

# 重启服务
docker-compose -f docker-compose.prod.yml start api video-service detection-service

echo "数据库恢复完成: $BACKUP_FILE"
```

## 安全配置

### SSL证书配置

```bash
# 使用Let's Encrypt获取SSL证书
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 防火墙配置

```bash
# UFW详细配置
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许必要端口
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 限制SSH访问
sudo ufw limit ssh

# 记录被拒绝的连接
sudo ufw logging on

# 启用防火墙
sudo ufw enable
```

### 安全头配置

```nginx
# Nginx安全配置
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

## 性能调优

### 数据库优化

```sql
-- PostgreSQL优化配置
-- /etc/postgresql/13/main/postgresql.conf

shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

-- 索引优化
CREATE INDEX CONCURRENTLY idx_video_upload_time ON videos(upload_time);
CREATE INDEX CONCURRENTLY idx_detection_video_frame ON detection_results(video_id, frame_number);
CREATE INDEX CONCURRENTLY idx_roi_video_frame ON roi_annotations(video_id, frame_number);
```

### Redis优化

```conf
# Redis配置优化
# /etc/redis/redis.conf

maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
tcp-keepalive 300
timeout 0
tcp-backlog 511
```

### 系统优化

```bash
# 系统调优脚本
#!/bin/bash

# 调整文件描述符限制
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 调整内核参数
cat >> /etc/sysctl.conf << EOF
# 网络优化
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 10

# 文件系统优化
fs.file-max = 2097152
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF

sysctl -p
```

## 故障排除

### 常见问题

#### 1. 服务无法启动

```bash
# 检查端口占用
sudo netstat -tulpn | grep :8000
sudo lsof -i :8000

# 检查Docker状态
docker ps
docker-compose ps

# 查看服务日志
docker-compose logs api
journalctl -u vein-deployment -f
```

#### 2. 数据库连接失败

```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 测试数据库连接
psql -h localhost -U vein_user -d vein_detection -c "SELECT version();"

# 检查防火墙规则
sudo ufw status
sudo iptables -L
```

#### 3. 内存不足

```bash
# 检查内存使用
free -h
docker stats

# 清理Docker资源
docker system prune -a

# 调整容器内存限制
docker-compose up --scale api=1
```

### 性能监控

```bash
# 系统性能监控脚本
#!/bin/bash
# scripts/monitor.sh

echo "=== 系统性能报告 ==="
echo "时间: $(date)"
echo

echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print "User: " $1 "%, System: " $3 "%"}'

echo
echo "内存使用:"
free -h | awk 'NR==2{printf "Total: %s, Used: %s (%.2f%%), Free: %s\n", $2,$3,$3*100/$2,$7}'

echo
echo "磁盘使用:"
df -h | grep -E '^/dev/'

echo
echo "Docker容器状态:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "数据库连接数:"
psql -h localhost -U vein_user -d vein_detection -t -c "SELECT count(*) FROM pg_stat_activity;"

echo
echo "Redis状态:"
redis-cli info memory | grep used_memory_human
redis-cli info stats | grep keyspace_hits
```

---

部署完成后，请确保按照生产环境安全最佳实践进行配置，并定期更新系统和依赖包以保持安全性。