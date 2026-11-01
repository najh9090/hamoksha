// Small DOM helpers shared by all modules.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;
export const stripEmoji = (s) => String(s ?? '').replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trim();

export function toast(message, kind = 'info') {
  const box = $('#toasts');
  const n = el('div', `toast toast-${kind}`, message);
  box.appendChild(n);
  setTimeout(() => n.classList.add('out'), 3800);
  setTimeout(() => n.remove(), 4300);
}

// Renders plain text safely: paragraphs, `inline code` and ```fenced code```.
export function renderRich(text, container) {
  container.textContent = '';
  const parts = String(text).split(/```[\w+-]*\n?([\s\S]*?)```/g);
  // After split with one capture group: even index = prose, odd index = code
  parts.forEach((chunk, i) => {
    if (i % 2 === 1) {
      const pre = el('pre');
      const code = el('code', '', chunk.replace(/\n$/, ''));
      code.dir = 'ltr';
      pre.appendChild(code);
      container.appendChild(pre);
      return;
    }
    chunk
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((para) => {
        const p = el('p');
        p.dir = 'auto';
        para.split(/(`[^`\n]+`)/g).forEach((seg) => {
          if (seg.length > 2 && seg.startsWith('`') && seg.endsWith('`')) {
            p.appendChild(el('code', 'inline', seg.slice(1, -1)));
          } else {
            p.appendChild(document.createTextNode(seg));
          }
        });
        container.appendChild(p);
      });
  });
}

export function timeLabel(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}
