import base64
import logging
from io import BytesIO
from typing import Tuple

import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F

# 兼容部分环境下 transformers 对 torch.utils._pytree 的新 API 依赖，
# 避免在导入 segmentation_models_pytorch -> timm -> torchvision 时崩溃。
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

    期望格式: "data:image/png;base64,AAAA..."
    """
    if not data_url.startswith("data:"):
        raise ValueError("Invalid image data URL")

    try:
        header, encoded = data_url.split(",", 1)
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

    - 仅对当前帧的 ROI 区域做分割，然后把 ROI 内的 mask 贴回整张图。
    - 当前权重为 ImageNet 预训练 encoder + 随机初始化 decoder，仅作示例；
      你可以在自己的超声静脉数据上微调后，加载自定义权重。
    """

    def __init__(self) -> None:
        self._initialized = False
        self.device: torch.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.model: torch.nn.Module | None = None

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
        # 示例：使用 ResNet34 作为 encoder 的 U-Net
        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights="imagenet",  # encoder 用 ImageNet 预训练权重
            in_channels=3,
            classes=1,
            activation=None,
        )

        self.model.to(self.device)
        self.model.eval()

        # 如果后续你有自己训练的权重，可以在这里加载，例如：
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

        # H, W, C -> 1, C, H, W，归一化到 0-1
        tensor = torch.from_numpy(roi_img).float() / 255.0  # type: ignore[arg-type]
        tensor = tensor.permute(2, 0, 1).unsqueeze(0)  # 1,3,H,W

        _, _, h, w = tensor.shape
        # U-Net 通常要求尺寸是 32 的倍数，这里做 reflect padding
        pad_h = (32 - h % 32) % 32
        pad_w = (32 - w % 32) % 32
        if pad_h or pad_w:
            tensor = F.pad(tensor, (0, pad_w, 0, pad_h), mode="reflect")

        return tensor.to(self.device), (x1, y1, h, w)

    def segment(self, image: np.ndarray, roi: ROIRegion) -> np.ndarray:
        """
        对单帧图像进行静脉血管分割，返回与输入图像同尺寸的 0/1 mask。

        步骤：
        1. 从整帧 image 中裁剪 ROI 区域，预处理为网络输入。
        2. 调用 U-Net 模型得到 ROI 内的概率图。
        3. 将 ROI 内的二值 mask 贴回整张图，其余区域为 0。
        """
        self._ensure_initialized()
        if self.model is None:
            # 无有效模型时，退回到全 0 mask，保证接口可用
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

        # 去掉 padding，只保留原始 ROI 尺寸
        pred = pred[:, :, :roi_h, :roi_w]
        prob_mask = pred[0, 0].cpu().numpy()

        # 简单阈值 0.5 生成 0/1 mask
        roi_mask = (prob_mask > 0.5).astype(np.uint8)

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1 : y1 + roi_h, x1 : x1 + roi_w] = roi_mask

        return full_mask


class CVVeinSegmentor:
    """
    使用传统 OpenCV 图像处理完成静脉分割：
    - 在 ROI 内进行灰度化、对比度增强、平滑；
    - 使用 Otsu 自适应阈值生成二值图；
    - 进行形态学闭运算与开运算去噪；
    - 返回与输入图像同尺寸的 0/1 mask。
    """

    def segment(self, image: np.ndarray, roi: ROIRegion) -> np.ndarray:
        if image.ndim == 2:
            height, width = image.shape
            gray = image
        else:
            height, width = image.shape[:2]
            # decode_image_from_data_url 返回的是 RGB，这里按 RGB 转灰度
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        x1 = max(0, int(roi.x))
        y1 = max(0, int(roi.y))
        x2 = min(width, x1 + int(roi.width))
        y2 = min(height, y1 + int(roi.height))

        if x2 <= x1 or y2 <= y1:
            logger.warning("Invalid ROI for CV segmentation, return empty mask")
            return np.zeros((height, width), dtype=np.uint8)

        roi_img = gray[y1:y2, x1:x2]

        # 预处理：高斯模糊 + CLAHE 提升静脉对比度
        blurred = cv2.GaussianBlur(roi_img, (5, 5), 0)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)

        # Otsu 自适应阈值，反色使静脉为白色（1），背景为黑色（0）
        _, thresh = cv2.threshold(
            enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )

        # 形态学操作：闭运算填补静脉内部小空洞，再开运算去除小噪声
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)

        roi_mask = (opened > 0).astype(np.uint8)

        full_mask = np.zeros((height, width), dtype=np.uint8)
        full_mask[y1:y2, x1:x2] = roi_mask

        return full_mask
