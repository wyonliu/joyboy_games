# 麦洛的冒险 | Melo's Quest

> 水墨山海经主题 · 纯TypeScript+Canvas2D · 零外部依赖 · 十款手游

## 游戏列表

### 经典五部

| # | 中文名 | English | 类型 | 代码量 |
|---|--------|---------|------|--------|
| 1 | 百妖长夜 | Endless Demon Night | 弹幕幸存者 | 3,578行 |
| 2 | 扶摇万里 | Soaring Winds | 一键飞行 | 5,515行 |
| 3 | 石破天惊 | Shatter Strike | 弹球Roguelike | 5,875行 |
| 4 | 吞灵化龙 | Dragon Ascent | 贪吃蛇进化 | 5,332行 |
| 5 | 碎星连珠 | Shattered Stars | 五行三消 | 3,468行 |

### 新篇五部

| # | 中文名 | English | 类型 |
|---|--------|---------|------|
| 6 | 登天叠塔 | Celestial Tower | 叠塔登天 |
| 7 | 水墨画疆 | Ink Territory | 领地争夺 |
| 8 | 合灵演化 | Spirit Merge | 物理合成 |
| 9 | 封印飞刃 | Seal Blade | 节奏飞刀 |
| 10 | 渡劫天梯 | Tribulation Climb | 横版跳跃 |

**总代码量**: ~45,000行 TypeScript

## 技术栈

- **语言**: TypeScript 5.7 + ES2020
- **渲染**: 纯 Canvas2D (无引擎)
- **音频**: Web Audio API 程序化合成 (零音频文件)
- **构建**: Vite 6
- **画布**: 390×844 竖屏 + devicePixelRatio 适配
- **部署**: 单HTML+单JS, gzip后 15-20KB/游戏

## 特色系统

### 跨游戏
- **麦洛护照** — localStorage跨游戏共享: 昵称/金币/成就/游戏次数
- **成就印章** — 每游戏5枚红色方印
- **品牌化分享** — 统一#麦洛的冒险标签+挑战码

### 经典五部独有
- **百妖长夜**: 5角色 · 14升级+5武器进化 · Boss弹幕 · 击杀变身三阶段
- **扶摇万里**: 5章节主题 · 险过连击 · 幽灵赛跑 · 天色渐变 · HiDPI
- **石破天惊**: 活砖系统(会看球的砖块) · 悟空降临 · 怒意模式 · 山灵图鉴
- **吞灵化龙**: 4阶进化仪式 · Boss蛇 · 竞技场事件 · 浮动摇杆 · AI逃跑
- **碎星连珠**: 五行生克连锁 · 特殊宝石组合 · 升调combo · 关卡制

### 新篇五部独有
- **登天叠塔**: 4区域主题 · 完美叠加combo · 物理摇摆 · 塔崩溃动画 · 区域BGM演进
- **水墨画疆**: Paper.io领地战 · AI人格系统 · 水墨笔触轨迹 · 竞技场缩圈 · 浮动摇杆
- **合灵演化**: 12阶灵兽进化链 · 圆形碰撞物理引擎 · 独立灵兽渲染 · 合成连锁 · 灵气爆发
- **封印飞刃**: 30+山海经Boss · 5种飞刃属性 · 封印阵法系统 · 弱点暴击 · 5章节剧情
- **渡劫天梯**: 5重天劫主题 · 伪3D等距视角 · 角色解锁 · Boss关卡 · 弹性跳跃动画

### 全游戏通用
- 暂停/静音按钮 (localStorage持久化)
- 预设昵称选择器 (8个水墨风名字)
- 粒子硬上限 (300-400) 防性能崩溃
- Web Audio节点自动回收
- 程序化水墨美术 (渐变/纹理/粒子, 零图片资源)
- 多层程序化BGM (低音/旋律/节奏/氛围)

## 本地开发

```bash
# 安装依赖 (在任一游戏目录)
cd games/melos-quest-1-v2
npm install

# 启动开发服务器
npx vite --port 3001

# 类型检查
npx tsc --noEmit

# 构建生产包
npx vite build
```

## 目录结构

```
joyboy_games/
├── games/
│   ├── melos-quest-1-v2/         # 百妖长夜 (弹幕幸存者)
│   ├── melos-quest-2-cloud-leap/ # 扶摇万里 (一键飞行)
│   ├── melos-quest-3-ricochet/   # 石破天惊 (弹球Roguelike)
│   ├── melos-quest-4-serpent/    # 吞灵化龙 (贪吃蛇进化)
│   ├── melos-quest-5-cards/      # 碎星连珠 (五行三消)
│   ├── melos-quest-6-stack/      # 登天叠塔 (叠塔登天)
│   ├── melos-quest-7-territory/  # 水墨画疆 (领地争夺)
│   ├── melos-quest-8-merge/      # 合灵演化 (物理合成)
│   ├── melos-quest-9-knife/      # 封印飞刃 (节奏飞刀)
│   └── melos-quest-10-crossy/    # 渡劫天梯 (横版跳跃)
├── publish/
│   └── itchio/
│       ├── metadata.md           # itch.io发布元数据
│       └── *.zip                 # 发布包
└── README.md
```

## 发布

```bash
# 构建全部10个游戏的发布包
for d in games/melos-quest-{1-v2,2-cloud-leap,3-ricochet,4-serpent,5-cards,6-stack,7-territory,8-merge,9-knife,10-crossy}; do
  cd $d && npx vite build && cd ../..
done
```

发布包在 `publish/itchio/` 目录, 格式为 HTML5 zip, 可直接上传至:
- itch.io (HTML5 Web)
- Poki (需SDK集成)
- CrazyGames (需SDK集成)

## 美术风格

敦煌赛博朋克 × 水墨山海经:
- 深色背景 + 金色/墨色主调
- 程序化水墨笔触边缘
- 粒子系统模拟墨滴飞溅
- 五声音阶程序化BGM
- 红巾少年麦洛为统一主角符号

## License

MIT

---

*JoyBoy Games · 2026*
