import base64
import logging
from io import BytesIO
from typing import Dict, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from skimage.filters import frangi

# 兼容部分环境中 transformers 对 torch.utils._pytree 的新 API 依赖，
# 避免在导入 segmentation_models_pytorch -> timm -> torchvision 时崩溃
try:  # pragma: no cover - 环境相关补丁
    import torch.utils._pytree as _pytree

    # 强制注册不兼容函数的安全包装器
    if hasattr(_pytree, "register_pytree_node"):
        orig_func = _pytree.register_pytree_node

        def _safe_register_pytree_node(*args, **kwargs):
            # 移除不支持的参数
            kwargs.pop("serialized_type_name", None)
            return orig_func(*args, **kwargs)

        _pytree.register_pytree_node = _safe_register_pytree_node

    elif hasattr(_pytree, "_register_pytree_node"):
        orig_func = _pytree._register_pytree_node

        def _safe_register_pytree_node(*args, **kwargs):
            kwargs.pop("serialized_type_name", None)
            return orig_func(*args, **kwargs)

        _pytree.register_pytree_node = _safe_register_pytree_node

except Exception:  # pragma: no cover
    pass

# 设置环境变量以减少transformers相关依赖问题
import os
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

try:
    import segmentation_models_pytorch as smp  # type: ignore[import]
except Exception as exc:  # pragma: no cover
    smp = None  # type: ignore[assignment]
    logging.getLogger(__name__).warning(
        "Failed to import segmentation_models_pytorch, "
        "U-Net vein segmentation will fallback to empty mask: %s",
        exc,
    )

from models import ROIRegion

logger = logging.getLogger(__name__)


def decode_image_from_data_url(data_url: str) -> np.ndarray:
    """
    解码前端传来的 data URL（例如 canvas.toDataURL）为 RGB numpy 数组。
    期望格式: \"data:image/png;base64,AAAA...\"
    """
    if not data_url.startswith("data:"):
        raise ValueError("Invalid image data URL")

    try:
        _, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise ValueError("Malformed image data URL") from exc

    try:
        image_bytes = base64.b64decode(encoded)
        with Image.open(BytesIO(image_bytes)) as img:
            image = img.convert("RGB")
    except Exception as exc:
        logger.exception("Failed to decode image data URL")
        raise ValueError("Failed to decode image data URL") from exc

    return np.array(image)


class SamusVeinSegmentor:
    """
    使用 segmentation_models_pytorch 提供的 U-Net 作为示例分割模型。
    - 仅对当前帧的 ROI 区域做分割，然后将 ROI 内的 mask 贴回整张图。
    - 当前权重为 ImageNet 预训练 encoder + 随机初始化 decoder，仅作示例；
      你可以在自己的超声静脉数据上微调后，加载自定义权重。
    """

    def __init__(self) -> None:
        self._initialized = False
        self.device: torch.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.model: Optional[torch.nn.Module] = None

    def _ensure_initialized(self) -> None:
        """懒加载 U-Net 模型，避免在导入模块时就占用显存。"""
        if self._initialized:
            return

        if smp is None:
            logger.warning(
                "segmentation_models_pytorch is not available, "
                "will fallback to empty mask."
            )
            self._initialized = True
            return

        logger.info("Initializing U-Net vein segmentation model (SMP)...")
        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights="imagenet",
            in_channels=3,
            classes=1,
            activation=None,
        )

        self.model.to(self.device)
        self.model.eval()

        # 如有自定义权重，可在此加载：
        # state_dict = torch.load("models/unet_vein_ultrasound.pth", map_location=self.device)
        # self.model.load_state_dict(state_dict)

        self._initialized = True
        logger.info("U-Net model initialized on device: %s", self.device)

    def _prepare_roi_tensor(
        self, image: np.ndarray, roi: ROIRegion
    ) -> Tuple[torch.Tensor, Tuple[int, int, int, int]]:
        """从整帧图像中裁剪 ROI，转换为网络输入张量，并做必要 padding。"""
        if image.ndim == 2:
            height, width = image.shape
            image_rgb = np.stack([image] * 3, axis=-1)
        else:
            height, width = image.shape[:2]
            image_rgb = image

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            raise ValueError("Invalid ROI region")

        roi_img = image_rgb[y1:y2, x1:x2, :]

        tensor = torch.from_numpy(roi_img).float() / 255.0  # type: ignore[arg-type]
        tensor = tensor.permute(2, 0, 1).unsqueeze(0)  # 1,3,H,W

        _, _, h, w = tensor.shape
        pad_h = (32 - h % 32) % 32
        pad_w = (32 - w % 32) % 32
        if pad_h or pad_w:
            tensor = F.pad(tensor, (0, pad_w, 0, pad_h), mode="reflect")

        return tensor.to(self.device), (x1, y1, h, w)

    def segment(
        self,
        image: np.ndarray,
        roi: ROIRegion,
        parameters: Optional[Dict[str, float]] = None,
    ) -> np.ndarray:
        """
        对单帧图像进行静脉血管分割，返回与输入图像同尺寸的 0/1 mask。
        可选参数：
        - threshold: 概率阈值，默认 0.5
        """
        self._ensure_initialized()
        if self.model is None:
            if image.ndim == 2:
                height, width = image.shape
            else:
                height, width = image.shape[:2]
            return np.zeros((height, width), dtype=np.uint8)

        if image.ndim == 2:
            height, width = image.shape
        else:
            height, width = image.shape[:2]

        try:
            roi_tensor, (x1, y1, roi_h, roi_w) = self._prepare_roi_tensor(image, roi)
        except ValueError as exc:
            logger.warning("Invalid ROI, fallback to empty mask: %s", exc)
            return np.zeros((height, width), dtype=np.uint8)

        with torch.no_grad():
            pred = self.model(roi_tensor)  # 1,1,H',W'
            pred = torch.sigmoid(pred)

        pred = pred[:, :, :roi_h, :roi_w]
        prob_mask = pred[0, 0].cpu().numpy()

        params = parameters or {}
        threshold = float(params.get("threshold", 0.5))

        roi_mask = (prob_mask > threshold).astype(np.uint8)

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1 : y1 + roi_h, x1 : x1 + roi_w] = roi_mask

        return full_mask


