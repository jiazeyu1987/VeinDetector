import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl?: string;
  currentFrame: number;
  totalFrames: number;
  onFrameChange: (frame: number) => void;
  onTimeUpdate?: (time: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
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
  isPlaying = false,
  onPlayPause,
  width = 800,
  height = 600,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);

  // 更新视频播放时间
  const updateCurrentTime = useCallback(() => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const frame = Math.floor(currentTime * 30); // 假设30fps
      onFrameChange(Math.min(frame, totalFrames - 1));
      onTimeUpdate?.(currentTime);
    }
  }, [totalFrames, onFrameChange, onTimeUpdate]);

  // 播放/暂停
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      onPlayPause?.();
    }
  }, [isPlaying, onPlayPause]);

  // 跳转到指定帧
  const handleSeekToFrame = useCallback((frame: number) => {
    if (videoRef.current) {
      const time = frame / 30; // 假设30fps
      videoRef.current.currentTime = time;
      onFrameChange(frame);
    }
  }, [onFrameChange]);

  // 上一帧
  const handlePreviousFrame = useCallback(() => {
    handleSeekToFrame(Math.max(0, currentFrame - 1));
  }, [currentFrame, handleSeekToFrame]);

  // 下一帧
  const handleNextFrame = useCallback(() => {
    handleSeekToFrame(Math.min(totalFrames - 1, currentFrame + 1));
  }, [currentFrame, totalFrames, handleSeekToFrame]);

  // 音量控制
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  // 进度条拖拽
  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = Math.floor((parseFloat(e.target.value) / 100) * totalFrames);
    handleSeekToFrame(frame);
  }, [totalFrames, handleSeekToFrame]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousFrame();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextFrame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlePlayPause, handlePreviousFrame, handleNextFrame]);

  // 同步视频播放状态
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // 同步到指定帧
  useEffect(() => {
    if (videoRef.current) {
      const targetTime = currentFrame / 30;
      const currentTime = videoRef.current.currentTime;
      
      if (Math.abs(currentTime - targetTime) > 0.1) { // 如果时间差超过0.1秒，则跳转
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [currentFrame]);

  const progressPercentage = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  return (
    <div 
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 视频元素 */}
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
          onTimeUpdate={updateCurrentTime}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          style={{ display: 'none' }}
        />
      ) : null}

      {/* 视频画布 */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full bg-gray-800"
      />

      {/* 加载指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
          <div className="text-white text-lg">加载中...</div>
        </div>
      )}

      {/* 帧信息显示 */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
        帧: {currentFrame + 1} / {totalFrames}
      </div>

      {/* 播放时间显示 */}
      {videoDuration > 0 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
          {Math.floor((currentFrame / 30) / 60)}:
          {String(Math.floor((currentFrame / 30) % 60)).padStart(2, '0')} /
          {Math.floor(videoDuration / 60)}:
          {String(Math.floor(videoDuration % 60)).padStart(2, '0')}
        </div>
      )}

      {/* 控制栏 */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 进度条 */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max="100"
            value={progressPercentage}
            onChange={handleProgressChange}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progressPercentage}%, #4b5563 ${progressPercentage}%, #4b5563 100%)`
            }}
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* 上一帧 */}
            <button
              onClick={handlePreviousFrame}
              disabled={currentFrame === 0}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="上一帧 (←)"
            >
              <SkipBack size={20} className="text-white" />
            </button>

            {/* 播放/暂停 */}
            <button
              onClick={handlePlayPause}
              className="p-3 rounded bg-blue-600 hover:bg-blue-500 transition-colors"
              title={isPlaying ? "暂停 (空格)" : "播放 (空格)"}
            >
              {isPlaying ? (
                <Pause size={24} className="text-white" />
              ) : (
                <Play size={24} className="text-white" />
              )}
            </button>

            {/* 下一帧 */}
            <button
              onClick={handleNextFrame}
              disabled={currentFrame === totalFrames - 1}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="下一帧 (→)"
            >
              <SkipForward size={20} className="text-white" />
            </button>
          </div>

          {/* 音量控制 */}
          <div className="flex items-center space-x-2">
            <Volume2 size={20} className="text-white" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};