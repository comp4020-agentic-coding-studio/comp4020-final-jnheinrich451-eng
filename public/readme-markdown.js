// Renders README.md for /readme/. It covers what the README uses: headings,
// paragraphs, lists, tables, emphasis, code and links. All source text is escaped.
const REPO = 'https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/blob/main/';
const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
const LIST_ITEM = /^\s*[-*]\s+/;

const escapeHtml = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The game serves this page, so repository paths have to lead to GitHub.
function target(url) {
  if (/^https?:/.test(url) || /^[/#]/.test(url)) return escapeHtml(url);
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? '#' : escapeHtml(REPO + url);
}

function inline(source) {
  let html = '', at = 0;
  for (const m of source.matchAll(INLINE)) {
    html += escapeHtml(source.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[1]) html += `<code>${escapeHtml(m[1])}</code>`;
    else if (m[2]) html += `<a href="${target(m[3])}">${inline(m[2])}</a>`;
    else if (m[4]) html += `<strong>${inline(m[4])}</strong>`;
    else html += `<em>${inline(m[5])}</em>`;
  }
  return html + escapeHtml(source.slice(at));
}

const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => inline(cell.trim()));
const startsBlock = line => /^#{1,6}\s/.test(line) || LIST_ITEM.test(line) || line.startsWith('|');

export function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/), html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i], heading = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (!line.trim()) { i++; continue; }
    if (heading) {
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      i++;
    } else if (LIST_ITEM.test(line)) {
      const items = [];
      for (; i < lines.length && (LIST_ITEM.test(lines[i]) || /^\s+\S/.test(lines[i])); i++) {
        if (LIST_ITEM.test(lines[i])) items.push(lines[i].replace(LIST_ITEM, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
      }
      html.push(`<ul>${items.map(item => `<li>${inline(item)}</li>`).join('')}</ul>`);
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      html.push(`<table><thead><tr>${cells(head).map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${cells(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    } else {
      const text = [];
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) text.push(lines[i++].trim());
      html.push(`<p>${inline(text.join(' '))}</p>`);
    }
  }
  return html.join('\n');
}
