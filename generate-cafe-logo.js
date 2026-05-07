const { createCanvas } = require('canvas');
const fs = require('fs');

function drawCafeLogo(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const s = w / 160;
  
  ctx.clearRect(0, 0, w, h);
  
  // Cercle blanc
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(38 * s, 40 * s, 30 * s, 0, Math.PI * 2);
  ctx.stroke();
  
  // Soleil
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(38 * s, 30 * s, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  
  // Vague 1
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18 * s, 46 * s);
  ctx.quadraticCurveTo(28 * s, 40 * s, 38 * s, 46 * s);
  ctx.quadraticCurveTo(48 * s, 52 * s, 58 * s, 46 * s);
  ctx.stroke();
  
  // Vague 2
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(20 * s, 56 * s);
  ctx.quadraticCurveTo(30 * s, 50 * s, 40 * s, 56 * s);
  ctx.quadraticCurveTo(50 * s, 62 * s, 60 * s, 56 * s);
  ctx.stroke();
  ctx.globalAlpha = 1;
  
  // Texte CAFÉ
  ctx.fillStyle = 'white';
  ctx.font = `bold ${18 * s}px Georgia, serif`;
  ctx.fillText('CAFÉ', 80 * s, 36 * s);
  
  // Texte DE LA PLAGE
  ctx.font = `${10 * s}px Georgia, serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('DE LA PLAGE', 80 * s, 52 * s);
}

const canvas1 = createCanvas(160, 80);
drawCafeLogo(canvas1);
fs.writeFileSync('passes/FidelEasy.pass/logo.png', canvas1.toBuffer('image/png'));

const canvas2 = createCanvas(320, 160);
drawCafeLogo(canvas2);
fs.writeFileSync('passes/FidelEasy.pass/logo@2x.png', canvas2.toBuffer('image/png'));

console.log('Logo Café de la Plage créé !');