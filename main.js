// Portfolio: progressive enhancement only. The page works fully without JS.

document.documentElement.classList.add('js');

// Fade sections in as they scroll into view (IntersectionObserver: no scroll listeners)
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// Project filters: show only cards whose data-tags include the chosen filter
const filterButtons = document.querySelectorAll('.filter');
const projectCards = document.querySelectorAll('#projects [data-tags]');
const filterStatus = document.getElementById('filter-status');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));

    let shown = 0;
    projectCards.forEach((card) => {
      const match = filter === 'all' || card.dataset.tags.split(' ').includes(filter);
      card.hidden = !match;
      if (match) shown++;
    });
    filterStatus.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}`;
  });
});

document.getElementById('year').textContent = new Date().getFullYear();
