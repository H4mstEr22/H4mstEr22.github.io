/**
 * 站点配置 —— 个人信息都在这里改。
 * 带「占位」字样的内容请替换成你自己的。
 */

export const SITE = {
  title: 'H4mstEr22',
  codename: 'H4MSTER22',
  description: 'H4mstEr22 的个人终端：主页与博客。',
  url: 'https://h4mster22.github.io',
  author: 'H4mstEr22',
  /** 终端编号，纯装饰 */
  terminalId: 'H4-0022',
  tagline: '代码、游戏与生活的观测记录。',
  taglineEn: 'FIELD NOTES ON CODE, GAMES & EVERYDAY LIFE',
  timezone: 'Asia/Shanghai',
  timezoneLabel: 'UTC+8',
  since: 2026,
};

export const NAV = [
  { href: '/', en: 'HOME', cn: '主页' },
  { href: '/blog/', en: 'LOGS', cn: '日志' },
  { href: '/tags/', en: 'TAGS', cn: '标签' },
];

export const IDENTITY = [
  { k: 'CODENAME', cn: '代号', v: 'H4MSTER22' },
  { k: 'CLASS', cn: '职业', v: 'DEVELOPER / 开发者' },
  { k: 'SECTOR', cn: '区域', v: 'CN · UTC+8' },
  { k: 'SINCE', cn: '入职', v: '2026' },
];

export const PROFILE = {
  bio: [
    '你好，我是 H4mstEr22。这里是我的个人终端：存放做过的项目，记录学到的东西，偶尔也写点不那么正经的。',
    '（占位文字——在 src/site.config.ts 里改成你自己的介绍。）',
  ],
  facts: [
    { k: 'FIELD', cn: '领域', v: '软件开发（占位）' },
    { k: 'STACK', cn: '技术栈', v: 'TypeScript · Python · Go（占位）' },
    { k: 'INTEREST', cn: '兴趣', v: '游戏 · 设计 · 工业美学（占位）' },
    { k: 'STATUS', cn: '状态', v: '持续构建中' },
  ],
};

export type ProjectStatus = 'ACTIVE' | 'PLANNED' | 'ARCHIVED';

export const PROJECTS: {
  code: string;
  name: string;
  cn: string;
  desc: string;
  tags: string[];
  status: ProjectStatus;
  href?: string;
}[] = [
  {
    code: 'P-01',
    name: 'Personal Terminal',
    cn: '个人终端',
    desc: '就是你正在看的这个网站。Astro 构建，GitHub Pages 部署，工业终端风格。',
    tags: ['Astro', 'CSS', 'GitHub Pages'],
    status: 'ACTIVE',
    href: 'https://github.com/H4mstEr22/H4mstEr22.github.io',
  },
  {
    code: 'P-02',
    name: 'Project Placeholder',
    cn: '项目占位',
    desc: '占位项目。在 src/site.config.ts 的 PROJECTS 里换成你的真实项目。',
    tags: ['TypeScript'],
    status: 'PLANNED',
  },
  {
    code: 'P-03',
    name: 'Old Experiment',
    cn: '旧实验',
    desc: '占位项目。已归档的项目会显示为 ARCHIVED 状态。',
    tags: ['Python'],
    status: 'ARCHIVED',
  },
];

export const LINKS = [
  { en: 'GITHUB', cn: 'GitHub', handle: '@H4mstEr22', href: 'https://github.com/H4mstEr22' },
  { en: 'RSS', cn: '订阅', handle: '/rss.xml', href: '/rss.xml' },
  // { en: 'EMAIL', cn: '邮箱', handle: 'you@example.com', href: 'mailto:you@example.com' },
];
