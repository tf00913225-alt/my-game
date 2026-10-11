'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/39-v143-skill-animation.js','utf8');
module.exports=function install(context,artwork){
    artwork.isConnected=true;
    context.entityFor=()=>({hp:100,alive:true});
    context.document={getElementById:()=>({classList:{contains:()=>true}}),body:{appendChild(){}},createElement:()=>({style:{},dataset:{},setAttribute(){},appendChild(){},remove(){this.removed=true;},animate:(frames,options)=>artwork.animate(frames,options)})};
    context.window.FourSymbolsBattlefieldRenderGeometry={getUnitGeometry:()=>({artworkProjection:{rect:{left:12,top:25,width:40,height:80},backgroundImage:'url("portrait.webp")',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}})};
    vm.runInContext(source.slice(source.indexOf('    function clearImpactOverlays('),source.indexOf('    function clearTimers(')),context);
};
