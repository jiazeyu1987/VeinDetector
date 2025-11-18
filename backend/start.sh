#!/bin/bash

# 超声静脉检测系统启动脚本

echo "🚀 启动超声静脉检测系统..."

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "📥 安装依赖包..."
pip install -r requirements.txt

# 创建必要的目录
echo "📁 创建工作目录..."
mkdir -p uploads outputs logs

# 启动服务
echo "🌟 启动FastAPI服务器..."
echo "📍 API文档地址: http://localhost:8000/docs"
echo "📍 健康检查: http://localhost:8000/health"
echo ""

# 使用uvicorn启动
uvicorn main:app --host 0.0.0.0 --port 8000 --reload