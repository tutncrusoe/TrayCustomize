function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function calculateTrayPrice(dimensions) {
    const l = toNumber(dimensions?.l);
    const w = toNumber(dimensions?.w);
    const h = toNumber(dimensions?.h);
    const wallThickness = toNumber(dimensions?.wallThickness, 2);

    const baseThick = 2;
    const volBase = l * w * baseThick;
    const volWalls = (2 * l + 2 * w) * h * wallThickness;
    const totalVolMm3 = volBase + volWalls;
    const totalVolCm3 = totalVolMm3 / 1000;

    const massGrams = totalVolCm3 * 1.25;
    const pricePerGram = 500;
    const baseFee = 50000;

    return Math.round((massGrams * pricePerGram + baseFee) / 1000) * 1000;
}

export function formatVND(amount) {
    const value = Math.max(0, Math.round(toNumber(amount)));
    return `${value.toLocaleString('vi-VN')} VND`;
}
