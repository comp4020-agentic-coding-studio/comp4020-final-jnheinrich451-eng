import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { renderMarkdown } from '../public/readme-markdown.js';

const page = (markdown: string) => new JSDOM(renderMarkdown(markdown)).window.document;

it('renders the README as a page instead of raw markdown', () => {
  const body = page(readFileSync('README.md', 'utf8')).body;
  expect(body.querySelectorAll('h1')).toHaveLength(1);
  expect(body.querySelectorAll('h2').length).toBeGreaterThan(2);
  expect(body.querySelector('table th')?.getAttribute('scope')).toBe('col');
  expect(body.textContent).not.toMatch(/\*\*|^#{1,6}\s|\]\(/m);
});

it('sends repository paths to GitHub, keeps web links and drops other schemes', () => {
  const links = [...page('[a](spec/x.ts#L2) [b](https://example.com/) [c](javascript:alert)').querySelectorAll('a')];
  expect(links.map(a => a.getAttribute('href'))).toEqual([
    'https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/blob/main/spec/x.ts#L2',
    'https://example.com/',
    '#',
  ]);
});

it('escapes HTML in the source', () => {
  const document = page('<script>alert(1)</script> **<b>bold</b>** `<i>`');
  expect(document.querySelector('script, b, i')).toBeNull();
  expect(document.querySelector('strong')?.textContent).toBe('<b>bold</b>');
  expect(document.querySelector('code')?.textContent).toBe('<i>');
});

it('keeps wrapped list items and table cells whole', () => {
  const document = page('- first\n  line\n- second\n\n| A | B |\n| --- | --- |\n| `1` | [2](/) |\n');
  expect([...document.querySelectorAll('li')].map(li => li.textContent)).toEqual(['first line', 'second']);
  expect([...document.querySelectorAll('td')].map(td => td.textContent)).toEqual(['1', '2']);
});
