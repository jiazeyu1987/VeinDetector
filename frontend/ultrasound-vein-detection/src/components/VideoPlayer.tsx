import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ConnectedComponentCenter } from '../types/algorithm';
import { ROI } from '../api/types';

interface VideoPlayerProps {
  videoUrl?: string;
  currentFrame: number;
  totalFrames: number;
  onFrameChange: (frame: number) => void;
  onTimeUpdate?: (time: number) => void;
  frameStep?: number;
  width?: number;
  height?: number;
  className?: string;
  onCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>, grayscaleValue: number, x: number, y: number) => void;
  onMouseLeave?: () => void;
  showGrayscale?: boolean;
  connectedComponentCenter?: ConnectedComponentCenter | null; // 新增：连通域中心点
  currentROI?: ROI | null; // 新增：当前ROI信息
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  currentFrame,
  totalFrames,
  onFrameChange,
  onTimeUpdate,
  frameStep = 1,
  width = 800,
  height = 600,
  className = '',
  onCanvasRef,
  onMouseMove,
  onMouseLeave,
  showGrayscale = false,
  connectedComponentCenter, // 新增
  currentROI, // 新增
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number; grayscale: number } | null>(null);

  const handleSeekToFrame = useCallback(
    (frame: number) => {
      const clamped = Math.min(Math.max(frame, 0), Math.max(totalFrames - 1, 0));
      if (videoRef.current) {
        const time = (clamped * frameStep) / 30;
        videoRef.current.currentTime = time;
        onTimeUpdate?.(time);
      }
      onFrameChange(clamped);
    },
    [frameStep, totalFrames, onFrameChange, onTimeUpdate],
  );

  const handlePreviousFrame = useCallback(() => {
    handleSeekToFrame(currentFrame - 1);
  }, [currentFrame, handleSeekToFrame]);

  const handleNextFrame = useCallback(() => {
    handleSeekToFrame(currentFrame + 1);
  }, [currentFrame, handleSeekToFrame]);

  // 获取鼠标位置的灰度值
  const getGrayscaleValue = useCallback((canvas: HTMLCanvasElement, x: number, y: number): number => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const canvasX = Math.floor((x - rect.left) * scaleX);
    const canvasY = Math.floor((y - rect.top) * scaleY);

    // 边界检查
    if (canvasX < 0 || canvasX >= canvas.width || canvasY < 0 || canvasY >= canvas.height) {
      return 0;
    }

    try {
      const imageData = ctx.getImageData(canvasX, canvasY, 1, 1);
      const data = imageData.data;
      // 使用标准灰度转换公式: 0.299*R + 0.587*G + 0.114*B
      const grayscale = Math.round(0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2]);
      return grayscale;
    } catch (error) {
      return 0;
    }
  }, []);

  // 处理鼠标移动事件
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const grayscaleValue = getGrayscaleValue(canvasRef.current, e.clientX, e.clientY);
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    setMousePosition({ x, y, grayscale: grayscaleValue });

    if (onMouseMove) {
      onMouseMove(e, grayscaleValue, x, y);
    }
  }, [getGrayscaleValue, onMouseMove]);

  // 处理鼠标离开事件
  const handleCanvasMouseLeave = useCallback(() => {
    if (onMouseLeave) {
      onMouseLeave();
    }
  }, [onMouseLeave]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousFrame();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextFrame();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePreviousFrame, handleNextFrame]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (videoUrl) {
        video.load();
      } else {
        video.pause();
      }
      setVideoDuration(0);
      setIsLoading(Boolean(videoUrl));
    }
  }, [videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      const targetTime = (currentFrame * frameStep) / 30;
      const currentTime = videoRef.current.currentTime;
      if (Math.abs(currentTime - targetTime) > 0.1) {
        videoRef.current.currentTime = targetTime;
        onTimeUpdate?.(targetTime);
      }
    }
  }, [currentFrame, frameStep, onTimeUpdate]);

  useEffect(() => {
    let animationFrameId: number;
    const drawFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);

          if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = width / height;

            let drawWidth = width;
            let drawHeight = height;

            if (videoAspect > canvasAspect) {
              drawWidth = width;
              drawHeight = width / videoAspect;
            } else {
              drawHeight = height;
              drawWidth = height * videoAspect;
            }

            const offsetX = (width - drawWidth) / 2;
            const offsetY = (height - drawHeight) / 2;

            ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

            // 绘制连通域中心点标记
            if (connectedComponentCenter) {
              // 关键理解：连通域中心点是基于800x600分析画布的坐标
              // 但视频在画布上可能被缩放并居中绘制，需要考虑视频的显示变换
              console.log('🔍 连通域中心点绘制分析（完整修复版）:');
              console.log('='.repeat(60));
              console.log('📊 坐标系统分析:');
              console.log(`  画布尺寸: ${width} x ${height}`);
              console.log(`  视频原始尺寸: ${video.videoWidth} x ${video.videoHeight}`);
              console.log(`  视频显示尺寸: ${drawWidth} x ${drawHeight}`);
              console.log(`  视频偏移: (${offsetX}, ${offsetY})`);

              // 将ROI相对坐标转换为画布绝对坐标（基于800x600分析画布）
              let analysisCanvasX, analysisCanvasY;
              if (currentROI) {
                analysisCanvasX = currentROI.x + connectedComponentCenter.x;
                analysisCanvasY = currentROI.y + connectedComponentCenter.y;
                console.log(`  ROI左上角坐标: (${currentROI.x}, ${currentROI.y})`);
                console.log(`  ROI大小: ${currentROI.width} x ${currentROI.height}`);
                console.log(`  分析画布坐标: ROI相对(${connectedComponentCenter.x}, ${connectedComponentCenter.y}) -> 画布绝对(${analysisCanvasX}, ${analysisCanvasY})`);
              } else {
                analysisCanvasX = connectedComponentCenter.x;
                analysisCanvasY = connectedComponentCenter.y;
                console.log(`  ⚠️ 未提供ROI信息，假设坐标为画布绝对坐标(${analysisCanvasX}, ${analysisCanvasY})`);
              }

              // 现在，需要将分析画布坐标映射到视频显示坐标
              // 假设分析画布就是当前画布(800x600)，所以直接使用分析画布坐标
              const canvasX = analysisCanvasX;
              const canvasY = analysisCanvasY;

              console.log('📐 坐标映射:');
              console.log(`  分析画布坐标 -> 视频显示坐标: (${analysisCanvasX}, ${analysisCanvasY}) -> (${canvasX}, ${canvasY})`);

              // 验证坐标是否在画布范围内
              const isValid = canvasX >= 0 && canvasX <= width && canvasY >= 0 && canvasY <= height;
              console.log('📌 最终验证:');
              console.log(`  画布坐标范围: x=[0, ${width}], y=[0, ${height}]`);
              console.log(`  最终绘制坐标: (${canvasX}, ${canvasY})`);
              console.log(`  坐标是否有效: ${isValid ? '是' : '否'}`);
              console.log('='.repeat(60));

              // 打印绘制信息
              console.log('🎯 准备绘制连通域中心点:', {
                ROI相对坐标: `(${connectedComponentCenter.x}, ${connectedComponentCenter.y})`,
                分析画布坐标: `(${analysisCanvasX}, ${analysisCanvasY})`,
                视频显示坐标: `(${canvasX}, ${canvasY})`,
                面积: connectedComponentCenter.area,
                ROI信息: currentROI ? `(${currentROI.x}, ${currentROI.y}, ${currentROI.width}x${currentROI.height})` : '无',
                坐标有效: isValid
              });

              // 绘制绿色小圆点，半径2px
              ctx.beginPath();
              ctx.arc(canvasX, canvasY, 2, 0, 2 * Math.PI);
              ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'; // 绿色，高对比度
              ctx.fill();
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(drawFrame);
    };
    animationFrameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height, videoUrl, connectedComponentCenter, currentROI]);

  return (
    <div
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          width={width}
          height={height}
          className="w-full h-full object-contain"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setVideoDuration(videoRef.current.duration);
            }
          }}
          onTimeUpdate={e => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          style={{ display: 'none' }}
        />
      ) : null}

      <canvas
        ref={el => {
          canvasRef.current = el;
          if (onCanvasRef) {
            onCanvasRef(el);
          }
        }}
        width={width}
        height={height}
        className="w-full h-full bg-gray-800"
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
          <div className="text-white text-lg">加载中...</div>
        </div>
      )}

      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
        帧 {currentFrame + 1} / {totalFrames}
      </div>

      {videoDuration > 0 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
          {Math.floor(((currentFrame * frameStep) / 30) / 60)}:
          {String(Math.floor(((currentFrame * frameStep) / 30) % 60)).padStart(2, '0')} /
          {Math.floor(videoDuration / 60)}:
          {String(Math.floor(videoDuration % 60)).padStart(2, '0')}
        </div>
      )}

      </div>
  );
};
