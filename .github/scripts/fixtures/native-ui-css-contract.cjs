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
        .replace(/calc\(([\d.]+px)\)/g,'$1');
};

// These small CSS fixtures exercise the retained shared-widget legacy fallback.
// The mandatory responsive-item runtime suite verifies production's 1080 host.
module.exports.legacyFixture=function legacyFixture(html){
    const style='<style data-qa-compatibility="legacy">#game-ui{--ui-length-unit:1px;--layout-inline-size:420px;--layout-block-size:746.6667px;--ui-page-max-width:420px;position:relative!important;inset:auto!important;width:420px!important;height:746.6667px!important;font-size:15px;transform:none!important}</style>';
    let result=html.replace('</head>',style+'</head>');
    if(!/id=["']game-ui["']/.test(result))result=result.replace(/(<body\b[^>]*>)/,'$1<div id="game-ui" data-qa-compatibility="legacy">').replace('</body>','</div></body>');
    return result;
};
