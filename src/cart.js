import {
    calculateCartTotals,
    createLocalOrder,
    getCart,
    isValidGmail,
    isValidVietnamPhone,
    removeCartItem,
    updateItemQuantity
} from './services/cartService.js';
import { formatVND } from './utils/pricing.js';

const CHECKOUT_INFO_STORAGE_KEY = 'tray_customize_checkout_info_v1';
const THUMB_SIZE = 72;
const ITEM_INFO_GAP_PX = 10;

const THUMB_THEME_COLORS = {
    brown: { bg: '#111827', wall: '#8D6E63', inner: '#2A2320', divider: '#E0C3B5' },
    white: { bg: '#111827', wall: '#F8F9FA', inner: '#6B7280', divider: '#D1D5DB' },
    red: { bg: '#111827', wall: '#EF5350', inner: '#3C1E22', divider: '#FCA5A5' },
    blue: { bg: '#111827', wall: '#42A5F5', inner: '#1C2F4B', divider: '#93C5FD' }
};

function readCheckoutInfo() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return { name: '', email: '', phone: '', address: '' };
    }

    try {
        const raw = window.localStorage.getItem(CHECKOUT_INFO_STORAGE_KEY);
        if (!raw) return { name: '', email: '', phone: '', address: '' };

        const parsed = JSON.parse(raw);
        return {
            name: typeof parsed?.name === 'string' ? parsed.name : '',
            email: typeof parsed?.email === 'string' ? parsed.email : '',
            phone: typeof parsed?.phone === 'string' ? parsed.phone : '',
            address: typeof parsed?.address === 'string' ? parsed.address : ''
        };
    } catch (error) {
        return { name: '', email: '', phone: '', address: '' };
    }
}