class CVVeinSegmentor:
    """
    使用传统 OpenCV 图像处理完成静脉分割（基础版）。
    参数（parameters）：
    - blur_kernel_size: 高斯模糊核大小（奇数），默认 5
    - clahe_clip_limit: CLAHE 对比度限制，默认 2.0
    - clahe_tile_grid_size: CLAHE 网格大小，默认 8
    - morph_kernel_size: 形态学核大小（奇数），默认 3
    - morph_close_iterations: 闭运算迭代次数，默认 2
    - morph_open_iterations: 开运算迭代次数，默认 1
    """

    def segment(
        self, image: np.ndarray, roi: ROIRegion, parameters: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        logger.info(
            "EnhancedCVVeinSegmentor.segment roi=(x=%s,y=%s,w=%s,h=%s), params=%s",
            getattr(roi, "x", None),
            getattr(roi, "y", None),
            getattr(roi, "width", None),
            getattr(roi, "height", None),
            parameters,
        )
        if image.ndim == 2:
            height, width = image.shape
            gray = image
        else:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            logger.warning("Invalid ROI for CV segmentation, return empty mask")
            return np.zeros((height, width), dtype=np.uint8)

        roi_img = gray[y1:y2, x1:x2]

        params = parameters or {}
        blur_ksize = int(params.get("blur_kernel_size", 3))
        if blur_ksize % 2 == 0:
            blur_ksize += 1
        clahe_clip = float(params.get("clahe_clip_limit", 2.0))
        clahe_tile = int(params.get("clahe_tile_grid_size", 8))
        morph_ksize = int(params.get("morph_kernel_size", 3))
        if morph_ksize % 2 == 0:
            morph_ksize += 1
        close_iter = int(params.get("morph_close_iterations", 2))
        open_iter = int(params.get("morph_open_iterations", 1))

        blurred = cv2.GaussianBlur(roi_img, (blur_ksize, blur_ksize), 0)
        clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(clahe_tile, clahe_tile))
        enhanced = clahe.apply(blurred)

        _, thresh = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_ksize, morph_ksize))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=close_iter)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=open_iter)

        roi_mask = (opened > 0).astype(np.uint8)

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1:y2, x1:x2] = roi_mask

        return full_mask


