const { createCanvas } = require('canvas');
const fs = require('fs');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#07070f';
  ctx.font = 'bold ' + (size*0.4) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size/2, size/2);
  
  return canvas.toBuffer('image/png');
}

fs.writeFileSync('C:/fideleasy-dashboard/public/icon-192.png', drawIcon(192));
fs.writeFileSync('C:/fideleasy-dashboard/public/icon-512.png', drawIcon(512));
console.log('Icônes créées !');