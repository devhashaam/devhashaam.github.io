// Skies: weather app on the free Open-Meteo REST API (no key needed).
// Shows: fetch + async/await, AbortController, debounced autocomplete,
// keyboard-accessible listbox, geolocation, sessionStorage caching.

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MS = 10 * 60 * 1000; // reuse a forecast for 10 minutes

const $ = (id) => document.getElementById(id);
const input = $('city');
const list = $('suggestions');
const statusEl = $('status');

let unit = readPref('skies-unit') || 'celsius';
let place = readPref('skies-place', true) || { name: 'Islamabad', country: 'Pakistan', latitude: 33.6844, longitude: 73.0479 };
let suggestions = [];
let activeIndex = -1;

// WMO weather codes → label, icon, background theme
const CODES = {
  0: ['Clear sky', '☀️', 'clear'], 1: ['Mainly clear', '🌤️', 'clear'], 2: ['Partly cloudy', '⛅', 'cloudy'],
  3: ['Overcast', '☁️', 'cloudy'], 45: ['Fog', '🌫️', 'cloudy'], 48: ['Rime fog', '🌫️', 'cloudy'],
  51: ['Light drizzle', '🌦️', 'rain'], 53: ['Drizzle', '🌦️', 'rain'], 55: ['Heavy drizzle', '🌧️', 'rain'],
  61: ['Light rain', '🌦️', 'rain'], 63: ['Rain', '🌧️', 'rain'], 65: ['Heavy rain', '🌧️', 'rain'],
  71: ['Light snow', '🌨️', 'snow'], 73: ['Snow', '🌨️', 'snow'], 75: ['Heavy snow', '❄️', 'snow'],
  80: ['Rain showers', '🌦️', 'rain'], 81: ['Rain showers', '🌧️', 'rain'], 82: ['Violent showers', '⛈️', 'storm'],
  95: ['Thunderstorm', '⛈️', 'storm'], 96: ['Thunderstorm, hail', '⛈️', 'storm'], 99: ['Thunderstorm, hail', '⛈️', 'storm'],
};
const describe = (code) => CODES[code] || ['Unknown', '🌡️', 'cloudy'];

// ----- Fetch helpers -----
async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function loadForecast(p) {
  const key = `skies-wx-${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}-${unit}`;
  const cached = readCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    latitude: p.latitude,
    longitude: p.longitude,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    temperature_unit: unit,
    timezone: 'auto',
  });
  const data = await getJSON(`${WX_URL}?${params}`);
  writeCache(key, data);
  return data;
}

// ----- Render -----
async function showWeather(p) {
  place = p;
  writePref('skies-place', p);
  document.body.classList.add('loading');
  setStatus('Loading weather…');

  try {
    const data = await loadForecast(p);
    render(p, data);
    setStatus('');
  } catch (err) {
    setStatus(`Couldn't load the weather. ${navigator.onLine ? 'Please try again.' : 'You appear to be offline.'}`, true);
  } finally {
    document.body.classList.remove('loading');
  }
}