class EnhancedCVVeinSegmentor:
    """
    增强版传统 CV 静脉分割：
    - 使用 Frangi 血管滤波器增强管状/静脉样结构；
    - 结合暗区域（Otsu 阈值）检测静脉低回声区域；
    - 通过形态学操作和面积/形状/位置约束筛选静脉候选；
    - 输出与整张图像同尺寸的 0/1 mask。

    参数（parameters）：
    - frangi_scale_min / frangi_scale_max / frangi_scale_step
    - frangi_threshold: Frangi 概率阈值，默认 0.1
    - area_min / area_max: 轮廓面积过滤
    - aspect_ratio_min / aspect_ratio_max: 宽高比过滤
    - center_band_top / center_band_bottom: 垂直方向中心带（相对 ROI 高度）
    - morph_kernel_size / morph_close_iterations / morph_open_iterations
    """

    def segment(
        self, image: np.ndarray, roi: ROIRegion, parameters: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        if image.ndim == 2:
            height, width = image.shape
            gray = image
        else:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            logger.warning(
                "Invalid ROI for enhanced CV segmentation, image_size=(%s,%s), x1=%s,x2=%s,y1=%s,y2=%s",
                width,
                height,
                x1,
                x2,
                y1,
                y2,
            )
            return np.zeros((height, width), dtype=np.uint8)

        roi_img = gray[y1:y2, x1:x2]

        params = parameters or {}
        blur_ksize = int(params.get("blur_kernel_size", 3))
        if blur_ksize % 2 == 0:
            blur_ksize += 1
        clahe_clip = float(params.get("clahe_clip_limit", 2.0))
        clahe_tile = int(params.get("clahe_tile_grid_size", 8))

        frangi_scale_min = float(params.get("frangi_scale_min", 1.5))
        frangi_scale_max = float(params.get("frangi_scale_max", 5.0))
        frangi_scale_step = float(params.get("frangi_scale_step", 0.5))
        frangi_threshold = float(params.get("frangi_threshold", 0.04))

        area_min = float(params.get("area_min", 300.0))
        area_max = float(params.get("area_max", 3500.0))
        aspect_ratio_min = float(params.get("aspect_ratio_min", 0.6))
        aspect_ratio_max = float(params.get("aspect_ratio_max", 1.6))
        center_band_top = float(params.get("center_band_top", 0.4))
        center_band_bottom = float(params.get("center_band_bottom", 0.8))

        morph_ksize = int(params.get("morph_kernel_size", 5))
        if morph_ksize % 2 == 0:
            morph_ksize += 1
        close_iter = int(params.get("morph_close_iterations", 2))
        open_iter = int(params.get("morph_open_iterations", 1))

        blurred = cv2.GaussianBlur(roi_img, (blur_ksize, blur_ksize), 0)
        clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(clahe_tile, clahe_tile))
        enhanced = clahe.apply(blurred)

        enhanced_norm = enhanced.astype(np.float32) / 255.0
        try:
            vessel_prob = frangi(
                enhanced_norm,
                scale_range=(frangi_scale_min, frangi_scale_max),
                scale_step=frangi_scale_step,
                black_ridges=True,
            )
        except Exception as exc:  # pragma: no cover - 防御性回退
            logger.warning("Frangi filter failed, fallback to zeros: %s", exc)
            vessel_prob = np.zeros_like(enhanced_norm, dtype=np.float32)

        _, dark_mask = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        vessel_mask = vessel_prob > frangi_threshold
        combined_mask = np.logical_and(vessel_mask, dark_mask > 0)
        vessel_binary = combined_mask.astype(np.uint8) * 255

        logger.info(
            "Enhanced CV intermediate: roi_size=(%s,%s), frangi_threshold=%s, "
            "dark_pixels=%s, vessel_pixels=%s, combined_pixels=%s",
            roi_img.shape[1],
            roi_img.shape[0],
            frangi_threshold,
            int((dark_mask > 0).sum()),
            int(vessel_mask.sum()),
            int(combined_mask.sum()),
        )

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_ksize, morph_ksize))
        closed = cv2.morphologyEx(vessel_binary, cv2.MORPH_CLOSE, kernel, iterations=close_iter)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=open_iter)

        contours, _ = cv2.findContours(
            opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        logger.info("Enhanced CV found %s raw contours", len(contours))

        roi_h = y2 - y1
        mask_roi = np.zeros_like(roi_img, dtype=np.uint8)
        kept_contours = 0

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < area_min or area > area_max:
                logger.debug(
                    "Contour filtered by area: %s (allowed [%s,%s])",
                    area,
                    area_min,
                    area_max,
                )
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            if h == 0:
                continue
            aspect_ratio = float(w) / h

            if not (aspect_ratio_min < aspect_ratio < aspect_ratio_max):
                logger.debug(
                    "Contour filtered by aspect_ratio: %s (allowed (%s,%s))",
                    aspect_ratio,
                    aspect_ratio_min,
                    aspect_ratio_max,
                )
                continue

            center_y = y + h / 2.0
            if not (center_band_top * roi_h < center_y < center_band_bottom * roi_h):
                logger.debug(
                    "Contour filtered by center_band: center_y=%s, band=(%s,%s) of roi_h=%s",
                    center_y,
                    center_band_top,
                    center_band_bottom,
                    roi_h,
                )
                continue

            cv2.drawContours(mask_roi, [cnt], -1, 1, thickness=-1)
            kept_contours += 1

        logger.info(
            "Enhanced CV kept %s contours after filtering, mask_roi_pixels=%s",
            kept_contours,
            int(mask_roi.sum()),
        )

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1:y2, x1:x2] = mask_roi

        return full_mask


