import React, { useState, useRef, useCallback } from 'react';
import { VideoPlayer } from './VideoPlayer';

/**
 * 灰度值功能测试组件
 * 用于测试鼠标悬停灰度值显示和自动阈值功能
 */
export const GrayscaleTest: React.FC = () => {
  const [showGrayscale, setShowGrayscale] = useState(true);
  const [currentGrayscale, setCurrentGrayscale] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [testImageUrl, setTestImageUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 生成测试图像
  const generateTestImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // 创建灰度渐变图像用于测试
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    for (let i = 0; i <= 255; i += 5) {
      const position = i / 255;
      gradient.addColorStop(position, `rgb(${i}, ${i}, ${i})`);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加一些几何形状用于测试
    ctx.fillStyle = '#000000';
    ctx.fillRect(100, 100, 100, 100); // 黑色方块
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(300, 100, 100, 100); // 白色方块
    ctx.fillStyle = '#808080';
    ctx.fillRect(500, 100, 100, 100); // 灰色方块

    // 添加圆形
    ctx.beginPath();
    ctx.arc(200, 350, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#404040';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(400, 350, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#c0c0c0';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(600, 350, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 添加文本标注
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('灰度渐变测试图像', 10, 30);
    ctx.font = '12px Arial';
    ctx.fillText('黑色 (0)', 100, 230);
    ctx.fillText('白色 (255)', 300, 230);
    ctx.fillText('灰色 (128)', 500, 230);

    const imageUrl = canvas.toDataURL();
    setTestImageUrl(imageUrl);
  }, []);

  // 处理鼠标移动事件
  const handleMouseMove = useCallback((e: React.MouseEvent, grayscaleValue: number, x: number, y: number) => {
    setCurrentGrayscale(grayscaleValue);
    setMousePosition({ x, y });
  }, []);

  // 处理鼠标离开事件
  const handleMouseLeave = useCallback(() => {
    setCurrentGrayscale(null);
    setMousePosition(null);
  }, []);

  // 创建测试视频URL
  const createTestVideoUrl = useCallback(() => {
    if (!testImageUrl) return;

    // 模拟视频对象
    const testVideo = {
      videoUrl: testImageUrl,
      frameCount: 1,
      duration: 1,
      width: 800,
      height: 600,
      fps: 30
    };

    return testVideo;
  }, [testImageUrl]);

  React.useEffect(() => {
    generateTestImage();
  }, [generateTestImage]);

  const testVideo = createTestVideoUrl();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">灰度值功能测试</h1>

        {/* 控制面板 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">测试控制</h2>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
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
            </div>

            {currentGrayscale !== null && (
              <div className="bg-gray-700 rounded p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>鼠标位置:</strong> ({mousePosition?.x}, {mousePosition?.y})
                  </div>
                  <div>
                    <strong>灰度值:</strong> {currentGrayscale}/255
                  </div>
                  <div>
                    <strong>十六进制:</strong> #{currentGrayscale.toString(16).padStart(2, '0').repeat(3)}
                  </div>
                  <div>
                    <strong>RGB:</strong> rgb({currentGrayscale}, {currentGrayscale}, {currentGrayscale})
                  </div>
                  <div>
                    <strong>建议阈值:</strong> {Math.round(currentGrayscale * 0.8)}
                  </div>
                  <div>
                    <strong>建议范围:</strong> [{Math.max(0, currentGrayscale - 20)}, {Math.min(255, currentGrayscale + 20)}]
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 测试图像显示 */}
        {testVideo && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">测试图像</h2>
            <div className="flex justify-center">
              <div className="border-2 border-gray-600 rounded">
                <VideoPlayer
                  videoUrl={testVideo.videoUrl}
                  currentFrame={0}
                  totalFrames={1}
                  onFrameChange={() => {}}
                  onTimeUpdate={() => {}}
                  frameStep={1}
                  width={800}
                  height={600}
                  className="w-full"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  showGrayscale={showGrayscale}
                />
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-400">
              <p>• 移动鼠标到图像上查看不同位置的灰度值</p>
              <p>• 图像包含灰度渐变、黑白灰方块和圆形</p>
              <p>• 测试不同区域的灰度值变化</p>
            </div>
          </div>
        )}

        {/* 预期结果说明 */}
        <div className="bg-gray-800 rounded-lg p-4 mt-6">
          <h2 className="text-xl font-semibold mb-4">预期测试结果</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">渐变区域</h3>
              <ul className="space-y-1 text-gray-300">
                <li>左侧 (0-255): 灰度值从0递增到255</li>
                <li>中间段: 灰度值约为128</li>
                <li>右侧: 灰度值接近255</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">几何形状</h3>
              <ul className="space-y-1 text-gray-300">
                <li>黑色方块: 灰度值 ≈ 0</li>
                <li>白色方块: 灰度值 ≈ 255</li>
                <li>灰色方块: 灰度值 ≈ 128</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};