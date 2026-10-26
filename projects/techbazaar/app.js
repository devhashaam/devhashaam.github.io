// TechBazaar: product catalogue built with jQuery.
// Shows: AJAX ($.getJSON), DOM rendering, event delegation, debouncing,
// state management, and localStorage persistence.

$(function () {
  const CART_KEY = 'techbazaar-cart';

  // ----- App state: one source of truth, UI is re-rendered from it -----
  const state = {
    products: [],
    query: '',
    category: 'All',
    sort: 'featured',
    cart: loadCart(), // { [productId]: quantity }
  };

  const $grid = $('#products');
  const formatPrice = (n) => 'Rs ' + n.toLocaleString('en-PK');

  // ----- 1. Load products with AJAX -----
  $.getJSON('products.json')
    .done(function (data) {
      state.products = data;
      renderCategories();
      renderProducts();
      renderCart();
    })
    .fail(function () {
      $grid.html(
        '<div class="error-box"><p>Could not load products.</p>' +
        '<button class="btn" id="retry" style="width:auto">Try again</button></div>'
      );
    });

  $grid.on('click', '#retry', () => location.reload());

  // ----- 2. Filtering + sorting (pure function: easy to test) -----
  function visibleProducts() {
    const q = state.query.toLowerCase();
    let list = state.products.filter(
      (p) =>
        (state.category === 'All' || p.category === state.category) &&
        p.name.toLowerCase().includes(q)
    );

    const sorters = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
    };
    if (sorters[state.sort]) list = [...list].sort(sorters[state.sort]);
    return list;
  }

  // ----- 3. Rendering -----
  function renderCategories() {
    const cats = ['All', ...new Set(state.products.map((p) => p.category))];
    $('#categories').html(
      cats
        .map(
          (c) =>
            `<button class="chip" data-category="${c}" aria-pressed="${c === state.category}">${c}</button>`
        )
        .join('')
    );
  }

  function productCard(p) {
    const inStock = p.stock > 0;
    // .text() would be safer for user input; this data comes from our own JSON file
    return `
      <article class="card">
        <div class="thumb" aria-hidden="true">${p.icon}</div>
        <h3>${p.name}</h3>
        <p class="meta">${p.category} · ★ ${p.rating}</p>
        <p class="price">${formatPrice(p.price)}</p>
        ${inStock ? '' : '<p class="out">Out of stock</p>'}
        <button class="btn add-to-cart" data-id="${p.id}" ${inStock ? '' : 'disabled'}>
          ${inStock ? 'Add to cart' : 'Unavailable'}
        </button>
      </article>`;
  }

  function renderProducts() {
    const list = visibleProducts();
    $('#result-count').text(`${list.length} product${list.length === 1 ? '' : 's'}`);

    if (!list.length) {
      $grid.html('<p class="empty">No products match your search.</p>');
      return;
    }
    $grid.html(list.map(productCard).join(''));
  }

  function renderCart() {
    const ids = Object.keys(state.cart);
    const $items = $('#cart-items').empty();
    let total = 0;
    let count = 0;

    if (!ids.length) {
      $items.append('<li class="cart-empty">Your cart is empty.</li>');
    }

    ids.forEach((id) => {
      const p = state.products.find((x) => x.id === Number(id));
      if (!p) return;
      const qty = state.cart[id];
      total += p.price * qty;
      count += qty;

      $items.append(`
        <li>
          <span class="ci-icon" aria-hidden="true">${p.icon}</span>
          <div>
            <div class="ci-name">${p.name}</div>
            <div class="ci-price">${formatPrice(p.price)}</div>
          </div>
          <div class="qty">
            <button class="qty-btn" data-id="${p.id}" data-delta="-1" aria-label="Decrease ${p.name}">−</button>
            <span>${qty}</span>
            <button class="qty-btn" data-id="${p.id}" data-delta="1" aria-label="Increase ${p.name}">+</button>
          </div>
        </li>`);
    });

    $('#cart-total').text(formatPrice(total));
    $('#cart-count').text(count);
    $('#checkout').prop('disabled', count === 0);
  }

  // ----- 4. Events -----

  // Debounced search: wait until the user stops typing for 250ms
  let searchTimer;
  $('#search').on('input', function () {
    clearTimeout(searchTimer);
    const value = $(this).val();
    searchTimer = setTimeout(() => {
      state.query = value.trim();
      renderProducts();
    }, 250);
  });

  $('#sort').on('change', function () {
    state.sort = $(this).val();
    renderProducts();
  });

  // Event delegation: chips are created dynamically, so listen on the parent
  $('#categories').on('click', '.chip', function () {
    state.category = $(this).data('category');
    $('.chip').attr('aria-pressed', 'false');
    $(this).attr('aria-pressed', 'true');
    renderProducts();
  });

  $grid.on('click', '.add-to-cart', function () {
    const id = $(this).data('id');
    const product = state.products.find((p) => p.id === id);
    const current = state.cart[id] || 0;

    if (current >= product.stock) {
      showToast(`Only ${product.stock} in stock`);
      return;
    }
    state.cart[id] = current + 1;
    saveCart();
    renderCart();
    $('#cart-count').removeClass('bump').width(); // .width() forces reflow so the animation restarts
    $('#cart-count').addClass('bump');
    showToast(`${product.name} added to cart`);
  });

  $('#cart-items').on('click', '.qty-btn', function () {
    const id = $(this).data('id');
    const delta = Number($(this).data('delta'));
    const product = state.products.find((p) => p.id === id);
    const next = (state.cart[id] || 0) + delta;

    if (next <= 0) delete state.cart[id];
    else if (next <= product.stock) state.cart[id] = next;
    else showToast(`Only ${product.stock} in stock`);

    saveCart();
    renderCart();
  });

  $('#checkout').on('click', function () {
    // A real store would send the cart to the back-end:
    // $.ajax({ url: '/api/orders', method: 'POST', contentType: 'application/json', data: JSON.stringify(state.cart) })
    state.cart = {};
    saveCart();
    renderCart();
    closeCart();
    showToast('Order placed! (demo)');
  });

  // ----- Cart drawer open/close -----
  function openCart() {
    $('#cart').addClass('open').attr('aria-hidden', 'false');
    $('#overlay').prop('hidden', false);
    $('#cart-open').attr('aria-expanded', 'true');
    $('#cart-close').trigger('focus');
  }

  function closeCart() {
    $('#cart').removeClass('open').attr('aria-hidden', 'true');
    $('#overlay').prop('hidden', true);
    $('#cart-open').attr('aria-expanded', 'false').trigger('focus');
  }

  $('#cart-open').on('click', openCart);
  $('#cart-close, #overlay').on('click', closeCart);
  $(document).on('keydown', (e) => {
    if (e.key === 'Escape' && $('#cart').hasClass('open')) closeCart();
  });

  // ----- Helpers -----
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch {
      /* storage full or blocked: cart still works for this visit */
    }
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    $('#toast').text(message).stop(true).fadeIn(150);
    toastTimer = setTimeout(() => $('#toast').fadeOut(300), 1800);
  }
});
