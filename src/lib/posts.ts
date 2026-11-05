import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'> & {
  /** 按发布时间从旧到新编号：LOG.0001 起 */
  logNo: string;
  minutes: number;
  chars: number;
};

const CJK = /[㐀-鿿豈-﫿]/g;

export function readingStats(body = '') {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  const cjk = (text.match(CJK) ?? []).length;
  const words = (text.replace(CJK, ' ').match(/[A-Za-z0-9][\w'-]*/g) ?? []).length;
  return { chars: cjk + words, minutes: Math.max(1, Math.round(cjk / 400 + words / 220)) };
}

/** 所有已发布文章，按时间倒序 */
export async function getPosts(): Promise<Post[]> {
  const entries = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  const asc = entries.sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
  return asc
    .map((entry, i) => ({
      ...entry,
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

export const tagHref =(t: string) => `/tags/${encodeURIComponent(t)}/`;
