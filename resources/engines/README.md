# 引擎二进制文件说明

这个目录下的 `pikafish/` 子目录（Pikafish引擎的可执行文件 + `pikafish.nnue` 神经网络权重文件）**不随git提交**：

- 体积太大：光是 `pikafish.nnue` 权重文件就有约53MB，加上Windows/Linux/macOS三个平台的二进制变体，总共70MB左右，直接进git仓库会让每个人clone这个项目都要多下载这么多内容，而且git对二进制大文件的历史记录管理本来就不友好。
- 官方随时可能发布新版本，没必要把某个具体版本的二进制"焊死"在仓库历史里。

## 怎么装

clone 这个仓库之后，运行一次：

```bash
npm run setup:pikafish
```

这个脚本会自动从 [Pikafish官方GitHub Releases](https://github.com/official-pikafish/Pikafish/releases) 下载发布包、解压，并把这个项目实际需要的文件放进 `pikafish/` 目录：

```
resources/engines/pikafish/
├── pikafish.nnue          # 神经网络权重，三个平台的二进制共用这一份
├── Copying.txt            # GPL v3 完整许可证文本
├── AUTHORS                # 引擎作者名单
├── NNUE-License.md        # 神经网络权重文件的许可说明
├── Windows/
│   ├── pikafish-avx2.exe
│   ├── pikafish-bmi2.exe
│   └── pikafish-sse41-popcnt.exe
├── Linux/
│   └── ...（同上三个变体）
└── MacOS/
    └── pikafish-apple-silicon
```

同一平台放好几个指令集变体，是因为不同CPU支持的指令集不一样（越靠前的变体越快，但要求CPU更新）；具体运行时用哪一个，由 `src/main/engine/EngineService.ts` 自动尝试——排在前面的变体如果这台CPU不支持会启动失败，会自动换下一个，直到最保险的 `sse41-popcnt`（几乎所有64位CPU都支持）兜底。

## 许可证

Pikafish以 **GPL v3** 协议开源，仅仅是通过子进程+标准输入输出（UCI协议）调用它，不属于代码链接，不会影响本项目主体代码的许可证。分发这个应用时的合规声明见项目根目录下的 `THIRD_PARTY_LICENSES.md`。
