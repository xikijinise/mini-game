# 火柴人幸存者 · 敌人素材（替换 emoji）

风格对齐 `../obstacles/`：扁平简笔、炭黑描边 #2b2b2b、低饱和平涂、无毛发纹理。全部**侧视、面朝右**（与火柴人默认朝向一致；朝左时 `setFlipX(true)`）。
透明底 RGBA PNG，已裁紧。文件名 = `src/data/enemies.js` 里的 key。

**尺寸约定：高度 ≈ ENEMIES[key].size**（Boss 例外，见下）。宽度随物种体型变化，长身动物（虎/熊）宽度远大于 size。
如果代码里仍按 emoji 正方形 `setDisplaySize(size,size)`，请改为只按高度缩放：`spr.setScale(size / spr.height)` 或直接原尺寸 1:1 显示。

建议锚点：`setOrigin(0.5, 1)`（脚底中心，便于按 y 排深度、与树/石同规则）。
如果现有逻辑按中心点做距离判定/追踪，也可用 `setOrigin(0.5, 0.5)`，碰撞盒偏移相同（Arcade body 偏移按图片左上角算，与 origin 无关）。

碰撞盒 = 相对图片左上角 (x, y, w, h)，取身体下半部约 60%×55%，避开耳朵/尾巴/象鼻，手感偏宽松。

| key | 文件 | w×h | ENEMIES size | 碰撞盒 x,y,w,h | 主色 hex | 物种特征 |
|---|---|---|---|---|---|---|
| mouse | mouse.png | 35×30 | 30 | 7,14,21,16 | #ccc8c0 灰 / #e0a8a8 耳 | 圆耳、细尾 |
| rabbit | rabbit.png | 25×32 | 32 | 5,14,15,18 | #fcf4e8 奶白 / #e0a0a8 耳内 | 长竖耳、球尾 |
| frog | frog.png | 41×32 | 32 | 8,14,25,18 | #84966f 灰绿 / #f0e8d0 肚 | 凸眼、蹲姿 |
| fox | fox.png | 61×38 | 38 | 12,17,37,21 | #c06c54 陶土橙 / #f8e8d0 奶白 | 尖耳、大尾白尖 |
| wolf | wolf.png | 53×40 | 40 | 10,18,32,22 | #78808c 蓝灰 / #c8ccd0 肚 | 耸肩鬃毛、压低头 |
| boar | boar.png | 65×46 | 46 | 13,21,39,25 | #968478 灰褐 / #7a6658 鬃 | 獠牙、背鬃 |
| bear | bear.png | 95×56 | 56 | 19,25,57,31 | #845a44 褐 / #d8b490 吻部 | 厚重块体 |
| tiger | tiger.png | 114×54 | 54 | 23,24,68,30 | #c89c60 赭黄 / #2b2b2b 纹 | 黑条纹、长尾 |
| elephant (Boss) | elephant.png | 99×80 | 100 → 建议 80 | 20,36,59,44 | #a89cac 灰紫 / #d898a4 耳内 | 卷鼻、獠牙、大耳 |
| — UI | elephant_icon.png | 59×48 | — | — | 同上 | Boss 血条/预警图标 |

Boss：原 size 100 偏大，这里按高 80 出图（约 1.7 个火柴人高，可读但不占半屏）。建议把 `elephant.size` 改成 80，或保留 100 时 `setScale(100/80)`（会略糊）。

源图（GenerateImage 1024² 原图）在 `raw/*_raw.jpg`；`process.py` 处理：近白背景 flood fill→透明、收边 1px、按目标尺寸把描边加粗到约 1~1.3px（保证 30px 级可读）、狐/虎/熊降饱和、裁紧、等比缩放。`preview.py` 生成 `raw/preview_x4.png`（#f4f1e8 米格底 4 倍放大，最右红框 = 32×48 火柴人）。
