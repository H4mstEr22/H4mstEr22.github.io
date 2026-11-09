import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** draft: true 的文章不会出现在构建结果里 */
    draft: z.boolean().default(false),
    /** 评测卡：写了就会在文章顶部显示评分，主要给游戏评测用 */
    review: z
      .object({
        game: z.string(),
        platform: z.string().optional(),
        /** 游玩时长（小时） */
        hours: z.number().positive().optional(),
        /** 0–10，可以带一位小数 */
        score: z.number().min(0).max(10),
        verdict: z.string().optional(),
        pros: z.array(z.string()).default([]),
        cons: z.array(z.string()).default([]),
      })
      .optional(),
  }),
});

export const collections = { blog };
