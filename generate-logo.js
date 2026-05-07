const { createCanvas } = require('canvas');
const fs = require('fs');

function drawLogo(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const s = w / 160;

  ctx.clearRect(0, 0, w, h);

  // Carte contour
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.roundRect(0, 7 * s, 52 * s, 36 * s, 6 * s);
  ctx.stroke();

  // Bande dorée
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.roundRect(0, 7 * s, 52 * s, 14 * s, [6 * s, 6 * s, 0, 0]);
  ctx.fill();

  // Puce
  ctx.beginPath();
  ctx.arc(38 * s, 33 * s, 5 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Texte Fidel
  ctx.fillStyle = 'white';
  ctx.font = `bold ${22 * s}px Arial`;
  ctx.fillText('Fidel', 62 * s, 28 * s);

  // Texte Easy
  ctx.fillStyle = '#d4af37';
  ctx.fillText('Easy', 62 * s, 50 * s);
}

const canvas1 = createCanvas(160, 50);
drawLogo(canvas1);
fs.writeFileSync('passes/FidelEasy.pass/logo.png', canvas1.toBuffer('image/png'));

const canvas2 = createCanvas(320, 100);
drawLogo(canvas2);
fs.writeFileSync('passes/FidelEasy.pass/logo@2x.png', canvas2.toBuffer('image/png'));

console.log('Logos créés !');