#!/bin/bash
# 静脉检测系统开发环境日志查看脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# 显示帮助信息
show_help() {
    echo "静脉检测系统日志查看脚本"
    echo
    echo "用法: $0 [选项] [服务名]"
    echo
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -f, --follow            实时跟踪日志 (默认)"
    echo "  -n, --lines NUM         显示最后N行日志 (默认100)"
    echo "  -t, --tail              等同于 --follow"
    echo "  --no-color              禁用彩色输出"
    echo
    echo "服务名:"
    echo "  api                     API服务日志"
    echo "  web                     前端服务日志"
    echo "  video-service           视频处理服务日志"
    echo "  postgres                PostgreSQL数据库日志"
    echo "  redis                   Redis缓存日志"
    echo "  minio                   MinIO存储日志"
    echo "  mailhog                 邮件服务日志"
    echo "  jupyter                 Jupyter Notebook日志"
    echo "  all                     所有服务日志 (默认)"
    echo
    echo "示例:"
    echo "  $0                      # 实时跟踪所有服务日志"
    echo "  $0 api                  # 查看API服务日志"
    echo "  $0 -n 50 postgres       # 查看PostgreSQL最后50行日志"
    echo "  $0 --no-color all       # 彩色输出查看所有日志"
    echo
}

# 解析命令行参数
parse_args() {
    FOLLOW=true
    LINES=100
    COLOR=true
    SERVICE="all"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -f|--follow|-t|--tail)
                FOLLOW=true
                shift
                ;;
            -n|--lines)
                LINES="$2"
                FOLLOW=false
                shift 2
                ;;
            --no-color)
                COLOR=false
                shift
                ;;
            all|api|web|video-service|postgres|redis|minio|mailhog|jupyter)
                SERVICE="$1"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 显示服务日志
show_service_logs() {
    local service="$1"
    local container_name="vein-${service}-dev"
    
    if [ "$FOLLOW" = true ]; then
        echo -e "${CYAN}=== $service 服务日志 (实时跟踪) ===${NC}"
        echo -e "${YELLOW}按 Ctrl+C 退出${NC}"
        echo
        docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" logs -f --tail="$LINES" "$service"
    else
        echo -e "${CYAN}=== $service 服务日志 (最后 $LINES 行) ===${NC}"
        docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" logs --tail="$LINES" "$service"
        echo
    fi
}

# 显示所有服务日志
show_all_logs() {
    if [ "$FOLLOW" = true ]; then
        echo -e "${CYAN}=== 所有服务日志 (实时跟踪) ===${NC}"
        echo -e "${YELLOW}按 Ctrl+C 退出${NC}"
        echo
        docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" logs -f
    else
        echo -e "${CYAN}=== 所有服务日志 (最后 $LINES 行) ===${NC}"
        docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" logs --tail="$LINES"
        echo
    fi
}

# 显示服务状态
show_service_status() {
    echo -e "${BLUE}=== 服务状态 ===${NC}"
    docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ps
    echo
    
    echo -e "${BLUE}=== 资源使用情况 ===${NC}"
    docker stats --no-stream $(docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ps -q) 2>/dev/null || echo "没有运行中的容器"
    echo
}

# 检查服务是否运行
check_service_running() {
    local service="$1"
    if ! docker-compose -f "$PROJECT_DIR/$DOCKER_COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        log_warn "服务 $service 未运行"
        return 1
    fi
    return 0
}

# 主函数
main() {
    parse_args "$@"
    
    echo "=========================================="
    echo "📋 静脉检测系统日志查看脚本"
    echo "=========================================="
    echo
    
    # 显示服务状态
    show_service_status
    
    # 根据服务参数显示日志
    case "$SERVICE" in
        all)
            show_all_logs
            ;;
        api|web|video-service|postgres|redis|minio|mailhog|jupyter)
            if check_service_running "$SERVICE"; then
                show_service_logs "$SERVICE"
            else
                log_error "服务 $SERVICE 未运行"
                exit 1
            fi
            ;;
        *)
            log_error "未知服务: $SERVICE"
            exit 1
            ;;
    esac
}

# 处理中断信号
trap 'echo -e "\n${GREEN}日志查看结束${NC}"; exit 0' INT TERM

# 执行主函数
main "$@"