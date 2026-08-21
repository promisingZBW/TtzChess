#!/usr/bin/env node
// 阶段6：一次性下载官方Pikafish发布包，解压出这个项目需要的几个东西，放进
// resources/engines/pikafish/ 目录。这些文件不随git提交（二进制+53MB的nnue权重文件，
// 详见 resources/engines/README.md），所以每个开发者clone仓库之后要自己跑一次：
//
//   npm run setup:pikafish
//
// 官方发布包（.7z格式）里同时打包了Windows/Linux/MacOS/Android全部指令集变体，
// 这个脚本只挑本项目实际用得到的三个桌面平台、每个平台留几个从"快"到"最保险"的变体，
// 具体启动时用哪个由 EngineService 在运行时自动挑（见 pikafishLocator.ts 的注释）。
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, cp, rm, chmod } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sevenBin from '7zip-bin'

const RELEASE_TAG = 'Pikafish-2026-01-02'
const ASSET_NAME = 'Pikafish.2026-01-02.7z'
const DOWNLOAD_URL = `https://github.com/official-pikafish/Pikafish/releases/download/${RELEASE_TAG}/${ASSET_NAME}`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const engineRootDir = path.join(projectRoot, 'resources', 'engines', 'pikafish')
const tmpDir = path.join(projectRoot, 'resources', 'engines', '.tmp-setup')
const archivePath = path.join(tmpDir, ASSET_NAME)
const extractDir = path.join(tmpDir, 'extracted')

function downloadFile(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'chessoc-setup-script' } }, (response) => {
      const { statusCode, headers } = response
      if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
        response.resume() // 丢弃这次响应体，跟着Location头再发一次请求
        if (redirectsLeft <= 0) {
          reject(new Error('重定向次数太多，下载失败'))
          return
        }
        downloadFile(headers.location, destPath, redirectsLeft - 1).then(resolve, reject)
        return
      }
      if (statusCode !== 200) {
        reject(new Error(`下载失败，HTTP状态码 ${statusCode}：${url}`))
        return
      }
      const fileStream = createWriteStream(destPath)
      response.pipe(fileStream)
      fileStream.on('finish', () => fileStream.close(() => resolve()))
      fileStream.on('error', reject)
    })
    request.on('error', reject)
  })
}

function extract7z(archive, destDir) {
  return new Promise((resolve, reject) => {
    execFile(sevenBin.path7za, ['x', archive, `-o${destDir}`, '-y'], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`解压失败：${stderr || err.message}`))
        return
      }
      resolve(stdout)
    })
  })
}

/** windows二进制不需要额外的可执行权限；Linux/macOS这边要手动chmod +x，不然直接spawn会报EACCES */
async function copyBinary(fromDir, fromName, toDir, toName) {
  const from = path.join(fromDir, fromName)
  const to = path.join(toDir, toName)
  await mkdir(toDir, { recursive: true })
  await cp(from, to)
  await chmod(to, 0o755)
}

async function main() {
  console.log(`即将下载 Pikafish ${RELEASE_TAG}（约55MB，来自GitHub官方releases）...`)
  await mkdir(tmpDir, { recursive: true })
  await downloadFile(DOWNLOAD_URL, archivePath)
  console.log('下载完成，开始解压...')
  await extract7z(archivePath, extractDir)

  await mkdir(engineRootDir, { recursive: true })

  // 神经网络权重文件：放在pikafish目录这一层（不是某个平台子目录），
  // 因为引擎官方文档写明EvalFile会搜索"进程工作目录"，EngineService启动子进程时
  // 会把cwd设成engineRootDir，三个平台的二进制共用这一份文件，不用重复拷贝
  await cp(path.join(extractDir, 'pikafish.nnue'), path.join(engineRootDir, 'pikafish.nnue'))

  // GPL v3合规要求的license文件，跟二进制放一起（这几个是文本文件，体积很小，
  // 项目根目录下的 THIRD_PARTY_LICENSES.md 里也有一份书面声明，两边信息对应）
  for (const licenseFile of ['Copying.txt', 'AUTHORS', 'NNUE-License.md']) {
    await cp(path.join(extractDir, licenseFile), path.join(engineRootDir, licenseFile))
  }

  const windowsDir = path.join(engineRootDir, 'Windows')
  await mkdir(windowsDir, { recursive: true })
  for (const variant of ['avx2', 'bmi2', 'sse41-popcnt']) {
    await cp(
      path.join(extractDir, 'Windows', `pikafish-${variant}.exe`),
      path.join(windowsDir, `pikafish-${variant}.exe`)
    )
  }

  for (const variant of ['avx2', 'bmi2', 'sse41-popcnt']) {
    await copyBinary(
      path.join(extractDir, 'Linux'),
      `pikafish-${variant}`,
      path.join(engineRootDir, 'Linux'),
      `pikafish-${variant}`
    )
  }

  await copyBinary(
    path.join(extractDir, 'MacOS'),
    'pikafish-apple-silicon',
    path.join(engineRootDir, 'MacOS'),
    'pikafish-apple-silicon'
  )

  await rm(tmpDir, { recursive: true, force: true })

  console.log('')
  console.log(`Pikafish引擎已就绪：${engineRootDir}`)
  console.log('现在可以正常使用"AI分析"相关功能了，npm run dev 启动应用即可。')
}

if (existsSync(path.join(engineRootDir, 'pikafish.nnue'))) {
  console.log(`检测到已经下载过引擎（${engineRootDir} 已存在pikafish.nnue），跳过本次下载。`)
  console.log('如果想重新下载，先删除这个目录再重新运行本脚本。')
} else {
  main().catch((err) => {
    console.error('下载/解压Pikafish引擎失败：')
    console.error(err)
    process.exitCode = 1
  })
}
