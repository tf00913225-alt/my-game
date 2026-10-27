import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=fs.readFileSync(new URL('../js/00-main.js',import.meta.url),'utf8');
const owner=source.slice(source.indexOf('function battleItemIconMarkup('),source.indexOf('function renderBattleItemMenu('));
const context=vm.createContext({});vm.runInContext(owner,context);

test('battle icon presentation preserves literal glyphs without requesting them as image URLs',()=>{
    assert.equal(context.battleItemIconMarkup({icon:'✦'}),'<span aria-hidden="true">✦</span>');
    assert.equal(context.battleItemIconMarkup({icon:''}),'');
    assert.equal(context.battleItemIconMarkup({icon:'<span>原圖示</span>'}),'<span>原圖示</span>');
    assert.equal(context.battleItemIconMarkup({icon:'<>&"'}),'<span aria-hidden="true">&lt;&gt;&amp;&quot;</span>');
});

test('existing relative image assets retain their original image transport and escaped query',()=>{
    const html=context.battleItemIconMarkup({icon:'assets/items/potion.webp?v=1&size=2'});
    assert.match(html,/^<img src="assets\/items\/potion\.webp\?v=1&amp;size=2"/);
    assert.match(html,/alt="" aria-hidden="true" draggable="false" decoding="async">$/);
});
