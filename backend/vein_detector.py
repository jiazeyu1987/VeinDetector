import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import logging
from scipy import ndimage
from skimage import measure, morphology
from dataclasses import dataclass
import time

# 设置日志
logger = logging.getLogger(__name__)

@dataclass
class VeinRegion:
    """静脉区域数据结构"""
    center: Tuple[int, int]
    radius: float
    area: float
    perimeter: float
    ellipticity: float
    confidence: float
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)

class VeinDetector:
    """静脉检测器"""
    
    def __init__(self, settings: Optional[Dict[str, Any]] = None):
        """初始化静脉检测器
        
        Args:
            settings: 检测参数设置
        """
        self.settings = settings or self._get_default_settings()
        self.detection_history = []
        
    def _get_default_settings(self) -> Dict[str, Any]:
        """获取默认检测设置"""
        return {
            'canny_threshold_low': 50,
            'canny_threshold_high': 150,
            'hough_dp': 1,
            'hough_min_dist': 50,
            'hough_param1': 50,
            'hough_param2': 30,
            'min_vein_area': 100,
            'max_vein_area': 2000,
            'elliptical_tolerance': 0.3,
            'min_aspect_ratio': 0.3,
            'max_aspect_ratio': 3.0
        }
    
    def update_settings(self, new_settings: Dict[str, Any]):
        """更新检测设置"""
        self.settings.update(new_settings)
        logger.info(f"检测设置已更新: {self.settings}")
    
    def detect_veins_in_frame(self, frame: np.ndarray, roi: Optional[Tuple[int, int, int, int]] = None) -> List[VeinRegion]:
        """在单帧中检测静脉
        
        Args:
            frame: 输入图像
            roi: ROI区域 (x, y, width, height)
            
        Returns:
            List[VeinRegion]: 检测到的静脉区域列表
        """
        start_time = time.time()
        
        try:
            # 如果有ROI，裁剪图像
            if roi:
                x, y, w, h = roi
                frame = frame[y:y+h, x:x+w]
            
            # 预处理
            processed_frame = self._preprocess_frame(frame)
            
            # Canny边缘检测
            edges = self._canny_edge_detection(processed_frame)
            
            # 霍夫圆变换
            circles = self._hough_circle_detection(edges)
            
            # 椭圆拟合
            ellipses = self._ellipse_fitting(processed_frame, edges)
            
            # 连通域分析
            connected_regions = self._connected_component_analysis(processed_frame, edges)
            
            # 合并结果
            vein_regions = self._merge_and_filter_results(circles, ellipses, connected_regions)
            
            # 重新映射ROI坐标
            if roi and vein_regions:
                x_offset, y_offset = roi[0], roi[1]
                for region in vein_regions:
                    # 重新映射中心点
                    new_center = (region.center[0] + x_offset, region.center[1] + y_offset)
                    region.center = new_center
                    
                    # 重新映射边界框
                    bbox = region.bbox
                    new_bbox = (bbox[0] + x_offset, bbox[1] + y_offset, bbox[2], bbox[3])
                    region.bbox = new_bbox
            
            processing_time = time.time() - start_time
            logger.info(f"静脉检测完成: 检测到 {len(vein_regions)} 个静脉区域, 耗时 {processing_time:.3f}s")
            
            return vein_regions
            
        except Exception as e:
            logger.error(f"静脉检测失败: {e}")
            return []
    
    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """预处理帧"""
        # 确保是灰度图
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame.copy()
        
        # 高斯模糊
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # CLAHE对比度增强
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)
        
        return enhanced
    
    def _canny_edge_detection(self, frame: np.ndarray) -> np.ndarray:
        """Canny边缘检测"""
        edges = cv2.Canny(
            frame,
            self.settings['canny_threshold_low'],
            self.settings['canny_threshold_high']
        )
        
        # 形态学操作去除噪声
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        
        return edges
    
    def _hough_circle_detection(self, edges: np.ndarray) -> List[Dict[str, Any]]:
        """霍夫圆变换检测"""
        circles = cv2.HoughCircles(
            edges,
            cv2.HOUGH_GRADIENT,
            dp=self.settings['hough_dp'],
            minDist=self.settings['hough_min_dist'],
            param1=self.settings['hough_param1'],
            param2=self.settings['hough_param2'],
            minRadius=5,
            maxRadius=50
        )
        
        detected_circles = []
        if circles is not None:
            circles = np.round(circles[0, :]).astype("int")
            for (x, y, r) in circles:
                detected_circles.append({
                    'center': (x, y),
                    'radius': r,
                    'type': 'circle',
                    'confidence': 0.8
                })
        
        return detected_circles
    
    def _ellipse_fitting(self, frame: np.ndarray, edges: np.ndarray) -> List[Dict[str, Any]]:
        """椭圆拟合"""
        # 查找轮廓
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detected_ellipses = []
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # 面积过滤
            if area < self.settings['min_vein_area'] or area > self.settings['max_vein_area']:
                continue
            
            # 拟合椭圆
            if len(contour) >= 5:
                try:
                    ellipse = cv2.fitEllipse(contour)
                    (x, y), (MA, ma), angle = ellipse
                    
                    # 计算椭圆度
                    ellipticity = MA / ma if ma > 0 else 0
                    
                    # 椭圆度过滤
                    if ellipticity < (1 - self.settings['elliptical_tolerance']) or ellipticity > (1 + self.settings['elliptical_tolerance']):
                        continue
                    
                    # 计算置信度
                    confidence = self._calculate_ellipse_confidence(contour, ellipse)
                    
                    detected_ellipses.append({
                        'center': (int(x), int(y)),
                        'axes': (MA, ma),
                        'angle': angle,
                        'ellipticity': ellipticity,
                        'type': 'ellipse',
                        'confidence': confidence,
                        'area': area
                    })
                    
                except cv2.error:
                    continue
        
        return detected_ellipses
    
    def _calculate_ellipse_confidence(self, contour: np.ndarray, ellipse: Tuple) -> float:
        """计算椭圆拟合置信度"""
        try:
            (x, y), (MA, ma), angle = ellipse
            
            # 计算轮廓与拟合椭圆的重叠度
            ellipse_area = np.pi * MA * ma
            contour_area = cv2.contourArea(contour)
            
            if ellipse_area == 0:
                return 0.0
            
            # 重叠率
            overlap_ratio = contour_area / ellipse_area
            
            # 置信度计算
            confidence = min(overlap_ratio, 1.0) * 0.9
            
            return confidence
            
        except:
            return 0.5
    
    def _connected_component_analysis(self, frame: np.ndarray, edges: np.ndarray) -> List[Dict[str, Any]]:
        """连通域分析"""
        # 使用标签连通域分析
        labeled = measure.label(edges, background=0)
        regions = measure.regionprops(labeled, intensity_image=frame)
        
        detected_regions = []
        
        for region in regions:
            # 面积过滤
            area = region.area
            if area < self.settings['min_vein_area'] or area > self.settings['max_vein_area']:
                continue
            
            # 形状分析
            if hasattr(region, 'eccentricity'):
                eccentricity = region.eccentricity
                
                # 偏心率过滤（太圆或太扁的都不要）
                if eccentricity > 0.9:
                    continue
            
            # 长宽比分析
            minr, minc, maxr, maxc = region.bbox
            width = maxc - minc
            height = maxr - minr
            
            if width == 0 or height == 0:
                continue
            
            aspect_ratio = max(width, height) / min(width, height)
            
            if aspect_ratio < self.settings['min_aspect_ratio'] or aspect_ratio > self.settings['max_aspect_ratio']:
                continue
            
            # 计算置信度
            confidence = self._calculate_region_confidence(region, frame)
            
            detected_regions.append({
                'center': region.centroid,
                'bbox': region.bbox,
                'area': area,
                'perimeter': region.perimeter,
                'type': 'connected',
                'confidence': confidence,
                'eccentricity': getattr(region, 'eccentricity', 0)
            })
        
        return detected_regions
    
    def _calculate_region_confidence(self, region, frame: np.ndarray) -> float:
        """计算区域置信度"""
        try:
            # 基础置信度
            base_confidence = 0.5
            
            # 面积归一化
            area_normalized = min(region.area / 1000, 1.0)
            
            # 强度对比度
            min_intensity = np.min(region.intensity_image)
            max_intensity = np.max(region.intensity_image)
            contrast = (max_intensity - min_intensity) / 255.0 if max_intensity > min_intensity else 0
            
            # 综合置信度
            confidence = base_confidence + 0.3 * area_normalized + 0.2 * contrast
            
            return min(confidence, 1.0)
            
        except:
            return 0.5
    
    def _merge_and_filter_results(self, circles: List[Dict], ellipses: List[Dict], regions: List[Dict]) -> List[VeinRegion]:
        """合并和过滤检测结果"""
        all_candidates = circles + ellipses + regions
        
        # 去重和合并重叠区域
        filtered_regions = self._remove_overlapping_regions(all_candidates)
        
        # 转换为VeinRegion对象
        vein_regions = []
        for region_dict in filtered_regions:
            vein_region = self._create_vein_region(region_dict)
            if vein_region:
                vein_regions.append(vein_region)
        
        # 按置信度排序
        vein_regions.sort(key=lambda x: x.confidence, reverse=True)
        
        return vein_regions
    
    def _remove_overlapping_regions(self, regions: List[Dict], overlap_threshold: float = 0.3) -> List[Dict]:
        """移除重叠区域"""
        if not regions:
            return []
        
        # 按置信度排序
        sorted_regions = sorted(regions, key=lambda x: x.get('confidence', 0), reverse=True)
        
        filtered_regions = []
        
        for i, region in enumerate(sorted_regions):
            is_overlapping = False
            
            for j, existing_region in enumerate(filtered_regions):
                if self._calculate_overlap_ratio(region, existing_region) > overlap_threshold:
                    is_overlapping = True
                    break
            
            if not is_overlapping:
                filtered_regions.append(region)
        
        return filtered_regions
    
    def _calculate_overlap_ratio(self, region1: Dict, region2: Dict) -> float:
        """计算两个区域的重叠比例"""
        # 简化计算：基于中心点距离
        center1 = region1.get('center', (0, 0))
        center2 = region2.get('center', (0, 0))
        
        distance = np.sqrt((center1[0] - center2[0])**2 + (center1[1] - center2[1])**2)
        
        # 估算半径
        radius1 = region1.get('radius', 10)
        if 'axes' in region1:
            radius1 = max(region1['axes']) / 2
        
        radius2 = region2.get('radius', 10)
        if 'axes' in region2:
            radius2 = max(region2['axes']) / 2
        
        # 重叠比例计算
        min_radius = min(radius1, radius2)
        if distance < min_radius:
            overlap = (min_radius - distance) / min_radius
            return overlap
        
        return 0.0
    
    def _create_vein_region(self, region_dict: Dict) -> Optional[VeinRegion]:
        """创建VeinRegion对象"""
        try:
            center = region_dict.get('center', (0, 0))
            confidence = region_dict.get('confidence', 0.5)
            
            # 估算半径
            radius = region_dict.get('radius', 10)
            if 'axes' in region_dict:
                radius = max(region_dict['axes']) / 2
            
            # 面积
            area = region_dict.get('area', np.pi * radius**2)
            
            # 周长估算
            perimeter = 2 * np.pi * radius
            
            # 椭圆度
            ellipticity = region_dict.get('ellipticity', 1.0)
            
            # 边界框
            bbox = region_dict.get('bbox', (center[0] - radius, center[1] - radius, 2*radius, 2*radius))
            
            return VeinRegion(
                center=center,
                radius=radius,
                area=area,
                perimeter=perimeter,
                ellipticity=ellipticity,
                confidence=confidence,
                bbox=bbox
            )
            
        except Exception as e:
            logger.error(f"创建VeinRegion失败: {e}")
            return None
    
    def visualize_detection(self, frame: np.ndarray, vein_regions: List[VeinRegion], output_path: str = None) -> np.ndarray:
        """可视化检测结果"""
        if len(frame.shape) == 3:
            result_frame = frame.copy()
        else:
            result_frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        
        for i, region in enumerate(vein_regions):
            # 绘制检测区域
            x, y, w, h = region.bbox
            cv2.rectangle(result_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # 绘制中心点
            center_x, center_y = region.center
            cv2.circle(result_frame, (center_x, center_y), 3, (0, 0, 255), -1)
            
            # 添加标签
            label = f"V{i+1}: {region.confidence:.2f}"
            cv2.putText(result_frame, label, (x, y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        if output_path:
            cv2.imwrite(output_path, result_frame)
            logger.info(f"检测结果已保存到: {output_path}")
        
        return result_frame