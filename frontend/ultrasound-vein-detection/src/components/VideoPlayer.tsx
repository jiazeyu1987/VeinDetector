import React, { useRef, useEffect, useState, useCallback } from 'react';

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
          }
        }
      }
      animationFrameId = requestAnimationFrame(drawFrame);
    };
    animationFrameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height, videoUrl]);

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
