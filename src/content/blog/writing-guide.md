---
title: 写作指南：如何发布一篇新日志
description: 新建文件、填写元数据、本地预览、推送发布——四步完成。
pubDate: 2026-11-05
tags: [写作, 建站]
---

发布一篇新日志只需要四步。

## 新建文件

在 `src/content/blog/` 目录下新建一个 `.md` 文件。**文件名就是网址**，比如 `my-first-post.md` 会发布到 `/blog/my-first-post/`。文件名建议用英文小写和连字符。

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

日志编号（`LOG.0001` 这种）按发布日期自动生成，不需要手写。

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
