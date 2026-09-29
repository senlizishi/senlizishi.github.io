# 项目长期笔记 · senlizishi.github.io

## 是什么

纯静态小游戏合集站，发布在 GitHub Pages（`origin` = `git@github.com:senlizishi/senlizishi.github.io.git`）。无后端、无构建步骤、无包管理（没看到 package.json），所有文件直接提交即上线。git 历史 30+ 提交，信息全是 "improve / add new game" 这类，别指望从 log 里读意图。

## 目录约定（重要）

- `index.html` = 入口页，卡片清单，新游戏要在这里加一张 `.card`（含 `--glow` 主题色、`.thumb` 缩略图、`.meta` 文案、`.tags`）。
- 每款游戏 = **根目录一个 html** + **`js/` 下一个场景文件**。html 里只有 shell/样式/Phaser 启动配置，游戏逻辑全在 js。
- 共用 `phaser.min.js`（Phaser 3，版本未标注）。
- `assets/` = 图标 + `pattern-01..10.jpg`（蚂蚁搬砖的图案来源照片）+ `dressup/` 约 190 个 SVG 部件。
- `tools/gen-dressup/` = Node 脚本（**唯一有构建性质的东西**），见下。
- `_mjpreview.html` / `_tiles-preview.html` = 麻将美术调试页，不属于游戏入口。

## 通用代码约定

1. **横竖屏**：每个 js 顶部都是 `IS_PORTRAIT = innerHeight > innerWidth`，`WIDTH/HEIGHT = 540×960 或 960×540`。方向变了就 `window.location.reload()`（麻将例外：按屏幕比例算画布 + 比例差 >8% 才 reload）。
2. **画布适配**：`Phaser.Scale.FIT` + `CENTER_BOTH`，`html/body` 固定 + `touch-action:none`。
3. **返回首页**：每页一个 fixed 的 `#home-link`（←），带 `env(safe-area-inset-*)`。
4. **音效**：各游戏自带 WebAudio 合成器，不加载音频文件。`js/mahjong/audio.js`、`memory-game.js` 内的 SoundFX、`ants-game.js` 的 `window.AntsAudio`、`jelly-game.js` 的 `window.JellyAudio`。
5. **美术**：几乎全部靠 `Phaser.Graphics` 程序化绘制；麻将更极端——`art.js` 用 Canvas 2D 烘焙成贴图（2 倍分辨率烘焙、显示缩放 0.5）。
6. **文案**：中文，面向小朋友（"5岁友好" 是 tag），措辞软、不用生硬术语。
7. **存档**：只写本机浏览器存储（jelly-game.js 里的最高分/历史），没有账号体系。

## 广东麻将（改动风险最高）

拆成 4 个文件：`rules.js`（纯逻辑，UMD，Node 可直接跑）/ `audio.js` / `art.js`（贴图烘焙）/ `game.js`（场景）。
- 规则：广东玩法，**不能吃，只能碰/杠/胡**。0-8 万、9-17 筒、18-26 条、27-33 字牌。
- `rules.js` 里已有完整算法：向听数、`isWinning`、`waitingTiles`、`chooseDiscard`、`shouldPong/shouldKong`。**改 AI 或判胡一定动这里，并且它是唯一能脱离 Phaser 单测的部分。**
- `mahjong.html` 有错误早捕 + 8 秒看门狗 + WebGL 丢失提示，专门防"黑屏无提示"。改这个页面要保住这套诊断。
- 脚本引用带 `?v=N` 版本号（rules v2 / audio v2 / art v10 / game v15）——**改 js 后必须手动 +1**，否则手机端缓存不更新。
- 布局全部由 `computeLayout()` 从 `WIDTH/HEIGHT/SAFE/HUD_INSET` 推导，不许写死像素；牌占位尺寸要按 `art.js` 的 footW/footH（含厚度投影），只按牌面宽排会糊在一起。

## 换装小公主 + 素材生成流水线（当前在做的方向）

