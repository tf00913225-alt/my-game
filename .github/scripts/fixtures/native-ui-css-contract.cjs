"use strict";

// Source tests for shared widgets compare their authored spacing units.
// Native-only literals are expressed in 1080 space; shared calc() lengths
// retain their authored number. This does not alter the CSS used by browser
// fixtures or production QA, which must validate the real native projection.
module.exports=function authoredUiCss(source){
    const values=[];
    let text=source.replace(/calc\((\d+(?:\.\d+)?) \* var\(--ui-length-unit,1px\)\)/g,(_,n)=>{
        values.push(n+'px');return '@@nativeUnit'+(values.length-1)+'@@';
    });
    text=text.replace(/var\(--layout-(?:inline|block)-size,[\d.]+px\)/g,value=>{
        values.push(value);return '@@nativeUnit'+(values.length-1)+'@@';
    });
    text=text.replace(/([^{}]+)\{([^{}]*)\}/g,(rule,selector,body)=>{
        if(!/#game-ui|#homeFeatureModal|#inventoryPage|#homePage|#allElementSkillPreviewModal|#inventoryCharacterDetailModal|#skillDetailModal|#statusHelpModal/.test(selector))return rule;
        return selector+'{'+body.replace(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g,(_,n)=>String(Number(n)/3)+'px')+'}';
    });
    return text.replace(/@@nativeUnit(\d+)@@/g,(_,i)=>values[Number(i)])
        .replace(/calc\(([\d.]+px)\)/g,'$1')
        .replace(/calc\(100 \* (var\(--layout-(?:inline|block)-size,[\d.]+px\)) \/ 100\)/g,'$1');
};

// These small CSS fixtures exercise the retained shared-widget legacy fallback.
// The mandatory responsive-item runtime suite verifies production's 1080 host.
module.exports.legacyFixture=function legacyFixture(html,options={}){
    const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../../..');
    const frame=(html.match(/#game-ui\s*\{([^}]*)\}/)||[])[1]||'';
    const width=options.width||Number((frame.match(/(?:^|;)\s*width:(\d+(?:\.\d+)?)px/)||[])[1])||420;
    const height=options.height||Number((frame.match(/(?:^|;)\s*height:(\d+(?:\.\d+)?)px/)||[])[1])||746.6667;
    // Isolated authored-unit widget fixtures retain their existing local frame.
    // Production's native stage and coordinate checks live in runtime QA.
    const style='<style data-qa-compatibility="legacy">#game-ui{--ui-length-unit:1px;--layout-inline-size:'+width+'px;--layout-block-size:'+height+'px;--ui-page-max-width:'+width+'px;position:relative!important;inset:auto!important;width:'+width+'px!important;height:'+height+'px!important;font-size:15px;transform:none!important}</style>';
    let result=html.replace(/<link\b[^>]*href=["'](css\/[^"']+)["'][^>]*>/g,(_,href)=>{
        const css=module.exports(fs.readFileSync(path.join(root,href),'utf8')).replace(/url\((["']?)(\.\.\/[^)'"\s]+)\1\)/g,(_,quote,url)=>'url("'+path.relative(root,path.resolve(root,path.dirname(href),url)).split(path.sep).join('/')+'")');
        return '<style data-qa-source="'+href+'">'+css+'</style>';
    }).replace('</head>',style+'</head>');
    if(!/id=["']game-ui["']/.test(result))result=result.replace(/(<body\b[^>]*>)/,'$1<div id="game-ui" data-qa-compatibility="legacy">').replace('</body>','</div></body>');
    return result;
};
