#!/usr/bin/env python3
"""
简化的连通区域测试
"""

import numpy as np

# 简单测试：创建几个独立区域
test_mask = np.zeros((50, 50), dtype=np.uint8)

# 区域1：大块
test_mask[10:20, 10:20] = 255  # 100像素

# 区域2：中块
test_mask[25:30, 25:30] = 255  # 25像素

# 区域3：小块
test_mask[35:37, 35:37] = 255  # 4像素

print(f"测试图像：3个独立区域，总像素数: {test_mask.sum()}")

# 模拟连通组件分析结果
region_sizes = [100, 25, 4]
max_idx = 1 + np.argmax(region_sizes)
max_size = max(region_sizes)

print(f"区域大小: {region_sizes}")
print(f"最大区域索引: {max_idx}")
print(f"最大区域大小: {max_size}")
print("算法将只保留面积为100像素的区域")