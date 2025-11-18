#!/bin/bash

# 系统部署和运维脚本
set -e

# 配置变量
PROJECT_NAME="vein-detection-system"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
LOG_DIR="$PROJECT_ROOT/logs"
CONFIG_DIR="$PROJECT_ROOT/config"
BACKUP_DIR="$PROJECT_ROOT/backups"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    local deps=("docker" "docker-compose" "node" "npm" "curl")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少以下依赖: ${missing_deps[*]}"
        exit 1
    fi
    
    log_info "所有依赖检查通过"
}

# 创建必要的目录
setup_directories() {
    log_info "创建必要的目录结构..."
    
    local dirs=(
        "$LOG_DIR"
        "$BACKUP_DIR"
        "$PROJECT_ROOT/uploads"
        "$PROJECT_ROOT/temp"
        "$PROJECT_ROOT/cache"
        "/var/cache/nginx"
        "/var/log/nginx"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_debug "创建目录: $dir"
        fi
    done
    
    # 设置权限
    chmod 755 "$LOG_DIR" "$BACKUP_DIR" "$PROJECT_ROOT/uploads" "$PROJECT_ROOT/temp" "$PROJECT_ROOT/cache"
    chown -R www-data:www-data "/var/cache/nginx" "/var/log/nginx" 2>/dev/null || true
}

# 检查端口可用性
check_ports() {
    log_info "检查端口占用情况..."
    
    local ports=(3000 8000 8080 5432 6379 80 443)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            occupied_ports+=("$port")
        fi
    done
    
    if [ ${#occupied_ports[@]} -ne 0 ]; then
        log_warn "以下端口已被占用: ${occupied_ports[*]}"
        log_warn "建议在继续之前释放这些端口"
        
        read -p "是否继续部署？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "部署已取消"
            exit 0
        fi
    fi
    
    log_info "端口检查完成"
}

# 环境变量检查
check_environment() {
    log_info "检查环境变量配置..."
    
    local required_vars=(
        "NODE_ENV"
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "UPLOAD_PATH"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "缺少以下环境变量: ${missing_vars[*]}"
        log_info "请在 .env 文件中设置这些变量"
        exit 1
    fi
    
    log_info "环境变量检查通过"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    cd "$PROJECT_ROOT"
    
    # 安装前端依赖
    if [ -d "frontend" ]; then
        log_info "安装前端依赖..."
        cd frontend
        npm ci --production
        cd "$PROJECT_ROOT"
    fi
    
    # 安装后端依赖
    if [ -d "backend" ]; then
        log_info "安装后端依赖..."
        cd backend
        npm ci --production
        cd "$PROJECT_ROOT"
    fi
    
    # 安装视频服务依赖
    if [ -d "video-service" ]; then
        log_info "安装视频服务依赖..."
        cd video-service
        npm ci --production
        cd "$PROJECT_ROOT"
    fi
    
    log_info "依赖安装完成"
}

# 构建Docker镜像
build_images() {
    log_info "构建Docker镜像..."
    
    cd "$PROJECT_ROOT"
    docker-compose build --parallel
    
    log_info "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    cd "$PROJECT_ROOT"
    
    # 启动数据库和缓存服务
    docker-compose up -d database redis
    
    # 等待数据库就绪
    log_info "等待数据库就绪..."
    sleep 10
    
    # 启动应用服务
    docker-compose up -d
    
    # 等待所有服务启动
    log_info "等待所有服务启动..."
    sleep 15
    
    # 检查服务状态
    check_services_health
}

# 检查服务健康状态
check_services_health() {
    log_info "检查服务健康状态..."
    
    local services=("frontend:3000" "backend:8000" "video-service:8080" "database:5432")
    local unhealthy_services=()
    
    for service_port in "${services[@]}"; do
        local service="${service_port%:*}"
        local port="${service_port#*:}"
        
        if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
            log_info "$service 服务运行正常"
        else
            unhealthy_services+=("$service")
            log_error "$service 服务健康检查失败"
        fi
    done
    
    if [ ${#unhealthy_services[@]} -ne 0 ]; then
        log_error "以下服务健康检查失败: ${unhealthy_services[*]}"
        log_info "查看服务状态: docker-compose ps"
        log_info "查看服务日志: docker-compose logs"
        return 1
    fi
    
    log_info "所有服务健康检查通过"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    
    cd "$PROJECT_ROOT"
    docker-compose down
    
    log_info "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    
    stop_services
    sleep 5
    start_services
    
    log_info "服务重启完成"
}

# 清理服务
clean_services() {
    log_info "清理服务..."
    
    cd "$PROJECT_ROOT"
    
    # 停止并删除容器
    docker-compose down -v --remove-orphans
    
    # 清理未使用的镜像
    docker image prune -f
    
    # 清理未使用的网络
    docker network prune -f
    
    log_info "服务清理完成"
}

# 重新部署
redeploy() {
    log_info "重新部署系统..."
    
    check_dependencies
    setup_directories
    check_ports
    check_environment
    
    # 停止现有服务
    stop_services
    
    # 清理服务
    clean_services
    
    # 重新构建和启动
    build_images
    start_services
    
    log_info "重新部署完成"
}

# 数据库迁移
run_migrations() {
    log_info "执行数据库迁移..."
    
    cd "$PROJECT_ROOT/backend"
    
    if [ -f "node_modules/.bin/sequelize-cli" ]; then
        npm run db:migrate
        log_info "数据库迁移完成"
    else
        log_warn "未找到迁移脚本，跳过数据库迁移"
    fi
    
    cd "$PROJECT_ROOT"
}

# 数据备份
backup_data() {
    local backup_name="backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log_info "开始数据备份..."
    
    mkdir -p "$backup_path"
    
    # 备份数据库
    log_info "备份数据库..."
    docker-compose exec -T database pg_dumpall -U postgres > "$backup_path/database.sql" 2>/dev/null || {
        log_warn "数据库备份失败"
    }
    
    # 备份上传的文件
    log_info "备份上传文件..."
    if [ -d "$PROJECT_ROOT/uploads" ]; then
        tar -czf "$backup_path/uploads.tar.gz" -C "$PROJECT_ROOT" uploads/ 2>/dev/null || {
            log_warn "上传文件备份失败"
        }
    fi
    
    # 备份配置文件
    log_info "备份配置文件..."
    tar -czf "$backup_path/config.tar.gz" -C "$PROJECT_ROOT" config/ .env 2>/dev/null || {
        log_warn "配置文件备份失败"
    }
    
    log_info "备份完成: $backup_path"
}

# 数据恢复
restore_data() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        log_error "请指定备份名称"
        return 1
    fi
    
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if [ ! -d "$backup_path" ]; then
        log_error "备份不存在: $backup_path"
        return 1
    fi
    
    log_warn "即将恢复数据，这将覆盖当前数据！"
    read -p "确认继续？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "恢复操作已取消"
        return 0
    fi
    
    log_info "开始数据恢复..."
    
    # 恢复数据库
    if [ -f "$backup_path/database.sql" ]; then
        log_info "恢复数据库..."
        docker-compose exec -T database psql -U postgres < "$backup_path/database.sql" 2>/dev/null || {
            log_error "数据库恢复失败"
            return 1
        }
    fi
    
    # 恢复上传文件
    if [ -f "$backup_path/uploads.tar.gz" ]; then
        log_info "恢复上传文件..."
        tar -xzf "$backup_path/uploads.tar.gz" -C "$PROJECT_ROOT" 2>/dev/null || {
            log_error "上传文件恢复失败"
            return 1
        }
    fi
    
    # 恢复配置文件
    if [ -f "$backup_path/config.tar.gz" ]; then
        log_info "恢复配置文件..."
        tar -xzf "$backup_path/config.tar.gz" -C "$PROJECT_ROOT" 2>/dev/null || {
            log_error "配置文件恢复失败"
            return 1
        }
    }
    
    log_info "数据恢复完成"
    log_info "建议重启服务以确保所有更改生效"
}

# 监控服务状态
monitor_services() {
    log_info "监控服务状态..."
    
    while true; do
        clear
        echo "========================================"
        echo "静脉检测系统 - 服务监控"
        echo "========================================"
        echo "时间: $(date)"
        echo
        
        # 显示Docker服务状态
        echo "Docker服务状态:"
        docker-compose ps
        echo
        
        # 显示系统资源使用
        echo "系统资源使用:"
        echo "CPU使用率: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
        echo "内存使用: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
        echo "磁盘使用: $(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 " 已用)"}')"
        echo
        
        # 显示服务健康状态
        echo "服务健康状态:"
        local services=("frontend:3000/health" "backend:8000/health" "video-service:8080/health")
        
        for service_path in "${services[@]}"; do
            local service="${service_path%:*}"
            local path="${service_path#*:}"
            local url="http://localhost:$path"
            
            if curl -sf "$url" > /dev/null 2>&1; then
                echo "✅ $service - 健康"
            else
                echo "❌ $service - 不健康"
            fi
        done
        
        echo
        echo "按 Ctrl+C 退出监控"
        
        sleep 10
    done
}

# 日志查看
view_logs() {
    local service="$1"
    local lines="${2:-50}"
    
    if [ -z "$service" ]; then
        log_info "可用的服务: frontend, backend, video-service, database, redis, nginx"
        read -p "请输入服务名称: " service
    fi
    
    cd "$PROJECT_ROOT"
    
    case "$service" in
        "frontend"|"backend"|"video-service"|"database"|"redis"|"nginx")
            docker-compose logs --tail="$lines" -f "$service"
            ;;
        "all")
            docker-compose logs --tail="$lines" -f
            ;;
        *)
            log_error "未知的服务: $service"
            exit 1
            ;;
    esac
}

