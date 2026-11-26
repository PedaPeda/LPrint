// Builds the self-contained index.html from src/ (no dependencies).
// Usage: node build.js
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const html = src('template.html')
  .replace('/*CORE*/', () => src('core.js'))
  .replace('/*I18N*/', () => src('i18n.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html written (' + Math.round(html.length / 1024) + ' KB)');