function render(p, data) {
  const c = data.current;
  const [label, icon, sky] = describe(c.weather_code);
  const symbol = unit === 'celsius' ? '°C' : '°F';

  document.body.dataset.sky = c.is_day ? sky : 'night';
  $('place').textContent = [p.name, p.admin1, p.country].filter(Boolean).join(', ');
  $('desc').textContent = label;
  $('temp').textContent = Math.round(c.temperature_2m);
  document.querySelector('.unit-label').textContent = symbol;
  $('feels').textContent = `Feels like ${Math.round(c.apparent_temperature)}${symbol}`;
  $('icon').textContent = c.is_day ? icon : (c.weather_code <= 1 ? '🌙' : icon);
  $('humidity').textContent = `${c.relative_humidity_2m}%`;
  $('wind').textContent = `${Math.round(c.wind_speed_10m)} km/h`;
  $('updated').textContent = new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Temperature bars are scaled to the week's overall range
  const { time, temperature_2m_max: hi, temperature_2m_min: lo, weather_code: codes } = data.daily;
  const weekMin = Math.min(...lo);
  const weekMax = Math.max(...hi);
  const span = weekMax - weekMin || 1;
  const dayName = new Intl.DateTimeFormat([], { weekday: 'short' });

  $('week').innerHTML = time
    .map((t, i) => {
      const [dLabel, dIcon] = describe(codes[i]);
      const left = ((lo[i] - weekMin) / span) * 100;
      const width = ((hi[i] - lo[i]) / span) * 100;
      return `
        <li>
          <span class="day">${i === 0 ? 'Today' : dayName.format(new Date(t + 'T12:00'))}</span>
          <span class="ico" role="img" aria-label="${dLabel}">${dIcon}</span>
          <span class="range">
            <span class="lo" aria-label="Low">${Math.round(lo[i])}°</span>
            <span class="bar" aria-hidden="true"><span style="left:${left}%;width:${width}%"></span></span>
            <span class="hi" aria-label="High">${Math.round(hi[i])}°</span>
          </span>
        </li>`;
    })
    .join('');

  $('current').hidden = false;
  $('week-section').hidden = false;
  document.title = `${Math.round(c.temperature_2m)}${symbol} ${p.name} | Skies`;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

// ----- City autocomplete (debounced, cancels stale requests) -----
let debounceTimer;
let controller;

input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  if (q.length < 2) return closeList();

  debounceTimer = setTimeout(async () => {
    controller?.abort(); // a newer keystroke wins over an older, slower response
    controller = new AbortController();
    try {
      const data = await getJSON(`${GEO_URL}?${new URLSearchParams({ name: q, count: 6 })}`, controller.signal);
      suggestions = data.results || [];
      renderList();
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('City search is unavailable right now.', true);
    }
  }, 300);
});

function renderList() {
  activeIndex = -1;
  if (!suggestions.length) {
    list.innerHTML = '<li role="option" aria-disabled="true">No matches</li>';
  } else {
    list.innerHTML = suggestions
      .map((s, i) => `<li role="option" id="opt-${i}" data-i="${i}">${s.name} <small>${[s.admin1, s.country].filter(Boolean).join(', ')}</small></li>`)
      .join('');
  }
  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function closeList() {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

function choose(i) {
  const s = suggestions[i];
  if (!s) return;
  input.value = '';
  closeList();
  showWeather({ name: s.name, admin1: s.admin1, country: s.country, latitude: s.latitude, longitude: s.longitude });
}

// Arrow keys + Enter + Escape, like a native combobox
input.addEventListener('keydown', (e) => {
  if (list.hidden || !suggestions.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === activeIndex)));
    input.setAttribute('aria-activedescendant', `opt-${activeIndex}`);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    choose(activeIndex >= 0 ? activeIndex : 0);
  } else if (e.key === 'Escape') {
    closeList();
  }
});

list.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) choose(Number(li.dataset.i));
});
input.addEventListener('blur', () => setTimeout(closeList, 100));
$('search-form').addEventListener('submit', (e) => e.preventDefault());

// ----- Geolocation -----
$('locate').addEventListener('click', () => {
  if (!('geolocation' in navigator)) return setStatus('Location is not supported in this browser.', true);
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => showWeather({ name: 'Your location', latitude: coords.latitude, longitude: coords.longitude }),
    () => setStatus('Location permission was denied. Search for a city instead.', true),
    { timeout: 10000 }
  );
});

// ----- Units -----
document.querySelectorAll('.units button').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(btn.dataset.unit === unit));
  btn.addEventListener('click', () => {
    unit = btn.dataset.unit;
    writePref('skies-unit', unit);
    document.querySelectorAll('.units button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    showWeather(place);
  });
});

// ----- Storage helpers (storage can be blocked, so never let it break the app) -----
function readPref(key, json = false) {
  try {
    const v = localStorage.getItem(key);
    return json ? JSON.parse(v) : v;
  } catch { return null; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch {}
}
function readCache(key) {
  try {
    const hit = JSON.parse(sessionStorage.getItem(key));
    return hit && Date.now() - hit.at < CACHE_MS ? hit.data : null;
  } catch { return null; }
}
function writeCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
}

showWeather(place);