# 系统清理
cleanup_system() {
    log_info "开始系统清理..."
    
    # 清理Docker资源
    log_info "清理Docker资源..."
    docker system prune -f
    
    # 清理临时文件
    log_info "清理临时文件..."
    rm -rf "$PROJECT_ROOT/temp/"*
    rm -rf "$PROJECT_ROOT/cache/"*
    
    # 清理日志文件（保留最近7天）
    log_info "清理日志文件..."
    find "$LOG_DIR" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    
    # 清理备份（保留最近30天）
    log_info "清理旧备份..."
    find "$BACKUP_DIR" -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
    
    log_info "系统清理完成"
}

# 性能测试
run_performance_test() {
    log_info "开始性能测试..."
    
    # 检查服务是否运行
    if ! curl -sf "http://localhost:8000/health" > /dev/null 2>&1; then
        log_error "后端服务未运行，请先启动服务"
        exit 1
    fi
    
    # 安装性能测试工具
    if ! command -v "ab" &> /dev/null; then
        log_warn "未找到ab工具，安装中..."
        sudo apt-get update
        sudo apt-get install -y apache2-utils
    fi
    
    # 执行API性能测试
    log_info "测试API响应性能..."
    ab -n 100 -c 10 "http://localhost:8000/health"
    
    log_info "性能测试完成"
}

