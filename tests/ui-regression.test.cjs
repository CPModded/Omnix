const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const viewPath = path.join(__dirname, '..', 'src', 'dashboard', 'views', 'admin-omnix-ia.ejs');
const view = fs.readFileSync(viewPath, 'utf8');

test('admin chat drawer stays visible on mobile instead of showing only the blur backdrop', () => {
  assert.match(view, /\.rail\{display:flex!important;z-index:1002;pointer-events:auto\}/);
  assert.match(view, /\.drawer-backdrop\{z-index:1001;pointer-events:auto\}/);
  assert.match(view, /drawerButton\?\.addEventListener\('click'/);
  assert.match(view, /el\.onclick=\(\)=>\{setDrawer\(false\);openSession\(s\.id\)\}/);
});

test('each chat message reveals a copy button only after that message is selected', () => {
  assert.match(view, /\.msg\.selected \.msg-tools\{opacity:1;visibility:visible;pointer-events:auto\}/);
  assert.match(view, /copy\.className='copy-message'/);
  assert.match(view, /row\.addEventListener\('click',e=>\{if\(e\.target\.closest\('\.copy-message'\)\)return;selectMessage\(\)\}\)/);
  assert.match(view, /navigator\.clipboard\.writeText\(value\)/);
});

test('admin chat EJS template compiles', () => {
  assert.doesNotThrow(() => ejs.compile(view, { filename: viewPath }));
});
