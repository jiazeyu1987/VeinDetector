# 部署指南

## 本地部署

### 方式一：直接运行
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 方式二：使用启动脚本
```bash
cd backend
chmod +x start.sh
./start.sh
```

### 方式三：Docker部署
```bash
cd backend
docker-compose up -d
```

## 生产环境部署

### 使用Gunicorn + Uvicorn
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 使用Nginx反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    client_max_body_size 500M;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /uploads/ {
        alias /path/to/backend/uploads/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    location /outputs/ {
        alias /path/to/backend/outputs/;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

## 监控和维护

### 日志查看
```bash
# 实时日志
tail -f logs/app.log

# 错误日志
grep "ERROR" logs/app.log

# 性能统计
grep "processing_time" logs/app.log
```

### 性能监控
```bash
# CPU使用率
top -p $(pgrep -f "main.py")

# 内存使用
ps aux | grep "main.py"

# 磁盘空间
df -h uploads outputs
```

### 清理维护
```bash
# 清理旧文件
find uploads/ -type f -mtime +1 -delete
find outputs/ -type f -mtime +7 -delete

# 清理日志
find logs/ -name "*.log" -mtime +30 -delete
```

## 故障排除

### 常见问题及解决方案

1. **内存不足**
   ```bash
   # 监控内存使用
   free -h
   
   # 减少并发数
   export WORKERS=1
   ```

2. **磁盘空间不足**
   ```bash
   # 清理临时文件
   rm -rf uploads/* outputs/*
   
   # 检查磁盘使用
   du -sh uploads/ outputs/
   ```

3. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :8000
   
   # 杀死进程
   kill -9 $(lsof -ti:8000)
   ```

4. **依赖包问题**
   ```bash
   # 重新安装依赖
   pip uninstall -r requirements.txt -y
   pip install -r requirements.txt
   ```

### 性能调优

1. **CPU密集型任务**
   - 调整检测参数降低计算复杂度
   - 使用多进程处理
   - 启用GPU加速（如果支持）

2. **内存优化**
   - 流式处理避免内存溢出
   - 及时释放不用的对象
   - 使用生成器处理大数据

3. **I/O优化**
   - 使用SSD存储
   - 启用文件缓存
   - 压缩输出文件

## 安全配置

### 访问控制
- 限制上传文件大小和类型
- 添加API密钥认证
- 启用HTTPS

### 文件安全
```bash
# 设置目录权限
chmod 755 uploads/ outputs/
chmod 600 config.yaml

# 限制文件执行
find . -name "*.py" -exec chmod 644 {} \;
```

## 备份策略

### 数据备份
```bash
# 备份上传文件
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# 备份输出文件
tar -czf outputs_backup_$(date +%Y%m%d).tar.gz outputs/

# 备份配置文件
cp config.yaml config_backup_$(date +%Y%m%d).yaml
```

### 自动备份脚本
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/vein-detection"

mkdir -p $BACKUP_DIR

# 备份数据
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/
tar -czf $BACKUP_DIR/outputs_$DATE.tar.gz outputs/

# 保留最近7天的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

## 扩展部署

### 集群部署
- 使用负载均衡器分发请求
- 配置共享存储
- 实现会话共享

### 微服务架构
- 视频上传服务
- 视频处理服务  
- 结果查询服务
- 文件管理服务

### 云原生部署
- Kubernetes部署
- Docker Swarm
- 容器编排