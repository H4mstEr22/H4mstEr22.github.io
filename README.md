# H4MSTER22 // Personal Terminal

H4mstEr22 的个人网站（主页 + 博客），线上地址：<https://h4mster22.github.io>

工业科幻终端风格，Astro 构建，GitHub Actions 自动部署到 GitHub Pages。

## 常用命令

```bash
npm install      # 安装依赖（首次）
npm run dev      # 本地开发，访问 http://localhost:4321
npm run build    # 构建到 dist/
npm run preview  # 预览构建结果
```

## 改什么去哪里

| 想改的内容 | 文件 |
| --- | --- |
| 名字、简介、身份卡、能力雷达、项目、联系方式 | `src/site.config.ts` |
| 写文章 | `src/content/blog/*.md`（参考站内的《写作指南》） |
| 颜色、字体等设计变量 | `src/styles/global.css` 顶部的 `:root` |
| 文章排版 | `src/styles/prose.css` |
| 首页结构 | `src/pages/index.astro` |

## 发布

推送到 `main` 分支即可，`.github/workflows/deploy.yml` 会自动构建并部署。
仓库 **Settings → Pages → Source** 需要设为 **GitHub Actions**。

## 目录

```
src/
├─ site.config.ts        个人信息配置
├─ content.config.ts     博客 frontmatter 定义
├─ content/blog/         文章（Markdown）
├─ components/           组件（页头、页脚、雷达图、条码……）
├─ layouts/Base.astro    页面骨架
├─ lib/posts.ts          文章排序、编号、阅读时间
├─ pages/                路由：首页、/blog、/tags、RSS、404
├─ scripts/ui.ts         主题切换、时钟、动效
└─ styles/               全局样式、文章排版
```