class SimpleCenterCVVeinSegmentor:
    """
    ��򵥵��� OpenCV �Խ� ROI ���м��͵�"�����ڡ�"�ָ
    - �ڲ�ʹ�� Gaussian �Գ� + CLAHE ��ǿ
    - ͨ��ģ�ת + Otsu ��ֵ��ȡ�� ROI �ڵķ��������
    - �� morphology �޳���С�����߲����
    - �� contours �У�ѡ�����ĵĵ�λ�� ROI �м䣬���������Ϻ�״�������ĵ���
    """

    def segment(
        self,
        image: np.ndarray,
        roi: ROIRegion,
        parameters: Optional[Dict[str, float]] = None,
    ) -> np.ndarray:
        if image.ndim == 2:
            height, width = image.shape
            gray = image
        else:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            logger.warning(
                "Invalid ROI for SimpleCenterCVVeinSegmentor, image_size=(%s,%s), x1=%s,x2=%s,y1=%s,y2=%s",
                width,
                height,
                x1,
                x2,
                y1,
                y2,
            )
            return np.zeros((height, width), dtype=np.uint8)

        roi_img = gray[y1:y2, x1:x2]
        roi_h, roi_w = roi_img.shape[:2]
        roi_area = float(roi_w * roi_h)

        params = parameters or {}

        blur_ksize = int(params.get("blur_kernel_size", 5))
        if blur_ksize % 2 == 0:
            blur_ksize += 1
        clahe_clip = float(params.get("clahe_clip_limit", 2.0))
        clahe_tile = int(params.get("clahe_tile_grid_size", 8))

        morph_ksize = int(params.get("morph_kernel_size", 5))
        if morph_ksize % 2 == 0:
            morph_ksize += 1
        close_iter = int(params.get("morph_close_iterations", 2))
        open_iter = int(params.get("morph_open_iterations", 1))

        # ������ز���Ĳ���Ϊ ROI ���ֵı���
        area_min_factor = float(params.get("area_min_factor", 0.01))
        area_max_factor = float(params.get("area_max_factor", 0.4))
        circularity_min = float(params.get("circularity_min", 0.4))

        area_min = area_min_factor * roi_area
        area_max = area_max_factor * roi_area

        logger.info(
            "SimpleCenterCVVeinSegmentor.segment roi_size=(%s,%s), area_range=[%s,%s]",
            roi_w,
            roi_h,
            area_min,
            area_max,
        )

        # Ԥ����
        blurred = cv2.GaussianBlur(roi_img, (blur_ksize, blur_ksize), 0)
        clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(clahe_tile, clahe_tile))
        enhanced = clahe.apply(blurred)

        # ��ת��ʹ���ڿ�ͨ��Ϊ��������
        inv = cv2.bitwise_not(enhanced)

        # Otsu ��ֵ
        _, bw = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # ��̬ѧ�޳�����
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_ksize, morph_ksize))
        closed = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=close_iter)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=open_iter)

        contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        logger.info("SimpleCenterCVVeinSegmentor found %s raw contours", len(contours))

        if not contours:
            full_empty = np.zeros((height, width), dtype=np.uint8)
            return full_empty

        roi_cx = roi_w / 2.0
        roi_cy = roi_h / 2.0
        diag2 = roi_w * roi_w + roi_h * roi_h

        best_score = -1.0
        best_cnt = None
        best_center_score = -1.0
        best_center_cnt = None

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area <= 0:
                continue

            if area < area_min or area > area_max:
                logger.debug("SimpleCenterCV: contour filtered by area=%s", area)
                continue

            perimeter = cv2.arcLength(cnt, True)
            if perimeter <= 0:
                continue
            circularity = 4.0 * np.pi * area / (perimeter * perimeter)

            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]

            dist2 = (cx - roi_cx) ** 2 + (cy - roi_cy) ** 2
            norm_dist = dist2 / diag2 if diag2 > 0 else 0.0

            # �ں����У��Բ��Ե;���Ŀ��ȼ�
            score = circularity + (1.0 - norm_dist)

            logger.debug(
                "SimpleCenterCV: contour area=%s, circularity=%s, center=(%s,%s), norm_dist=%s, score=%s",
                area,
                circularity,
                cx,
                cy,
                norm_dist,
                score,
            )

            if circularity >= circularity_min and score > best_score:
                best_score = score
                best_cnt = cnt

            center_score = 1.0 - norm_dist
            if center_score > best_center_score:
                best_center_score = center_score
                best_center_cnt = cnt

        mask_roi = np.zeros_like(roi_img, dtype=np.uint8)
        target_cnt = best_cnt if best_cnt is not None else best_center_cnt
        # 如果所有轮廓都被严格条件过滤掉，则退而求其次选一个最大的轮廓
        if False and target_cnt is None and len(contours) > 0:
            target_cnt = max(contours, key=cv2.contourArea)
            logger.info(
                "SimpleCenterCVVeinSegmentor fallback selected largest contour, area=%s",
                cv2.contourArea(target_cnt),
            )

        if target_cnt is not None:
            cv2.drawContours(mask_roi, [target_cnt], -1, 1, thickness=-1)
            logger.info(
                "SimpleCenterCVVeinSegmentor selected contour, mask_pixels=%s",
                int(mask_roi.sum()),
            )
        else:
            logger.info("SimpleCenterCVVeinSegmentor did not select any contour")

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1:y2, x1:x2] = mask_roi

        return full_mask


