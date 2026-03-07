import { calculateTrayPrice } from '../utils/pricing.js';

const CART_STORAGE_KEY = 'tray_customize_cart_v1';
const ORDER_STORAGE_KEY = 'tray_customize_orders_v1';
const MAX_TOP_VIEW_PREVIEW_LENGTH = 24000;

const DEFAULT_CART_STATE = {
    items: [],
    updatedAt: null
};

function cloneJsonSafe(value) {
    return JSON.parse(JSON.stringify(value));
}

function hasLocalStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStorageJson(key, fallbackValue) {
    if (!hasLocalStorage()) return cloneJsonSafe(fallbackValue);

    let raw;
    try {
        raw = window.localStorage.getItem(key);
    } catch (error) {
        return cloneJsonSafe(fallbackValue);
    }

    if (!raw) return cloneJsonSafe(fallbackValue);

    try {
        return JSON.parse(raw);
    } catch (error) {
        try {
            window.localStorage.removeItem(key);
        } catch (_ignored) {
            // no-op
        }
        return cloneJsonSafe(fallbackValue);
    }
}

function writeStorageJson(key, value) {
    if (!hasLocalStorage()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeDimensions(dimensions = {}) {
    return {
        l: toNumber(dimensions.l),
        w: toNumber(dimensions.w),
        h: toNumber(dimensions.h),
        radius: toNumber(dimensions.radius),
        wallThickness: toNumber(dimensions.wallThickness, 2)
    };
}

function sanitizeDividerArray(values) {
    if (!Array.isArray(values)) return [];
    return values
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
}

function sanitizeHiddenSegments(hiddenSegments = {}) {
    const result = {};

    Object.keys(hiddenSegments)
        .sort()
        .forEach((key) => {
            if (hiddenSegments[key]) {
                result[key] = true;
            }
        });

    return result;
}

function sanitizeConfigSnapshot(snapshot = {}) {
    return {
        dimensions: sanitizeDimensions(snapshot.dimensions),
        dividers: {
            x: sanitizeDividerArray(snapshot.dividers?.x),
            z: sanitizeDividerArray(snapshot.dividers?.z)
        },
        hiddenSegments: sanitizeHiddenSegments(snapshot.hiddenSegments),
        colorTheme: typeof snapshot.colorTheme === 'string' ? snapshot.colorTheme : 'brown'
    };
}

function sanitizeTopViewPreview(preview) {
    if (typeof preview !== 'string') return null;
    const trimmed = preview.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_TOP_VIEW_PREVIEW_LENGTH) return null;
    if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(trimmed)) return null;
    return trimmed;
}

