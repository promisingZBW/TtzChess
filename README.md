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

工具栏上的「AI 分析」直接拿当前棋盘去问引擎，不用另外再摆一遍局面。结果占用右边那一列，和棋谱树是两个标签页，随时切回去看棋路——开局棋路和中局／残局／整局案例都能用。

![打谱时一键 AI 分析](pics/中炮对屏风马AI.png)

### 中局 / 残局 / 整局

案例库用文件夹和搜索管理你积累的局面。中局、残局从空白棋盘摆子，点「开始打谱」再记录；整局则一开始就是全部棋子摆好的开局。

摆到一半可以直接点「保存」走人，下次打开还停在摆局界面，子都在。已经开始打谱的案例想改起始局面，点棋盘下面的「重新摆局」回到摆局界面（已经记下的走法是按旧局面推的，会一起清掉，会先问一次）。

![案例库](pics/案例库.png)

### AI 分析

分析用的是开源引擎 [Pikafish](https://github.com/official-pikafish/Pikafish)。

- **一键分析**：打谱时直接分析当前棋盘，不用重新摆一遍，见上面「打谱」一节的截图。
- **单次分析**：从空棋盘摆一个局面，看后面几步的胜率、吃子和捉子提示。
- **整局分析**：选红方或黑方视角，从头走棋，右侧画出胜率折线。任意一步都可以再做一次单次分析，也可以把当前棋路收藏进整局案例库。

![整局分析](pics/ai分析.png)

---

## 下载使用

不需要安装 Node.js。打开 [Releases](https://github.com/promisingZBW/TtzChess/releases)，选一个：

| 文件 | 说明 |
| --- | --- |
| `TtzChess-*-setup.exe` | 安装包，会生成开始菜单和桌面快捷方式 |
| `TtzChess-*-win.zip` | 免安装，解压后运行 `TtzChess.exe` |

引擎（Pikafish）已经打进包里，下载后可以直接点「开始分析」，不用另外配置。

每个版本改了什么见 [CHANGELOG.md](CHANGELOG.md)。

棋谱数据在程序旁边的 `data` 文件夹。换电脑时关掉软件，把整个 `data` 拷过去覆盖即可。

### 国内下载不动 / GitHub 打不开

安装包接近 150 MB，而 Release 里的附件并不放在 `github.com` 上，是从
`objects.githubusercontent.com` 发出来的——这个域名在国内经常连不上或者限速到几十 KB/s，
下到一半断掉是常事。仓库源码只有 8 MB 左右，`git clone` 一般没问题，卡住的基本都是安装包。

几个办法，从最省事的开始：

1. **换个网络再试**：手机热点、公司网络、或者挂代理，往往一次就过。用
   [aria2](https://aria2.github.io/) 或者迅雷这类支持断点续传的下载工具，比浏览器扛得住。
2. **用加速前缀**：把下载地址前面拼一段公共代理域名再下。这类站点是社区维护的，会换域名也会挂，
   用之前先确认还活着（搜「github 加速」能找到当下能用的）。形式大致是：

   ```text
   https://<加速域名>/https://github.com/promisingZBW/TtzChess/releases/download/<版本号>/TtzChess-<版本号>-setup.exe
   ```

3. **`git clone` 也卡的话**，让 git 自动走加速域名：

   ```bash
   git config --global url."https://<加速域名>/https://github.com/".insteadOf "https://github.com/"
   ```

   不想改全局配置就临时用 `git clone https://<加速域名>/https://github.com/promisingZBW/TtzChess.git`。

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
