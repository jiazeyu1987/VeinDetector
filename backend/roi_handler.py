import numpy as np
import cv2
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import logging
import math
from collections import deque

# 设置日志
logger = logging.getLogger(__name__)

@dataclass
class ROIMovement:
    """ROI移动信息"""
    dx: int = 0  # x方向移动距离
    dy: int = 0  # y方向移动距离
    confidence: float = 0.0  # 移动置信度
    movement_type: str = "none"  # 移动类型: "none", "drift", "jump", "stable"

class ROIHandler:
    """ROI处理器 - 管理感兴趣区域的自动跟踪和平移"""
    
    def __init__(self, initial_width: int = 200, initial_height: int = 200, 
                 movement_threshold: float = 0.1, max_movement_speed: float = 50.0):
        """初始化ROI处理器
        
        Args:
            initial_width: 初始ROI宽度
            initial_height: 初始ROI高度
            movement_threshold: 移动阈值（相对于ROI尺寸的比例）
            max_movement_speed: 最大移动速度（像素/帧）
        """
        self.initial_width = initial_width
        self.initial_height = initial_height
        
        self.movement_threshold = movement_threshold
        self.max_movement_speed = max_movement_speed
        
        # 当前ROI
        self.current_roi = None
        
        # 历史记录用于平滑移动
        self.movement_history = deque(maxlen=5)
        self.position_history = deque(maxlen=10)
        
        # 移动统计
        self.total_movements = 0
        self.stable_frames = 0
        self.drift_frames = 0
        
    def initialize_roi(self, center_x: int, center_y: int, frame_width: int, frame_height: int) -> Tuple[int, int, int, int]:
        """初始化ROI
        
        Args:
            center_x: 中心x坐标
            center_y: 中心y坐标
            frame_width: 帧宽度
            frame_height: 帧高度
            
        Returns:
            Tuple[int, int, int, int]: ROI坐标 (x, y, width, height)
        """
        # 计算ROI边界，确保在帧内
        half_width = self.initial_width // 2
        half_height = self.initial_height // 2
        
        x = max(0, center_x - half_width)
        y = max(0, center_y - half_height)
        width = min(self.initial_width, frame_width - x)
        height = min(self.initial_height, frame_height - y)
        
        self.current_roi = (x, y, width, height)
        
        # 记录初始位置
        self.position_history.append((center_x, center_y))
        
        logger.info(f"ROI已初始化: {self.current_roi}")
        return self.current_roi
    
    def update_roi(self, frame: np.ndarray, vein_centers: List[Tuple[int, int]], 
                   roi_info: Optional[Dict[str, Any]] = None) -> Tuple[int, int, int, int]:
        """更新ROI位置
        
        Args:
            frame: 当前帧
            vein_centers: 静脉中心点列表
            roi_info: ROI信息（可选）
            
        Returns:
            Tuple[int, int, int, int]: 更新后的ROI坐标
        """
        if self.current_roi is None:
            # 如果没有ROI，使用默认中心点初始化
            center_x = frame.shape[1] // 2
            center_y = frame.shape[0] // 2
            return self.initialize_roi(center_x, center_y, frame.shape[1], frame.shape[0])
        
        if not vein_centers:
            # 没有检测到静脉，保持当前ROI
            return self.current_roi
        
        # 计算目标中心点
        target_center = self._calculate_target_center(vein_centers, roi_info)
        
        # 计算移动距离
        current_center = self._get_current_center()
        dx, dy = target_center[0] - current_center[0], target_center[1] - current_center[1]
        
        # 应用移动限制
        limited_dx, limited_dy = self._limit_movement(dx, dy)
        
        # 平滑移动
        smoothed_dx, smoothed_dy = self._smooth_movement(limited_dx, limited_dy)
        
        # 应用移动
        new_roi = self._apply_movement(smoothed_dx, smoothed_dy)
        
        # 记录移动信息
        movement = ROIMovement(
            dx=smoothed_dx,
            dy=smoothed_dy,
            confidence=self._calculate_movement_confidence(vein_centers),
            movement_type=self._classify_movement(smoothed_dx, smoothed_dy)
        )
        
        self.movement_history.append(movement)
        self.position_history.append(target_center)
        
        # 更新统计
        self._update_movement_statistics(movement)
        
        self.current_roi = new_roi
        return new_roi
    
    def _calculate_target_center(self, vein_centers: List[Tuple[int, int]], 
                                roi_info: Optional[Dict[str, Any]] = None) -> Tuple[int, int]:
        """计算目标中心点"""
        if not vein_centers:
            return self._get_current_center()
        
        if len(vein_centers) == 1:
            # 只有一个静脉，直接跟随
            return vein_centers[0]
        
        # 多个静脉，选择最优中心点
        current_center = self._get_current_center()
        
        # 计算每个静脉点到当前中心的距离
        distances = []
        for center in vein_centers:
            dist = math.sqrt((center[0] - current_center[0])**2 + (center[1] - current_center[1])**2)
            distances.append(dist)
        
        # 选择距离适中的静脉（避免跳跃太大）
        min_dist_idx = distances.index(min(distances))
        target_idx = min_dist_idx
        
        # 如果当前ROI内有多个静脉，选择最接近中心的
        if roi_info and 'existing_regions' in roi_info:
            existing_regions = roi_info['existing_regions']
            if existing_regions:
                # 选择与现有静脉区域重叠最大的新静脉
                best_overlap = -1
                for i, center in enumerate(vein_centers):
                    overlap = self._calculate_overlap_with_existing(center, existing_regions)
                    if overlap > best_overlap:
                        best_overlap = overlap
                        target_idx = i
        
        return vein_centers[target_idx]
    
    def _calculate_overlap_with_existing(self, center: Tuple[int, int], 
                                       existing_regions: List[Dict[str, Any]]) -> float:
        """计算与现有区域的重叠度"""
        max_overlap = 0.0
        
        for region in existing_regions:
            region_center = region.get('center', (0, 0))
            distance = math.sqrt((center[0] - region_center[0])**2 + 
                               (center[1] - region_center[1])**2)
            
            # 距离越小，重叠度越高
            overlap = max(0, 1.0 - distance / 100.0)
            max_overlap = max(max_overlap, overlap)
        
        return max_overlap
    
    def _limit_movement(self, dx: int, dy: int) -> Tuple[int, int]:
        """限制移动距离"""
        distance = math.sqrt(dx**2 + dy**2)
        
        if distance > self.max_movement_speed:
            # 按比例缩放
            scale = self.max_movement_speed / distance
            dx = int(dx * scale)
            dy = int(dy * scale)
        
        return dx, dy
    
    def _smooth_movement(self, dx: int, dy: int) -> Tuple[int, int]:
        """平滑移动"""
        if len(self.movement_history) < 2:
            return dx, dy
        
        # 计算移动趋势
        recent_movements = list(self.movement_history)[-3:]
        avg_dx = sum(m.dx for m in recent_movements) / len(recent_movements)
        avg_dy = sum(m.dy for m in recent_movements) / len(recent_movements)
        
        # 目标移动
        target_dx = dx * 0.7 + avg_dx * 0.3
        target_dy = dy * 0.7 + avg_dy * 0.3
        
        return int(target_dx), int(target_dy)
    
    def _apply_movement(self, dx: int, dy: int) -> Tuple[int, int, int, int]:
        """应用移动到当前ROI"""
        if self.current_roi is None:
            return (0, 0, self.initial_width, self.initial_height)
        
        x, y, width, height = self.current_roi
        
        # 应用移动
        new_x = x + dx
        new_y = y + dy
        
        # 确保ROI在图像边界内
        # 这里需要知道图像尺寸，暂时使用相对限制
        # 在实际使用中需要传入图像尺寸参数
        # new_x = max(0, min(new_x, frame_width - width))
        # new_y = max(0, min(new_y, frame_height - height))
        
        return (new_x, new_y, width, height)
    
    def _get_current_center(self) -> Tuple[int, int]:
        """获取当前ROI中心"""
        if self.current_roi is None:
            return (0, 0)
        
        x, y, width, height = self.current_roi
        return (x + width // 2, y + height // 2)
    
    def _calculate_movement_confidence(self, vein_centers: List[Tuple[int, int]]) -> float:
        """计算移动置信度"""
        if not vein_centers:
            return 0.0
        
        # 基于检测到的静脉数量
        count_factor = min(len(vein_centers) / 3.0, 1.0)
        
        # 基于位置一致性
        if len(vein_centers) > 1:
            # 计算中心点之间的方差
            centers_array = np.array(vein_centers)
            variance = np.var(centers_array, axis=0).mean()
            consistency_factor = max(0, 1.0 - variance / 1000.0)
        else:
            consistency_factor = 0.8
        
        # 基于移动历史平滑性
        smoothness_factor = 0.8
        if len(self.movement_history) >= 2:
            recent_movements = list(self.movement_history)[-2:]
            if (abs(recent_movements[-1].dx - recent_movements[0].dx) < 5 and 
                abs(recent_movements[-1].dy - recent_movements[0].dy) < 5):
                smoothness_factor = 1.0
        
        confidence = (count_factor * 0.4 + consistency_factor * 0.4 + smoothness_factor * 0.2)
        return min(confidence, 1.0)
    
    def _classify_movement(self, dx: int, dy: int) -> str:
        """分类移动类型"""
        distance = math.sqrt(dx**2 + dy**2)
        
        if distance < 3:
            return "stable"
        elif distance < 20:
            return "drift"
        else:
            return "jump"
    
    def _update_movement_statistics(self, movement: ROIMovement):
        """更新移动统计"""
        self.total_movements += 1
        
        if movement.movement_type == "stable":
            self.stable_frames += 1
        elif movement.movement_type == "drift":
            self.drift_frames += 1
    
    def get_roi_statistics(self) -> Dict[str, Any]:
        """获取ROI统计信息"""
        return {
            'total_movements': self.total_movements,
            'stable_frames': self.stable_frames,
            'drift_frames': self.drift_frames,
            'stability_rate': self.stable_frames / max(self.total_movements, 1),
            'drift_rate': self.drift_frames / max(self.total_movements, 1),
            'current_position': self._get_current_center(),
            'current_roi': self.current_roi
        }
    
    def reset_roi(self, center_x: int, center_y: int, frame_width: int, frame_height: int):
        """重置ROI"""
        self.current_roi = None
        self.movement_history.clear()
        self.position_history.clear()
        self.total_movements = 0
        self.stable_frames = 0
        self.drift_frames = 0
        
        return self.initialize_roi(center_x, center_y, frame_width, frame_height)
    
    def adjust_roi_size(self, new_width: int, new_height: int):
        """调整ROI大小"""
        if self.current_roi is None:
            return
        
        x, y, _, _ = self.current_roi
        self.initial_width = new_width
        self.initial_height = new_height
        
        # 重新计算ROI大小，保持中心点不变
        self.current_roi = self.initialize_roi(
            x + self.current_roi[2] // 2,
            y + self.current_roi[3] // 2,
            new_width * 2,  # 临时使用较大尺寸
            new_height * 2
        )
        
        logger.info(f"ROI大小已调整为: {self.current_roi}")
    
    def predict_next_position(self, lookahead_frames: int = 3) -> Optional[Tuple[int, int]]:
        """预测下一个位置"""
        if len(self.movement_history) < 2:
            return None
        
        # 基于历史移动趋势预测
        recent_movements = list(self.movement_history)[-min(5, len(self.movement_history)):]
        
        if not recent_movements:
            return None
        
        # 计算平均移动速度
        avg_dx = sum(m.dx for m in recent_movements) / len(recent_movements)
        avg_dy = sum(m.dy for m in recent_movements) / len(recent_movements)
        
        # 预测位置
        current_center = self._get_current_center()
        predicted_x = current_center[0] + avg_dx * lookahead_frames
        predicted_y = current_center[1] + avg_dy * lookahead_frames
        
        return (int(predicted_x), int(predicted_y))
    
    def visualize_roi(self, frame: np.ndarray, output_path: str = None) -> np.ndarray:
        """可视化ROI"""
        if self.current_roi is None:
            return frame
        
        result_frame = frame.copy() if len(frame.shape) == 3 else cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        
        x, y, width, height = self.current_roi
        
        # 绘制ROI边框
        cv2.rectangle(result_frame, (x, y), (x + width, y + height), (255, 0, 0), 2)
        
        # 绘制中心点
        center_x, center_y = self._get_current_center()
        cv2.circle(result_frame, (center_x, center_y), 5, (0, 255, 0), -1)
        
        # 绘制预测位置（如果有）
        predicted_pos = self.predict_next_position()
        if predicted_pos:
            cv2.circle(result_frame, predicted_pos, 8, (0, 255, 255), 2)
        
        # 添加信息文本
        stats = self.get_roi_statistics()
        info_text = f"ROI: {width}x{height} | Center: ({center_x}, {center_y})"
        cv2.putText(result_frame, info_text, (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        if output_path:
            cv2.imwrite(output_path, result_frame)
        
        return result_frame