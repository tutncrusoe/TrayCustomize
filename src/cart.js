import {
    calculateCartTotals,
    createLocalOrder,
    getCart,
    isValidVietnamPhone,
    removeCartItem,
    updateItemQuantity
} from './services/cartService.js';
import { formatVND } from './utils/pricing.js';

const CHECKOUT_INFO_STORAGE_KEY = 'tray_customize_checkout_info_v1';

function readCheckoutInfo() {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return { name: '', phone: '', address: '' };
    }

    try {
        const raw = window.localStorage.getItem(CHECKOUT_INFO_STORAGE_KEY);
        if (!raw) return { name: '', phone: '', address: '' };

        const parsed = JSON.parse(raw);
        return {
            name: typeof parsed?.name === 'string' ? parsed.name : '',
            phone: typeof parsed?.phone === 'string' ? parsed.phone : '',
            address: typeof parsed?.address === 'string' ? parsed.address : ''
        };
    } catch (error) {
        return { name: '', phone: '', address: '' };
    }
}

function saveCheckoutInfo(info) {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;

    const payload = {
        name: typeof info?.name === 'string' ? info.name : '',
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
        this.phoneInput = document.getElementById('customer-phone');
        this.addressInput = document.getElementById('customer-address');

        this.bindEvents();
        this.restoreCheckoutInfo();
        this.render();
    }

    bindEvents() {
        this.itemsEl?.addEventListener('click', (event) => this.handleItemAction(event));
        this.checkoutForm?.addEventListener('submit', (event) => this.handleCheckoutSubmit(event));
        this.nameInput?.addEventListener('input', () => this.persistCheckoutInfo());
        this.phoneInput?.addEventListener('input', () => this.persistCheckoutInfo());
        this.addressInput?.addEventListener('input', () => this.persistCheckoutInfo());
    }

    restoreCheckoutInfo() {
        const info = readCheckoutInfo();
        if (this.nameInput) this.nameInput.value = info.name;
        if (this.phoneInput) this.phoneInput.value = info.phone;
        if (this.addressInput) this.addressInput.value = info.address;
    }

    persistCheckoutInfo() {
        saveCheckoutInfo({
            name: this.nameInput?.value || '',
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
        if (!customer.phone.trim()) return 'Please enter your phone number.';
        if (!isValidVietnamPhone(customer.phone)) return 'Please enter a valid Vietnam phone number.';
        if (!customer.address.trim()) return 'Please enter your address.';
        return null;
    }

    handleCheckoutSubmit(event) {
        event.preventDefault();

        const customer = {
            name: this.nameInput?.value || '',
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
            this.showStatus(`Order placed successfully. Order ID: ${result.orderId}`, 'success');
            this.render();
        } catch (error) {
            this.showStatus(error?.message || 'Unable to place order. Please try again.', 'error');
        }
    }

    renderItem(item) {
        const summary = buildConfigSummary(item.configSnapshot);

        return `
            <article class="rounded-2xl border border-white/10 bg-zinc-900/70 p-4 shadow-xl">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div class="space-y-1">
                  <h3 class="text-base font-bold text-white">${escapeHtml(item.name)}</h3>
                  <p class="text-sm text-zinc-300">Size: ${escapeHtml(summary.size)}</p>
                  <p class="text-xs text-zinc-400">${escapeHtml(summary.details)}</p>
                  <p class="text-xs text-zinc-500">${escapeHtml(summary.extras)}</p>
                </div>
                <div class="md:text-right">
                  <p class="text-xs uppercase tracking-wider text-zinc-400">Unit Price</p>
                  <p class="text-sm font-semibold text-zinc-200">${formatVND(item.unitPrice)}</p>
                  <p class="mt-1 text-lg font-bold text-white">${formatVND(item.lineTotal)}</p>
                </div>
              </div>

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
