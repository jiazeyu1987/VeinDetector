import cv2
import numpy as np
import os
import logging
from typing import List, Tuple, Optional, Generator
from pathlib import Path
import tempfile
import uuid
from datetime import datetime

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VideoProcessor:
    """视频处理器"""
    
    def __init__(self, upload_dir: str = "uploads"):
        """初始化视频处理器
        
        Args:
            upload_dir: 上传目录路径
        """
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(exist_ok=True)
        
        # 支持的视频格式
        self.supported_formats = {'.mp4', '.mov', '.avi', '.mkv'}
        
    def is_supported_format(self, filename: str) -> bool:
        """检查是否为支持的视频格式
        
        Args:
            filename: 文件名
            
        Returns:
            bool: 是否支持
        """
        return Path(filename).suffix.lower() in self.supported_formats
    
    def save_uploaded_video(self, file_content: bytes, filename: str) -> str:
        """保存上传的视频文件
        
        Args:
            file_content: 文件内容
            filename: 文件名
            
        Returns:
            str: 保存的文件路径
            
        Raises:
            ValueError: 不支持的文件格式
        """
        if not self.is_supported_format(filename):
            raise ValueError(f"不支持的视频格式: {Path(filename).suffix}")
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_extension = Path(filename).suffix
        saved_filename = f"{file_id}{file_extension}"
        file_path = self.upload_dir / saved_filename
        
        # 保存文件
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        logger.info(f"视频文件已保存: {file_path}")
        return str(file_path)
    
    def get_video_info(self, video_path: str) -> dict:
        """获取视频信息
        
        Args:
            video_path: 视频文件路径
            
        Returns:
            dict: 视频信息字典
        """
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                raise ValueError(f"无法打开视频文件: {video_path}")
            
            # 获取视频属性
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = frame_count / fps if fps > 0 else 0
            
            cap.release()
            
            info = {
                'fps': fps,
                'frame_count': frame_count,
                'width': width,
                'height': height,
                'duration': duration,
                'resolution': f"{width}x{height}"
            }
            
            logger.info(f"视频信息: {info}")
            return info
            
        except Exception as e:
            logger.error(f"获取视频信息失败: {e}")
            raise
    
    def extract_frames(self, video_path: str, target_fps: float = 8.0) -> Generator[Tuple[int, np.ndarray], None, None]:
        """从视频中提取指定帧率的帧
        
        Args:
            video_path: 视频文件路径
            target_fps: 目标帧率 (默认每秒8帧)
            
        Yields:
            Tuple[int, np.ndarray]: (帧号, 帧图像)
        """
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                raise ValueError(f"无法打开视频文件: {video_path}")
            
            # 获取原始帧率
            original_fps = cap.get(cv2.CAP_PROP_FPS)
            
            # 计算帧间隔
            if original_fps <= 0:
                logger.warning("无法获取视频帧率，使用默认值25")
                original_fps = 25.0
            
            frame_interval = max(1, int(original_fps / target_fps))
            
            logger.info(f"原始帧率: {original_fps}, 目标帧率: {target_fps}, 帧间隔: {frame_interval}")
            
            frame_number = 0
            processed_frames = 0
            
            while True:
                ret, frame = cap.read()
                
                if not ret:
                    break
                
                # 按间隔选择帧
                if frame_number % frame_interval == 0:
                    yield processed_frames, frame
                    processed_frames += 1
                
                frame_number += 1
            
            cap.release()
            logger.info(f"成功提取 {processed_frames} 帧")
            
        except Exception as e:
            logger.error(f"提取帧失败: {e}")
            raise
    
    def get_frame_at_time(self, video_path: str, time_seconds: float) -> Optional[np.ndarray]:
        """获取指定时间的帧
        
        Args:
            video_path: 视频文件路径
            time_seconds: 时间点(秒)
            
        Returns:
            np.ndarray: 帧图像，如果失败返回None
        """
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                return None
            
            # 设置到指定时间点
            cap.set(cv2.CAP_PROP_POS_MSEC, time_seconds * 1000)
            
            ret, frame = cap.read()
            cap.release()
            
            return frame if ret else None
            
        except Exception as e:
            logger.error(f"获取指定时间帧失败: {e}")
            return None
    
    def resize_frame(self, frame: np.ndarray, max_width: int = 1920, max_height: int = 1080) -> np.ndarray:
        """调整帧大小，保持宽高比
        
        Args:
            frame: 输入帧
            max_width: 最大宽度
            max_height: 最大高度
            
        Returns:
            np.ndarray: 调整大小后的帧
        """
        h, w = frame.shape[:2]
        
        # 计算缩放比例
        scale_w = max_width / w
        scale_h = max_height / h
        scale = min(scale_w, scale_h, 1.0)  # 不放大，只缩小
        
        if scale < 1.0:
            new_w = int(w * scale)
            new_h = int(h * scale)
            resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
            return resized
        
        return frame
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """预处理帧
        
        Args:
            frame: 输入帧
            
        Returns:
            np.ndarray: 预处理后的帧
        """
        # 调整大小
        frame = self.resize_frame(frame)
        
        # 转为灰度图
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame.copy()
        
        # 高斯模糊去噪
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # 增强对比度
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(blurred)
        
        return enhanced
    
    def cleanup_temp_files(self, file_path: str, max_age_hours: int = 24):
        """清理临时文件
        
        Args:
            file_path: 文件路径
            max_age_hours: 最大保留时间(小时)
        """
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return
            
            # 检查文件年龄
            file_age = datetime.now().timestamp() - file_path.stat().st_mtime
            
            if file_age > max_age_hours * 3600:
                file_path.unlink()
                logger.info(f"已清理临时文件: {file_path}")
            
        except Exception as e:
            logger.error(f"清理临时文件失败: {e}")
    
    def __del__(self):
        """析构函数，清理资源"""
        try:
            # 清理所有旧文件
            for file_path in self.upload_dir.glob("*"):
                if file_path.is_file():
                    self.cleanup_temp_files(str(file_path))
        except Exception as e:
            logger.error(f"清理资源失败: {e}")