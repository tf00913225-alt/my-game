/* =====================================================
   出城冒險 V1 — data owner
   Data only. Runtime/UI must not hard-code chapter behavior.
===================================================== */
(function installAdventureContentV1(){
    "use strict";
    if(typeof window==="undefined"||window.FourSymbolsAdventureContent){ return; }

    const chapters={
        chapter_v1:{
            id:"chapter_v1",
            title:"山關初行",
            subtitle:"江湖主線 · 章節推進",
            description:"一段可替換的正式 V1 旅程：穿過山路、村落與驛站，查清黑松寨攔路之事。",
            suggestedLevel:10,
            startNodeId:"n01_arrival",
            endNodeId:"n10_finish",
            hiddenNodeId:"hidden_merchant",
            merchantAppearanceChance:.25,
            chapterRewardId:"chapter_v1_clear",
            nodes:[
                {id:"n01_arrival",type:"event",title:"山前驛",subtitle:"旅人求助",eventId:"evt_arrival",x:18,y:84,next:"n02_roadfight"},
                {id:"n02_roadfight",type:"battle",title:"山道伏影",subtitle:"普通戰",encounterId:"enc_road",suggestedLevel:8,x:33,y:75,next:"n03_fork",rewardId:"road_first"},
                {id:"n03_fork",type:"branch",title:"岔路口",subtitle:"選擇路線",x:49,y:66,branchId:"fork_1",
                    branches:[
                        {id:"safe",nodeId:"n04a_path",title:"林間小徑",risk:"較安全",description:"繞過寨門，會遇到一名受傷旅人。"},
                        {id:"bold",nodeId:"n04b_gate",title:"山寨正門",risk:"高風險",description:"直接闖關，面對更強的守寨精英。"}
                    ]},
                {id:"n04a_path",type:"event",title:"林間小徑",subtitle:"旅人事件",eventId:"evt_forest_traveler",x:31,y:56,next:"n05_commission",branchId:"fork_1",branchChoice:"safe"},
                {id:"n04b_gate",type:"elite",title:"山寨正門",subtitle:"精英戰",encounterId:"enc_gate_elite",suggestedLevel:10,x:67,y:56,next:"n05_commission",branchId:"fork_1",branchChoice:"bold",rewardId:"gate_first"},
                {id:"n05_commission",type:"objective",title:"村民委託",subtitle:"前往野怪區",objectiveId:"obj_patrol_token",x:50,y:46,next:"n06_rest",rewardId:"commission_turnin"},
                {id:"n06_rest",type:"rest",title:"落雁驛",subtitle:"休息 · HP/SP +30%",x:30,y:36,next:"n07_chest"},
                {id:"n07_chest",type:"chest",title:"舊驛箱",subtitle:"一次性寶箱",x:51,y:29,next:"n08_truth",rewardId:"road_chest"},
                {id:"n08_truth",type:"event",title:"寨下石橋",subtitle:"發現真相",eventId:"evt_before_boss",x:70,y:22,next:"n09_boss"},
                {id:"n09_boss",type:"boss",title:"黑松寨主",subtitle:"Boss",encounterId:"enc_boss",suggestedLevel:12,x:55,y:13,next:"n10_finish",rewardId:"boss_first"},
                {id:"n10_finish",type:"finish",title:"章節終點",subtitle:"山路重開",x:34,y:7}
            ],
            hiddenNodes:[
                {id:"hidden_merchant",type:"merchant",title:"神秘燈影",subtitle:"？",x:79,y:41}
            ]
        }
    };

    const encounters={
        enc_road:{
            id:"enc_road",
            label:"山道伏影",
            enemies:[
                {name:"攔路山賊",level:8,element:"fire",rank:"regular"},
                {name:"山道惡徒",level:8,element:"wind",rank:"regular"},
                {name:"寨外斥候",level:9,element:"earth",rank:"regular"}
            ]
        },
        enc_gate_elite:{
            id:"enc_gate_elite",
            label:"山寨正門",
            enemies:[
                {name:"黑松寨精英",level:10,element:"earth",rank:"elite"},
                {name:"持刀寨眾",level:10,element:"fire",rank:"regular"},
                {name:"巡寨快手",level:10,element:"wind",rank:"regular"}
            ]
        },
        enc_boss:{
            id:"enc_boss",
            label:"黑松寨主",
            enemies:[
                {name:"黑松寨主",level:12,element:"earth",rank:"boss"},
                {name:"寨主親衛",level:11,element:"fire",rank:"elite"},
                {name:"寨主親衛",level:11,element:"wind",rank:"elite"}
            ]
        }
    };

    const events={
        evt_arrival:{
            id:"evt_arrival",
            title:"山前驛",
            speaker:"守驛人",
            portrait:"守衛",
            background:"mountain-pass",
            paragraphs:[
                "山路近來被黑松寨的人攔住，往來旅人只敢在驛站停留。",
                "守驛人請你先探一探前方。若願意聽完他的提醒，下一戰可先回一口氣。"
            ],
            choices:[
                {id:"listen",label:"聽取提醒",result:"記下山勢與敵情。",buff:{type:"sp-start",percent:15,label:"下一戰開始恢復 15% SP"}},
                {id:"depart",label:"直接上路",result:"你謝過守驛人，立刻動身。"}
            ]
        },
        evt_forest_traveler:{
            id:"evt_forest_traveler",
            title:"林間小徑",
            speaker:"受傷旅人",
            portrait:"旅人",
            background:"forest-path",
            paragraphs:[
                "繞過寨門後，你在林間遇到一名受傷旅人。",
                "這條路較安全，但花了更多時間。旅人留下少量盤纏答謝。"
            ],
            choices:[
                {id:"help",label:"替他包紮",result:"旅人連聲道謝。",reward:{gold:120}}
            ]
        },
        evt_before_boss:{
            id:"evt_before_boss",
            title:"寨下石橋",
            speaker:"藥師",
            portrait:"藥師",
            background:"stone-bridge",
            paragraphs:[
                "藥師說，山寨並非為了什麼大陰謀，只是寨主趁道路失守坐地收錢。",
                "處理掉寨主，這條路就能重新通行。"
            ],
            choices:[
                {id:"continue",label:"前往山寨",result:"你整好行裝，向寨門深處前進。"}
            ]
        }
    };

    const objectives={
        obj_patrol_token:{
            id:"obj_patrol_token",
            type:"patrol-drop",
            title:"村民委託",
            description:"前往目前已開放的野怪區，從指定怪物身上取得委託信物。",
            target:5,
            minTarget:3,
            maxTarget:8,
            dropRate:.40,
            pityMisses:3,
            preferHighestUnlocked:true,
            allowedRanks:["regular","elite"]
        }
    };

    const rewards={
        road_first:{gold:150},
        gate_first:{gold:350},
        commission_turnin:{gold:300},
        road_chest:{gold:420,potions:[{id:"hpPotion50",count:1}]},
        boss_first:{gold:650,sharedExp:300},
        chapter_v1_clear:{gold:1000,potions:[{id:"taichingQiPill",count:1}]}
    };

    const merchantPool=[
        {id:"hpPotion50",name:"回復 50% HP 藥水",kind:"potion",price:220,quantity:2,tierKey:"blue"},
        {id:"spPotion50",name:"回復 50% SP 藥水",kind:"potion",price:260,quantity:2,tierKey:"blue"},
        {id:"hpPotion100",name:"回復 100% HP 藥水",kind:"potion",price:520,quantity:1,tierKey:"purple"},
        {id:"nineTurnRestorationPill",name:"九轉回元丹",kind:"potion",price:1800,quantity:1,tierKey:"orange",rare:true},
        {id:"taichingQiPill",name:"太清聚氣丹",kind:"potion",price:1800,quantity:1,tierKey:"orange",rare:true}
    ];

    window.FourSymbolsAdventureContent=Object.freeze({
        schemaVersion:1,
        chapters:Object.freeze(chapters),
        encounters:Object.freeze(encounters),
        events:Object.freeze(events),
        objectives:Object.freeze(objectives),
        rewards:Object.freeze(rewards),
        merchantPool:Object.freeze(merchantPool)
    });
})();
