#!/bin/bash
# 静脉检测系统开发环境重启脚本

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

# 重启服务
restart_services() {
    log_step "重启开发服务..."
    
    cd "$PROJECT_DIR"
    
    # 重启所有服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" restart
    
    log_info "服务重启完成"
}

# 重建并重启服务
rebuild_and_restart() {
    log_step "重建镜像并重启服务..."
    
    cd "$PROJECT_DIR"
    
    # 停止服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # 重建镜像
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    # 重启服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    log_info "镜像重建并重启完成"
}

# 等待服务就绪
wait_for_services() {
    log_step "等待服务就绪..."
    
    # 检查API服务
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

# 显示服务信息
show_service_info() {
    echo
    echo "🔄 服务重启完成!"
    echo
    echo "📊 服务地址:"
    echo "  🌐 Web前端:     http://localhost:3000"
    echo "  🔗 API文档:     http://localhost:8000/docs"
    echo "  🏥 API健康检查: http://localhost:8000/health"
    echo
}

# 主函数
main() {
    echo "=========================================="
    echo "🔄 静脉检测系统开发环境重启脚本"
    echo "=========================================="
    echo
    
    # 检查是否在正确的目录
    if [ ! -f "$PROJECT_DIR/docker-compose.dev.yml" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    if [ "$1" = "--rebuild" ] || [ "$1" = "-r" ]; then
        rebuild_and_restart
    else
        restart_services
    fi
    
    wait_for_services
    show_service_info
}

# 执行主函数
main "$@"