function saveCheckoutInfo(info) {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

    const payload = {
        name: typeof info?.name === 'string' ? info.name : '',
        email: typeof info?.email === 'string' ? info.email : '',
        phone: typeof info?.phone === 'string' ? info.phone : '',
        address: typeof info?.address === 'string' ? info.address : ''
    };

    try {
        window.localStorage.setItem(CHECKOUT_INFO_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        // no-op
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDimension(value) {
    const rounded = Math.round(Number(value) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function capitalize(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function toFinite(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildConfigSummary(configSnapshot = {}) {
    const dimensions = configSnapshot.dimensions || {};
    const dividers = configSnapshot.dividers || { x: [], z: [] };
    const hiddenSegments = configSnapshot.hiddenSegments || {};

    const dividerCount = (dividers.x?.length || 0) + (dividers.z?.length || 0);
    const hiddenCount = Object.keys(hiddenSegments).length;
    const colorTheme = capitalize(configSnapshot.colorTheme || 'brown');

    return {
        size: `${formatDimension(dimensions.l)} x ${formatDimension(dimensions.w)} x ${formatDimension(dimensions.h)} mm`,
        details: `Radius ${formatDimension(dimensions.radius)} mm | Wall ${formatDimension(dimensions.wallThickness)} mm`,
        extras: `Color ${colorTheme} | Dividers ${dividerCount} | Hidden walls ${hiddenCount}`
    };
}

class CartPage {
    constructor() {
        this.itemsEl = document.getElementById('cart-items');
        this.countEl = document.getElementById('cart-count');
        this.subtotalEl = document.getElementById('subtotal-price');
        this.totalEl = document.getElementById('total-price');
        this.checkoutForm = document.getElementById('checkout-form');
        this.placeOrderBtn = document.getElementById('place-order-btn');
        this.statusEl = document.getElementById('checkout-status');
        this.nameInput = document.getElementById('customer-name');
        this.emailInput = document.getElementById('customer-email');
        this.phoneInput = document.getElementById('customer-phone');
        this.addressInput = document.getElementById('customer-address');
        this.thumbnailFallbackCache = new Map();

        this.bindEvents();
        this.restoreCheckoutInfo();
        this.render();
        this.focusCheckoutIfRequested();
    }

    getThemeColors(theme) {
        return THUMB_THEME_COLORS[theme] || THUMB_THEME_COLORS.brown;
    }

    formatSvgNumber(value) {
        return Number(value).toFixed(2);
    }

    buildFallbackTopViewThumbnail(configSnapshot = {}) {
        const dims = configSnapshot.dimensions || {};
        const dividers = configSnapshot.dividers || { x: [], z: [] };
        const hiddenSegments = configSnapshot.hiddenSegments || {};
        const colors = this.getThemeColors(configSnapshot.colorTheme || 'brown');

        const l = Math.max(1, toFinite(dims.l, 120));
        const w = Math.max(1, toFinite(dims.w, 120));
        const radius = Math.max(0, toFinite(dims.radius, 8));
        const wallThickness = Math.max(0.5, toFinite(dims.wallThickness, 2));

        const size = THUMB_SIZE;
        const pad = 6;
        const drawArea = size - (pad * 2);
        const scale = drawArea / Math.max(l, w);

        const trayW = l * scale;
        const trayH = w * scale;
        const cx = size / 2;
        const cy = size / 2;

        const outerX = cx - (trayW / 2);
        const outerY = cy - (trayH / 2);
        const outerR = Math.max(1, Math.min(Math.min(trayW, trayH) / 2, (radius + wallThickness) * scale));

        const wallPx = Math.max(1, wallThickness * scale);
        const innerX = outerX + wallPx;
        const innerY = outerY + wallPx;
        const innerW = Math.max(1, trayW - (wallPx * 2));
        const innerH = Math.max(1, trayH - (wallPx * 2));
        const innerR = Math.max(0.5, Math.min(Math.min(innerW, innerH) / 2, radius * scale));

        const sortedX = Array.isArray(dividers.x)
            ? [...dividers.x].map((value) => toFinite(value, 0)).sort((a, b) => a - b)
            : [];
        const sortedZ = Array.isArray(dividers.z)
            ? [...dividers.z].map((value) => toFinite(value, 0)).sort((a, b) => a - b)
            : [];

        const xBounds = [-l / 2, ...sortedX, l / 2];
        const zBounds = [-w / 2, ...sortedZ, w / 2];
        const lineWidth = Math.max(1, Math.min(3, wallPx));
        const lineSegments = [];

        for (let i = 0; i < sortedX.length; i += 1) {
            const x = cx + (sortedX[i] * scale);
            for (let j = 0; j < zBounds.length - 1; j += 1) {
                if (hiddenSegments[`X_${i}_${j}`]) continue;
                const y1 = cy + (zBounds[j] * scale);
                const y2 = cy + (zBounds[j + 1] * scale);
                lineSegments.push(
                    `<line x1="${this.formatSvgNumber(x)}" y1="${this.formatSvgNumber(y1)}" x2="${this.formatSvgNumber(x)}" y2="${this.formatSvgNumber(y2)}" />`
                );
            }
        }

        for (let i = 0; i < sortedZ.length; i += 1) {
            const y = cy + (sortedZ[i] * scale);
            for (let j = 0; j < xBounds.length - 1; j += 1) {
                if (hiddenSegments[`Z_${i}_${j}`]) continue;
                const x1 = cx + (xBounds[j] * scale);
                const x2 = cx + (xBounds[j + 1] * scale);
                lineSegments.push(
                    `<line x1="${this.formatSvgNumber(x1)}" y1="${this.formatSvgNumber(y)}" x2="${this.formatSvgNumber(x2)}" y2="${this.formatSvgNumber(y)}" />`
                );
            }
        }

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <rect width="${size}" height="${size}" fill="${colors.bg}" />
              <rect x="${this.formatSvgNumber(outerX)}" y="${this.formatSvgNumber(outerY)}" width="${this.formatSvgNumber(trayW)}" height="${this.formatSvgNumber(trayH)}" rx="${this.formatSvgNumber(outerR)}" ry="${this.formatSvgNumber(outerR)}" fill="${colors.wall}" />
              <rect x="${this.formatSvgNumber(innerX)}" y="${this.formatSvgNumber(innerY)}" width="${this.formatSvgNumber(innerW)}" height="${this.formatSvgNumber(innerH)}" rx="${this.formatSvgNumber(innerR)}" ry="${this.formatSvgNumber(innerR)}" fill="${colors.inner}" />
              <g stroke="${colors.divider}" stroke-width="${this.formatSvgNumber(lineWidth)}" stroke-linecap="round">
                ${lineSegments.join('')}
              </g>
            </svg>
        `;

        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    getItemThumbnail(item) {
        const preview = typeof item?.topViewPreview === 'string' ? item.topViewPreview.trim() : '';
        // Old snapshots may contain flat/empty JPEG captures; prefer fallback if preview is suspiciously tiny.
        if (preview.startsWith('data:image/') && preview.length >= 1800) {
            return preview;
        }

        const cacheKey = item?.fingerprint || JSON.stringify(item?.configSnapshot || {});
        const cached = this.thumbnailFallbackCache.get(cacheKey);
        if (cached) return cached;

        const generated = this.buildFallbackTopViewThumbnail(item?.configSnapshot || {});
        this.thumbnailFallbackCache.set(cacheKey, generated);
        return generated;
    }

    bindEvents() {
        this.itemsEl?.addEventListener('click', (event) => this.handleItemAction(event));
        this.checkoutForm?.addEventListener('submit', (event) => this.handleCheckoutSubmit(event));
        this.nameInput?.addEventListener('input', () => this.persistCheckoutInfo());
        this.emailInput?.addEventListener('input', () => this.persistCheckoutInfo());
        this.phoneInput?.addEventListener('input', () => this.persistCheckoutInfo());
        this.addressInput?.addEventListener('input', () => this.persistCheckoutInfo());
    }

    restoreCheckoutInfo() {
        const info = readCheckoutInfo();
        if (this.nameInput) this.nameInput.value = info.name;
        if (this.emailInput) this.emailInput.value = info.email;
        if (this.phoneInput) this.phoneInput.value = info.phone;
        if (this.addressInput) this.addressInput.value = info.address;
    }

    persistCheckoutInfo() {
        saveCheckoutInfo({
            name: this.nameInput?.value || '',
            email: this.emailInput?.value || '',
            phone: this.phoneInput?.value || '',
            address: this.addressInput?.value || ''
        });
    }

    handleItemAction(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const fingerprint = button.dataset.fingerprint;
        if (!fingerprint) return;

        try {
            const cart = getCart();
            const item = cart.items.find((entry) => entry.fingerprint === fingerprint);
            if (!item) return;

            if (action === 'increase') {
                updateItemQuantity(fingerprint, item.quantity + 1);
            } else if (action === 'decrease') {
                updateItemQuantity(fingerprint, item.quantity - 1);
            } else if (action === 'remove') {
                removeCartItem(fingerprint);
            }

            this.clearStatus();
            this.render();
        } catch (error) {
            this.showStatus('Unable to update cart. Please try again.', 'error');
        }
    }

    getValidationError(customer) {
        if (!customer.name.trim()) return 'Please enter your name.';
        if (!customer.email.trim()) return 'Please enter your Gmail.';
        if (!isValidGmail(customer.email)) return 'Please enter a valid Gmail address.';
        if (!customer.phone.trim()) return 'Please enter your phone number.';
        if (!isValidVietnamPhone(customer.phone)) return 'Please enter a valid Vietnam phone number.';
        if (!customer.address.trim()) return 'Please enter your address.';
        return null;
    }

    handleCheckoutSubmit(event) {
        event.preventDefault();

        const customer = {
            name: this.nameInput?.value || '',
            email: this.emailInput?.value || '',
            phone: this.phoneInput?.value || '',
            address: this.addressInput?.value || ''
        };

        const validationError = this.getValidationError(customer);
        if (validationError) {
            this.showStatus(validationError, 'error');
            return;
        }

        try {
            const result = createLocalOrder(customer);
            this.persistCheckoutInfo();
            this.showStatus(`Đặt hàng thành công! Mã đơn: ${result.orderId} — Vui lòng thanh toán qua QR bên dưới.`, 'success');
            this.render();
            this.showPaymentQR(result.orderId, result.total);
        } catch (error) {
            this.showStatus(error?.message || 'Unable to place order. Please try again.', 'error');
        }
    }

    showPaymentQR(orderId, total) {
        const bankId = 'ACB';
        const accountNo = '29557197';
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(orderId)}`;

        const modal = document.getElementById('cart-payment-modal');
        const qrImg = document.getElementById('cart-qr-image');
        const orderIdEl = document.getElementById('cart-payment-order-id');

        if (modal && qrImg) {
            qrImg.src = qrUrl;
            if (orderIdEl) orderIdEl.textContent = orderId;
            modal.classList.remove('hidden');
        }
    }

    renderItem(item) {
        const summary = buildConfigSummary(item.configSnapshot);
        const thumbSrc = this.getItemThumbnail(item);

        return `
            <article class="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-xl">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex flex-1 items-start" style="gap: ${ITEM_INFO_GAP_PX}px;">
                  <img
                    src="${escapeHtml(thumbSrc)}"
                    alt="Top view preview of ${escapeHtml(item.name)}"
                    width="${THUMB_SIZE}"
                    height="${THUMB_SIZE}"
                    loading="lazy"
                    decoding="async"
                    class="h-[72px] w-[72px] shrink-0 rounded-lg border border-white/10 bg-zinc-950/80 object-cover"
                  />
                  <div class="min-w-0">
                    <h3 class="text-base font-bold text-white">${escapeHtml(item.name)}</h3>
                    <p class="text-sm text-zinc-300">Size: ${escapeHtml(summary.size)}</p>
                    <p class="text-xs text-zinc-400">${escapeHtml(summary.details)}</p>
                    <p class="text-xs text-zinc-500">${escapeHtml(summary.extras)}</p>

                    <div class="mt-4 flex flex-wrap items-center gap-2">
                      <div class="inline-flex items-center overflow-hidden rounded-xl border border-white/15">
                        <button
                          type="button"
                          data-action="decrease"
                          data-fingerprint="${escapeHtml(item.fingerprint)}"
                          class="px-3 py-2 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                        >
                          -
                        </button>
                        <span class="min-w-10 bg-zinc-800/70 px-3 py-2 text-center text-sm font-semibold text-white">${item.quantity}</span>
                        <button
                          type="button"
                          data-action="increase"
                          data-fingerprint="${escapeHtml(item.fingerprint)}"
                          class="px-3 py-2 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        data-action="remove"
                        data-fingerprint="${escapeHtml(item.fingerprint)}"
                        class="rounded-xl border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950/40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-xs uppercase tracking-wider text-zinc-400">Unit Price</p>
                  <p class="text-sm font-semibold text-zinc-200">${formatVND(item.unitPrice)}</p>
                  <p class="mt-1 text-lg font-bold text-white">${formatVND(item.lineTotal)}</p>
                </div>
              </div>
            </article>
        `;
    }

    renderItems(items) {
        if (!this.itemsEl) return;

        if (!items.length) {
            this.itemsEl.innerHTML = `
                <div class="rounded-2xl border border-dashed border-white/20 bg-zinc-900/60 p-8 text-center">
                  <p class="text-base font-semibold text-white">Your cart is empty.</p>
                  <p class="mt-2 text-sm text-zinc-400">Go back to the editor and add a tray configuration.</p>
                </div>
            `;
            return;
        }

        this.itemsEl.innerHTML = items.map((item) => this.renderItem(item)).join('');
    }

    renderSummary(cart) {
        const totals = calculateCartTotals(cart.items);
        const totalUnits = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const uniqueItems = cart.items.length;

        if (this.countEl) {
            this.countEl.textContent = `${uniqueItems} item(s) | ${totalUnits} unit(s)`;
        }
        if (this.subtotalEl) {
            this.subtotalEl.textContent = formatVND(totals.subtotal);
        }
        if (this.totalEl) {
            this.totalEl.textContent = formatVND(totals.total);
        }

        const isEmpty = uniqueItems === 0;
        if (this.placeOrderBtn) {
            this.placeOrderBtn.disabled = isEmpty;
            this.placeOrderBtn.classList.toggle('opacity-50', isEmpty);
            this.placeOrderBtn.classList.toggle('cursor-not-allowed', isEmpty);
        }
    }

    render() {
        const cart = getCart();
        this.renderItems(cart.items);
        this.renderSummary(cart);
    }

    focusCheckoutIfRequested() {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        if (url.searchParams.get('checkout') !== '1') return;

        const focusTarget =
            (this.nameInput && !this.nameInput.value.trim() && this.nameInput) ||
            (this.emailInput && !this.emailInput.value.trim() && this.emailInput) ||
            (this.phoneInput && !this.phoneInput.value.trim() && this.phoneInput) ||
            (this.addressInput && !this.addressInput.value.trim() && this.addressInput) ||
            this.nameInput ||
            this.emailInput ||
            this.phoneInput ||
            this.addressInput;

        const form = this.checkoutForm;
        if (form && typeof form.scrollIntoView === 'function') {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (focusTarget && typeof focusTarget.focus === 'function') {
            window.setTimeout(() => {
                focusTarget.focus();
            }, 150);
        }

        url.searchParams.delete('checkout');
        window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }

    showStatus(message, type) {
        if (!this.statusEl) return;

        this.statusEl.classList.remove('hidden');
        this.statusEl.textContent = message;

        if (type === 'success') {
            this.statusEl.className = 'mt-4 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200';
        } else {
            this.statusEl.className = 'mt-4 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200';
        }
    }

    clearStatus() {
        if (!this.statusEl) return;
        this.statusEl.className = 'mt-4 hidden rounded-xl border px-3 py-2 text-sm';
        this.statusEl.textContent = '';
    }
}

window.addEventListener('load', () => {
    new CartPage();
});
