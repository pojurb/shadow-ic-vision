import fs from 'node:fs';

const file = 'private/knowledge/batches/input/dd496b2d985d89057c0bcd4d9754f7975eb4b6eb16a690bbd8dd09f676c48789.json';
let buffer = fs.readFileSync(file);
let repaired = false;

// Remove BOM
if (buffer.length > 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
  buffer = buffer.slice(3);
  repaired = true;
}

let content = buffer.toString('utf8');
let json;

try {
  json = JSON.parse(content);
} catch (e) {
  // If JSON.parse fails, it might be due to unescaped characters or bad encoding artifacts
  // from our previous PowerShell slice operation.
  // We'll replace problematic invalid JSON things like loose control chars or fix quotes.
  // We can try to use a regex or clean up known issues if it fails.
  console.log('JSON.parse failed. Trying basic repair...');
  
  // Clean control chars except \n, \r, \t
  content = content.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  try {
    json = JSON.parse(content);
    repaired = true;
  } catch(e2) {
    console.error('Fatal parse error:', e2.message);
    process.exit(1);
  }
}

const outContent = JSON.stringify(json, null, 2) + '\n';
if (content !== outContent) {
  repaired = true;
}

fs.writeFileSync(file, outContent, 'utf8');

// Validate
let passed = false;
try {
  JSON.parse(fs.readFileSync(file, 'utf8'));
  passed = true;
} catch(e) {}

console.log('repaired: ' + repaired);
console.log('passed: ' + passed);
console.log('sourceDocumentHash: ' + json.sourceDocumentHash);
console.log('sourceRelativePath: ' + json.sourceRelativePath);
