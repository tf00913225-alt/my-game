// Original vector artwork for this isolated sample. No external asset/license.
// Four independently drawn views, each with neutral and two stride silhouettes.
import fs from 'node:fs';
const outline='#243d39',robe='#477d73',light='#89aa94',skin='#d5ae81';
function front(back,pose){
 const left=pose===1?177:pose===2?188:184,right=pose===2?177:pose===1?188:184;
 return `<path d="M48 135L43 ${left} 60 ${left} 70 143 78 ${right} 97 ${right} 91 135" fill="#344e49" stroke="${outline}" stroke-width="3"/>
 <path d="M43 ${left-4}l-10 12q16 7 29-1l-2-11M78 ${right-4}l-1 12q16 6 28-1l-10-11" fill="#242f2f"/>
 <path d="M48 68Q28 74 ${pose===1?21:29} ${pose===1?121:136}l17 4 9-39-10 57q27 16 57 0l-8-57 10 ${pose===2?40:26} 18-5Q111 75 91 68" fill="${robe}" stroke="${outline}" stroke-width="3"/>
 <path d="M51 76l20 29 18-30-9 54H59z" fill="${back?'#35695f':'#e1d9b8'}"/><path d="M45 123h51l3 13H43z" fill="#745336"/>
 <path d="M51 139l-4 19m14-20-4 25m26-25 8 23" stroke="${light}" stroke-width="2"/>
 <path d="M91 134l${pose===1?13:5} 32 9-3-7-32" fill="#b77745"/>
 <path d="M${back?91:37} 67l${back?13:-14} 88" stroke="#283c38" stroke-width="9"/><path d="M${back?91:37} 68l${back?13:-14} 84" stroke="#b3a37e" stroke-width="3"/>
 <ellipse cx="70" cy="46" rx="25" ry="29" fill="${skin}" stroke="${outline}" stroke-width="2"/>
 ${back?'<path d="M45 39q-1-32 25-32t25 32l-5 40-20 10-21-11z" fill="#283d38"/><path d="M57 39v34m13-40v46m13-40v35" stroke="#476056" stroke-width="2"/>':'<path d="M44 43q-6-38 27-37 32 0 25 41L84 25 71 32 54 26z" fill="#283d38"/><path d="M55 47l8-1m15 0 8 1" stroke="#3c4132" stroke-width="3"/><path d="M68 61l5 1m-10 7q8 4 15-1" stroke="#9a7350" fill="none" stroke-width="2"/>'}
 <ellipse cx="70" cy="10" rx="14" ry="9" fill="#283d38"/><path d="M51 24l38-1" stroke="#be8d56" stroke-width="5"/>`;
}
function side(direction,pose){
 const left=direction==='left';
 // Profile geometry is drawn separately, not a reflected front view.
 const head=left?'M79 18q-28-4-34 17l-9 16 10 4 3 15 19 6 16-13 4-27z':'M61 18q28-4 34 17l9 16-10 4-3 15-19 6-16-13-4-27z';
 const hair=left?'M44 37q-4-31 31-31 27 5 21 35l-10 37-20 8 5-23 8-26-16-11z':'M96 37q4-31-31-31-27 5-21 35l10 37 20 8-5-23-8-26 16-11z';
 const a=pose===1?39:pose===2?69:53,b=pose===2?91:pose===1?65:85;
 return `<path d="M56 133L${a} 180l17 6 10-39 6 1 ${b-2} 181l18-3-20-47" fill="#304d47" stroke="${outline}" stroke-width="3"/>
 <path d="M${a} 177l-8 11q11 8 26 2l-1-10M${b-2} 176l-2 12q15 6 28-1l-12-11" fill="#242f2f"/>
 <path d="M57 69q-17 14-13 42l-5 45q28 13 57 0l-10-55q7-22-9-32z" fill="${robe}" stroke="${outline}" stroke-width="3"/>
 <path d="M${left?51:83} 77l-2 43" stroke="#d9d3b2" stroke-width="7"/><path d="M44 123h48v13H43z" fill="#745336"/>
 <path d="M${left?74:58} 78q${left?-2:2} 17 ${pose===1?-18:pose===2?18:0} 42l14 6q7-29-4-46" fill="#649486" stroke="${outline}" stroke-width="3"/>
 <path d="M48 141l-3 15m39-16 6 17" stroke="${light}" stroke-width="2"/>
 <path d="M${left?88:48} 74l${left?13:-13} 80" stroke="#293f39" stroke-width="9"/><path d="M${left?88:48} 74l${left?13:-13} 80" stroke="#b7a983" stroke-width="3"/>
 <path d="${head}" fill="${skin}" stroke="${outline}" stroke-width="2"/><path d="${hair}" fill="#283d38"/>
 <path d="M${left?47:86} 45h7" stroke="#354135" stroke-width="3"/><ellipse cx="70" cy="10" rx="14" ry="9" fill="#283d38"/><path d="M51 24l37-1" stroke="#be8d56" stroke-width="5"/>`;
}
const symbols=['up','down','left','right'].flatMap(direction=>[0,1,2].map(pose=>`<symbol id="${direction}-${pose}" viewBox="0 0 140 200">${direction==='up'||direction==='down'?front(direction==='up',pose):side(direction,pose)}</symbol>`));
fs.writeFileSync(new URL('./traveller.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('\n')}</svg>\n`);
