from pathlib import Path

# Restore the V173.48/49 premium equipment-card geometry while keeping the
# V173.51 purchase-state, unlimited-refresh and image-retry behavior.
p=Path('js/56-v173.51-shop-qa.js')
s=p.read_text(encoding='utf-8')
s=s.replace('v=173.51-'+"\"+Date.now()", 'v=173.56-'+"\"+Date.now()") if False else s
s=s.replace('"v=173.51-"+Date.now()', '"v=173.56-"+Date.now()')

old_image='''function image(i,index){const src=String(i?.assetPath||"");if(!src)return'<span class="v17351-shop-fallback">'+slot(i).slice(0,1)+'</span>';return'<span class="v17351-shop-image v17346-rarity-'+q(i)+'"><img src="'+esc(src)+'?v=173.51" data-src="'+esc(src)+'" data-i="'+index+'" alt="" draggable="false" decoding="async" loading="eager" onerror="v17351RetryShopImage(this)"><span class="v17351-shop-fallback">'+slot(i).slice(0,1)+'</span></span>'}
'''
new_image='''function image(i,index){const src=String(i?.assetPath||""),rarity=q(i),fallback=slot(i).slice(0,1);if(!src)return'<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+' v17351-shop-image image-failed"><span class="v17351-shop-fallback">'+fallback+'</span></span>';return'<span class="v169-item-art v169-equipment-art v17346-rarity-'+rarity+' v17351-shop-image"><img src="'+esc(src)+'?v=173.56" data-src="'+esc(src)+'" data-i="'+index+'" alt="" draggable="false" decoding="async" loading="eager" onerror="v17351RetryShopImage(this)"><span class="v17351-shop-fallback">'+fallback+'</span></span>'}
window.v17351PreviewEquipmentShopOffer=function(index){const i=Math.max(0,Math.min(SIZE-1,safe(index))),item=offers()[i];if(!item||typeof window.v132ShowRewardModal!=="function")return;const price=safe(item.shopPrice||item.price),html='<div class="v132-reward-modal-inner v17346-shop-preview-modal" data-rarity="'+esc(q(item))+'"><h3>'+esc(item.name||"裝備")+'</h3><div class="v17346-shop-preview-art">'+image(item,i)+'</div><div class="v17346-shop-preview-info"><span>'+slot(item)+'</span><strong>'+stats(item)+'</strong></div><div class="v17346-shop-preview-price">'+price.toLocaleString("zh-TW")+' 金幣</div>'+(item.reforgeSlots?'<div class="v17346-shop-preview-reforge">[可冶煉]</div>':'')+'<div class="v132-reward-actions"><button type="button" onclick="v132CloseRewardModal()">返回</button></div></div>';window.v132ShowRewardModal(html)};
window.v17346PreviewEquipmentShopOffer=window.v17351PreviewEquipmentShopOffer;
'''
if old_image not in s:
    raise SystemExit('shop image anchor not found')
s=s.replace(old_image,new_image,1)

start=s.index('function render(force){')
end=s.index('window.v17351RenderEquipmentShop=',start)
old_render=s[start:end]
new_render='''function render(force){const root=document.querySelector("#homeFeatureModalBody .v17345-equipment-shop");if(!root)return false;const st=loadState(),all=offers();if(!all.length)return false;const bs=bought(st.refreshCount),sig=st.date+"|"+st.refreshCount+"|"+[...bs].join(","),broken=root.textContent.includes("售價待設定")||root.querySelectorAll(".v17345-equipment-icon img").length===0;if(!force&&root.dataset.v17351===sig&&!broken)return true;root.dataset.v17351=sig;const currentGold=safe(typeof gold!=="undefined"?gold:0);root.innerHTML='<div class="v17345-equipment-wallet"><span>裝備商店</span><b>金幣 '+currentGold.toLocaleString("zh-TW")+'</b></div><div class="v17345-equipment-grid">'+all.map((i,n)=>{const done=bs.has(n),price=safe(i.shopPrice||i.price),canBuy=!done&&currentGold>=price,stateClass=done?"purchased is-affordable":(canBuy?"is-affordable":"is-unaffordable");return'<article class="v17345-equipment-card v17346-shop-card '+stateClass+'" data-rarity="'+esc(q(i))+'" role="button" tabindex="0" aria-label="預覽 '+esc(i.name||"裝備")+'" onclick="v17351PreviewEquipmentShopOffer('+n+')" onkeydown="if(event.key===\\'Enter\\'||event.key===\\' \\'){event.preventDefault();v17351PreviewEquipmentShopOffer('+n+')}"><div class="v17345-equipment-icon v17346-gear-art">'+image(i,n)+'</div><b class="v17346-shop-name">'+esc(i.name||"裝備")+'</b><span class="v17346-shop-slot">'+slot(i)+'</span><span class="v17346-stat">'+stats(i)+'</span>'+(i.reforgeSlots?'<span class="v17346-reforge-mini">[可冶煉]</span>':'')+'<button class="v17346-shop-buy '+(done?"v17351-purchased-buy":"")+'" type="button" '+(done?'disabled aria-disabled="true"':canBuy?'onclick="event.stopPropagation();v17351BuyEquipmentShopOffer('+n+')"':'disabled aria-disabled="true"')+'>'+(done?"✓ 已購買":price.toLocaleString("zh-TW")+" 金幣")+'</button></article>'}).join("")+'</div><div class="v17345-equipment-refresh v17351-free-refresh"><div><b>測試模式・無限免費刷新</b><span>目前第 '+st.refreshCount+' 次刷新；測試期間不扣金幣、不設上限。</span></div><button type="button" onclick="v17351RefreshEquipmentShop()">免費刷新</button></div>';return true}
'''
s=s[:start]+new_render+s[end:]
p.write_text(s,encoding='utf-8')

