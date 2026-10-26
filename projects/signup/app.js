// Signup wizard: implements requirements.html (FR-1 … FR-10).
// Shows: per-step validation, error summary, focus management,
// password strength scoring, draft saving (never the password), review step.

const DRAFT_KEY = 'signup-draft';
const form = document.getElementById('wizard');
const f = form.elements;
const steps = [...document.querySelectorAll('.step')];
const progress = [...document.querySelectorAll('.steps li')];
const summary = document.getElementById('error-summary');
const LAST = steps.length - 1;
let current = 0;

// ----- Validation rules: one function per field, returns '' when valid (FR-3) -----
const rules = {
  email: (v) => (!v ? 'Enter your email address.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Enter an email like name@example.com.'),
  password: (v) => (v.length < 8 ? 'Password must be at least 8 characters.' : !/\d/.test(v) || !/[a-z]/i.test(v) ? 'Password needs at least one letter and one number.' : ''),
  confirm: (v) => (!v ? 'Confirm your password.' : v !== f.password.value ? 'Passwords do not match.' : ''),
  fullname: (v) => (v.trim().length < 3 ? 'Enter your full name.' : ''),
  phone: (v) => (!v.trim() || /^03\d{2}[\s-]?\d{7}$/.test(v.trim()) ? '' : 'Use the format 03xx xxxxxxx.'),
  city: (v) => (v ? '' : 'Choose your city.'),
  plan: (v) => (v ? '' : 'Choose a plan.'),
  terms: () => (f.terms.checked ? '' : 'You must agree to the terms to continue.'),
};
const STEP_FIELDS = [['email', 'password', 'confirm'], ['fullname', 'phone', 'city'], ['plan', 'terms']];
const LABELS = { email: 'Email', password: 'Password', confirm: 'Confirm password', fullname: 'Full name', phone: 'Mobile number', city: 'City', plan: 'Plan', terms: 'Terms' };

function validateField(name) {
  const message = rules[name](f[name].value);
  document.getElementById(`${name}-err`).textContent = message;
  const el = name === 'plan' ? null : f[name];
  if (el) el.setAttribute('aria-invalid', String(Boolean(message)));
  return message;
}

function validateStep(i) {
  const errors = (STEP_FIELDS[i] || [])
    .map((name) => ({ name, message: validateField(name) }))
    .filter((e) => e.message);

  // FR-4: an error summary at the top, linking to each field, receives focus
  if (errors.length) {
    summary.innerHTML = `<p>Please fix ${errors.length} ${errors.length === 1 ? 'problem' : 'problems'}:</p><ul>${errors
      .map((e) => `<li><a href="#${e.name === 'plan' ? 'plan-err' : e.name}">${e.message}</a></li>`)
      .join('')}</ul>`;
    summary.hidden = false;
    summary.focus();
  } else {
    summary.hidden = true;
  }
  return errors.length === 0;
}

// Validate a field when the user leaves it; re-check it live once it has shown an error
Object.keys(rules).forEach((name) => {
  const els = f[name] instanceof RadioNodeList ? [...f[name]] : [f[name]];
  els.forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || name === 'terms') validateField(name); });
    el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true' || name === 'plan') validateField(name);
      if (name === 'password' && f.confirm.value) validateField('confirm');
      saveDraft();
    });
    el.addEventListener('change', saveDraft);
  });
});

summary.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();
  const target = document.querySelector(link.getAttribute('href'));
  (target.id === 'plan-err' ? f.plan[0] : target).focus();
});

// ----- Navigation -----
function show(i) {
  current = i;
  steps.forEach((s, n) => { s.hidden = n !== i; });
  progress.forEach((li, n) => {
    li.classList.toggle('complete', n < i);
    if (n === i) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  });
  document.getElementById('back').hidden = i === 0;
  document.getElementById('next').textContent = i === LAST ? 'Create account' : 'Continue';
  summary.hidden = true;
  if (i === LAST) renderReview();

  // FR-6: move focus to the new step's first field (or its heading)
  const first = steps[i].querySelector('input, select, h2');
  if (first.tagName === 'H2') first.tabIndex = -1;
  first.focus();
  saveDraft();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (current < LAST) {
    if (validateStep(current)) show(current + 1);
    return;
  }
  // FR-9: a real app would POST here, e.g. fetch('/api/signup', { method: 'POST', body: new FormData(form) })
  complete();
});

document.getElementById('back').addEventListener('click', () => show(current - 1));

// ----- Review step (FR-8) -----
function renderReview() {
  const rows = [
    ['email', f.email.value, 0],
    ['fullname', f.fullname.value, 1],
    ['phone', f.phone.value || 'Not given', 1],
    ['city', f.city.value, 1],
    ['plan', f.plan.value, 2],
  ];
  const review = document.getElementById('review');
  review.innerHTML = '';
  rows.forEach(([name, value, step], i) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = LABELS[name];
    dd.textContent = value; // textContent: user input is never parsed as HTML
    review.append(dt, dd);
    const nextRow = rows[i + 1];
    if (!nextRow || nextRow[2] !== step) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'edit';
      edit.textContent = `Edit step ${step + 1}`;
      edit.addEventListener('click', () => show(step));
      review.append(edit);
    }
  });
}

// ----- Password strength (FR-5) -----
const meterBar = document.getElementById('meter-bar');
const strengthText = document.getElementById('pw-strength');

f.password.addEventListener('input', () => {
  const v = f.password.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (v.length >= 12) score++;
  if (/\d/.test(v) && /[a-z]/i.test(v)) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/[^a-z0-9]/i.test(v)) score++;

  const levels = [['', '0%', 'var(--error)'], ['Weak', '25%', 'var(--error)'], ['Fair', '50%', '#d97706'], ['Good', '75%', '#65a30d'], ['Strong', '100%', 'var(--ok)']];
  const [label, width, color] = levels[Math.min(score, 4)];
  meterBar.style.width = v ? width : '0%';
  meterBar.style.background = color;
  strengthText.textContent = v ? `Strength: ${label || 'Weak'}.` : '';
});

document.querySelector('.pw-toggle').addEventListener('click', (e) => {
  const showing = f.password.type === 'text';
  f.password.type = showing ? 'password' : 'text';
  e.currentTarget.textContent = showing ? 'Show' : 'Hide';
  e.currentTarget.setAttribute('aria-pressed', String(!showing));
});

// ----- Draft: restored after a reload, passwords never stored (FR-7) -----
function saveDraft() {
  const { email, fullname, phone, city, plan } = f;
  const draft = { email: email.value, fullname: fullname.value, phone: phone.value, city: city.value, plan: plan.value };
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function restoreDraft() {
  let d;
  try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch {}
  if (!d) return;
  ['email', 'fullname', 'phone', 'city'].forEach((k) => { f[k].value = d[k] || ''; });
  if (d.plan) f.plan.value = d.plan;
}

// ----- Completion (FR-10) -----
function complete() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  form.hidden = true;
  document.querySelector('.steps').hidden = true;
  const done = document.getElementById('done');
  document.getElementById('done-text').textContent = `Welcome, ${f.fullname.value.trim().split(' ')[0]}! Your ${f.plan.value} account for ${f.email.value} is ready.`;
  done.hidden = false;
  done.focus();
}

document.getElementById('restart').addEventListener('click', () => {
  form.reset();
  form.hidden = false;
  document.querySelector('.steps').hidden = false;
  document.getElementById('done').hidden = true;
  meterBar.style.width = '0%';
  strengthText.textContent = '';
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.err').forEach((el) => { el.textContent = ''; });
  show(0);
});

restoreDraft();
show(0);
