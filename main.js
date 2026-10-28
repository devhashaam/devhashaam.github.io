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

document.getElementById('year').textContent = new Date().getFullYear();