# Remove the V173.51 alternate card geometry that overrode the premium layout.
p=Path('css/53-v173.51-qa.css')
s=p.read_text(encoding='utf-8')
start=s.index('#game-stage #homeFeatureModal .v17351-shop-card{')
end=s.index('\n#game-stage #homeFeatureModal .v17351-achievement-shell{',start)
replacement='''#game-stage #homeFeatureModal .v17351-shop-image{position:relative!important;display:grid!important;place-items:center!important;width:100%!important;height:100%!important;overflow:hidden!important}
#game-stage #homeFeatureModal .v17351-shop-image img{position:relative!important;z-index:2!important;width:100%!important;height:100%!important;object-fit:contain!important}
#game-stage #homeFeatureModal .v17351-shop-fallback{position:absolute!important;inset:0!important;z-index:1!important;display:grid!important;place-items:center!important;color:#dcb65f!important;font-size:20px!important;font-weight:900!important}.v17351-shop-image:not(.image-failed) .v17351-shop-fallback{opacity:.08!important}
#game-stage #homeFeatureModal .v17346-shop-card.purchased .v17346-shop-buy.v17351-purchased-buy{color:#b8ccb0!important;border-color:#586a4f!important;background:linear-gradient(180deg,#242d20,#11160f)!important;box-shadow:none!important;opacity:1!important}
#game-stage #homeFeatureModal .v17351-free-refresh button{color:#261704!important;border-color:#d4a44b!important;background:linear-gradient(180deg,#f2cd73,#c78930)!important}
'''
s=s[:start]+replacement+s[end:]
p.write_text(s,encoding='utf-8')

# Bump the runtime/cache chain so mobile Chrome cannot reuse the regressed shop JS/CSS.
p=Path('js/20-anonymous-20.js')
s=p.read_text(encoding='utf-8')
if 'const V_ASSET_VERSION="173.55";' not in s:
    raise SystemExit('V_ASSET_VERSION 173.55 not found')
s=s.replace('const V_ASSET_VERSION="173.55";','const V_ASSET_VERSION="173.56";',1)
s=s.replace('dataset.runtimeReady="173.55"','dataset.runtimeReady="173.56"',1)
p.write_text(s,encoding='utf-8')

p=Path('js/51-v169-rpg-ui.js')
s=p.read_text(encoding='utf-8').replace('js/equipment-progression.js?v=173.55','js/equipment-progression.js?v=173.56')
p.write_text(s,encoding='utf-8')

p=Path('js/equipment-progression.js')
s=p.read_text(encoding='utf-8').replace('css/52-v173.50-inventory-qol.css?v=173.55','css/52-v173.50-inventory-qol.css?v=173.56').replace('js/53-v173.50-inventory-qol.js?v=173.55','js/53-v173.50-inventory-qol.js?v=173.56')
p.write_text(s,encoding='utf-8')

p=Path('js/53-v173.50-inventory-qol.js')
s=p.read_text(encoding='utf-8').replace('css/53-v173.51-qa.css?v=173.55','css/53-v173.51-qa.css?v=173.56')
for name in ['54-v173.51-battle-qa.js','55-v173.51-inventory-qa.js','56-v173.51-shop-qa.js','57-v173.51-quest-qa.js']:
    s=s.replace(name+'?v=173.55',name+'?v=173.56')
p.write_text(s,encoding='utf-8')

p=Path('index.html')
s=p.read_text(encoding='utf-8').replace('173.55','173.56')
p.write_text(s,encoding='utf-8')

for p in Path('tests').glob('*.js'):
    s=p.read_text(encoding='utf-8')
    n=s.replace('173\\.55','173\\.56').replace('173.55','173.56')
    if n!=s:
        p.write_text(n,encoding='utf-8')

Path('tests/v173.56-shop-layout-preview-regression.test.js').write_text(r'''"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const shop=fs.readFileSync("js/56-v173.51-shop-qa.js","utf8");
const css=fs.readFileSync("css/53-v173.51-qa.css","utf8");
const loader=fs.readFileSync("js/20-anonymous-20.js","utf8");
const index=fs.readFileSync("index.html","utf8");
assert.match(shop,/v17345-equipment-card v17346-shop-card/);
assert.match(shop,/v17345-equipment-icon v17346-gear-art/);
assert.match(shop,/v17346-shop-name/);
assert.match(shop,/v17346-shop-slot/);
assert.match(shop,/v17346-stat/);
assert.match(shop,/v17346-shop-buy/);
assert.match(shop,/onclick=\\"v17351PreviewEquipmentShopOffer\(/);
assert.match(shop,/window\.v17351PreviewEquipmentShopOffer=function/);
assert.match(shop,/window\.v17346PreviewEquipmentShopOffer=window\.v17351PreviewEquipmentShopOffer/);
assert.doesNotMatch(shop,/v17345-equipment-card v17351-shop-card/);
assert.doesNotMatch(css,/\.v17351-shop-card\{display:grid!important;grid-template-columns:88px/);
assert.match(css,/\.v17346-shop-card\.purchased \.v17346-shop-buy\.v17351-purchased-buy/);
assert.match(loader,/const V_ASSET_VERSION="173\.56"/);
assert.match(index,/<title>四象江湖傳 V173\.56<\/title>/);
console.log("✓ V173.56 restores premium equipment shop layout and click preview");
''',encoding='utf-8')
print('V173.56 shop regression fix applied')
