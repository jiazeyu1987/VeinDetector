# T1中心黑区方式滑动条增强

## 🎯 功能概述

为T1中心黑区方式（SimpleCenterCVVeinSegmentor）添加了两个新的滑动条，使用户能够更直观地控制预处理和形态学参数的严格程度。

## ✨ 新增功能

### 1. 预处理严格程度滑动条
- **位置**: T1参数面板 → 预处理部分
- **范围**: 0.0 (宽松) - 1.0 (严格)
- **步长**: 0.05
- **控制的参数**:
  - `blurKernelSize`: 3→5→7→9 (模糊核大小)
  - `claheClipLimit`: 1.0→4.0 (CLAHE对比度限制)
  - `claheTileGridSize`: 4→8 (CLAHE网格大小)

### 2. 形态学严格程度滑动条
- **位置**: T1参数面板 → 形态学部分
- **范围**: 0.0 (宽松) - 1.0 (严格)
- **步长**: 0.05
- **控制的参数**:
  - `morphKernelSize`: 3→5→7 (形态学核大小)
  - `morphCloseIterations`: 1→4 (闭运算次数)
  - `morphOpenIterations`: 0→2 (开运算次数)

## 🔧 技术实现

### 状态管理
```typescript
const [simplePreStrength, setSimplePreStrength] = useState(0.5);
const [simpleMorphStrength, setSimpleMorphStrength] = useState(0.5);
```

### 自动参数映射逻辑

#### 预处理严格程度映射
```typescript
useEffect(() => {
  if (segmentationModel.toLowerCase() !== 'cv_simple_center') return;

  const p = simplePreStrength; // 0~1
  const blurKernel = 3 + 2 * Math.round(p * 3); // 3,5,7,9
  const claheClip = 1.0 + 3.0 * p; // 1.0 ~ 4.0
  const claheTile = 4 + Math.round(p * 4); // 4 ~ 8

  setSimpleCenterParams(prev => ({
    ...prev,
    blurKernelSize: blurKernel,
    claheClipLimit: claheClip,
    claheTileGridSize: claheTile,
  }));
}, [simplePreStrength, segmentationModel]);
```

#### 形态学严格程度映射
```typescript
useEffect(() => {
  if (segmentationModel.toLowerCase() !== 'cv_simple_center') return;

  const m = simpleMorphStrength; // 0~1
  const morphKernel = 3 + 2 * Math.round(m * 2); // 3,5,7
  const closeIter = 1 + Math.round(m * 3); // 1~4
  const openIter = Math.round(m * 2); // 0~2

  setSimpleCenterParams(prev => ({
    ...prev,
    morphKernelSize: morphKernel,
    morphCloseIterations: closeIter,
    morphOpenIterations: openIter,
  }));
}, [simpleMorphStrength, segmentationModel]);
```

### UI组件结构
```tsx
<div className="mb-2">
  <label className="flex items-center justify-between text-xs mb-1">
    <span>预处理严格程度</span>
    <span className="text-gray-400">{simplePreStrength.toFixed(2)}</span>
  </label>
  <input
    type="range"
    min={0}
    max={1}
    step={0.05}
    value={simplePreStrength}
    onChange={e => setSimplePreStrength(Number(e.target.value))}
    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
  />
  <div className="flex justify-between text-xs text-gray-500 mt-1">
    <span>宽松</span>
    <span>严格</span>
  </div>
</div>
```

## 📊 参数映射表

### 预处理严格程度 (simplePreStrength)
| 滑动条值 | blurKernelSize | claheClipLimit | claheTileGridSize | 描述 |
|----------|---------------|----------------|-------------------|------|
| 0.0      | 3             | 1.0            | 4                 | 最宽松 |
| 0.25     | 5             | 1.75           | 5                 | 较宽松 |
| 0.5      | 7             | 2.5            | 6                 | 中等 |
| 0.75     | 7             | 3.25           | 7                 | 较严格 |
| 1.0      | 9             | 4.0            | 8                 | 最严格 |

### 形态学严格程度 (simpleMorphStrength)
| 滑动条值 | morphKernelSize | morphCloseIterations | morphOpenIterations | 描述 |
|----------|-----------------|---------------------|-------------------|------|
| 0.0      | 3               | 1                   | 0                 | 最宽松 |
| 0.25     | 3               | 2                   | 1                 | 较宽松 |
| 0.5      | 5               | 3                   | 1                 | 中等 |
| 0.75     | 7               | 3                   | 2                 | 较严格 |
| 1.0      | 7               | 4                   | 2                 | 最严格 |

## 🎮 使用指南

### 操作步骤
1. 选择分割模型为 "T1 中心黑区 · 简单 CV"
2. 打开参数设置面板
3. 调整预处理严格程度滑动条控制图像预处理强度
4. 调整形态学严格程度滑动条控制形态学处理强度
5. 观察实时检测结果变化

### 参数调节建议
- **宽松设置** (0.0-0.3): 适用于噪声较多的图像，避免过度过滤
- **中等设置** (0.4-0.6): 平衡检测精度和鲁棒性的通用设置
- **严格设置** (0.7-1.0): 适用于高质量图像，追求高精度检测

## 🚀 性能优化

### 实时响应
- 滑动条变化立即更新参数
- 使用React的useEffect确保参数同步
- 避免不必要的重新渲染

### 用户体验
- 数值实时显示当前滑动条位置
- "宽松/严格"标签帮助用户理解参数影响
- 保留原有数字输入框作为微调选项

## 🔗 与其他功能的集成

### 全局置信度滑动条
- 仍然控制候选区域筛选参数
- 与新滑动条形成完整的三级控制体系
- 提供从粗到细的参数调节层次

### API集成
- 参数自动映射到后端API请求
- 与优化后的模型加载系统无缝集成
- 保持向后兼容性

## 📝 开发注意事项

### 状态同步
- 确保滑动条值与参数对象同步
- 避免循环更新导致的性能问题
- 正确处理组件卸载时的清理

### 边界情况
- 处理滑动条超出范围的情况
- 确保参数映射的数学正确性
- 验证参数对检测算法的实际影响

## 🎉 总结

通过添加这两个滑动条，T1中心黑区方式现在提供了：
- ✅ **更直观的参数控制**: 用户无需理解具体参数含义
- ✅ **实时参数调节**: 即时看到参数变化的影响
- ✅ **分层参数体系**: 预处理→形态学→区域筛选的三级控制
- ✅ **保持原有精度**: 仍然可以手动微调具体参数
- ✅ **改善用户体验**: 降低使用门槛，提高调节效率

这些改进使得T1中心黑区方式更加用户友好，同时保持了专业的参数控制能力。