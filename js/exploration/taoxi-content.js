/* EXPLORATION-CORNER-20261023: reversible Taoxi v1 content; no main-story writes. */
(function(scope){
'use strict';
const houses=[
  {id:'a',name:'桃枝居',x:470,y:2350,condition:'open',hint:'村口民宅，歡迎歇腳。'},
  {id:'b',name:'溪畔居',x:1330,y:2300,condition:'open',hint:'溪邊人家，門常開著。'},
  {id:'c',name:'藥農居',x:420,y:1530,condition:'clue',hint:'先與阿芸交談，並讀桃枝居的書信。'},
  {id:'d',name:'織戶居',x:1330,y:1450,condition:'c1_06',hint:'完成主線第 6 關「村民求援」後開放。'},
  {id:'e',name:'守望居',x:900,y:650,condition:'mixed',hint:'完成主線第 16 關「寨前情報」，並讀藥農居的手記。'}
];
const npcs=[
  {id:'elder',name:'周伯',x:840,y:2470,lines:['少俠，桃溪村就在前頭。村口的桃枝居與溪畔居都可進去歇腳。','各家留的補給只取一回。走累了，也可沿原路返回。']},
  {id:'ayun',name:'阿芸',x:940,y:1840,lines:['藥農託我照看門戶。讀過桃枝居桌上的書信，就能知道他留下的線索。','村中傳聞，還得回主線向當事人查證；閒聊不會替你完成關卡。']},
  {id:'woodworker',name:'陳叔',x:850,y:1060,lines:['山路的事，就依你親身走過的經歷來。','織戶等村民求援的事告一段落才開門；守望居還得等寨前情報。']}
];
const points=[
  {id:'a-chest',house:'a',name:'旅途補給',kind:'reward',item:'hpPotion10',count:1,text:'主人留下一包回春散，供過路人應急。'},
  {id:'a-letter',house:'a',name:'桌上書信',kind:'clue',text:'藥農留書：若阿芸已認得你，便可來藥農居翻閱手記。'},
  {id:'b-chest',house:'b',name:'竹籃補給',kind:'reward',item:'spPotion10',count:1,text:'竹籃裡留著一包凝氣散。'},
  {id:'b-note',house:'b',name:'溪畔舊記',kind:'clue',text:'溪水年年流過桃枝。紙上的舊事，只是村人的生活記錄。'},
  {id:'c-chest',house:'c',name:'藥箱',kind:'reward',item:'hpPotion10',count:1,text:'藥農留下的一包回春散。'},
  {id:'c-journal',house:'c',name:'藥農手記',kind:'clue',text:'手記：守望居的人關心寨前道路。知曉第十六關的情報後，可持此線索前往。'},
  {id:'d-chest',house:'d',name:'窗邊布包',kind:'reward',item:'spPotion10',count:1,text:'布包內有一包凝氣散。'},
  {id:'d-box',house:'d',name:'木櫃補給',kind:'reward',item:'hpPotion10',count:1,text:'一包收好的回春散。'},
  {id:'e-chest',house:'e',name:'守望補給',kind:'reward',item:'spPotion10',count:1,text:'守望人留下一包凝氣散。'},
  {id:'e-record',house:'e',name:'村中紀事',kind:'clue',text:'村中紀事：行走江湖，記得來處。你已走遍桃溪村五戶人家。'}
];
function unlocked(house,chapter,state){
  const done=id=>!!chapter?.completedNodes?.[id];
  if(house.condition==='open')return true;
  if(house.condition==='clue')return state.talked.ayun===true&&state.searched['a-letter']===true;
  if(house.condition==='mixed')return done('c1_16')&&state.searched['c-journal']===true;
  return done(house.condition);
}
function available(chapter){return [1,2,3,4,5].every(n=>!!chapter?.completedNodes?.['c1_'+String(n).padStart(2,'0')])&&chapter?.onboarding?.active===false&&chapter.onboarding.phase==='complete';}
function appearance(player){const index=['fire','water','wind','earth'].indexOf(player?.element);if(index<0)throw Error('無法辨識創角外觀');return 'player_'+(player.gender==='male'?'male':'female')+'_0'+(index+1);}
function village(spawn){
  return {id:'village',name:'桃溪村',width:1800,height:3100,viewWidth:1080,viewHeight:1420,radius:23,speed:320,spawn:spawn||{x:900,y:2800},objects:[
    {id:'village-exit',name:'桃溪村口',art:'gate',x:900,y:3070,width:600,height:600,approach:{x:900,y:2960},hitbox:{x:800,y:2990,width:200,height:80},interaction:'exit-map',label:'離開桃溪村'},
    {id:'gate-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:680,y:2910,width:65,height:65}},
    {id:'gate-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:1060,y:2980,width:70,height:70}},
    ...houses.map(h=>({...h,art:'house',width:660,height:660,sortY:h.y-65,solid:{x:h.x-260,y:h.y-370,width:520,height:305},approach:{x:h.x-80,y:h.y+40},hitbox:{x:h.x-120,y:h.y-240,width:240,height:350},interaction:'house',label:'進入 '+h.name})),
    ...npcs.map(n=>({...n,art:'npc',width:200,height:200,approach:{x:n.x,y:n.y+100},hitbox:{x:n.x-45,y:n.y-185,width:90,height:185},interaction:'talk',label:'交談 · '+n.name})),
    ...[[280,2810],[1520,2750],[130,1890],[1690,1710],[150,830],[1640,650]].map(([x,y],i)=>({id:'peach-'+i,art:'peach',x,y,width:480,height:600,solid:{x:x-23,y:y-50,width:46,height:50}}))
  ]};
}
function interior(id){
  const h=houses.find(h=>h.id===id);if(!h)throw Error('未知民宅');
  const layouts={a:{bed:[230,540],points:[[790,950],[330,570]]},b:{bed:[820,540],points:[[310,950],[760,570]]},c:{bed:[230,600],points:[[800,980],[760,590]]},d:{bed:[820,600],points:[[280,980],[330,590]]},e:{bed:[230,640],points:[[800,980],[720,650]]}};
  const layout=layouts[id],positions=layout.points;
  return {id,name:h.name,width:1080,height:1420,viewWidth:1080,viewHeight:1420,radius:23,speed:300,spawn:{x:540,y:1220},objects:[
    {id:'wall-back',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:0,width:1080,height:300}},
    {id:'wall-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:0,width:80,height:1420}},
    {id:'wall-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:1000,y:0,width:80,height:1420}},
    {id:'wall-front-left',art:'solid',x:0,y:0,width:0,height:0,solid:{x:0,y:1110,width:350,height:310}},
    {id:'wall-front-right',art:'solid',x:0,y:0,width:0,height:0,solid:{x:730,y:1110,width:350,height:310}},
    {id:'bed',art:'bed',x:layout.bed[0],y:layout.bed[1],width:430,height:430,solid:{x:layout.bed[0]-120,y:layout.bed[1]-330,width:240,height:330}},
    ...points.filter(p=>p.house===id).map((p,i)=>({...p,art:i?'desk':'chest',x:positions[i][0],y:positions[i][1],width:i?300:200,height:i?295:223,solid:{x:positions[i][0]-(i?115:70),y:positions[i][1]-(i?100:75),width:i?230:140,height:i?100:75},approach:{x:positions[i][0],y:positions[i][1]+85},interaction:'search',label:'搜尋 · '+p.name})),
    {id:'door',art:'door',x:540,y:1390,width:220,height:125,approach:{x:540,y:1250},autoInteract:true,interaction:'exit',label:'出屋'}
  ]};
}
scope.FourSymbolsTaoxiContent=Object.freeze({houses,npcs,points,unlocked,available,appearance,village,interior});
})(globalThis);
