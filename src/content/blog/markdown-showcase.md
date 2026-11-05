---
title: 样式测试：Markdown 元素一览
description: 一篇用来检查排版的文章，把常用的 Markdown 元素都过一遍。
pubDate: 2026-11-04
tags: [写作, 测试]
---

这篇文章用来检查各种 Markdown 元素在这个主题下的样子。写新文章时可以拿它当参考。

## 文字与强调

普通段落文字。**粗体**、*斜体*、~~删除线~~、`行内代码`，以及一个[指向 Astro 文档的链接](https://docs.astro.build)。需要高亮时可以写 HTML：<mark>这是一段高亮</mark>，键盘按键是 <kbd>Ctrl</kbd> + <kbd>C</kbd>。

中英文混排 English mixed with 中文 也应该看起来自然，数字 2026 和单位 16px 同理。

## 列表

### 无序列表

- 第一项
- 第二项
  - 嵌套的子项
  - 另一个子项
- 第三项

### 有序列表

1. 打开终端
2. 运行 `npm run dev`
3. 在浏览器里访问 `localhost:4321`

### 任务列表

- [x] 已完成的任务
- [ ] 未完成的任务

## 引用

> 引用块会显示成一个带黄色边条的「注」面板。
>
> 可以有多个段落。

## 代码

TypeScript：

```ts
interface Operator {
  codename: string;
  level: number;
}

const me: Operator = { codename: 'H4MSTER22', level: 22 };
console.log(`${me.codename} online, Lv.${me.level}`);
```

Shell：

```bash
git add .
git commit -m "new log"
git push
```

Python：

```python
def decode(signal: str) -> str:
    return "".join(reversed(signal))

print(decode("enilno lanimret"))
```

## 表格

| 状态 | 含义 | 颜色 |
| --- | --- | --- |
| ACTIVE | 运行中 | 绿色 |
| PLANNED | 筹备中 | 青色 |
| ARCHIVED | 已归档 | 灰色 |

## 分割线

下面是一条分割线：

---

## 脚注

这句话有一个脚注[^1]。

[^1]: 脚注内容会出现在文章末尾。
