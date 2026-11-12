/**
 * GitHub 风格的提示块：
 *
 *   > [!NOTE]
 *   > 内容
 *
 * 支持 NOTE / TIP / IMPORTANT / WARNING / CAUTION。
 * 会去掉开头的 [!TYPE] 标记，并给 blockquote 加上 data-alert="note" 等属性，样式在 prose.css 里。
 */
const MARK = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n?/i;

/** @type {import('satteri').HastPluginDefinition} */
export const githubAlerts = {
  name: 'github-alerts',
  element: {
    filter: ['blockquote'],
    visit(node, ctx) {
      const first = node.children.find((c) => c.type === 'element' || (c.type === 'text' && c.value.trim()));
      if (first?.type !== 'element' || first.tagName !== 'p') return;
      const head = first.children[0];
      const m = head?.type === 'text' ? head.value.match(MARK) : null;
      if (!m) return;

      ctx.setProperty(node, 'dataAlert', m[1].toLowerCase());
      const rest = head.value.slice(m[0].length);
      if (!rest.trim() && first.children.length === 1) {
        // 「> [!NOTE]」单独占一段：整段去掉
        ctx.removeNode(first);
      } else if (rest) {
        ctx.setProperty(head, 'value', rest);
      } else {
        // 标记后面紧跟换行 <br> 或别的元素：只去掉标记本身和紧随的 <br>
        ctx.removeNode(head);
        const next = first.children[1];
        if (next?.type === 'element' && next.tagName === 'br') ctx.removeNode(next);
      }
    },
  },
};
