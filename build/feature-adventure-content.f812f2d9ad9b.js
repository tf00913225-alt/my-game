/* Canonical Adventure content. Tutorial Encounter Data is independent of formal monster balance. */
(function installAdventureContentV1(){
"use strict";
if(typeof window==="undefined"||window.FourSymbolsAdventureContent)return;
const schemaVersion=2;
const chapters={
  "chapter_v1": {
    "id": "chapter_v1",
    "title": "山關初行",
    "subtitle": "江湖主線 · 章節推進",
    "description": "打通被黑松寨封鎖的山關，走完初入江湖的第一段旅程。",
    "suggestedLevel": 1,
    "nodeCapacity": 20,
    "mainProgressNodeCount": 20,
    "startNodeId": "c1_01",
    "endNodeId": "c1_20",
    "hiddenNodeId": "hidden_merchant",
    "merchantAppearanceChance": 0,
    "chapterRewardId": "chapter_v1_clear",
    "nodes": [
      {
        "id": "c1_01",
        "type": "battle",
        "title": "山前初戰",
        "detail": "初遇惡徒，以普攻迎敵。",
        "subtitle": "初入江湖",
        "stage": 1,
        "npc": "guard",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "少俠，前頭有個攔路的。先看準敵人，再穩穩出招。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我初來此地，正想問問山路的情況。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "先過了眼前這一關。別慌，一招一式來。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "好，我先替大家探一段路。"
          }
        ],
        "next": "c1_02",
        "x": 19,
        "y": 73.3,
        "tutorialEncounterId": "tutorial_1",
        "rewardId": "story_first_growth"
      },
      {
        "id": "c1_02",
        "type": "battle",
        "title": "山道惡徒",
        "detail": "學會招式，再戰山道惡徒。",
        "subtitle": "初入江湖",
        "stage": 2,
        "npc": "guard",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "山道惡徒",
            "text": "新來的？這條山道的規矩，你可還沒學會。",
            "npcAssetId": "traveler"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "放旅人過去，有什麼事衝我來。",
            "npcAssetId": "traveler"
          }
        ],
        "next": "c1_03",
        "x": 24.8,
        "y": 70.5,
        "tutorialEncounterId": "tutorial_2",
        "guidance": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "這個惡徒比先前的難纏，只靠硬拚恐怕不成。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "剛才吃了虧，得換個打法。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "先把方才所得用於成長，再學一招合用的技能。準備好了，還從這裡再戰。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我記住了。練好招式，再來闖這段山道。"
          }
        ]
      },
      {
        "id": "c1_03",
        "type": "battle",
        "title": "追兵",
        "detail": "擊退追兵，備妥護具。",
        "subtitle": "初入江湖",
        "stage": 3,
        "npc": "traveler",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "不好，剛才那夥人的追兵來了！"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "別急，退到我身後。新學的招式正好派上用場。"
          },
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "多謝你相助。等追兵退了，我會給你一筆置裝費，到主城商店買件合用的護具。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "先把人護住，其他的戰後再說。"
          }
        ],
        "next": "c1_04",
        "x": 32.2,
        "y": 67.2,
        "tutorialEncounterId": "tutorial_3",
        "rewardId": "story_starter_gear"
      },
      {
        "id": "c1_04",
        "type": "battle",
        "title": "寨外守衛",
        "detail": "買好護具，穿戴後再戰。",
        "subtitle": "初入江湖",
        "stage": 4,
        "npc": "guard",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "寨外守衛",
            "text": "只憑手上的招式，就想闖過這道關？"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我會先看清你的架勢。"
          }
        ],
        "next": "c1_05",
        "x": 37,
        "y": 64,
        "tutorialEncounterId": "tutorial_4",
        "guidance": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "這些寨外守衛出手更重，你身上的行裝還沒備齊。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "只顧著練招，還沒把護具備好。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "先到主城商店買件護具，再從背包穿上，回來這裡重試。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "這次先整好行裝，再與他們交手。"
          }
        ]
      },
      {
        "id": "c1_05",
        "type": "battle",
        "title": "受困旅人",
        "detail": "備妥補品，救回受困旅人。",
        "subtitle": "初入江湖",
        "stage": 5,
        "npc": "herbalist",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "藥師",
            "text": "這位旅人被困在前面。救人之前，也得先照看自己。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "氣血不足會撐不住，真氣不夠也使不出招式。"
          },
          {
            "speaker": "npc",
            "name": "藥師",
            "text": "看看自己的氣血與真氣，再按需要使用補品。準備妥當才上路。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "明白。往後每次交手前，我都會先檢查行裝與補給。"
          }
        ],
        "next": "c1_06",
        "x": 46,
        "y": 60.4,
        "tutorialEncounterId": "tutorial_5",
        "rewardId": "story_supplies"
      },
      {
        "id": "c1_06",
        "type": "event",
        "title": "村民求援",
        "detail": "傾聽村民，尋找進寨道路。",
        "subtitle": "山關主線",
        "stage": 6,
        "npc": "traveler",
        "scene": "village",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "村民",
            "text": "少俠救回了旅人，可山關還封著。黑松寨強收過路銀，連送米的車都不放。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "這條山路，是你們進出村子的要道？"
          },
          {
            "speaker": "npc",
            "name": "村民",
            "text": "正是。再拖下去，藥材與糧食都送不進來了。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我既然走到了這裡，就替你們把這條路打通。"
          }
        ],
        "next": "c1_07",
        "x": 53,
        "y": 59
      },
      {
        "id": "c1_07",
        "type": "battle",
        "title": "山道巡哨",
        "detail": "擊散巡哨，繼續沿路前行。",
        "subtitle": "山關主線",
        "stage": 7,
        "npc": "guard",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "從這裡往上是黑松寨的巡哨，沒有誰能替你攔下刀劍。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我已懂得備戰，接下來會自己留神。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "沿著山道往前，先打散巡哨，別讓他們合圍。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "好。路要一段一段打通，人也要平安帶回。"
          }
        ],
        "next": "c1_08",
        "x": 60,
        "y": 57.8,
        "encounterId": "chapter1_enc_7"
      },
      {
        "id": "c1_08",
        "type": "chest",
        "title": "荒驛舊箱",
        "detail": "開啟舊箱，收取沿途補給。",
        "subtitle": "山關主線",
        "stage": 8,
        "npc": "traveler",
        "scene": "village",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "荒驛還留著一口舊箱，是商隊撤走時留下的路用物資。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "有主之物，我不能隨便拿。"
          },
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "商隊已託我轉交。裡頭是些盤纏、補品和普通材料，正好助你上路。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "那我收下這份心意，等山路通了，再向大家道謝。"
          }
        ],
        "next": "c1_09",
        "x": 68,
        "y": 56.8,
        "rewardId": "story_road_chest",
        "legacyRewardId": "road_chest"
      },
      {
        "id": "c1_09",
        "type": "rest",
        "title": "落雁驛",
        "detail": "驛站歇腳，恢復後再上山。",
        "subtitle": "山關主線",
        "stage": 9,
        "npc": "guard",
        "scene": "village",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "落雁驛到了。坐一會兒，把氣血與真氣養回來。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "一路上的哨卡，比先前密了。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "石橋附近快換哨了。你可趁他們交接時往前探，切記別急著闖寨。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "多謝提醒。我歇妥了，就去石橋看看。"
          }
        ],
        "next": "c1_10",
        "x": 70,
        "y": 55.2
      },
      {
        "id": "c1_10",
        "type": "battle",
        "title": "黑松斥候",
        "detail": "越過斥候，前往寨下石橋。",
        "subtitle": "山關主線",
        "stage": 10,
        "npc": "traveler",
        "scene": "road",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "前頭那個斥候一直盯著山道，怕是已經發現你了。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "他正往寨裡傳信。這回避不開了。"
          },
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "黑松寨知道有人插手，後面的路只會更難走。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "那就堂堂正正走下去，先過這一關。"
          }
        ],
        "next": "c1_11",
        "x": 62.5,
        "y": 53.5,
        "encounterId": "chapter1_enc_10"
      },
      {
        "id": "c1_11",
        "type": "event",
        "title": "寨下石橋",
        "detail": "取得信物，探明側門去路。",
        "subtitle": "山關主線",
        "stage": 11,
        "npc": "herbalist",
        "scene": "bridge",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "藥師",
            "text": "你要去側門，得認得他們的信物。這塊黑松腰牌是寨眾往來用的。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "你怎會留著它？"
          },
          {
            "speaker": "npc",
            "name": "藥師",
            "text": "先前替一名寨眾治傷，他拿它抵了藥錢。如今交給你，或許能少一道阻攔。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我會收好。打通山關後，也不能再讓他們拿信物欺壓旅人。"
          }
        ],
        "next": "c1_12",
        "x": 49.5,
        "y": 50.4,
        "grantsStoryKey": "blackPineToken"
      },
      {
        "id": "c1_12",
        "type": "battle",
        "title": "石橋伏兵",
        "detail": "突破伏兵，守住石橋道路。",
        "subtitle": "山關主線",
        "stage": 12,
        "npc": "guard",
        "scene": "bridge",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "小心橋後！他們把人藏在橋墩兩旁。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "看來斥候的消息已經送到了。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "這裡路窄，先穩住腳步，別讓伏兵從身後包上來。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我來擋住橋頭。你們先退到安全處。"
          }
        ],
        "next": "c1_13",
        "x": 38.2,
        "y": 47.8,
        "encounterId": "chapter1_enc_12"
      },
      {
        "id": "c1_13",
        "type": "rest",
        "title": "旅途整備",
        "detail": "清點行裝，為進寨做準備。",
        "subtitle": "山關主線",
        "stage": 13,
        "npc": "merchant",
        "scene": "village",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "旅商",
            "text": "過了石橋，就是山寨的地界了。少俠可還缺些路用補給？"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "先讓我清點補品，也看看身上的裝備。"
          },
          {
            "speaker": "npc",
            "name": "旅商",
            "text": "莫急。我在這裡歇腳，你也養養精神，再去走後半程。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "多謝。準備周全，才能把事情辦到底。"
          }
        ],
        "next": "c1_14",
        "x": 51,
        "y": 45.6
      },
      {
        "id": "c1_14",
        "type": "event",
        "title": "寨外側門",
        "detail": "帶著信物，從側門進寨。",
        "subtitle": "山關主線",
        "stage": 14,
        "npc": "guard",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "側門就在前面。藥師交給你的黑松腰牌，可還帶著？"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "帶著。這腰牌正是寨眾通行的憑據。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "亮出腰牌，趁守衛辨認時越過這道門。進去後仍要留心。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "好。借它過門，接下來便去找寨主把話說清楚。"
          }
        ],
        "next": "c1_15",
        "x": 66,
        "y": 42.4,
        "requiresStoryKey": "blackPineToken"
      },
      {
        "id": "c1_15",
        "type": "elite",
        "title": "斷嶺哨所",
        "detail": "清除哨所，打通上山道路。",
        "subtitle": "山關主線",
        "stage": 15,
        "npc": "guard",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "斷嶺哨所駐著寨裡的精銳，出手與山道上的巡哨不同。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "守住這裡，他們就能隨時封死山路。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "別被他們的陣勢逼亂。看準空隙，再把哨所拿下。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "這道關口，我一定要過。"
          }
        ],
        "next": "c1_16",
        "x": 56,
        "y": 39.6,
        "encounterId": "chapter1_enc_15"
      },
      {
        "id": "c1_16",
        "type": "event",
        "title": "寨前情報",
        "detail": "聽取情報，弄清封路緣由。",
        "subtitle": "山關主線",
        "stage": 16,
        "npc": "traveler",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "我替寨裡送過貨。他們沒有什麼遠大圖謀，只是趁道路失守，攔路收銀。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "所以大家吃的苦，只為了寨主多收幾袋錢？"
          },
          {
            "speaker": "npc",
            "name": "旅人",
            "text": "是。寨裡的頭目也分一杯羹，誰都不肯先把路障撤下。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "那便讓他們知道，這條路不是誰家的私產。"
          }
        ],
        "next": "c1_17",
        "x": 44.6,
        "y": 36.6
      },
      {
        "id": "c1_17",
        "type": "battle",
        "title": "寨門攻防",
        "detail": "突破寨門，打開商旅道路。",
        "subtitle": "山關主線",
        "stage": 17,
        "npc": "guard",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "寨門前的人都聚過來了。他們想把你堵在外頭。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "山下的商旅還在等。走到這一步，不能退。"
          },
          {
            "speaker": "npc",
            "name": "守驛人",
            "text": "我在後面接應。你若能破開寨門，山關就有轉機。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "好，今日便把這道攔路的門打開。"
          }
        ],
        "next": "c1_18",
        "x": 51.5,
        "y": 33.8,
        "encounterId": "chapter1_enc_17"
      },
      {
        "id": "c1_18",
        "type": "elite",
        "title": "寨中頭目",
        "detail": "擊敗頭目，直面黑松寨主。",
        "subtitle": "山關主線",
        "stage": 18,
        "npc": "guard",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "寨中頭目",
            "text": "能闖過寨門，倒有幾分本事。可進了寨子，就別想輕易出去。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我來找寨主，讓他撤掉路障，放商旅通行。"
          },
          {
            "speaker": "npc",
            "name": "寨中頭目",
            "text": "先過我這一關，再談你的條件！"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "你們攔路欺人，今日也該到頭了。"
          }
        ],
        "next": "c1_19",
        "x": 58.7,
        "y": 30.5,
        "encounterId": "chapter1_enc_18"
      },
      {
        "id": "c1_19",
        "type": "event",
        "title": "寨主現身",
        "detail": "面見寨主，爭取山關通行。",
        "subtitle": "山關主線",
        "stage": 19,
        "npc": "chief",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "黑松寨主",
            "text": "一路打進我的寨子，少俠的手未免伸得太長。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "你封山收銀，斷了村民與商旅的生路。我只要你撤掉路障。"
          },
          {
            "speaker": "npc",
            "name": "黑松寨主",
            "text": "這片山道由我守著，要過路，自然得付銀子。"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "山關是大家的路。既然你不肯放行，那就憑本事分個明白。"
          }
        ],
        "next": "c1_20",
        "x": 70,
        "y": 25
      },
      {
        "id": "c1_20",
        "type": "boss",
        "title": "黑松寨主",
        "detail": "擊敗寨主，讓山關通行。",
        "subtitle": "山關主線",
        "stage": 20,
        "npc": "chief",
        "scene": "stockade",
        "dialogue": [
          {
            "speaker": "npc",
            "name": "黑松寨主",
            "text": "哼！想讓我撤障，先勝過我手中這柄斧！"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "我為山下等路的人而來，不會在此退讓。"
          },
          {
            "speaker": "npc",
            "name": "黑松寨主",
            "text": "那就來吧，讓我看看你憑什麼管這樁閒事！"
          },
          {
            "speaker": "player",
            "name": "玩家",
            "text": "這一戰，就把山關還給往來的人。"
          }
        ],
        "next": null,
        "x": 76.5,
        "y": 18.5,
        "encounterId": "chapter1_enc_20",
        "rewardId": "boss_first"
      }
    ],
    "routes": [
      {
        "from": "c1_01",
        "to": "c1_02"
      },
      {
        "from": "c1_02",
        "to": "c1_03"
      },
      {
        "from": "c1_03",
        "to": "c1_04"
      },
      {
        "from": "c1_04",
        "to": "c1_05"
      },
      {
        "from": "c1_05",
        "to": "c1_06"
      },
      {
        "from": "c1_06",
        "to": "c1_07"
      },
      {
        "from": "c1_07",
        "to": "c1_08"
      },
      {
        "from": "c1_08",
        "to": "c1_09"
      },
      {
        "from": "c1_09",
        "to": "c1_10"
      },
      {
        "from": "c1_10",
        "to": "c1_11"
      },
      {
        "from": "c1_11",
        "to": "c1_12"
      },
      {
        "from": "c1_12",
        "to": "c1_13"
      },
      {
        "from": "c1_13",
        "to": "c1_14"
      },
      {
        "from": "c1_14",
        "to": "c1_15"
      },
      {
        "from": "c1_15",
        "to": "c1_16"
      },
      {
        "from": "c1_16",
        "to": "c1_17"
      },
      {
        "from": "c1_17",
        "to": "c1_18"
      },
      {
        "from": "c1_18",
        "to": "c1_19"
      },
      {
        "from": "c1_19",
        "to": "c1_20"
      }
    ],
    "hiddenNodes": [],
    "storySchemaVersion": 2,
    "ending": [
      {
        "speaker": "npc",
        "name": "黑松寨主",
        "text": "我認輸，路障今日便撤。往來商旅，不再收過路銀。"
      },
      {
        "speaker": "player",
        "name": "玩家",
        "text": "記住你說的話。這條山路，不該再困住任何人。"
      },
      {
        "speaker": "npc",
        "name": "守驛人",
        "text": "山關通了！少俠，驛站的大門隨時為你敞開。",
        "npcAssetId": "guard"
      },
      {
        "speaker": "player",
        "name": "玩家",
        "text": "江湖的路還長。先回城整備，再啟下一程。",
        "npcAssetId": "guard"
      }
    ]
  }
};
const encounters={
  "enc_road": {
    "id": "enc_road",
    "label": "山道伏影",
    "enemies": [
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 8,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.road.thug",
        "archetype": "balanced",
        "name": "山道惡徒",
        "level": 8,
        "element": "wind",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_021"
      },
      {
        "monsterKey": "adventure.road.scout",
        "archetype": "balanced",
        "name": "寨外斥候",
        "level": 9,
        "element": "earth",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "enc_gate_elite": {
    "id": "enc_gate_elite",
    "label": "山寨正門",
    "enemies": [
      {
        "monsterKey": "adventure.gate.elite",
        "archetype": "balanced",
        "name": "黑松寨精英",
        "level": 10,
        "element": "earth",
        "rank": "elite",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.gate.blade",
        "archetype": "balanced",
        "name": "持刀寨眾",
        "level": 10,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.gate.runner",
        "archetype": "balanced",
        "name": "巡寨快手",
        "level": 10,
        "element": "wind",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "enc_boss": {
    "id": "enc_boss",
    "label": "黑松寨主",
    "enemies": [
      {
        "monsterKey": "adventure.boss.chief",
        "archetype": "balanced",
        "name": "黑松寨主",
        "level": 12,
        "element": "earth",
        "rank": "smallBoss",
        "portraitKey": "NPC_SHARED_040"
      },
      {
        "monsterKey": "adventure.boss.guard-fire",
        "archetype": "balanced",
        "name": "寨主親衛",
        "level": 11,
        "element": "fire",
        "rank": "elite",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.boss.guard-wind",
        "archetype": "balanced",
        "name": "寨主親衛",
        "level": 11,
        "element": "wind",
        "rank": "elite",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_7": {
    "id": "chapter1_enc_7",
    "label": "山道巡哨",
    "enemies": [
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 1,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_10": {
    "id": "chapter1_enc_10",
    "label": "黑松斥候",
    "enemies": [
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 2,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_12": {
    "id": "chapter1_enc_12",
    "label": "石橋伏兵",
    "enemies": [
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 2,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 2,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_15": {
    "id": "chapter1_enc_15",
    "label": "斷嶺哨所",
    "enemies": [
      {
        "monsterKey": "adventure.gate.elite",
        "archetype": "balanced",
        "name": "黑松寨精英",
        "level": 2,
        "element": "earth",
        "rank": "elite",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_17": {
    "id": "chapter1_enc_17",
    "label": "寨門攻防",
    "enemies": [
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 2,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      },
      {
        "monsterKey": "adventure.road.bandit",
        "archetype": "balanced",
        "name": "攔路山賊",
        "level": 2,
        "element": "fire",
        "rank": "regular",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_18": {
    "id": "chapter1_enc_18",
    "label": "寨中頭目",
    "enemies": [
      {
        "monsterKey": "adventure.gate.elite",
        "archetype": "balanced",
        "name": "黑松寨精英",
        "level": 2,
        "element": "earth",
        "rank": "elite",
        "portraitKey": "NPC_SHARED_029"
      }
    ]
  },
  "chapter1_enc_20": {
    "id": "chapter1_enc_20",
    "label": "黑松寨主",
    "enemies": [
      {
        "monsterKey": "adventure.boss.chief",
        "archetype": "balanced",
        "name": "黑松寨主",
        "level": 3,
        "element": "earth",
        "rank": "smallBoss",
        "portraitKey": "NPC_SHARED_040"
      }
    ]
  }
};
const events={
  "evt_arrival": {
    "id": "evt_arrival",
    "title": "山前驛",
    "speaker": "守驛人",
    "portrait": "守衛",
    "background": "mountain-pass",
    "paragraphs": [
      "山路近來被黑松寨的人攔住，往來旅人只敢在驛站停留。",
      "守驛人請你先探一探前方。若願意聽完他的提醒，下一戰可先回一口氣。"
    ],
    "choices": [
      {
        "id": "listen",
        "label": "聽取提醒",
        "result": "記下山勢與敵情。",
        "buff": {
          "type": "sp-start",
          "percent": 15,
          "label": "下一戰開始恢復 15% SP"
        }
      },
      {
        "id": "depart",
        "label": "直接上路",
        "result": "你謝過守驛人，立刻動身。"
      }
    ]
  },
  "evt_forest_traveler": {
    "id": "evt_forest_traveler",
    "title": "林間小徑",
    "speaker": "受傷旅人",
    "portrait": "旅人",
    "background": "forest-path",
    "paragraphs": [
      "繞過寨門後，你在林間遇到一名受傷旅人。",
      "這條路較安全，但花了更多時間。旅人留下少量盤纏答謝。"
    ],
    "choices": [
      {
        "id": "help",
        "label": "替他包紮",
        "result": "旅人連聲道謝。",
        "reward": {
          "gold": 120
        }
      }
    ]
  },
  "evt_before_boss": {
    "id": "evt_before_boss",
    "title": "寨下石橋",
    "speaker": "藥師",
    "portrait": "藥師",
    "background": "stone-bridge",
    "paragraphs": [
      "藥師說，山寨並非為了什麼大陰謀，只是寨主趁道路失守坐地收錢。",
      "處理掉寨主，這條路就能重新通行。"
    ],
    "choices": [
      {
        "id": "continue",
        "label": "前往山寨",
        "result": "你整好行裝，向寨門深處前進。"
      }
    ]
  }
};
const objectives={
  "obj_patrol_token": {
    "id": "obj_patrol_token",
    "type": "patrol-drop",
    "title": "村民委託",
    "description": "前往目前已開放的野怪區，從指定怪物身上取得委託信物。",
    "target": 5,
    "minTarget": 3,
    "maxTarget": 8,
    "dropRate": 0.4,
    "pityMisses": 3,
    "preferHighestUnlocked": true,
    "allowedRanks": [
      "regular",
      "elite"
    ]
  }
};
const rewards={
  "road_first": {
    "gold": 150
  },
  "gate_first": {
    "gold": 350
  },
  "commission_turnin": {
    "gold": 300
  },
  "road_chest": {
    "gold": 420,
    "potions": [
      {
        "id": "hpPotion30",
        "count": 1
      }
    ]
  },
  "boss_first": {
    "gold": 650,
    "sharedExp": 300
  },
  "chapter_v1_clear": {
    "gold": 1000,
    "potions": [
      {
        "id": "taichingQiPill",
        "count": 1
      }
    ]
  },
  "story_first_growth": {
    "sharedExp": 15
  },
  "story_starter_gear": {
    "starterEquipmentFunding": "leatherArmor"
  },
  "story_supplies": {
    "potions": [
      {
        "id": "hpPotion10",
        "count": 2
      },
      {
        "id": "spPotion10",
        "count": 2
      }
    ]
  },
  "story_road_chest": {
    "gold": 420,
    "potions": [
      {
        "id": "hpPotion30",
        "count": 1
      }
    ],
    "materials": [
      {
        "id": "oreLow",
        "count": 1
      }
    ]
  }
};
const merchantPool=[
  {
    "id": "hpPotion30",
    "name": "大還丹",
    "kind": "potion",
    "price": 220,
    "quantity": 2,
    "tierKey": "blue"
  },
  {
    "id": "spPotion30",
    "name": "歸元丹",
    "kind": "potion",
    "price": 260,
    "quantity": 2,
    "tierKey": "blue"
  },
  {
    "id": "nineTurnRestorationPill",
    "name": "九轉回元丹",
    "kind": "potion",
    "price": 1800,
    "quantity": 1,
    "tierKey": "orange",
    "rare": true
  },
  {
    "id": "taichingQiPill",
    "name": "太清聚氣丹",
    "kind": "potion",
    "price": 1800,
    "quantity": 1,
    "tierKey": "orange",
    "rare": true
  }
];
const tutorialEncounters={
  "tutorial_1": {
    "name": "攔路惡徒",
    "portraitName": "攔路山賊",
    "hpRatio": 1.6,
    "damage": 4,
    "skillChance": 0,
    "portraitKey": "NPC_SHARED_021"
  },
  "tutorial_2": {
    "name": "山道惡徒",
    "portraitName": "山道惡徒",
    "hpRatio": 1.8,
    "damage": 6,
    "lesson": "skill",
    "unprepared": {
      "hpRatio": 40,
      "damageRatio": 1.25
    },
    "skillChance": 0,
    "portraitKey": "NPC_SHARED_021"
  },
  "tutorial_3": {
    "name": "追兵",
    "portraitName": "寨外斥候",
    "hpRatio": 1.8,
    "damage": 5,
    "requiresSkillUse": true,
    "skillChance": 0,
    "portraitKey": "NPC_SHARED_029"
  },
  "tutorial_4": {
    "name": "寨外守衛",
    "portraitName": "黑松寨精英",
    "hpRatio": 1.9,
    "damage": 6,
    "lesson": "equipment",
    "unprepared": {
      "hpRatio": 40,
      "damageRatio": 1.25
    },
    "skillChance": 0,
    "portraitKey": "NPC_SHARED_029"
  },
  "tutorial_5": {
    "name": "攔路寨眾",
    "portraitName": "持刀寨眾",
    "hpRatio": 2.2,
    "damage": 7,
    "skillChance": 0,
    "portraitKey": "NPC_SHARED_029"
  }
};
const legacyNodes=[
  {
    "id": "n01_arrival",
    "type": "event",
    "title": "山前驛",
    "subtitle": "旅人求助",
    "detail": "先完成第一場實戰，熟悉出城冒險。",
    "onboarding": "完成基本戰鬥",
    "eventId": "evt_arrival",
    "x": 18,
    "y": 96,
    "next": "n02_roadfight"
  },
  {
    "id": "n02_roadfight",
    "type": "battle",
    "title": "山道伏影",
    "subtitle": "普通戰",
    "detail": "建議 Lv.8。擊退攔路山賊。",
    "onboarding": "戰後查看成長／技能點",
    "encounterId": "enc_road",
    "suggestedLevel": 8,
    "x": 36,
    "y": 89,
    "next": "n03_fork",
    "rewardId": "road_first"
  },
  {
    "id": "n03_fork",
    "type": "branch",
    "title": "岔路口",
    "subtitle": "選擇路線",
    "detail": "選擇你的第一條江湖路。",
    "onboarding": "技能學習／升級",
    "x": 52,
    "y": 82,
    "branchId": "fork_1",
    "branches": [
      {
        "id": "safe",
        "nodeId": "n04a_path",
        "title": "林間小徑",
        "risk": "較安全",
        "description": "繞過寨門，會遇到一名受傷旅人。"
      },
      {
        "id": "bold",
        "nodeId": "n04b_gate",
        "title": "山寨正門",
        "risk": "高風險",
        "description": "直接闖關，面對更強的守寨精英。"
      }
    ]
  },
  {
    "id": "n04a_path",
    "type": "event",
    "title": "林間小徑",
    "subtitle": "旅人事件",
    "detail": "聽取旅人的消息，取得上路的線索。",
    "onboarding": "裝備與道具",
    "eventId": "evt_forest_traveler",
    "x": 33,
    "y": 75,
    "next": "n05_commission",
    "branchId": "fork_1",
    "branchChoice": "safe"
  },
  {
    "id": "n04b_gate",
    "type": "elite",
    "title": "山寨正門",
    "subtitle": "精英戰",
    "detail": "建議 Lv.10。正面突破寨門。",
    "onboarding": "裝備與道具",
    "encounterId": "enc_gate_elite",
    "suggestedLevel": 10,
    "x": 72,
    "y": 75,
    "next": "n05_commission",
    "branchId": "fork_1",
    "branchChoice": "bold",
    "rewardId": "gate_first"
  },
  {
    "id": "n05_commission",
    "type": "objective",
    "title": "村民委託",
    "subtitle": "前往野怪區",
    "detail": "完成委託後，熟悉隊伍與元素準備。",
    "onboarding": "元素／隊伍",
    "objectiveId": "obj_patrol_token",
    "x": 52,
    "y": 68,
    "next": "n06_rest",
    "rewardId": "commission_turnin"
  },
  {
    "id": "n06_rest",
    "type": "rest",
    "title": "落雁驛",
    "subtitle": "休息 · HP/SP +30%",
    "x": 31,
    "y": 61,
    "next": "n07_chest"
  },
  {
    "id": "n07_chest",
    "type": "chest",
    "title": "舊驛箱",
    "subtitle": "一次性寶箱",
    "x": 54,
    "y": 54,
    "next": "n08_truth",
    "rewardId": "road_chest"
  },
  {
    "id": "n08_truth",
    "type": "event",
    "title": "寨下石橋",
    "subtitle": "發現真相",
    "eventId": "evt_before_boss",
    "x": 72,
    "y": 47,
    "next": "n09_boss"
  },
  {
    "id": "n09_boss",
    "type": "boss",
    "title": "黑松寨主",
    "subtitle": "Boss",
    "encounterId": "enc_boss",
    "suggestedLevel": 12,
    "x": 55,
    "y": 39,
    "next": "n10_finish",
    "rewardId": "boss_first"
  },
  {
    "id": "n10_finish",
    "type": "finish",
    "title": "章節終點",
    "subtitle": "山路重開",
    "x": 35,
    "y": 32
  }
];
const storyPresentation={
  "npcs": {
    "guard": "NPC_SHARED_029",
    "traveler": "NPC_SHARED_021",
    "herbalist": "NPC_SHARED_044",
    "merchant": "NPC_SHARED_034",
    "chief": "NPC_SHARED_040"
  },
  "scenes": {
    "road": "assets/story/backgrounds/mountain-road.webp",
    "village": "assets/ui/home-background.jpg",
    "bridge": "assets/story/backgrounds/stone-bridge.webp",
    "stockade": "assets/story/backgrounds/black-pine-stockade.webp"
  }
};
window.FourSymbolsAdventureContent=Object.freeze({schemaVersion,chapters,encounters,events,objectives,rewards,merchantPool,tutorialEncounters,legacyNodes,storyPresentation});
})();
