#!/bin/bash
# 静脉检测系统开发环境启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_COMPOSE_FILE="docker-compose.dev.yml"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查Docker和Docker Compose
check_dependencies() {
    log_step "检查依赖项..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Docker服务状态
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行，请启动Docker"
        exit 1
    fi
    
    log_info "依赖项检查通过"
}

# 创建环境变量文件
create_env_file() {
    log_step "创建环境变量文件..."
    
    ENV_FILE="$PROJECT_DIR/.env.dev"
    
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << EOF
# 开发环境配置
DEBUG=True
DATABASE_URL=postgresql://vein_user:dev_password@localhost:5432/vein_detection_dev
REDIS_URL=redis://redis:6379/0

# API配置
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=1

# 文件存储
STORAGE_TYPE=minio
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=dev_minio_password

# 前端配置
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=30000

# 日志级别
LOG_LEVEL=DEBUG

# 邮件配置（开发）
MAIL_SERVER=mailhog
MAIL_PORT=1025
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_USE_TLS=false
MAIL_DEFAULT_SENDER=noreply@vein-detection.local

# 安全配置（开发）
SECRET_KEY=dev-secret-key-for-development-only
JWT_SECRET=dev-jwt-secret-for-development-only
EOF
        log_info "创建了环境变量文件: $ENV_FILE"
    else
        log_info "环境变量文件已存在: $ENV_FILE"
    fi
}

# 创建必要目录
create_directories() {
    log_step "创建必要目录..."
    
    DIRS=(
        "$PROJECT_DIR/data/videos"
        "$PROJECT_DIR/data/uploads"
        "$PROJECT_DIR/logs"
        "$PROJECT_DIR/logs/api"
        "$PROJECT_DIR/logs/video"
        "$PROJECT_DIR/logs/web"
        "$PROJECT_DIR/notebooks"
        "$PROJECT_DIR/models"
    )
    
    for dir in "${DIRS[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "创建目录: $dir"
        fi
    done
}

# 清理旧的容器和数据
cleanup() {
    log_step "清理旧的容器和数据..."
    
    cd "$PROJECT_DIR"
    
    # 停止并删除容器
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans --volumes 2>/dev/null || true
    
    # 清理未使用的镜像
    docker image prune -f &> /dev/null || true
    
    log_info "清理完成"
}

# 构建镜像
build_images() {
    log_step "构建Docker镜像..."
    
    cd "$PROJECT_DIR"
    
    # 构建必要的后端镜像
    docker build -f docker/Dockerfile.dev -t vein-detection:dev-backend ./backend
    
    # 构建前端镜像
    docker build -f docker/Dockerfile.frontend.dev -t vein-detection:dev-frontend ./frontend
    
    log_info "镜像构建完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    cd "$PROJECT_DIR"
    
    # 启动基础设施服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis minio
    
    log_info "等待基础设施服务启动..."
    sleep 30
    
    # 启动应用服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d api web video-service mailhog jupyter
    
    log_info "等待应用服务启动..."
    sleep 15
    
    log_info "所有服务启动完成"
}

# 等待服务就绪
wait_for_services() {
    log_step "等待服务就绪..."
    
    # 检查数据库
    log_info "检查数据库连接..."
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U vein_user -d vein_detection_dev &> /dev/null; then
            log_info "数据库连接成功"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done
    
    if [ $counter -ge $timeout ]; then
        log_error "数据库连接超时"
        exit 1
    fi
    
    # 检查API服务
    log_info "检查API服务..."
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if curl -f http://localhost:8000/health &> /dev/null; then
            log_info "API服务就绪"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done
    
    if [ $counter -ge $timeout ]; then
        log_error "API服务启动超时"
        exit 1
    fi
    
    log_info "所有服务就绪"
}

# 运行数据库迁移
run_migrations() {
    log_step "运行数据库迁移..."
    
    cd "$PROJECT_DIR"
    
    # 执行数据库初始化（如果需要）
    docker-compose -f "$DOCKER_COMPOSE_FILE" exec api python -c "
from app.core.database import engine
from app.models import Base
try:
    Base.metadata.create_all(bind=engine)
    print('数据库表创建成功')
except Exception as e:
    print(f'数据库迁移失败: {e}')
" || log_warn "数据库迁移可能失败，请检查日志"
}

# 显示服务信息
show_services_info() {
    log_step "服务信息"
    echo
    echo "🎉 静脉检测系统开发环境启动成功!"
    echo
    echo "📊 服务地址:"
    echo "  🌐 Web前端:     http://localhost:3000"
    echo "  🔗 API文档:     http://localhost:8000/docs"
    echo "  🏥 API健康检查: http://localhost:8000/health"
    echo "  📝 Jupyter:     http://localhost:8888"
    echo "  📧 邮件测试:    http://localhost:8025"
    echo "  💾 MinIO控制台: http://localhost:9001"
    echo
    echo "🗄️  数据库:"
    echo "  🏷️  PostgreSQL: localhost:5432"
    echo "  🗃️  Redis:      localhost:6379"
    echo
    echo "📁 数据目录:"
    echo "  📹 视频文件:    ./data/videos"
    echo "  📋 日志文件:    ./logs"
    echo "  🧠 模型文件:    ./models"
    echo
    echo "🔧 常用命令:"
    echo "  📋 查看日志:    ./scripts/dev-logs.sh"
    echo "  🔄 重启服务:    ./scripts/dev-restart.sh"
    echo "  🛑 停止服务:    ./scripts/dev-stop.sh"
    echo
    echo "💡 提示:"
    echo "  - 修改代码后服务会自动重启"
    echo "  - 查看日志以了解服务状态"
    echo "  - 使用Ctrl+C停止开发服务器"
    echo
}

# 主函数
main() {
    echo "=========================================="
    echo "🚀 静脉检测系统开发环境启动脚本"
    echo "=========================================="
    echo
    
    # 检查是否在正确的目录
    if [ ! -f "$PROJECT_DIR/docker-compose.dev.yml" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    check_dependencies
    create_env_file
    create_directories
    cleanup
    build_images
    start_services
    wait_for_services
    run_migrations
    show_services_info
}

# 处理信号
trap 'log_warn "收到中断信号，正在停止服务..."; docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" down; exit 0' INT TERM

# 执行主函数
main "$@"