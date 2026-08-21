# 第三方组件许可声明

## Pikafish（象棋引擎）

- **用途**：本应用的"AI分析"功能（棋力分析、胜率评估）通过启动 Pikafish 的独立可执行文件子进程、使用标准的 UCI 文本协议与其通信来实现，本应用不包含、不修改 Pikafish 的任何源代码。
- **许可证**：[GNU General Public License v3 (GPL v3)](https://www.gnu.org/licenses/gpl-3.0.html)
- **源代码**：<https://github.com/official-pikafish/Pikafish>
- **使用版本**：Pikafish 2026-01-02（见 [Releases 页面](https://github.com/official-pikafish/Pikafish/releases/tag/Pikafish-2026-01-02)）
- **获取方式**：本仓库不随git提交 Pikafish 的二进制文件与神经网络权重文件（体积过大，且属于官方独立分发的第三方产物），开发者/使用者需要自行运行 `npm run setup:pikafish` 下载官方发布包，详见 `resources/engines/README.md`。下载到本地后，`resources/engines/pikafish/` 目录下会同时包含 Pikafish 官方分发包自带的完整许可证文本（`Copying.txt`）与作者名单（`AUTHORS`）。
- **合规说明**：因为是通过 `child_process` 启动独立可执行文件、用 UCI 协议通信，属于"简单聚合"（mere aggregation），不构成代码链接，本应用主体代码不因此受 GPL v3 传染、不需要开源。如果未来对 Pikafish 引擎源码本身做了修改（而不是外层调用代码），修改部分需要同样以 GPL v3 开放。

## NNUE 神经网络权重文件

- Pikafish 使用的 `pikafish.nnue` 权重文件随官方发布包一同分发，许可条款见该文件同目录下的 `NNUE-License.md`（同样通过 `npm run setup:pikafish` 下载获得）。
