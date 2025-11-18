#!/bin/bash
# 静脉检测系统开发环境停止脚本

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

# 停止服务
stop_services() {
    log_step "停止开发服务..."
    
    cd "$PROJECT_DIR"
    
    # 停止所有服务
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    log_info "所有服务已停止"
}

# 清理资源
cleanup_resources() {
    log_step "清理Docker资源..."
    
    cd "$PROJECT_DIR"
    
    # 清理未使用的镜像
    docker image prune -f &> /dev/null || true
    
    # 清理未使用的网络
    docker network prune -f &> /dev/null || true
    
    # 清理未使用的卷（可选）
    # docker volume prune -f &> /dev/null || true
    
    log_info "资源清理完成"
}

# 显示服务状态
show_service_status() {
    log_step "检查服务状态..."
    
    # 检查容器状态
    echo
    echo "容器状态:"
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ps 2>/dev/null || echo "没有运行中的容器"
    
    # 检查端口占用
    echo
    echo "端口占用情况:"
    PORTS=(3000 8000 5432 6379 9000 9001 8888 8025)
    for port in "${PORTS[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${YELLOW}⚠️  端口 $port 仍被占用${NC}"
        else
            echo -e "  ${GREEN}✅ 端口 $port 可用${NC}"
        fi
    done
}

# 主函数
main() {
    echo "=========================================="
    echo "🛑 静脉检测系统开发环境停止脚本"
    echo "=========================================="
    echo
    
    stop_services
    cleanup_resources
    show_service_status
    
    echo
    echo "✅ 开发环境已完全停止"
    echo
    echo "💡 下次启动:"
    echo "   ./scripts/dev-start.sh"
    echo
}

# 执行主函数
main "$@"