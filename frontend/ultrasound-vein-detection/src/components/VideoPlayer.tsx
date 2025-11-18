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
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

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
          if (video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, width, height);
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
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full bg-gray-800"
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

