// Chai Corner: small, dependency-free JavaScript.

// ----- Mobile navigation -----
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');

function setMenu(open) {
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

toggle.addEventListener('click', () => {
  setMenu(toggle.getAttribute('aria-expanded') !== 'true');
});

// Close the menu after tapping a link (event delegation: one listener on the parent)
nav.addEventListener('click', (e) => {
  if (e.target.matches('a')) setMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenu(false);
});

// ----- Accessible menu tabs -----
const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab) {
  tabs.forEach((t) => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  });
  tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') selectTab(tabs[(i + 1) % tabs.length]);
    if (e.key === 'ArrowLeft') selectTab(tabs[(i - 1 + tabs.length) % tabs.length]);
  });
});

// ----- Booking form validation -----
const form = document.querySelector('.contact-form');
const status = form.querySelector('.form-status');

const rules = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
  // Pakistani mobile: 03xx xxxxxxx, spaces/dashes allowed
  phone: (v) => (/^03\d{2}[\s-]?\d{7}$/.test(v.trim()) ? '' : 'Use the format 03xx xxxxxxx.'),
};

function validateField(input) {
  const message = rules[input.name](input.value);
  document.getElementById(`${input.name}-error`).textContent = message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
  return !message;
}

Object.keys(rules).forEach((name) => {
  form.elements[name].addEventListener('blur', (e) => validateField(e.target));
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = Object.keys(rules).map((name) => form.elements[name]);
  const allValid = fields.map(validateField).every(Boolean);

  if (!allValid) {
    fields.find((f) => f.getAttribute('aria-invalid') === 'true').focus();
    status.textContent = '';
    return;
  }

  // A real site would POST to a back-end here, e.g. fetch('/api/bookings', { method: 'POST', body: new FormData(form) })
  status.textContent = `Thanks ${form.elements.name.value.trim()}! We'll call you to confirm.`;
  form.reset();
});

// ----- Footer year -----
document.getElementById('year').textContent = new Date().getFullYear();
