/**
 * Logic menu/cart dùng chung — /order và /t/:token (QR bàn).
 * Dùng applyPubMenuBase() trong init() — không spread (Alpine không reactive đúng).
 */
(function (global) {
  /** Khai báo sẵn trong x-data — Alpine reactive đúng cho cart/items. */
  function menuStateDefaults(opts) {
    opts = opts || {};
    return {
      items: [],
      heroImages: opts.heroImages || [],
      search: '',
      activeCat: 0,
      tabIndicatorStyle: 'left:0;width:0;opacity:0',
      cart: [],
      cartOpen: false,
      submitting: false,
      errorMsg: '',
      cartBumpId: null,
      cartBarBump: false,
      canSubmit: opts.canSubmit !== false,
      orderMode: opts.orderMode || 'delivery',
      cartBarLabel: opts.cartBarLabel || 'Xem giỏ hàng',
      cartDrawerTitle: opts.cartDrawerTitle || 'Giỏ hàng',
      submitLabel: opts.submitLabel || 'Đặt hàng',
      submitLabelLoading: opts.submitLabelLoading || 'Đang gửi...',
      _revealObserver: null,
    };
  }

  function createPubMenuBase(menuItems, opts) {
    opts = opts || {};
    return {
      items: (menuItems || []).map((it) => ({ ...it, _imgLoaded: false })),
      heroImages: opts.heroImages || [],
      search: '',
      activeCat: 0,
      tabIndicatorStyle: 'left:0;width:0;opacity:0',
      cart: [],
      cartOpen: false,
      submitting: false,
      errorMsg: '',
      cartBumpId: null,
      cartBarBump: false,
      canSubmit: opts.canSubmit !== false,
      orderMode: opts.orderMode || 'delivery',
      cartBarLabel: opts.cartBarLabel || 'Xem giỏ hàng',
      cartDrawerTitle: opts.cartDrawerTitle || 'Giỏ hàng',
      submitLabel: opts.submitLabel || 'Đặt hàng',
      submitLabelLoading: opts.submitLabelLoading || 'Đang gửi...',
      _revealObserver: null,

      initPubMenu() {
        this.$nextTick(() => {
          this.updateTabIndicator();
          if (global.lucide) lucide.createIcons();
        });
        if (!global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this._revealObserver = new IntersectionObserver(
            (entries) => entries.forEach((e) => {
              if (e.isIntersecting) e.target.classList.add('is-visible');
            }),
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
          );
        }
      },

      observeReveal(el) {
        if (this._revealObserver) this._revealObserver.observe(el);
        else el.classList.add('is-visible');
      },

      setCat(id) {
        this.activeCat = id;
        this.$nextTick(() => this.updateTabIndicator());
      },

      updateTabIndicator() {
        const row = this.$refs.tabsRow;
        if (!row) return;
        const btn = row.querySelector('[data-cat="' + this.activeCat + '"]');
        if (!btn) return;
        this.tabIndicatorStyle = 'left:' + btn.offsetLeft + 'px;width:' + btn.offsetWidth + 'px;opacity:1';
      },

      filteredItems() {
        const s = this.search.toLowerCase().trim();
        return this.items.filter((it) => {
          const catOk = this.activeCat === 0 || it.category_id === this.activeCat;
          const txtOk = !s || it.name.toLowerCase().includes(s);
          return catOk && txtOk;
        });
      },

      totalAmount() {
        return this.cart.reduce((sum, e) => sum + e.price * e.qty, 0);
      },

      totalItemCount() {
        return this.cart.reduce((sum, e) => sum + e.qty, 0);
      },

      fmt(n) {
        return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
      },

      cartCount(itemId) {
        const e = this.cart.find((x) => x.item_id === itemId);
        return e ? e.qty : 0;
      },

      addItem(item) {
        if (this.canSubmit === false) return;
        const existing = this.cart.find((e) => e.item_id === item.id);
        if (existing) existing.qty++;
        else {
          this.cart.push({
            item_id: item.id,
            name: item.name,
            price: item.base_price,
            image_url: item.image_url || '',
            qty: 1,
          });
        }
        this.cartBumpId = item.id;
        this.cartBarBump = true;
        setTimeout(() => {
          this.cartBumpId = null;
          this.cartBarBump = false;
        }, 500);
        this.$nextTick(() => { if (global.lucide) lucide.createIcons(); });
      },

      updateQty(idx, delta) {
        const e = this.cart[idx];
        const newQty = e.qty + delta;
        if (newQty <= 0) this.cart.splice(idx, 1);
        else e.qty = newQty;
      },
    };
  }

  /** Gắn menu base lên component Alpine trong init() — giữ mảng đã khai báo sẵn. */
  function applyPubMenuBase(component, menuItems, opts) {
    const base = createPubMenuBase(menuItems, opts);
    for (const key of Object.keys(base)) {
      const val = base[key];
      if (typeof val === 'function') {
        component[key] = val.bind(component);
      } else if (Array.isArray(val) && Array.isArray(component[key])) {
        component[key].splice(0, component[key].length, ...val);
      } else {
        component[key] = val;
      }
    }
  }

  global.menuStateDefaults = menuStateDefaults;
  global.createPubMenuBase = createPubMenuBase;
  global.applyPubMenuBase = applyPubMenuBase;
})(typeof window !== 'undefined' ? window : global);