# 显示帮助信息
show_help() {
    echo "静脉检测系统部署脚本"
    echo
    echo "用法: $0 [COMMAND]"
    echo
    echo "可用命令:"
    echo "  check           检查系统环境和依赖"
    echo "  install         安装项目依赖"
    echo "  build          构建Docker镜像"
    echo "  start          启动服务"
    echo "  stop           停止服务"
    echo "  restart        重启服务"
    echo "  clean          清理服务"
    echo "  redeploy       重新部署系统"
    echo "  migrate        执行数据库迁移"
    echo "  backup         备份数据"
    echo "  restore <name> 恢复数据"
    echo "  monitor        监控服务状态"
    echo "  logs [service] 查看服务日志"
    echo "  cleanup        清理系统"
    echo "  test           运行性能测试"
    echo "  help           显示此帮助信息"
    echo
}

# 主函数
main() {
    local command="${1:-help}"
    
    case "$command" in
        "check")
            check_dependencies
            setup_directories
            check_ports
            check_environment
            ;;
        "install")
            install_dependencies
            ;;
        "build")
            build_images
            ;;
        "start")
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "clean")
            clean_services
            ;;
        "redeploy")
            redeploy
            ;;
        "migrate")
            run_migrations
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$2"
            ;;
        "monitor")
            monitor_services
            ;;
        "logs")
            view_logs "$2" "$3"
            ;;
        "cleanup")
            cleanup_system
            ;;
        "test")
            run_performance_test
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 信号处理
trap 'log_info "脚本执行中断"; exit 130' INT TERM

# 执行主函数
main "$@"