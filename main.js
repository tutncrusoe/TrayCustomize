const widthInput = document.getElementById('widthInput');
const depthInput = document.getElementById('depthInput');
const heightInput = document.getElementById('heightInput');
const widthLabel = document.getElementById('widthLabel');
const depthLabel = document.getElementById('depthLabel');
const heightLabel = document.getElementById('heightLabel');
const canvas = document.getElementById('canvas');
const isoBox = document.getElementById('isoBox');
const toggleGridBtn = document.getElementById('toggleGridBtn');

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateDimensions() {
  const width = clamp(Number(widthInput.value) || 0, Number(widthInput.min), Number(widthInput.max));
  const depth = clamp(Number(depthInput.value) || 0, Number(depthInput.min), Number(depthInput.max));
  const height = clamp(Number(heightInput.value) || 0, Number(heightInput.min), Number(heightInput.max));

  document.documentElement.style.setProperty('--width', width);
  document.documentElement.style.setProperty('--depth', depth);
  document.documentElement.style.setProperty('--height', height);
  document.documentElement.style.setProperty('--widthpx', `calc(${width} * var(--scale))`);
  document.documentElement.style.setProperty('--depthpx', `calc(${depth} * var(--scale))`);
  document.documentElement.style.setProperty('--heightpx', `calc(${height} * var(--scale))`);

  widthLabel.textContent = width;
  depthLabel.textContent = depth;
  heightLabel.textContent = height;

  const heightOffset = Math.max(0, (height - 20) * 0.6);
  isoBox.style.transform = `rotateX(60deg) rotateZ(45deg) translateY(${40 + heightOffset}px)`;
}

[widthInput, depthInput, heightInput].forEach(input => {
  input.addEventListener('input', updateDimensions);
});

toggleGridBtn.addEventListener('click', () => {
  canvas.classList.toggle('grid-off');
});

updateDimensions();
