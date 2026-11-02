# 火柴人幸存者 · 敌人素材（现行：B Q版）

风格 = **B Q版可爱**（可欣选定，锚点 `style_B_chibi_tiger.png`）：大头短肢、圆润、侧视**面朝右**、炭黑描边 #2b2b2b、低饱和扁平赛璐璐、不抢火柴人红围巾。透明 RGBA，已裁紧，高度 = 目标 size。朝左时 `setFlipX(true)`。

建议锚点 `setOrigin(0.5, 1)`。只按高度缩放（`spr.setScale(size/spr.height)` 或 1:1），不要 `setDisplaySize(size,size)`。碰撞盒相对图片左上角，取身体下半约 60%×55%，已向右（头/身体侧）偏移避开左侧尾巴。Boss 按 80 高出图，建议 `elephant.size` 改 80。

| key | 文件 | w×h | ENEMIES size | 碰撞盒 x,y,w,h | 物种特征 |
|---|---|---|---|---|---|
| mouse | mouse.png | 42×30 | 30 | 12,14,25,16 | 灰毛、粉圆耳、细粉尾 |
| rabbit | rabbit.png | 32×32 | 32 | 7,14,19,18 | 奶白、长竖耳、球尾（跳跃姿态） |
| frog | frog.png | 41×32 | 32 | 9,14,25,18 | 灰绿、凸眼、蹲姿、斑点 |
| fox | fox.png | 46×38 | 38 | 13,17,28,21 | 陶土橙（已降饱和）、尖耳、白尖大尾 |
| wolf | wolf.png | 53×40 | 40 | 13,18,32,22 | 蓝灰、颈鬃、蓬尾 |
| boar | boar.png | 61×46 | 46 | 14,21,37,25 | 灰褐、背鬃、獠牙、粉鼻 |
| bear | bear.png | 66×56 | 56 | 15,25,40,31 | 褐、圆耳、浅吻部 |
| tiger | tiger.png | 75×54 | 54 | 20,24,45,30 | 赭黄黑纹（已降饱和），即 style_B 样张 |
| elephant (Boss) | elephant.png | 96×80 | 100 → 建议 80 | 22,36,58,44 | 灰紫、粉大耳、卷鼻、獠牙、小金冠 |
| — UI | elephant_icon.png | 58×48 | — | — | Boss 血条/预警图标（同图缩小） |

旧扁平版备份：/workspace/mini-game-art/zodiac-style-pass/b-chibi-full/_backup_old/。源图与处理脚本：/workspace/mini-game-art/zodiac-style-pass/b-chibi-full/（raw/、process.py、preview.py）。
