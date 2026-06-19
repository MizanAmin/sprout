// Browser print-to-PDF. Renders an HTML document in a hidden iframe and calls
// print() — the user picks "Save as PDF" (or a printer). No server-side PDF lib.

import { fmtDate } from './date';

export function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 32px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 18px; font-weight: 800; color: #4f46e5; }
  .muted { color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  th { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
  .right { text-align: right; }
  .totals td { border-bottom: none; font-weight: 700; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .green { background: #d1fae5; color: #065f46; }
  .amber { background: #fef3c7; color: #92400e; }
  .red { background: #fee2e2; color: #991b1b; }
  .grey { background: #f1f5f9; color: #475569; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0 16px; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
  .card .v { font-size: 20px; font-weight: 800; }
  .card .l { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
  .bar-wrap { background: #f1f5f9; border-radius: 6px; height: 8px; overflow: hidden; }
  .bar { background: #4f46e5; height: 100%; }
  @media print { body { margin: 12mm; } @page { margin: 12mm; } }
`;

// Standard document header (brand + title on the left, subtitle + date on the right).
export function printHeader(title: string, subtitle?: string): string {
  const date = fmtDate(new Date());
  return `<div class="doc-head">
    <div><div class="brand"><img src="/sprout-icon.png" alt="" style="width:18px;height:18px;border-radius:4px;vertical-align:-3px;margin-right:6px">Sprout</div><h1>${escapeHtml(title)}</h1></div>
    <div class="muted" style="text-align:right">${subtitle ? escapeHtml(subtitle) + '<br>' : ''}Generated ${date}</div>
  </div>`;
}

export function printDocument(title: string, bodyHtml: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<link rel="preconnect" href="https://fonts.googleapis.com">` +
      `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">` +
      `<style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`,
  );
  doc.close();
  // Give fonts/layout a moment, then print and clean up.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 350);
}
