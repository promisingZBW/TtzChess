# TtzChess

本地优先的中国象棋打谱与 AI 分析桌面应用。棋路、笔记、案例都存在你自己的电脑上。

**中文** | [English](README.en.md)

---

点左侧三个入口就能用完全部功能。

### 开局径向图

按起手棋子把棋路摊开：炮、马、车、相、兵各一个中心。点中心的棋子图标新建一条棋路；点已经长出来的小球，直接进去继续打谱。

![开局径向图](pics/开局径向图.png)

### 打谱

左边是棋盘，右边是光球棋谱树。按象棋规则走子，每一步会变成一个光球；点光球就能跳回那一手。右键可以加分支或写笔记。需要试变化时，打开「沙盘演练」——关掉后棋盘会回到进入前的局面。

![中炮对屏风马](pics/中炮对屏风马.png)

### 中局 / 残局 / 整局

案例库用文件夹和搜索管理你积累的局面。中局、残局从空白棋盘摆子，点「开始打谱」再记录；整局则一开始就是全部棋子摆好的开局。

![案例库](pics/案例库.png)

### AI 分析

分析用的是开源引擎 [Pikafish](https://github.com/official-pikafish/Pikafish)。

- **单次分析**：摆一个局面，看后面几步的胜率、吃子和捉子提示。
- **整局分析**：选红方或黑方视角，从头走棋，右侧画出胜率折线。任意一步都可以再做一次单次分析，也可以把当前棋路收藏进整局案例库。

![整局分析](pics/ai分析.png)

---

## 下载使用

不需要安装 Node.js。打开 [Releases](https://github.com/promisingZBW/TtzChess/releases) ，选一个：

| 文件 | 说明 |
| --- | --- |
| `TtzChess-*-setup.exe` | 安装包，会生成开始菜单和桌面快捷方式 |
| `TtzChess-*-win.zip` | 免安装，解压后运行 `TtzChess.exe` |

引擎已经打进安装包里，下载后可以直接点「开始分析」。

棋谱数据在程序旁边的 `data` 文件夹。换电脑时关掉软件，把整个 `data` 拷过去覆盖即可。

## 从源码运行

适合想改代码的人。

```bash
git clone https://github.com/promisingZBW/TtzChess.git
cd TtzChess
npm install
npm run setup:pikafish
npm run dev
```

Windows 打包：

```bash
npm run dist:win
```

完成后看 `release/<版本号>/`。

## 许可

本仓库源码用于学习与个人使用。AI 分析通过独立进程调用 Pikafish（GPL v3），不属于代码链接。说明见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
