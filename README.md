# WordWander

WordWander 是一个本地优先的沉浸式小说打字练习工具。

## 启动开发环境

请在项目根目录执行：

```powershell
cd "D:\Study\项目实战\Projects\java_project\WordWander"
npm install
npm run dev
```

项目开发服务器固定使用：

```text
http://127.0.0.1:5173/
```

不要直接打开 `dist/index.html`，也不要使用之前缓存的 `5174` 页面。

如果提示端口被占用，先关闭旧的 Vite 进程：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173 | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force
}
npm run dev
```

如果页面看起来仍然是旧版本，在浏览器中执行一次强制刷新：

```text
Ctrl + Shift + R
```

或者打开开发者工具后长按刷新按钮，选择“清空缓存并硬性重新加载”。

## 构建

```bash
npm run build
```

## 当前功能

- 小说章节目录与章节切换
- 原文逐字高亮、正确/错误/待输入状态
- 中文输入法组合输入处理
- 输入法确认后继续追加文字
- 退格删除
- 练习暂停、重新开始、跳过段落
- WPM、准确率、错误数、练习时长与累计输入字数
- 夜间模式、字号调节、字体选择、响应式布局
- 本地 TXT 导入
- 使用浏览器 LocalStorage 自动保存当前输入和进度
