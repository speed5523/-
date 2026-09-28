/* Ставрида — логика витрины: каталог, фильтры, корзина, оформление заказа. */
(function () {
  'use strict';

  const FREE_SHIPPING_FROM = 3000; // бесплатная доставка курьером от этой суммы
  const COURIER_PRICE = 300;
  const CART_KEY = 'stavrida-cart';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- утилиты

  const SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const icon = (name, cls = '') =>
    `<svg class="ico ${cls}" viewBox="0 0 64 64" ${SVG_ATTRS} stroke-width="1.5" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const UI_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  const rub = (n) => n.toLocaleString('ru-RU') + ' ₽';

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }
  const goods = (n) => `${n} ${plural(n, 'товар', 'товара', 'товаров')}`;

  const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е');

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const discount = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);

  // ---------------------------------------------------------------- категории

  function renderCategories() {
    $('#catGrid').innerHTML = CATEGORIES.map((c) => `
      <button class="cat" type="button" data-cat="${c.id}" style="--tint:${c.tint}">
        ${icon(c.icon)}
        <b>${c.name}</b>
        <span>${c.desc}</span>
        <i class="cat__arrow">${UI_ARROW}</i>
      </button>`).join('');
  }

  // ---------------------------------------------------------------- каталог

  const state = { cat: 'all', query: '', sort: 'popular' };

  const sorters = {
    popular: (a, b) => b.pop - a.pop,
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price,
    sale: (a, b) => discount(b) - discount(a) || b.pop - a.pop,
  };

  function visibleProducts() {
    const words = normalize(state.query).split(/\s+/).filter(Boolean);
    return PRODUCTS
      .filter((p) => state.cat === 'all' || p.cat === state.cat)
      .filter((p) => {
        if (!words.length) return true;
        const haystack = normalize(`${p.name} ${p.spec} ${catById[p.cat].name}`);
        return words.every((w) => haystack.includes(w));
      })
      .sort(sorters[state.sort]);
  }

  function renderChips() {
    const items = [{ id: 'all', short: 'Все товары' }, ...CATEGORIES];
    $('#chips').innerHTML = items.map((c) => {
      const active = state.cat === c.id;
      return `<button class="chip${active ? ' is-active' : ''}" type="button" data-chip="${c.id}" aria-pressed="${active}">${c.short}</button>`;
    }).join('');
  }

  function productCard(p, i) {
    const c = catById[p.cat];
    const off = discount(p);
    const name = escapeHtml(p.name);
    const badge =
      p.badge === 'hit' ? '<span class="badge">Хит</span>' :
      p.badge === 'new' ? '<span class="badge badge--new">Новинка</span>' : '';

    return `
      <article class="product" style="--tint:${c.tint}; animation-delay:${Math.min(i, 12) * 35}ms">
        <div class="product__art" data-quick="${p.id}">
          ${badge}
          ${off ? `<span class="badge badge--sale">−${off}%</span>` : ''}
          ${icon(p.icon)}
        </div>
        <div class="product__body">
          <p class="product__cat">${c.short}</p>
          <h3 class="product__name"><button type="button" data-quick="${p.id}">${name}</button></h3>
          <p class="product__spec">${p.spec}</p>
          <div class="product__row">
            <div class="price"><b>${rub(p.price)}</b>${p.old ? `<s>${rub(p.old)}</s>` : ''}</div>
            <button class="btn btn--primary btn--small" type="button" data-add="${p.id}" aria-label="Добавить в корзину: ${name}">В корзину</button>
          </div>
        </div>
      </article>`;
  }

  function renderProducts() {
    const list = visibleProducts();
    const grid = $('#productGrid');

    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : `<div class="empty" style="grid-column: 1 / -1">
           <b>Ничего не нашлось</b>
           <p>Попробуйте другой запрос или загляните в соседний раздел.</p>
           <button class="btn btn--ghost btn--small" type="button" data-reset>Сбросить фильтры</button>
         </div>`;

    const where = state.cat === 'all' ? 'во всех разделах' : `в разделе «${catById[state.cat].name}»`;
    $('#resultInfo').textContent = `${goods(list.length)} ${where}`;
    $('#catalogTitle').textContent = state.cat === 'all' ? 'Популярные товары' : catById[state.cat].name;
  }

  function setCategory(id) {
    state.cat = catById[id] ? id : 'all';
    renderChips();
    renderProducts();
  }

  function resetFilters() {
    state.cat = 'all';
    state.query = '';
    state.sort = 'popular';
    $('#search').value = '';
    $('#sort').value = 'popular';
    renderChips();
    renderProducts();
  }

  function scrollToCatalog() {
    $('#catalog').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // ---------------------------------------------------------------- корзина

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      const clean = {};
      Object.entries(raw).forEach(([id, qty]) => {
        if (productById[id] && Number.isInteger(qty) && qty > 0) clean[id] = Math.min(qty, 99);
      });
      return clean;
    } catch (e) {
      return {};
    }
  }

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* приватный режим — корзина живёт до перезагрузки */ }
  }

  let cart = loadCart();

  const cartCount = () => Object.values(cart).reduce((sum, q) => sum + q, 0);
  const cartTotal = () => Object.entries(cart).reduce((sum, [id, q]) => sum + productById[id].price * q, 0);

  function addToCart(id) {
    cart[id] = Math.min((cart[id] || 0) + 1, 99);
    saveCart();
    renderCart();

    const btn = $('#cartBtn');
    btn.classList.remove('is-bumped');
    void btn.offsetWidth; // перезапуск анимации
    btn.classList.add('is-bumped');

    showToast(`Добавлено: ${productById[id].name}`);
  }

  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = Math.min(qty, 99);
    saveCart();
    renderCart();
  }

  function renderCart() {
    const count = cartCount();
    const total = cartTotal();

    const badge = $('#cartCount');
    badge.textContent = count;
    badge.classList.toggle('is-on', count > 0);
    $('#cartBtn').setAttribute('aria-label', count ? `Корзина: ${goods(count)}` : 'Корзина пуста');

    const body = $('#cartBody');
    const foot = $('#cartFoot');

    if (!count) {
      body.innerHTML = `
        <div class="cart-empty">
          ${icon('net')}
          <b>Пока пусто</b>
          <p>Загляните в каталог — там есть на что клюнуть.</p>
          <button class="btn btn--ghost btn--small" type="button" data-go-catalog>Перейти в каталог</button>
        </div>`;
      foot.hidden = true;
      return;
    }

    foot.hidden = false;
    body.innerHTML = Object.entries(cart).map(([id, qty]) => {
      const p = productById[id];
      const name = escapeHtml(p.name);
      return `
        <div class="cart-item">
          <div class="cart-item__art" style="--tint:${catById[p.cat].tint}">${icon(p.icon)}</div>
          <div>
            <p class="cart-item__name">${name}</p>
            <p class="cart-item__price">${rub(p.price)} за шт.</p>
          </div>
          <div class="cart-item__side">
            <span class="cart-item__sum">${rub(p.price * qty)}</span>
            <div class="qty">
              <button type="button" data-dec="${id}" aria-label="Уменьшить количество: ${name}">−</button>
              <span>${qty}</span>
              <button type="button" data-inc="${id}" aria-label="Увеличить количество: ${name}">+</button>
            </div>
            <button class="remove" type="button" data-remove="${id}">Удалить</button>
          </div>
        </div>`;
    }).join('');

    $('#cartTotalLabel').textContent = `Итого за ${goods(count)}`;
    $('#cartTotal').textContent = rub(total);

    const left = FREE_SHIPPING_FROM - total;
    $('#shipText').innerHTML = left > 0
      ? `До бесплатной доставки по городу — <b>${rub(left)}</b>`
      : '<b>Доставка по городу — бесплатно</b>';
    $('#shipBar').style.width = Math.min(100, (total / FREE_SHIPPING_FROM) * 100) + '%';

    updateCheckoutSummary();
  }

  // ---------------------------------------------------------------- панели и окна

  const drawer = $('#cart');
  const modal = $('#modal');
  const nav = $('#nav');
  const burger = $('#burger');
  let drawerReturnFocus = null;
  let modalReturnFocus = null;

  function syncScrollLock() {
    const locked = drawer.classList.contains('is-open') || modal.classList.contains('is-open');
    document.body.classList.toggle('is-locked', locked);
  }

  function openCart() {
    drawerReturnFocus = document.activeElement;
    setNav(false);
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    syncScrollLock();
    setTimeout(() => $('.close-btn', drawer).focus(), 60);
  }

  function closeCart(restoreFocus = true) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    syncScrollLock();
    if (restoreFocus && drawerReturnFocus) drawerReturnFocus.focus();
  }

  function openModal(html, returnFocus) {
    modalReturnFocus = returnFocus || document.activeElement;
    $('#modalContent').innerHTML = html;
    $('.modal__box', modal).scrollTop = 0;
    modal.inert = false;
    modal.classList.add('is-open');
    syncScrollLock();
    setTimeout(() => $('.modal__close', modal).focus(), 60);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.inert = true;
    syncScrollLock();
    if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  function setNav(open) {
    nav.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }

  function trapFocus(e, container) {
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select, textarea', container)
      .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------------------------------------------------------------- карточка товара

  function openQuickView(id) {
    const p = productById[id];
    const c = catById[p.cat];
    openModal(`
      <div class="quick">
        <div class="quick__art" style="--tint:${c.tint}">${icon(p.icon)}</div>
        <div class="quick__body">
          <p class="product__cat">${c.name}</p>
          <h3 id="modalTitle">${escapeHtml(p.name)}</h3>
          <p class="product__spec">${p.spec}</p>
          <p class="descr">${p.descr}</p>
          <div class="quick__row">
            <div class="price"><b>${rub(p.price)}</b>${p.old ? `<s>${rub(p.old)}</s>` : ''}</div>
            <button class="btn btn--primary" type="button" data-add="${p.id}" data-close-after>В корзину</button>
          </div>
        </div>
      </div>`);
  }

  // ---------------------------------------------------------------- оформление заказа

  function deliveryInfo(method, total) {
    if (method === 'courier') {
      return total >= FREE_SHIPPING_FROM ? { cost: 0, label: 'бесплатно' } : { cost: COURIER_PRICE, label: rub(COURIER_PRICE) };
    }
    if (method === 'post') return { cost: 0, label: 'по тарифу перевозчика' };
    return { cost: 0, label: 'бесплатно' };
  }

  function openCheckout() {
    if (!cartCount()) return;
    closeCart(false);
    const courierLabel = cartTotal() >= FREE_SHIPPING_FROM ? 'Бесплатно' : rub(COURIER_PRICE);

    openModal(`
      <div class="checkout">
        <h3 id="modalTitle">Оформление заказа</h3>
        <p>Перезвоним, чтобы подтвердить наличие и время получения. Оплата — при получении.</p>
        <form id="checkoutForm" novalidate>
          <label class="field">
            <span>Имя</span>
            <input name="customer" autocomplete="name" placeholder="Как к вам обращаться" required>
          </label>
          <label class="field">
            <span>Телефон</span>
            <input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required>
          </label>
          <div class="field" role="radiogroup" aria-label="Способ получения">
            <span>Способ получения</span>
            <div class="radio-group">
              <label class="radio">
                <input type="radio" name="delivery" value="pickup" checked>
                <div><b>Самовывоз</b><span>ул.&nbsp;Рыбацкая,&nbsp;12 — в тот же день</span></div>
                <em>Бесплатно</em>
              </label>
              <label class="radio">
                <input type="radio" name="delivery" value="courier">
                <div><b>Курьер по городу</b><span>На следующий день</span></div>
                <em>${courierLabel}</em>
              </label>
              <label class="radio">
                <input type="radio" name="delivery" value="post">
                <div><b>По России</b><span>СДЭК или Почта, 2–7 дней</span></div>
                <em>По тарифу</em>
              </label>
            </div>
          </div>
          <label class="field" id="addressField" hidden>
            <span>Адрес доставки</span>
            <input name="address" autocomplete="street-address" placeholder="Город, улица, дом, квартира">
          </label>
          <label class="field">
            <span>Комментарий</span>
            <textarea name="comment" placeholder="Например: намотать шнур на катушку"></textarea>
          </label>
          <div class="checkout__summary">
            <span id="sumLabel"></span>
            <b id="sumTotal"></b>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Подтвердить заказ</button>
          <small class="form-note">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</small>
        </form>
      </div>`, $('#cartBtn'));

    const form = $('#checkoutForm');
    attachPhoneMask(form.elements.phone);
    form.addEventListener('change', updateCheckoutSummary);
    form.addEventListener('submit', submitCheckout);
    updateCheckoutSummary();
  }

  function updateCheckoutSummary() {
    const form = $('#checkoutForm');
    if (!form) return;
    const method = form.elements.delivery.value;
    const total = cartTotal();
    const delivery = deliveryInfo(method, total);

    $('#addressField').hidden = method === 'pickup';
    form.elements.address.required = method !== 'pickup';

    $('#sumLabel').textContent = `${goods(cartCount())}, доставка — ${delivery.label}`;
    $('#sumTotal').textContent = rub(total + delivery.cost);
  }

  function submitCheckout(e) {
    e.preventDefault();
    const form = e.currentTarget;
    validatePhone(form.elements.phone);
    if (!form.reportValidity()) return;

    const order = {
      number: 'СТ-' + String(Date.now()).slice(-6),
      customer: form.elements.customer.value.trim(),
      phone: form.elements.phone.value,
      delivery: form.elements.delivery.value,
      address: form.elements.address.value.trim(),
      comment: form.elements.comment.value.trim(),
      items: Object.entries(cart).map(([id, qty]) => ({ id: Number(id), name: productById[id].name, qty, price: productById[id].price })),
      total: cartTotal(),
    };
    // TODO: отправить заказ на сервер или в Telegram-бота, например:
    // fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });

    cart = {};
    saveCart();
    renderCart();

    $('#modalContent').innerHTML = `
      <div class="done">
        ${icon('fish')}
        <h3 id="modalTitle">Заказ принят!</h3>
        <p>Номер заказа <b>${order.number}</b>. Перезвоним на ${escapeHtml(order.phone).replace(/ /g, ' ')}, чтобы подтвердить детали. Ни хвоста, ни чешуи!</p>
        <button class="btn btn--primary" type="button" data-close-modal>Вернуться в магазин</button>
      </div>`;
    $('.modal__close', modal).focus();
  }

  // ---------------------------------------------------------------- телефон

  function formatPhone(value) {
    let d = value.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    else if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);

    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  function attachPhoneMask(input) {
    input.addEventListener('input', (e) => {
      input.setCustomValidity('');
      if (e.inputType && e.inputType.startsWith('delete')) return; // не мешаем стирать
      input.value = formatPhone(input.value);
    });
    input.addEventListener('blur', () => {
      if (input.value) input.value = formatPhone(input.value);
    });
  }

  function validatePhone(input) {
    const ok = input.value.replace(/\D/g, '').length === 11;
    input.setCustomValidity(ok ? '' : 'Введите номер полностью: +7 и ещё 10 цифр');
    return ok;
  }

  // ---------------------------------------------------------------- уведомление

  let toastTimer = null;
  function showToast(text) {
    $('#toastText').textContent = text;
    const toast = $('#toast');
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }

  // ---------------------------------------------------------------- сезон

  function renderSeason() {
    const month = new Date().getMonth();
    const s = SEASONS.find((x) => x.months.includes(month)) || SEASONS[0];
    $('#seasonEyebrow').textContent = s.eyebrow;
    $('#seasonTitle').textContent = s.title;
    $('#seasonText').textContent = s.text;
    const btn = $('#seasonBtn');
    btn.textContent = s.cta;
    btn.dataset.cat = s.cat;
    $('#seasonArt').innerHTML = icon(s.icon);
  }

  // ---------------------------------------------------------------- появление при прокрутке

  function setupReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el) => io.observe(el));
  }

  // ---------------------------------------------------------------- события

  document.addEventListener('click', (e) => {
    if (e.target === modal) { closeModal(); return; }

    const el = e.target.closest(
      '[data-cat], [data-chip], [data-add], [data-quick], [data-inc], [data-dec], [data-remove], ' +
      '[data-reset], [data-close-cart], [data-close-modal], [data-go-catalog], #cartBtn, #checkoutBtn'
    );
    if (!el) return;
    const d = el.dataset;

    if (d.cat) {
      e.preventDefault();
      state.query = '';
      $('#search').value = '';
      setCategory(d.cat);
      setNav(false);
      scrollToCatalog();
    } else if (d.chip) {
      setCategory(d.chip);
    } else if (d.add) {
      addToCart(d.add);
      if ('closeAfter' in d) closeModal();
      else {
        el.textContent = 'Добавлено ✓';
        clearTimeout(el._timer);
        el._timer = setTimeout(() => { el.textContent = 'В корзину'; }, 1400);
      }
    } else if (d.quick) {
      openQuickView(d.quick);
    } else if (d.inc || d.dec) {
      const id = d.inc || d.dec;
      setQty(id, (cart[id] || 0) + (d.inc ? 1 : -1));
      const same = $(d.inc ? `[data-inc="${id}"]` : `[data-dec="${id}"]`, drawer);
      (same || $('.close-btn', drawer)).focus();
    } else if (d.remove) {
      setQty(d.remove, 0);
      $('.close-btn', drawer).focus();
    } else if ('reset' in d) {
      resetFilters();
    } else if ('closeCart' in d) {
      closeCart();
    } else if ('closeModal' in d) {
      closeModal();
    } else if ('goCatalog' in d) {
      closeCart(false);
      scrollToCatalog();
    } else if (el.id === 'cartBtn') {
      openCart();
    } else if (el.id === 'checkoutBtn') {
      openCheckout();
    }
  });

  document.addEventListener('keydown', (e) => {
    const modalOpen = modal.classList.contains('is-open');
    const drawerOpen = drawer.classList.contains('is-open');

    if (e.key === 'Escape') {
      if (modalOpen) closeModal();
      else if (drawerOpen) closeCart();
      else if (nav.classList.contains('is-open')) { setNav(false); burger.focus(); }
    } else if (e.key === 'Tab') {
      if (modalOpen) trapFocus(e, $('.modal__box', modal));
      else if (drawerOpen) trapFocus(e, $('.drawer__panel', drawer));
    }
  });

  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderProducts();
  });

  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderProducts();
  });

  burger.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });

  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });

  const callbackForm = $('#callbackForm');
  attachPhoneMask(callbackForm.elements.phone);
  callbackForm.addEventListener('submit', (e) => {
    e.preventDefault();
    validatePhone(callbackForm.elements.phone);
    if (!callbackForm.reportValidity()) return;
    // TODO: отправить заявку на сервер
    callbackForm.reset();
    showToast('Спасибо! Перезвоним в течение 15 минут');
  });

  // ---------------------------------------------------------------- старт

  $$('[data-icon]').forEach((svg) => { svg.innerHTML = ICONS[svg.dataset.icon] || ''; });
  $('#year').textContent = new Date().getFullYear();

  renderCategories();
  renderChips();
  renderProducts();
  renderCart();
  renderSeason();
  setupReveal();
  onScroll();
})();
