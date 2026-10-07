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
            nodeCapacity:20,
            mainProgressNodeCount:20,
            startNodeId:"n01_arrival",
            endNodeId:"n10_finish",
            hiddenNodeId:"hidden_merchant",
            merchantAppearanceChance:.25,
            chapterRewardId:"chapter_v1_clear",
            nodes:[
                {id:"n01_arrival",type:"event",title:"山前驛",subtitle:"旅人求助",detail:"先完成第一場實戰，熟悉出城冒險。",onboarding:"完成基本戰鬥",eventId:"evt_arrival",x:18,y:96,next:"n02_roadfight"},
                {id:"n02_roadfight",type:"battle",title:"山道伏影",subtitle:"普通戰",detail:"建議 Lv.8。擊退攔路山賊。",onboarding:"戰後查看成長／技能點",encounterId:"enc_road",suggestedLevel:8,x:36,y:89,next:"n03_fork",rewardId:"road_first"},
                {id:"n03_fork",type:"branch",title:"岔路口",subtitle:"選擇路線",detail:"選擇你的第一條江湖路。",onboarding:"技能學習／升級",x:52,y:82,branchId:"fork_1",
                    branches:[
                        {id:"safe",nodeId:"n04a_path",title:"林間小徑",risk:"較安全",description:"繞過寨門，會遇到一名受傷旅人。"},
                        {id:"bold",nodeId:"n04b_gate",title:"山寨正門",risk:"高風險",description:"直接闖關，面對更強的守寨精英。"}
                    ]},
                {id:"n04a_path",type:"event",title:"林間小徑",subtitle:"旅人事件",detail:"聽取旅人的消息，取得上路的線索。",onboarding:"裝備與道具",eventId:"evt_forest_traveler",x:33,y:75,next:"n05_commission",branchId:"fork_1",branchChoice:"safe"},
                {id:"n04b_gate",type:"elite",title:"山寨正門",subtitle:"精英戰",detail:"建議 Lv.10。正面突破寨門。",onboarding:"裝備與道具",encounterId:"enc_gate_elite",suggestedLevel:10,x:72,y:75,next:"n05_commission",branchId:"fork_1",branchChoice:"bold",rewardId:"gate_first"},
                {id:"n05_commission",type:"objective",title:"村民委託",subtitle:"前往野怪區",detail:"完成委託後，熟悉隊伍與元素準備。",onboarding:"元素／隊伍",objectiveId:"obj_patrol_token",x:52,y:68,next:"n06_rest",rewardId:"commission_turnin"},
                {id:"n06_rest",type:"rest",title:"落雁驛",subtitle:"休息 · HP/SP +30%",x:31,y:61,next:"n07_chest"},
                {id:"n07_chest",type:"chest",title:"舊驛箱",subtitle:"一次性寶箱",x:54,y:54,next:"n08_truth",rewardId:"road_chest"},
                {id:"n08_truth",type:"event",title:"寨下石橋",subtitle:"發現真相",eventId:"evt_before_boss",x:72,y:47,next:"n09_boss"},
                {id:"n09_boss",type:"boss",title:"黑松寨主",subtitle:"Boss",encounterId:"enc_boss",suggestedLevel:12,x:55,y:39,next:"n10_finish",rewardId:"boss_first"},
                {id:"n10_finish",type:"finish",title:"章節終點",subtitle:"山路重開",x:35,y:32},
                {id:"n11_reserved",type:"event",title:"山霧古道",subtitle:"江湖事件",detail:"第二段山關故事預留。",availability:"planned",x:20,y:26},
                {id:"n12_reserved",type:"battle",title:"古道伏兵",subtitle:"普通戰",detail:"後續主線戰鬥預留。",availability:"planned",x:45,y:22},
                {id:"n13_reserved",type:"chest",title:"斷碑密匣",subtitle:"旅途寶箱",detail:"後續寶箱節點預留。",availability:"planned",x:68,y:19},
                {id:"n14_reserved",type:"rest",title:"松風驛",subtitle:"休息驛站",detail:"後續休息節點預留。",availability:"planned",x:44,y:16},
                {id:"n15_reserved",type:"elite",title:"斷嶺哨所",subtitle:"精英戰",detail:"後續精英節點預留。",availability:"planned",x:70,y:13},
                {id:"n16_reserved",type:"event",title:"殘燈舊舍",subtitle:"江湖事件",detail:"後續劇情節點預留。",availability:"planned",x:51,y:10},
                {id:"n17_reserved",type:"battle",title:"石徑追影",subtitle:"普通戰",detail:"後續主線戰鬥預留。",availability:"planned",x:30,y:8},
                {id:"n18_reserved",type:"chest",title:"關隘藏箱",subtitle:"旅途寶箱",detail:"後續寶箱節點預留。",availability:"planned",x:54,y:6},
                {id:"n19_reserved",type:"boss",title:"黑松寨主",subtitle:"章節頭目",detail:"第一章最終頭目節點；待完整章節內容接通後啟用。",availability:"planned",x:70,y:4},
                {id:"n20_reserved",type:"finish",title:"山關重開",subtitle:"章節終點",detail:"第一章二十關完成節點預留。",availability:"planned",x:46,y:2}
            ],
            routes:[
                {from:"n01_arrival",to:"n02_roadfight"},{from:"n02_roadfight",to:"n03_fork"},{from:"n03_fork",to:"n04a_path",bendX:39,bendY:60},{from:"n03_fork",to:"n04b_gate",bendX:59,bendY:60},{from:"n04a_path",to:"n05_commission"},{from:"n04b_gate",to:"n05_commission"},{from:"n05_commission",to:"n06_rest"},{from:"n06_rest",to:"n07_chest"},{from:"n07_chest",to:"n08_truth"},{from:"n08_truth",to:"n09_boss"},{from:"n09_boss",to:"n10_finish"},
                {from:"n10_finish",to:"n11_reserved"},{from:"n11_reserved",to:"n12_reserved"},{from:"n12_reserved",to:"n13_reserved"},{from:"n13_reserved",to:"n14_reserved"},{from:"n14_reserved",to:"n15_reserved"},{from:"n15_reserved",to:"n16_reserved"},{from:"n16_reserved",to:"n17_reserved"},{from:"n17_reserved",to:"n18_reserved"},{from:"n18_reserved",to:"n19_reserved"},{from:"n19_reserved",to:"n20_reserved"}
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
                {monsterKey:"adventure.road.bandit",archetype:"balanced",name:"攔路山賊",level:8,element:"fire",rank:"regular"},
                {monsterKey:"adventure.road.thug",archetype:"balanced",name:"山道惡徒",level:8,element:"wind",rank:"regular"},
                {monsterKey:"adventure.road.scout",archetype:"balanced",name:"寨外斥候",level:9,element:"earth",rank:"regular"}
            ]
        },
        enc_gate_elite:{
            id:"enc_gate_elite",
            label:"山寨正門",
            enemies:[
                {monsterKey:"adventure.gate.elite",archetype:"balanced",name:"黑松寨精英",level:10,element:"earth",rank:"elite"},
                {monsterKey:"adventure.gate.blade",archetype:"balanced",name:"持刀寨眾",level:10,element:"fire",rank:"regular"},
                {monsterKey:"adventure.gate.runner",archetype:"balanced",name:"巡寨快手",level:10,element:"wind",rank:"regular"}
            ]
        },
        enc_boss:{
            id:"enc_boss",
            label:"黑松寨主",
            enemies:[
                {monsterKey:"adventure.boss.chief",archetype:"balanced",name:"黑松寨主",level:12,element:"earth",rank:"smallBoss"},
                {monsterKey:"adventure.boss.guard-fire",archetype:"balanced",name:"寨主親衛",level:11,element:"fire",rank:"elite"},
                {monsterKey:"adventure.boss.guard-wind",archetype:"balanced",name:"寨主親衛",level:11,element:"wind",rank:"elite"}
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
        road_chest:{gold:420,potions:[{id:"hpPotion30",count:1}]},
        boss_first:{gold:650,sharedExp:300},
        chapter_v1_clear:{gold:1000,potions:[{id:"taichingQiPill",count:1}]}
    };

    const merchantPool=[
        {id:"hpPotion30",name:"大還丹",kind:"potion",price:220,quantity:2,tierKey:"blue"},
        {id:"spPotion30",name:"歸元丹",kind:"potion",price:260,quantity:2,tierKey:"blue"},
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
