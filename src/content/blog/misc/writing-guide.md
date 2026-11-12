---
title: 写作指南：如何发布一篇新日志
description: 选板块、新建文件、填写元数据、本地预览、推送发布。
pubDate: 2026-11-05
updatedDate: 2026-11-12
tags: [写作, 建站]
---

发布一篇新日志只需要几步。

## 选板块，新建文件

文章按板块放在不同的文件夹里，**放进哪个文件夹，就属于哪个板块**：

| 板块 | 文件夹 | 网址 |
| --- | --- | --- |
| 技术博客 | `src/content/blog/tech/` | `/blog/tech/` |
| 技术文档 | `src/content/blog/docs/` | `/blog/docs/` |
| 游戏评测 | `src/content/blog/games/` | `/blog/games/` |
| 搞七捻三 | `src/content/blog/misc/` | `/blog/misc/` |

**文件名就是网址**，比如 `tech/my-first-post.md` 会发布到 `/blog/tech/my-first-post/`。文件名建议用英文小写和连字符。

## 填写元数据

文件开头用 `---` 包起来的部分叫 frontmatter：

```md
---
title: 文章标题
description: 一句话简介，会显示在列表和搜索结果里
pubDate: 2026-11-05
tags: [标签一, 标签二]
---

正文从这里开始……
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `description` | 是 | 简介 |
| `pubDate` | 是 | 发布日期，格式 `YYYY-MM-DD` |
| `updatedDate` | 否 | 更新日期 |
| `tags` | 否 | 标签列表，会自动生成标签页 |
| `draft` | 否 | 设为 `true` 时只在本地预览可见，不会发布 |
| `review` | 否 | 评测卡，见下一节 |

日志编号（`LOG.0001` 这种）按发布日期自动生成，不需要手写。

正文支持 GitHub 风格的提示块，从 GitHub 上搬过来的文档可以直接用：

```md
> [!NOTE]
> 普通提示。另有 [!TIP]、[!IMPORTANT]、[!WARNING]、[!CAUTION]。
```

## 游戏评测的评测卡

写了 `review` 的文章，正文上方会出现一张评测卡，列表里也会显示分数：

```md
review:
  game: 游戏名
  platform: PC / Switch
  hours: 40
  score: 8.5
  verdict: 一句话结论
  pros: [优点一, 优点二]
  cons: [缺点一]
```

只有 `game` 和 `score` 必填，`score` 是 0–10 的数字，可以带一位小数。`games/review-template.md` 是一份写好的模板（草稿，不会发布），复制它就能开始写。

## 新增板块

1. 在 `src/site.config.ts` 的 `SECTIONS` 里加一项，比如 `{ id: 'anime', en: 'Anime', cn: '番剧', desc: '……' }`；
2. 新建 `src/content/blog/anime/` 文件夹，把文章放进去。

导航栏、首页的板块卡片、板块列表页都会自动生成。板块多到导航栏放不下时，导航会自动收进右上角的菜单；也可以给不常用的板块加上 `nav: false`，让它只出现在首页和日志页。

## 本地预览

```bash
npm install   # 第一次需要
npm run dev
```

然后打开 `http://localhost:4321`，保存文件后页面会自动刷新。

## 推送发布

```bash
git add .
git commit -m "log: 文章标题"
git push
```

推送后 GitHub Actions 会自动构建，一两分钟后新文章就上线了。可以在仓库的 **Actions** 标签页查看构建进度。

> 图片放在 `public/images/` 下，文章里用 `![说明](/images/文件名.png)` 引用。