class EllipticalMorphSegmentor:
    """
    椭圆形形态学阈值分割算法：
    - 支持双阈值选择（可调阈值区间）
    - 使用椭圆形结构元素进行形态学操作
    - 提供形态学严格程度统一控制
    - 支持最大连通区域检测功能
    - 支持ROI中心点连通域保留功能
    - 支持选中点连通域保留功能
    - 适用于需要精确形状控制的分割任务

    参数（parameters）：
    - threshold_min: 阈值下限
    - threshold_max: 阈值上限
    - ellipse_major_axis: 椭圆长轴长度
    - ellipse_minor_axis: 椭圆短轴长度
    - ellipse_angle: 椭圆旋转角度（度）
    - morph_strength: 形态学严格程度 (0.0-1.0)
    - blur_kernel_size: 预处理模糊核大小
    - clahe_clip_limit: CLAHE对比度限制
    - clahe_tile_grid_size: CLAHE网格大小
    - elliptical_constraint_enabled: 是否启用椭圆约束 (0/1)
    - max_connected_component_enabled: 是否启用最大连通区域检测 (0/1)
    - roi_center_connected_component_enabled: 是否启用ROI中心点连通域保留 (0/1)
    - selected_point_connected_component_enabled: 是否启用选中点连通域保留 (0/1)
    - selected_point_x: 选中点的X坐标（相对于ROI左上角）
    - selected_point_y: 选中点的Y坐标（相对于ROI左上角）
    - preprocessing_enabled: 是否启用预处理（高斯模糊+CLAHE）(0/1)
    """

    def segment(
        self,
        image: np.ndarray,
        roi: ROIRegion,
        parameters: Optional[Dict[str, float]] = None,
    ) -> np.ndarray:
        logger.info(
            "EllipticalMorphSegmentor.segment roi=(x=%s,y=%s,w=%s,h=%s), params=%s",
            getattr(roi, "x", None),
            getattr(roi, "y", None),
            getattr(roi, "width", None),
            getattr(roi, "height", None),
            parameters,
        )

        if image.ndim == 2:
            height, width = image.shape
            gray = image
        else:
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            logger.warning("Invalid ROI for elliptical morph segmentation, return empty mask")
            return np.zeros((height, width), dtype=np.uint8)

        roi_img = gray[y1:y2, x1:x2]
        roi_h, roi_w = roi_img.shape[:2]

        # 解析参数
        params = parameters or {}
        threshold_min = int(params.get("threshold_min", 50))
        threshold_max = int(params.get("threshold_max", 150))
        ellipse_major = int(params.get("ellipse_major_axis", 15))
        ellipse_minor = int(params.get("ellipse_minor_axis", 10))
        ellipse_angle = float(params.get("ellipse_angle", 0.0))
        morph_strength = float(params.get("morph_strength", 0.5))

        # 椭圆约束控制参数
        elliptical_constraint_enabled = bool(int(params.get("elliptical_constraint_enabled", 0)))

        # 最大连通区域检测参数
        max_connected_component_enabled = bool(int(params.get("max_connected_component_enabled", 0)))

        # ROI中心点连通域检测参数
        roi_center_connected_component_enabled = bool(int(params.get("roi_center_connected_component_enabled", 0)))

        # 选中点连通域检测参数
        selected_point_connected_component_enabled = bool(int(params.get("selected_point_connected_component_enabled", 0)))
        selected_point_x = int(params.get("selected_point_x", 0))
        selected_point_y = int(params.get("selected_point_y", 0))

        # 预处理控制参数
        preprocessing_enabled = bool(int(params.get("preprocessing_enabled", 1)))  # 默认启用

        # 直接显示原始mask控制参数
        direct_raw_mask_display = bool(int(params.get("direct_raw_mask_display", 0)))  # 默认禁用

        # 预处理参数
        blur_ksize = int(params.get("blur_kernel_size", 5))
        if blur_ksize % 2 == 0:
            blur_ksize += 1
        clahe_clip = float(params.get("clahe_clip_limit", 2.0))
        clahe_tile = int(params.get("clahe_tile_grid_size", 8))

        logger.info(
            "EllipticalMorph parameters: threshold_range=[%s,%s], ellipse=(%s,%s,%s°), morph_strength=%s, constraint_enabled=%s, max_connected_component=%s",
            threshold_min, threshold_max, ellipse_major, ellipse_minor, ellipse_angle, morph_strength, elliptical_constraint_enabled, max_connected_component_enabled
        )
        logger.info(
            "EllipticalMorph point filtering: roi_center_enabled=%s, selected_point_enabled=%s, selected_point=(%s,%s)",
            roi_center_connected_component_enabled, selected_point_connected_component_enabled, selected_point_x, selected_point_y
        )
        logger.info(
            "EllipticalMorph display options: preprocessing_enabled=%s, direct_raw_mask_display=%s",
            preprocessing_enabled, direct_raw_mask_display
        )

        try:
            # 检查是否所有过滤选项都禁用
            all_filters_disabled = (
                not max_connected_component_enabled and
                not roi_center_connected_component_enabled and
                not selected_point_connected_component_enabled
            )

            # 标志变量，跟踪是否已经设置了processed变量
            processed_set = False

            if max_connected_component_enabled:
                # 最大连通区域模式：直接使用原始图像，避免预处理导致的区域连接
                logger.info(f"EllipticalMorph: Direct thresholding for max connected component (connectivity=4)")

                # 直接对原始图像进行阈值分割
                mask = np.zeros_like(roi_img, dtype=np.uint8)
                mask[(roi_img >= threshold_min) & (roi_img <= threshold_max)] = 255

                # 调试：显示阈值分割结果
                threshold_pixels = (mask > 0).sum()
                logger.info(f"Threshold分割结果：{threshold_pixels}像素在阈值范围内")

                # 注意：不再在此处提前返回，即使启用direct_raw_mask_display也要继续进行连通域分析
                # direct_raw_mask_display将在最后阶段处理，决定是否跳过形态学操作

                # 根据direct_raw_mask_display参数决定是否进行形态学操作
                if not direct_raw_mask_display:
                    # 轻微的形态学操作确保区域分离
                    kernel_small = np.ones((2, 2), np.uint8)
                    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_small, iterations=1)

                    # 调试：显示形态学操作后的结果
                    morph_pixels = (mask > 0).sum()
                    logger.info(f"形态学操作后：{morph_pixels}像素（减少了{threshold_pixels - morph_pixels}像素）")
                else:
                    logger.info(f"直接显示原始mask模式：跳过形态学操作，保持{threshold_pixels}原始阈值像素")

                processed = mask.copy()
                processed_set = True
            else:
                # 常规模式：根据过滤选项和预处理参数决定处理流程
                if all_filters_disabled and not preprocessing_enabled:
                    # 纯阈值分割模式：所有过滤选项和预处理都禁用
                    mask = np.zeros_like(roi_img, dtype=np.uint8)
                    mask[(roi_img >= threshold_min) & (roi_img <= threshold_max)] = 255

                    # 直接返回纯阈值分割结果，不进行任何后处理
                    threshold_pixels = (mask > 0).sum()
                    logger.info(f"EllipticalMorph: Pure threshold segmentation - {threshold_pixels} pixels in range [{threshold_min}, {threshold_max}]")

                    # 注意：不再在此处提前返回，即使启用direct_raw_mask_display也要继续进行连通域分析
                    # 直接返回结果，继续进行连通域分析（如果启用了的话）
                    logger.info(f"纯阈值分割模式：{threshold_pixels}像素，继续进行连通域分析（如果启用）")

                    # 设置processed为mask，准备进行连通域分析
                    processed = mask.copy()
                    processed_set = True

                    # 跳过其他处理路径，直接进入连通域分析阶段
                    # 但需要确保后续的连通域分析能够正确执行

                elif preprocessing_enabled:
                    # 第一步：预处理
                    blurred = cv2.GaussianBlur(roi_img, (blur_ksize, blur_ksize), 0)
                    clahe = cv2.createCLAHE(clipLimit=clahe_clip, tileGridSize=(clahe_tile, clahe_tile))
                    enhanced = clahe.apply(blurred)

                    # 第二步：双阈值分割（对预处理后的图像）
                    mask = np.zeros_like(roi_img, dtype=np.uint8)
                    mask[(enhanced >= threshold_min) & (enhanced <= threshold_max)] = 255

                    logger.info("EllipticalMorph: Using preprocessing flow (GaussianBlur + CLAHE)")
                    logger.info(f"  预处理参数: blur_kernel_size={blur_ksize}, clahe_clip_limit={clahe_clip}, clahe_tile_size={clahe_tile}")
                else:
                    # 直接对原始图像进行阈值分割（不预处理，但需要后续连通域分析）
                    mask = np.zeros_like(roi_img, dtype=np.uint8)
                    mask[(roi_img >= threshold_min) & (roi_img <= threshold_max)] = 255

                    logger.info("EllipticalMorph: Direct thresholding without preprocessing")
                    logger.info(f"  阈值范围: [{threshold_min}, {threshold_max}]")

                # 注意：不再在此处提前返回，即使启用direct_raw_mask_display也要继续进行连通域分析
                # 根据direct_raw_mask_display参数决定是否进行形态学操作
                if not direct_raw_mask_display:
                    # 第三步：纯阈值分割后的形态学操作
                    # 可以在这里添加轻微的形态学操作，但在组合模式下可能需要跳过
                    processed = mask.copy()
                    processed_set = True
                else:
                    logger.info(f"直接显示原始mask模式：跳过形态学操作，保持原始阈值结果")
                    processed = mask.copy()
                    processed_set = True

            # 第四步：连通域分析和筛选
            if processed_set and (max_connected_component_enabled or roi_center_connected_component_enabled or selected_point_connected_component_enabled):
                # 连通域检测模式：使用连通组件分析
                if (processed > 0).sum() > 0:
                    # 使用连通组件分析（4连通：只有上下左右相连）
                    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
                        processed, connectivity=4, ltype=cv2.CV_32S
                    )

                    logger.info(f"连通组件分析结果：发现{num_labels}个标签（包括背景），{num_labels-1}个连通区域")

                    # 显示所有连通区域的面积信息
                    for i in range(1, num_labels):
                        area = stats[i, cv2.CC_STAT_AREA]
                        centroid = centroids[i]
                        logger.info(f"连通区域 {i}: 面积={area}像素, ROI内中心=({centroid[0]:.1f}, {centroid[1]:.1f})")
                        # 转换为图像绝对坐标
                        image_x = x1 + centroid[0]  # ROI左上角x + ROI内x坐标
                        image_y = y1 + centroid[1]  # ROI左上角y + ROI内y坐标
                        logger.info(f"连通区域 {i}: 图像绝对坐标=({image_x:.1f}, {image_y:.1f})")

                    # 初始化最终掩码
                    final_mask = np.zeros_like(processed)
                    kept_components = []

                    if max_connected_component_enabled:
                        # 最大连通区域模式
                        if num_labels > 1:
                            max_area_idx = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
                            max_area = stats[max_area_idx, cv2.CC_STAT_AREA]
                            final_mask[labels == max_area_idx] = 255
                            kept_components.append(f"max_area_{max_area_idx}")
                            logger.info(f"保留最大连通区域 {max_area_idx}，面积={max_area}")

                    elif roi_center_connected_component_enabled:
                        # ROI中心点连通域模式
                        roi_center_x = roi_w // 2
                        roi_center_y = roi_h // 2
                        logger.info(f"ROI中心点坐标: ({roi_center_x}, {roi_center_y})")

                        # 查找包含ROI中心点的连通区域
                        center_label = labels[roi_center_y, roi_center_x] if 0 <= roi_center_y < roi_h and 0 <= roi_center_x < roi_w else 0

                        if center_label > 0:
                            final_mask[labels == center_label] = 255
                            kept_components.append(f"roi_center_{center_label}")
                            area = stats[center_label, cv2.CC_STAT_AREA]
                            logger.info(f"保留ROI中心连通区域 {center_label}，面积={area}")
                        else:
                            logger.warning("ROI中心点不在任何连通区域内，保留所有连通区域")
                            final_mask = processed.copy()
                            kept_components.append("all_regions")

                    elif selected_point_connected_component_enabled:
                        # 选中点连通域模式
                        logger.info(f"选中点坐标: ({selected_point_x}, {selected_point_y})")

                        # 检查选中点是否在ROI范围内
                        if 0 <= selected_point_x < roi_w and 0 <= selected_point_y < roi_h:
                            # 查找包含选中点的连通区域
                            selected_label = labels[selected_point_y, selected_point_x]

                            if selected_label > 0:
                                final_mask[labels == selected_label] = 255
                                kept_components.append(f"selected_point_{selected_label}")
                                area = stats[selected_label, cv2.CC_STAT_AREA]
                                logger.info(f"保留选中点连通区域 {selected_label}，面积={area}")
                            else:
                                logger.warning("选中点不在任何连通区域内，保留所有连通区域")
                                final_mask = processed.copy()
                                kept_components.append("all_regions")
                        else:
                            logger.warning(f"选中点 ({selected_point_x}, {selected_point_y}) 超出ROI范围 ({roi_w}x{roi_h})，保留所有连通区域")
                            final_mask = processed.copy()
                            kept_components.append("all_regions")

                    mask_roi = final_mask
                    kept_contours = len(kept_components)

                    logger.info(
                        "EllipticalMorph connected component filtering: kept %s components (%s), total pixels=%s",
                        kept_contours,
                        ", ".join(kept_components),
                        int((mask_roi > 0).sum())
                    )
                else:
                    logger.warning("EllipticalMorph connected component: no white pixels in processed mask")
                    mask_roi = processed.copy()
                    kept_contours = "empty"
            else:
                # 没有进行连通域分析，直接使用processed（如果存在）或mask
                if processed_set:
                    mask_roi = processed.copy()
                    kept_contours = (mask_roi > 0).sum()
                    logger.info(f"EllipticalMorph: No connected component filtering, using processed mask with {kept_contours} pixels")
                else:
                    # 如果没有processed变量，创建阈值分割的mask
                    mask_roi = np.zeros_like(roi_img, dtype=np.uint8)
                    mask_roi[(roi_img >= threshold_min) & (roi_img <= threshold_max)] = 255
                    kept_contours = (mask_roi > 0).sum()
                    logger.info(f"EllipticalMorph: No processed mask available, created threshold mask with {kept_contours} pixels")

            if not isinstance(kept_contours, (int, float)):
                # 如果kept_contours是字符串（如"empty"），计算实际像素数
                kept_contours = (mask_roi > 0).sum()

            logger.info(
                "EllipticalMorph kept %s pixels after processing, direct_raw_mask_display=%s",
                int(kept_contours),
                direct_raw_mask_display,
            )

            # 转换为二进制掩码
            binary_mask = (mask_roi > 0).astype(np.uint8)

            full_mask = np.zeros((height, width), dtype=np.uint8)
            full_mask[y1:y2, x1:x2] = binary_mask

            return full_mask

        except Exception as exc:
            logger.error(f"EllipticalMorph segmentation failed: {exc}")
            # 返回空掩码作为fallback
            return np.zeros((height, width), dtype=np.uint8)

    def _create_rotated_ellipse_kernel(self, major_axis: int, minor_axis: int, angle: float) -> np.ndarray:
        """创建旋转的椭圆形结构元素"""
        # 创建基础椭圆
        kernel = np.zeros((major_axis * 2, major_axis * 2), dtype=np.uint8)
        center = (major_axis, major_axis)

        # 绘制椭圆
        cv2.ellipse(
            kernel, center, (minor_axis, major_axis), angle, 0, 360, 255, -1
        )

        return kernel

    def _calculate_ellipticity(self, contour: np.ndarray) -> float:
        """计算轮廓的椭圆性（0-1，1表示完美椭圆）"""
        if len(contour) < 5:
            return 0.0

        try:
            # 拟合椭圆
            ellipse = cv2.fitEllipse(contour)
            (x, y), (major_axis, minor_axis), angle = ellipse

            if minor_axis == 0:
                return 0.0

            # 计算椭圆性（短轴/长轴的比例）
            ellipticity = min(major_axis, minor_axis) / max(major_axis, minor_axis)

            return ellipticity
        except Exception:
            return 0.0
