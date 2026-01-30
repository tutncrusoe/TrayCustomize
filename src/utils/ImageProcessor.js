export function processLogo(source, themeColor) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 512; // Standardize size
            canvas.width = size;
            canvas.height = size;

            // Maintain aspect ratio
            const aspect = img.width / img.height;
            let drawW = size;
            let drawH = size;
            if (aspect > 1) {
                drawH = size / aspect;
            } else {
                drawW = size * aspect;
            }

            ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);

            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;

            // Palette Definition
            // Brown Theme: Logo should be White (#EFEBE9) on transparent/background
            // White Theme: Logo should be Brown (#4E342E) on transparent/background
            // Actually, the user said "Converted to 2 colors".
            // We will map dark pixels to the "Ink" color and light pixels to transparent (or the "Paper" color if we wanted a full card).
            // But since it's a logo on the tray, transparency is better for the background.

            const colorBrown = { r: 78, g: 52, b: 46 };   // #4E342E
            const colorWhite = { r: 239, g: 235, b: 233 }; // #EFEBE9

            let inkColor;
            if (themeColor === 'white') {
                inkColor = colorBrown;
            } else {
                // Brown, Red, Blue -> Dark Base -> White Ink
                inkColor = colorWhite;
            }

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                if (a < 50) continue; // Skip transparent

                // Simple luminance
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                if (lum < 128) {
                    // Dark pixel -> Ink Color
                    data[i] = inkColor.r;
                    data[i + 1] = inkColor.g;
                    data[i + 2] = inkColor.b;
                    data[i + 3] = 255;
                } else {
                    // Light pixel -> Transparent (or maybe White/Brown depending on desire)
                    // Let's make it transparent to blend with the wood?
                    // User said "converted to 2 colors". If the tray is brown, the logo should be white.
                    // If the input image has a white background, we want that white background to disappear?
                    // Or do we want a square sticker?
                    // "Khắc Chữ / Logo" implies engraving or printing. Transparency for background is safer.
                    data[i + 3] = 0;
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
        };
        img.onerror = reject;
        img.src = source;
    });
}

export function createTextLogo(text, themeColor) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const colorBrown = "#4E342E";
    const colorWhite = "#EFEBE9";

    let inkColor;
    if (themeColor === 'white') {
        inkColor = colorBrown;
    } else {
        inkColor = colorWhite;
    }

    ctx.fillStyle = inkColor;
    ctx.font = "bold 100px 'Plus Jakarta Sans', sans-serif"; // Large font
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw text
    ctx.fillText(text, size / 2, size / 2);

    return canvas.toDataURL();
}