function buildConfigSnapshotFromState(state = {}) {
    return sanitizeConfigSnapshot({
        dimensions: state.dimensions,
        dividers: state.dividers,
        hiddenSegments: state.hiddenSegments,
        colorTheme: state.colorTheme
    });
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    }

    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${pairs.join(',')}}`;
}

function hashString(input) {
    let hash = 2166136261;

    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
    }

    return (hash >>> 0).toString(36);
}

function createFingerprint(configSnapshot) {
    const canonicalJson = stableStringify(configSnapshot);
    return `cfg_${hashString(canonicalJson)}_${canonicalJson.length}`;
}

function formatDimensionValue(value) {
    const rounded = Math.round(toNumber(value) * 10) / 10;
    if (Number.isInteger(rounded)) return String(rounded);
    return String(rounded);
}

function buildTrayName(configSnapshot) {
    const { l, w, h } = configSnapshot.dimensions;
    return `Tray ${formatDimensionValue(l)}x${formatDimensionValue(w)}x${formatDimensionValue(h)}mm`;
}

function normalizeCartItem(rawItem) {
    if (!rawItem || typeof rawItem !== 'object') return null;
    if (typeof rawItem.fingerprint !== 'string' || rawItem.fingerprint.length === 0) return null;

    const configSnapshot = sanitizeConfigSnapshot(rawItem.configSnapshot);
    const unitPrice = Math.max(0, Math.round(toNumber(rawItem.unitPrice)));
    const quantity = Math.max(1, Math.floor(toNumber(rawItem.quantity, 1)));
    const addedAt = typeof rawItem.addedAt === 'string' ? rawItem.addedAt : new Date().toISOString();
    const updatedAt = typeof rawItem.updatedAt === 'string' ? rawItem.updatedAt : addedAt;
    const name =
        typeof rawItem.name === 'string' && rawItem.name.trim().length > 0
            ? rawItem.name.trim()
            : buildTrayName(configSnapshot);
    const topViewPreview = sanitizeTopViewPreview(rawItem.topViewPreview);

    return {
        fingerprint: rawItem.fingerprint,
        name,
        configSnapshot,
        topViewPreview,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
        addedAt,
        updatedAt
    };
}

function readCartState() {
    const parsed = readStorageJson(CART_STORAGE_KEY, DEFAULT_CART_STATE);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
        return cloneJsonSafe(DEFAULT_CART_STATE);
    }

    const items = parsed.items.map((item) => normalizeCartItem(item)).filter(Boolean);
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;

    return { items, updatedAt };
}

function writeCartState(cartState) {
    writeStorageJson(CART_STORAGE_KEY, cartState);
    return cartState;
}

function readOrders() {
    const parsed = readStorageJson(ORDER_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
}

function writeOrders(orders) {
    writeStorageJson(ORDER_STORAGE_KEY, orders);
}

function normalizePhone(phone) {
    return String(phone || '').replace(/[\s.-]/g, '');
}

export function isValidVietnamPhone(phone) {
    const normalized = normalizePhone(phone);
    return /^(?:\+84|0)\d{8,10}$/.test(normalized);
}

function validateCustomerInfo(customerInfo = {}) {
    const customer = {
        name: String(customerInfo.name || '').trim(),
        phone: normalizePhone(customerInfo.phone),
        address: String(customerInfo.address || '').trim()
    };

    if (!customer.name) {
        throw new Error('Name is required.');
    }

    if (!customer.phone) {
        throw new Error('Phone number is required.');
    }

    if (!isValidVietnamPhone(customer.phone)) {
        throw new Error('Invalid phone number format.');
    }

    if (!customer.address) {
        throw new Error('Address is required.');
    }

    return customer;
}

function calculateCartTotals(items = []) {
    const subtotal = items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
    return {
        subtotal,
        total: subtotal
    };
}

function generateOrderId(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 6; i += 1) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `ORD-${yyyy}${mm}${dd}-${random}`;
}

export function buildCartItemFromState(state, options = {}) {
    const configSnapshot = buildConfigSnapshotFromState(state);
    const fingerprint = createFingerprint(configSnapshot);
    const unitPrice = calculateTrayPrice(configSnapshot.dimensions);
    const now = new Date().toISOString();
    const topViewPreview = sanitizeTopViewPreview(options.topViewPreview);

    return {
        fingerprint,
        name: buildTrayName(configSnapshot),
        configSnapshot,
        topViewPreview,
        unitPrice,
        quantity: 1,
        lineTotal: unitPrice,
        addedAt: now,
        updatedAt: now
    };
}

export function getCart() {
    return readCartState();
}

export function getCartTrayCount() {
    const cart = getCart();
    return cart.items.reduce((sum, item) => sum + Math.max(0, Math.floor(toNumber(item.quantity, 0))), 0);
}

export function addOrMergeCartItem(cartItem) {
    const normalized = normalizeCartItem(cartItem);
    if (!normalized) {
        throw new Error('Invalid cart item.');
    }

    const cart = readCartState();
    const now = new Date().toISOString();
    const existingIndex = cart.items.findIndex((item) => item.fingerprint === normalized.fingerprint);

    if (existingIndex >= 0) {
        const existing = cart.items[existingIndex];
        const mergedQuantity = existing.quantity + normalized.quantity;
        const mergedPreview = normalized.topViewPreview || existing.topViewPreview || null;
        cart.items[existingIndex] = {
            ...existing,
            name: normalized.name,
            configSnapshot: normalized.configSnapshot,
            topViewPreview: mergedPreview,
            unitPrice: normalized.unitPrice,
            quantity: mergedQuantity,
            lineTotal: normalized.unitPrice * mergedQuantity,
            updatedAt: now
        };
    } else {
        cart.items.push({
            ...normalized,
            topViewPreview: normalized.topViewPreview || null,
            addedAt: normalized.addedAt || now,
            updatedAt: now,
            lineTotal: normalized.unitPrice * normalized.quantity
        });
    }

    cart.updatedAt = now;
    return writeCartState(cart);
}

export function updateItemQuantity(fingerprint, nextQty) {
    const qty = Math.floor(toNumber(nextQty));
    if (qty <= 0) {
        return removeCartItem(fingerprint);
    }

    const cart = readCartState();
    const now = new Date().toISOString();
    let changed = false;

    cart.items = cart.items.map((item) => {
        if (item.fingerprint !== fingerprint) return item;
        changed = true;
        return {
            ...item,
            quantity: qty,
            lineTotal: item.unitPrice * qty,
            updatedAt: now
        };
    });

    if (!changed) return cart;

    cart.updatedAt = now;
    return writeCartState(cart);
}

export function removeCartItem(fingerprint) {
    const cart = readCartState();
    const nextItems = cart.items.filter((item) => item.fingerprint !== fingerprint);
    if (nextItems.length === cart.items.length) return cart;

    cart.items = nextItems;
    cart.updatedAt = new Date().toISOString();
    return writeCartState(cart);
}

export function clearCart() {
    writeCartState({
        items: [],
        updatedAt: new Date().toISOString()
    });
}

export function createLocalOrder(customerInfo) {
    const cart = readCartState();
    if (cart.items.length === 0) {
        throw new Error('Cart is empty.');
    }

    const customer = validateCustomerInfo(customerInfo);
    const totals = calculateCartTotals(cart.items);
    const now = new Date();
    const order = {
        orderId: generateOrderId(now),
        createdAt: now.toISOString(),
        customer,
        items: cloneJsonSafe(cart.items),
        subtotal: totals.subtotal,
        total: totals.total
    };

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);
    clearCart();

    return {
        orderId: order.orderId,
        total: order.total
    };
}

export { calculateCartTotals, CART_STORAGE_KEY, ORDER_STORAGE_KEY };
