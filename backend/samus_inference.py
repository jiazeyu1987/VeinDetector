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

    if not hasattr(_pytree, "register_pytree_node") and hasattr(
        _pytree, "_register_pytree_node"
    ):
        _pytree.register_pytree_node = _pytree._register_pytree_node  # type: ignore[attr-defined]
except Exception:  # pragma: no cover
    pass

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


