// 配合 main/index.ts 里的 titleBarStyle: 'hidden' + titleBarOverlay：
// 系统只负责画右上角最小化/最大化/关闭三个按钮（颜色已经调成跟深色主题一致），
// 标题文字和"按住能拖动窗口"的区域都要靠这个组件自己在网页里画出来。
// `app-region: drag` 是 Electron 专门识别的 CSS 属性，划出的区域鼠标按下就能拖窗口；
// 里面如果放按钮之类需要点击的东西，要单独标 `app-region: no-drag`，否则点不到。
export function TitleBar(): React.JSX.Element {
  return (
    <div className="title-bar">
      <span className="title-bar-text">TtzChess</span>
    </div>
  )
}
