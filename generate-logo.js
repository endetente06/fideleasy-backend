const { createCanvas } = require('canvas');
const fs = require('fs');

function drawLogo(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const s = w / 160;

  ctx.clearRect(0, 0, w, h);

  // Carte contour (plus petite)
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.roundRect(0, 8 * s, 38 * s, 26 * s, 4 * s);
  ctx.stroke();

  // Bande dorée
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.roundRect(0, 8 * s, 38 * s, 10 * s, [4 * s, 4 * s, 0, 0]);
  ctx.fill();

  // Puce
  ctx.beginPath();
  ctx.arc(28 * s, 24 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Texte FidelEasy sur une ligne
  ctx.fillStyle = 'white';
  ctx.font = `bold ${16 * s}px Arial`;
  ctx.fillText('Fidel', 44 * s, 20 * s);
  ctx.fillStyle = '#d4af37';
  ctx.fillText('Easy', 44 * s, 38 * s);
}

const canvas1 = createCanvas(160, 50);
drawLogo(canvas1);
fs.writeFileSync('passes/FidelEasy.pass/logo.png', canvas1.toBuffer('image/png'));

const canvas2 = createCanvas(320, 100);
drawLogo(canvas2);
fs.writeFileSync('passes/FidelEasy.pass/logo@2x.png', canvas2.toBuffer('image/png'));

console.log('Logos créés !');