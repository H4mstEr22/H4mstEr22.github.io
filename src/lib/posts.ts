import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS, type Section } from '../site.config';

export type Post = CollectionEntry<'blog'> & {
  /** 按发布时间从旧到新编号：LOG.0001 起 */
  logNo: string;
  /** 所属板块，由文章所在的文件夹决定 */
  section: Section;
  /** 文件名（不含扩展名和文件夹） */
  file: string;
  minutes: number;
  chars: number;
};

const CJK = /[㐀-鿿豈-﫿]/g;

export function readingStats(body = '') {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  const cjk = (text.match(CJK) ?? []).length;
  const words = (text.replace(CJK, ' ').match(/[A-Za-z0-9][\w'-]*/g) ?? []).length;
  return { chars: cjk + words, minutes: Math.max(1, Math.round(cjk / 400 + words / 220)) };
}

/** 文章 id 形如 "tech/terminal-online"，第一段是板块文件夹 */
function locate(entry: CollectionEntry<'blog'>) {
  const parts = entry.id.split('/');
  const section = SECTIONS.find((s) => s.id === parts[0]);
  if (parts.length < 2 || !section) {
    const ids = SECTIONS.map((s) => s.id).join('、');
    throw new Error(
      parts.length < 2
        ? `文章 ${entry.filePath} 没有放在板块文件夹里，请移到 src/content/blog/<板块>/ 下（现有板块：${ids}）。`
        : `文章 ${entry.filePath} 所在的文件夹「${parts[0]}」不是已配置的板块，请先在 src/site.config.ts 的 SECTIONS 里添加（现有板块：${ids}）。`,
    );
  }
  return { section, file: parts[parts.length - 1] };
}

/** 所有已发布文章，按时间倒序 */
export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  const asc = entries.sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
  return asc
    .map((entry, i) => ({
      ...entry,
      ...locate(entry),
      logNo: `LOG.${String(i + 1).padStart(4, '0')}`,
      ...readingStats(entry.body),
    }))
    .reverse();
}

export function getTags(posts: Post[]) {
  const map = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const fmtDate = (d: Date) =>
  `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;

/** 构建当天的日期（按站点时区，而不是构建机器的时区），格式 2026.11.05 */
export const fmtBuildDate = (timeZone = 'Asia/Shanghai') =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .replaceAll('-', '.');

/** 评分：整数原样显示，否则保留一位小数 */
export const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const postHref = (p: Post) => `/blog/${p.id}/`;
export const sectionHref = (s: Section) => `/blog/${s.id}/`;
export const tagHref = (t: string) => `/tags/${encodeURIComponent(t)}/`;
