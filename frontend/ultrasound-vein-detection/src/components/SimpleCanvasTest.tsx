import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * 简单的Canvas灰度值测试组件
 */
export const SimpleCanvasTest: React.FC = () => {
  const [showGrayscale, setShowGrayscale] = useState(true);
  const [currentGrayscale, setCurrentGrayscale] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 生成测试图像
  const generateTestImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布大小
    canvas.width = 800;
    canvas.height = 600;

    // 创建灰度渐变背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (let i = 0; i <= 255; i += 5) {
      const position = i / 255;
      gradient.addColorStop(position, `rgb(${i}, ${i}, ${i})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加测试形状
    ctx.fillStyle = '#000000';
    ctx.fillRect(100, 100, 150, 150); // 黑色方块

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(300, 100, 150, 150); // 白色方块

    ctx.fillStyle = '#808080';
    ctx.fillRect(500, 100, 150, 150); // 灰色方块

    // 添加圆形
    ctx.beginPath();
    ctx.arc(200, 400, 75, 0, 2 * Math.PI);
    ctx.fillStyle = '#404040';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(400, 400, 75, 0, 2 * Math.PI);
    ctx.fillStyle = '#c0c0c0';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(600, 400, 75, 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 添加文本
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('灰度值测试 - 从左到右 0-255', 200, 50);
    ctx.font = '14px Arial';
    ctx.fillText('黑色 (0)', 150, 280);
    ctx.fillText('白色 (255)', 340, 280);
    ctx.fillText('灰色 (128)', 540, 280);
  }, []);

  // 获取鼠标位置的灰度值
  const getGrayscaleValue = useCallback((x: number, y: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    try {
      const imageData = ctx.getImageData(x, y, 1, 1);
      const data = imageData.data;
      // 使用标准灰度转换公式: 0.299*R + 0.587*G + 0.114*B
      const grayscale = Math.round(0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]);
      return grayscale;
    } catch (error) {
      return 0;
    }
  }, []);

  // 处理鼠标移动事件
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showGrayscale || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    // 边界检查
    if (x < 0 || x >= canvasRef.current.width || y < 0 || y >= canvasRef.current.height) {
      return;
    }

    const grayscaleValue = getGrayscaleValue(x, y);
    setCurrentGrayscale(grayscaleValue);
    setMousePosition({ x, y });
  }, [showGrayscale, getGrayscaleValue]);

  // 处理鼠标离开事件
  const handleMouseLeave = useCallback(() => {
    setCurrentGrayscale(null);
    setMousePosition(null);
  }, []);

  // 初始化测试图像
  useEffect(() => {
    generateTestImage();
  }, [generateTestImage]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">灰度值功能测试</h1>

        {/* 控制面板 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试控制</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showGrayscale}
                onChange={(e) => setShowGrayscale(e.target.checked)}
                className="h-4 w-4"
              />
              <span>显示灰度值信息</span>
            </label>

            <button
              onClick={generateTestImage}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
            >
              重新生成测试图像
            </button>

            {currentGrayscale !== null && (
              <div className="bg-gray-700 rounded p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>鼠标位置:</strong> ({mousePosition?.x}, {mousePosition?.y})</div>
                  <div><strong>灰度值:</strong> {currentGrayscale}/255</div>
                  <div><strong>十六进制:</strong> #{currentGrayscale.toString(16).padStart(2, '0').repeat(3)}</div>
                  <div><strong>RGB:</strong> rgb({currentGrayscale}, {currentGrayscale}, {currentGrayscale})</div>
                  <div><strong>建议阈值:</strong> {Math.round(currentGrayscale * 0.8)}</div>
                  <div><strong>建议范围:</strong> [{Math.max(0, currentGrayscale - 20)}, {Math.min(255, currentGrayscale + 20)}]</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 测试图像显示 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">测试图像</h2>
          <div className="flex justify-center">
            <div className="border-2 border-gray-600 rounded relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />

              {/* 灰度值显示覆盖层 */}
              {showGrayscale && currentGrayscale !== null && (
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-90 text-white px-3 py-2 rounded text-sm border border-gray-600">
                  <div className="font-mono space-y-1">
                    <div>坐标: ({mousePosition?.x}, {mousePosition?.y})</div>
                    <div>灰度值: {currentGrayscale}/255</div>
                    <div className="text-xs text-gray-300">建议阈值: {Math.round(currentGrayscale * 0.8)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>• 移动鼠标到图像上查看不同位置的灰度值</p>
            <p>• 图像包含从黑到白的灰度渐变</p>
            <p>• 测试不同区域的灰度值变化</p>
            <p>• 黑色方块 ≈ 0, 白色方块 ≈ 255, 灰色方块 ≈ 128</p>
          </div>
        </div>

        {/* 测试说明 */}
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
          <h2 className="text-xl font-semibold mb-4">测试说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">预期测试结果</h3>
              <ul className="space-y-1 text-gray-300">
                <li>左侧区域: 灰度值 0-50</li>
                <li>中间区域: 灰度值 120-140</li>
                <li>右侧区域: 灰度值 200-255</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">几何形状测试</h3>
              <ul className="space-y-1 text-gray-300">
                <li>黑色方块: 灰度值 ≈ 0</li>
                <li>白色方块: 灰度值 ≈ 255</li>
                <li>灰色方块: 灰度值 ≈ 128</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.href = window.location.origin}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded"
          >
            返回主应用
          </button>
        </div>
      </div>
    </div>
  );
};