- `tools/gen-dressup/`：`lib.js`（SVG 原语 + 描边/曲线采样求包围盒 + 写文件）、`doll.js`（600×900 娃娃空间的锚点常量：HEAD/EYE/TORSO/HIP/SLEEVE/LEG、`fringe`/`hairCap`/`hairLock` 等头发构件）、`geom.js`（镜像/曲线/多边形工具）、`parts/*.js`（9 类部件：hair/hat/face/top/skirt/bottom/shoes/accessory/scene）、`index.js`（入口）。
- 三个命令：`node tools/gen-dressup/index.js emit`（**生成 assets/dressup/*.svg + boxes.json**）、`data`（把尺寸表写进 js）、`dump`（只看不写）。
- `index.js` 会往 `js/dressup-game.js` 的 `// >>> GEN:ITEMS >>>` / `// <<< GEN:ITEMS <<<` 之间回写 `ITEMS` 表。**这对标记之间的内容是生成物，不要手改**；改造型改 `parts/*.js` 再跑脚本。脚本有护栏：会校验 `SCENES_DATA / CATEGORIES / SLOT_DEPTH / SLOT_BEHIND / LAYOUT / textStyle` 六个声明还在，缺了就直接抛错拒绝写入。
- 游戏侧关键常量：`SLOT_DEPTH` 定层（leg→…→hand，`back` 走身后层）、`SLOT_BEHIND`、`PIECE_COVERS`（连衣裙和上衣互斥）、`SCENES_DATA`（海边/宫廷/森林，每个场景 3 个 `spots` 互动点）、`SPOT_ACTIONS`。
- 新增一件衣服 = parts 里加定义 → 跑 emit → 跑 data。不要手写 ITEMS，box 算错会拖偏/判定歪。

## 小猫咪插花（2026-09-29 新增）

`flower.html` + `js/flower-game.js`，无分数无计时纯插花玩具（女儿点子），猫四姿态（sleep/sit/walk/sniff）自主活动全程零交互。要点：

- **9 个瓶口槽位**从中间往两边交替（`SLOT_ORDER`），茎/花头分层（茎 12 < 瓶 20 < 头 30）做出"插进去"的遮挡。
- **插满 = 五声音阶一段上行旋律**（9 槽对 9 音），满瓶触发花摇 + 猫来闻 + 花瓣飘落；重插按钮在右下。
- 花瓶轮廓必须过 `Phaser.Curves.Spline` 平滑（直连 profile 点会变多边形）；花瓣用贝塞尔采样点集 + 手写 fillPts/strokePts（比 fillPoints 兼容性好）。
- 存档 `localStorage['kitty-flower-v1']`，重开还是她插的那瓶。
- `_flower-preview.html` = 美术调试页（hash 支持 `#pose=sit&catx=420`）。**headless 截图两坑**：页面要主动 `game.loop.stop()`，且 stop 后要手动 `game.loop.step(1000)` 补最后一帧，否则 create 后加的对象不出现在截图里；截图命令必须带 `timeout 75`。

## 其他几款（一句话）

- `jelly-game.js`：果冻合成（物理，Matter），有商店/皮肤/主题/音量滑杆，代码里最大的一款之一。
- `ants-game.js`：蚂蚁搬砖，30×35 格图案 + 5 槽位 + 卡牌队列，图案来自 `pattern-01..10.jpg` 经中位切分量化成调色板（逻辑写在 **ants.html 内联脚本**里）。
- `maze-game.js`：递归回溯 / Prim 迷宫，主题数组循环换色，小乌龟会追人。
- `memory-game.js`：翻牌配对，关卡随等级加牌，emoji 池 24 个。

## 环境坑

本机 WorkBuddy 的 bash 是残缺的（`ls/cat/wc/head/dirname` 都没有），**别用 Bash 工具做文件操作**，用 Read/Glob/Grep/Write；git 命令是好的。
