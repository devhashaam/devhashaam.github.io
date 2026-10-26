// FinTrack dashboard: vanilla JS. Builds the chart as SVG, so no chart library is needed.

const spending = [3200, 1850, 4600, 2200, 5100, 7400, 2900, 1600, 3900, 2500, 6100, 4200, 3300, 5800];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const budgets = [
  { name: 'Groceries', spent: 21500, limit: 30000 },
  { name: 'Eating out', spent: 14200, limit: 15000 },
  { name: 'Transport', spent: 9800, limit: 12000 },
  { name: 'Shopping', spent: 18600, limit: 15000 },
];

const transactions = [
  { desc: 'Salary', cat: 'Income', date: '2026-10-01', amount: 165000 },
  { desc: 'Imtiaz Supermarket', cat: 'Groceries', date: '2026-10-24', amount: -6850 },
  { desc: 'Careem ride', cat: 'Transport', date: '2026-10-23', amount: -740 },
  { desc: 'Freelance project', cat: 'Income', date: '2026-10-20', amount: 20000 },
  { desc: 'Savour Foods', cat: 'Eating out', date: '2026-10-19', amount: -1980 },
  { desc: 'Daraz order', cat: 'Shopping', date: '2026-10-17', amount: -12400 },
  { desc: 'Electricity bill', cat: 'Bills', date: '2026-10-12', amount: -8900 },
];

const pkr = (n) => 'Rs ' + Math.abs(n).toLocaleString('en-PK');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ----- Count-up animation for stat cards -----
function countUp(el) {
  const target = Number(el.dataset.count);
  el.textContent = pkr(target); // final value first, in case animation frames never run (background tab)
  if (reducedMotion) return;
  const start = performance.now();
  const duration = 900;
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = pkr(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
document.querySelectorAll('[data-count]').forEach(countUp);

// ----- SVG bar chart -----
const chartEl = document.getElementById('chart');
const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function drawChart(range) {
  const data = spending.slice(-range);
  const W = 600, H = 220, padL = 40, padB = 24;
  const max = Math.ceil(Math.max(...data) / 2000) * 2000;
  const slot = (W - padL) / data.length;
  const barW = slot * 0.6;

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' });

  // Horizontal grid lines + y labels
  for (let v = 0; v <= max; v += max / 4) {
    const y = H - padB - (v / max) * (H - padB - 10);
    root.append(svg('line', { x1: padL, x2: W, y1: y, y2: y, class: 'grid-line' }));
    const label = svg('text', { x: 0, y: y + 4 });
    label.textContent = v >= 1000 ? `${v / 1000}k` : v;
    root.append(label);
  }

  data.forEach((value, i) => {
    const h = (value / max) * (H - padB - 10);
    const x = padL + i * slot + (slot - barW) / 2;
    const bar = svg('rect', { x, y: H - padB - h, width: barW, height: h, rx: 4, class: 'bar' });
    const title = svg('title', {});
    title.textContent = `${days[i % 7]}: ${pkr(value)}`;
    bar.append(title);
    root.append(bar);

    if (range <= 7 || i % 2 === 0) {
      const label = svg('text', { x: x + barW / 2, y: H - 6, 'text-anchor': 'middle' });
      label.textContent = days[i % 7];
      root.append(label);
    }
  });

  chartEl.replaceChildren(root);
  chartEl.setAttribute('aria-label', `Bar chart of daily spending over the last ${range} days, peaking at ${pkr(Math.max(...data))}`);
}

document.querySelectorAll('.segmented button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.segmented button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    drawChart(Number(btn.dataset.range));
  });
});
drawChart(7);

// ----- Budgets -----
document.getElementById('budget-list').innerHTML = budgets
  .map(({ name, spent, limit }) => {
    const pct = Math.round((spent / limit) * 100);
    const level = pct > 100 ? 'over' : pct >= 85 ? 'warn' : '';
    return `
      <li>
        <div class="budget-row"><span>${name}</span><span>${pkr(spent)} / ${pkr(limit)}</span></div>
        <div class="progress ${level}" role="progressbar" aria-label="${name}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div data-width="${Math.min(pct, 100)}%"></div>
        </div>
      </li>`;
  })
  .join('');

// Set widths after a short delay so the CSS transition runs from 0
setTimeout(() => {
  document.querySelectorAll('.progress > div').forEach((bar) => { bar.style.width = bar.dataset.width; });
}, 50);

// ----- Transactions table with filter -----
const txBody = document.getElementById('tx-body');
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function renderTransactions(filter) {
  const rows = transactions
    .filter((t) => filter === 'all' || (filter === 'in' ? t.amount > 0 : t.amount < 0))
    .sort((a, b) => b.date.localeCompare(a.date));

  txBody.innerHTML = rows
    .map((t) => `
      <tr>
        <td>${t.desc}</td>
        <td><span class="pill">${t.cat}</span></td>
        <td>${dateFmt.format(new Date(t.date))}</td>
        <td class="num ${t.amount > 0 ? 'amount-in' : ''}">${t.amount > 0 ? '+' : '−'}${pkr(t.amount)}</td>
      </tr>`)
    .join('');
}
document.getElementById('tx-filter').addEventListener('change', (e) => renderTransactions(e.target.value));
renderTransactions('all');

// ----- Theme toggle (remembers the choice) -----
document.getElementById('theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = isDark ? 'light' : 'dark';
  try { localStorage.setItem('fintrack-theme', root.dataset.theme); } catch (e) {}
});

// ----- Mobile sidebar -----
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');
const menuBtn = document.getElementById('menu-btn');

function setSidebar(open) {
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
scrim.addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSidebar(false); });
