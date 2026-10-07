// GENERATED projection of canonical Reward Owners. DO NOT EDIT.
window.FourSymbolsItemAcquisitionData={
  "equipmentChest": [
    {
      "key": "white",
      "label": "白階",
      "chance": 40
    },
    {
      "key": "blue",
      "label": "藍階",
      "chance": 40
    },
    {
      "key": "purple",
      "label": "紫階",
      "chance": 10
    },
    {
      "key": "orange",
      "label": "橙階",
      "chance": 10
    }
  ],
  "materialChest": [
    {
      "itemId": "oreLow",
      "weight": 20,
      "amount": 10,
      "provisional": true
    },
    {
      "itemId": "oreMid",
      "weight": 15,
      "amount": 10,
      "provisional": true
    },
    {
      "itemId": "oreHigh",
      "weight": 10,
      "amount": 10,
      "provisional": true
    },
    {
      "itemId": "orePerfect",
      "weight": 5,
      "amount": 5,
      "provisional": true
    },
    {
      "itemId": "hpPotion10",
      "weight": 12,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "spPotion10",
      "weight": 12,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "hpPotion30",
      "weight": 8,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "spPotion30",
      "weight": 8,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "hpPotion50",
      "weight": 4,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "spPotion50",
      "weight": 4,
      "amount": 1,
      "provisional": true
    },
    {
      "itemId": "revivalPill",
      "weight": 2,
      "amount": 1,
      "provisional": true
    }
  ],
  "eliteDrops": [
    {
      "itemId": "ticketSetFire",
      "chance": 0.01,
      "quantity": 1
    },
    {
      "itemId": "ticketSetWater",
      "chance": 0.01,
      "quantity": 1
    },
    {
      "itemId": "ticketSetEarth",
      "chance": 0.01,
      "quantity": 1
    },
    {
      "itemId": "ticketSetWind",
      "chance": 0.01,
      "quantity": 1
    },
    {
      "itemId": "freezeTalismanMid",
      "chance": 0.05,
      "quantity": 1
    },
    {
      "itemId": "stealthTalismanMid",
      "chance": 0.05,
      "quantity": 1
    },
    {
      "itemId": "barrierTalismanMid",
      "chance": 0.05,
      "quantity": 1
    }
  ],
  "wildDrops": [
    {
      "itemId": "freezeTalismanLow",
      "chance": 0.05,
      "quantity": 1
    },
    {
      "itemId": "stealthTalismanLow",
      "chance": 0.05,
      "quantity": 1
    },
    {
      "itemId": "barrierTalismanLow",
      "chance": 0.05,
      "quantity": 1
    },
    {
      "itemId": "oreLow",
      "chance": 0.05,
      "quantity": 1
    }
  ],
  "talismanGold": {
    "white": 300,
    "blue": 1000,
    "purple": 3000
  },
  "shopPotions": {
    "hpPotion10": 20,
    "hpPotion50": 80,
    "hpPotion30": 75,
    "spPotion10": 25,
    "spPotion50": 100,
    "spPotion30": 90
  },
  "towerUnlockLevel": 30,
  "personalBosses": [
    {
      "id": "personal-20",
      "name": "赤焰君",
      "level": 20,
      "element": "fire",
      "phases": 1,
      "traits": [
        "護盾",
        "燃燒"
      ],
      "objects": [
        {
          "round": 2,
          "type": "shield"
        }
      ],
      "firstReward": "首通金幣 1,200・藍階礦石 ×2",
      "repeatReward": "金幣 260・白階礦石",
      "firstGold": 1200,
      "repeatGold": 260,
      "ore": "oreLow",
      "firstOre": 2
    },
    {
      "id": "personal-30",
      "name": "獄火侯",
      "level": 30,
      "element": "fire",
      "phases": 1,
      "traits": [
        "蓄力",
        "燃燒",
        "精英援軍"
      ],
      "objects": [
        {
          "round": 2,
          "type": "charge"
        },
        {
          "round": 6,
          "type": "charge"
        }
      ],
      "summon": {
        "hpBelow": 0.5
      },
      "firstReward": "首通金幣 1,800・藍階礦石 ×2",
      "repeatReward": "金幣 380・藍階礦石",
      "firstGold": 1800,
      "repeatGold": 380,
      "ore": "oreMid",
      "firstOre": 2
    },
    {
      "id": "personal-40",
      "name": "凍海君",
      "level": 40,
      "element": "water",
      "phases": 2,
      "traits": [
        "回復",
        "凍傷"
      ],
      "objects": [
        {
          "round": 2,
          "type": "heal"
        },
        {
          "hpBelow": 0.5,
          "type": "charge"
        }
      ],
      "firstReward": "首通金幣 2,600・紫階礦石 ×2",
      "repeatReward": "金幣 520・紫階礦石",
      "firstGold": 2600,
      "repeatGold": 520,
      "ore": "oreHigh",
      "firstOre": 2
    },
    {
      "id": "personal-50",
      "name": "霜淵侯",
      "level": 50,
      "element": "water",
      "phases": 2,
      "traits": [
        "護盾",
        "回復",
        "凍傷",
        "精英援軍"
      ],
      "objects": [
        {
          "round": 2,
          "type": "shield"
        },
        {
          "hpBelow": 0.45,
          "type": "heal"
        }
      ],
      "summon": {
        "round": 4
      },
      "firstReward": "首通金幣 3,400・紫階礦石 ×3",
      "repeatReward": "金幣 660・紫階礦石",
      "firstGold": 3400,
      "repeatGold": 660,
      "ore": "oreHigh",
      "firstOre": 3
    },
    {
      "id": "personal-60",
      "name": "雪獄尊",
      "level": 60,
      "element": "water",
      "phases": 3,
      "traits": [
        "護盾",
        "蓄力",
        "凍傷"
      ],
      "objects": [
        {
          "round": 2,
          "type": "shield"
        },
        {
          "round": 5,
          "type": "charge"
        },
        {
          "hpBelow": 0.35,
          "type": "charge"
        }
      ],
      "firstReward": "首通金幣 4,300・橙階礦石 ×2",
      "repeatReward": "金幣 820・紫階礦石",
      "firstGold": 4300,
      "repeatGold": 820,
      "ore": "orePerfect",
      "firstOre": 2
    },
    {
      "id": "personal-70",
      "name": "寒劫尊",
      "level": 70,
      "element": "water",
      "phases": 3,
      "traits": [
        "回復",
        "增幅",
        "控制",
        "精英援軍"
      ],
      "objects": [
        {
          "round": 2,
          "type": "heal"
        },
        {
          "round": 5,
          "type": "amplify"
        },
        {
          "hpBelow": 0.35,
          "type": "charge"
        }
      ],
      "summon": {
        "hpBelow": 0.55
      },
      "firstReward": "首通金幣 5,200・橙階礦石 ×2",
      "repeatReward": "金幣 980・橙階礦石",
      "firstGold": 5200,
      "repeatGold": 980,
      "ore": "orePerfect",
      "firstOre": 2
    },
    {
      "id": "personal-80",
      "name": "凍界皇",
      "level": 80,
      "element": "water",
      "phases": 3,
      "traits": [
        "護盾",
        "蓄力",
        "回復"
      ],
      "objects": [
        {
          "round": 2,
          "type": "shield"
        },
        {
          "round": 5,
          "type": "charge"
        },
        {
          "hpBelow": 0.4,
          "type": "heal"
        }
      ],
      "firstReward": "首通回天寶輪・金幣 6,200",
      "repeatReward": "金幣 1,160・橙階礦石",
      "firstGold": 6200,
      "repeatGold": 1160,
      "ore": "orePerfect",
      "firstOre": 1,
      "relic": "relic_returning_wheel"
    },
    {
      "id": "personal-90",
      "name": "霜天皇",
      "level": 90,
      "element": "water",
      "phases": 4,
      "traits": [
        "封鎖",
        "護盾",
        "蓄力",
        "精英援軍"
      ],
      "objects": [
        {
          "round": 2,
          "type": "seal"
        },
        {
          "round": 4,
          "type": "shield"
        },
        {
          "round": 7,
          "type": "charge"
        },
        {
          "hpBelow": 0.3,
          "type": "amplify"
        }
      ],
      "summon": {
        "round": 4
      },
      "firstReward": "首通金幣 7,500・橙階礦石 ×3",
      "repeatReward": "金幣 1,360・橙階礦石",
      "firstGold": 7500,
      "repeatGold": 1360,
      "ore": "orePerfect",
      "firstOre": 3
    },
    {
      "id": "personal-100",
      "name": "寒獄帝",
      "level": 100,
      "element": "water",
      "phases": 4,
      "traits": [
        "護盾",
        "蓄力",
        "回復",
        "封鎖",
        "精英援軍"
      ],
      "objects": [
        {
          "round": 2,
          "type": "shield"
        },
        {
          "round": 4,
          "type": "charge"
        },
        {
          "round": 7,
          "type": "heal"
        },
        {
          "hpBelow": 0.3,
          "type": "seal"
        }
      ],
      "summon": {
        "hpBelow": 0.6
      },
      "firstReward": "首通金幣 10,000・橙階礦石 ×4",
      "repeatReward": "金幣 1,600・橙階礦石",
      "firstGold": 10000,
      "repeatGold": 1600,
      "ore": "orePerfect",
      "firstOre": 4
    }
  ],
  "worldBosses": [
    {
      "id": "world-40",
      "name": "熔天君",
      "level": 40,
      "element": "fire",
      "traits": [
        "四階段",
        "護盾",
        "蓄力"
      ],
      "firstReward": "特殊首通：回天寶輪・金幣 6,000",
      "repeatReward": "最終階段再戰：金幣 700",
      "firstGold": 6000,
      "repeatGold": 700,
      "relic": "relic_returning_wheel"
    },
    {
      "id": "world-60",
      "name": "冰海皇",
      "level": 60,
      "element": "water",
      "traits": [
        "四階段",
        "回復",
        "凍傷"
      ],
      "firstReward": "特殊首通：橙階礦石 ×4・金幣 9,000",
      "repeatReward": "最終階段再戰：金幣 1,000",
      "firstGold": 9000,
      "repeatGold": 1000,
      "ore": "orePerfect",
      "firstOre": 4
    },
    {
      "id": "world-80",
      "name": "九曜龍皇",
      "level": 80,
      "element": "fire",
      "traits": [
        "四階段",
        "增幅",
        "蓄力"
      ],
      "firstReward": "特殊首通：橙階礦石 ×6・金幣 13,000",
      "repeatReward": "最終階段再戰：金幣 1,400",
      "firstGold": 13000,
      "repeatGold": 1400,
      "ore": "orePerfect",
      "firstOre": 6
    },
    {
      "id": "world-100",
      "name": "滅世天魔",
      "level": 100,
      "element": "fire",
      "traits": [
        "四階段",
        "封鎖",
        "護盾",
        "蓄力"
      ],
      "firstReward": "特殊首通：橙階礦石 ×8・金幣 20,000",
      "repeatReward": "最終階段再戰：金幣 2,000",
      "firstGold": 20000,
      "repeatGold": 2000,
      "ore": "orePerfect",
      "firstOre": 8
    }
  ],
  "relics": [
    {
      "id": "relic_qiankun_flask",
      "name": "乾坤玉壺",
      "rarity": "blue"
    },
    {
      "id": "relic_sun_orb",
      "name": "烈陽神珠",
      "rarity": "purple"
    },
    {
      "id": "relic_xuanwu_seal",
      "name": "玄武靈印",
      "rarity": "blue"
    },
    {
      "id": "relic_soul_bell",
      "name": "鎮魂古鐘",
      "rarity": "purple"
    },
    {
      "id": "relic_tiangang_banner",
      "name": "天罡戰旗",
      "rarity": "orange"
    },
    {
      "id": "relic_nine_dragon_fire",
      "name": "九龍神火罩",
      "rarity": "purple"
    },
    {
      "id": "relic_cold_spring_jade",
      "name": "寒泉玉珮",
      "rarity": "purple"
    },
    {
      "id": "relic_qinglan_feather",
      "name": "青嵐羽符",
      "rarity": "blue"
    },
    {
      "id": "relic_rock_mountain_seal",
      "name": "岩岳鎮印",
      "rarity": "purple"
    },
    {
      "id": "relic_returning_wheel",
      "name": "回天寶輪",
      "rarity": "pink"
    },
    {
      "id": "relic_origin_talisman",
      "name": "太初聖符",
      "rarity": "purple"
    },
    {
      "id": "relic_broken_army_scroll",
      "name": "破軍殘卷",
      "rarity": "purple"
    },
    {
      "id": "relic_red_sky_war_mark",
      "name": "赤霄戰紋",
      "rarity": "orange"
    },
    {
      "id": "relic_ice_mirror_heart",
      "name": "玄冰鏡心",
      "rarity": "purple"
    },
    {
      "id": "relic_wind_chasing_talisman",
      "name": "追風行符",
      "rarity": "blue"
    },
    {
      "id": "relic_mountain_river_cauldron",
      "name": "山河寶鼎",
      "rarity": "orange"
    },
    {
      "id": "relic_burning_star_mark",
      "name": "焚星殘印",
      "rarity": "purple"
    },
    {
      "id": "relic_spirit_spring_bottle",
      "name": "靈泉法瓶",
      "rarity": "blue"
    },
    {
      "id": "relic_demon_suppressing_seal",
      "name": "伏魔金印",
      "rarity": "orange"
    },
    {
      "id": "relic_all_returning_array",
      "name": "萬象歸元盤",
      "rarity": "four-symbol"
    }
  ],
  "bossPools": {
    "personal-20": [
      "relic_qinglan_feather",
      "relic_sun_orb"
    ],
    "personal-30": [
      "relic_sun_orb",
      "relic_nine_dragon_fire"
    ],
    "personal-40": [
      "relic_qiankun_flask",
      "relic_cold_spring_jade"
    ],
    "personal-50": [
      "relic_xuanwu_seal",
      "relic_cold_spring_jade"
    ],
    "personal-60": [
      "relic_xuanwu_seal",
      "relic_soul_bell",
      "relic_rock_mountain_seal"
    ],
    "personal-70": [
      "relic_soul_bell",
      "relic_tiangang_banner"
    ],
    "personal-80": [
      "relic_cold_spring_jade",
      "relic_tiangang_banner",
      "relic_returning_wheel"
    ],
    "personal-90": [
      "relic_rock_mountain_seal",
      "relic_tiangang_banner",
      "relic_returning_wheel"
    ],
    "personal-100": [
      "relic_soul_bell",
      "relic_tiangang_banner",
      "relic_returning_wheel"
    ],
    "world-40": [
      "relic_sun_orb",
      "relic_nine_dragon_fire"
    ],
    "world-60": [
      "relic_qiankun_flask",
      "relic_cold_spring_jade",
      "relic_xuanwu_seal"
    ],
    "world-80": [
      "relic_nine_dragon_fire",
      "relic_tiangang_banner",
      "relic_returning_wheel"
    ],
    "world-100": [
      "relic_tiangang_banner",
      "relic_returning_wheel",
      "relic_all_returning_array"
    ]
  },
  "rarityWeights": {
    "white": 40,
    "blue": 30,
    "purple": 18,
    "orange": 8,
    "pink": 3,
    "four-symbol": 1
  },
  "rarityChances": {
    "white": 1,
    "blue": 0.9,
    "purple": 0.72,
    "orange": 0.5,
    "pink": 0.28,
    "four-symbol": 0.12
  },
  "difficulties": {
    "normal": {
      "fragment": [
        2,
        4
      ],
      "essence": [
        10,
        16
      ],
      "universal": {
        "chance": 0.04,
        "count": [
          1,
          1
        ]
      },
      "breakthrough": {
        "chance": 0,
        "count": [
          0,
          0
        ]
      },
      "clearMinutes": 2
    },
    "hard": {
      "fragment": [
        3,
        5
      ],
      "essence": [
        18,
        28
      ],
      "universal": {
        "chance": 0.06,
        "count": [
          1,
          2
        ]
      },
      "breakthrough": {
        "chance": 0,
        "count": [
          0,
          0
        ]
      },
      "clearMinutes": 2.5
    },
    "hell": {
      "fragment": [
        4,
        7
      ],
      "essence": [
        30,
        44
      ],
      "universal": {
        "chance": 0.08,
        "count": [
          1,
          2
        ]
      },
      "breakthrough": {
        "chance": 0.1,
        "count": [
          1,
          1
        ]
      },
      "clearMinutes": 3
    },
    "special": {
      "fragment": [
        5,
        8
      ],
      "essence": [
        42,
        60
      ],
      "universal": {
        "chance": 0.12,
        "count": [
          1,
          3
        ]
      },
      "breakthrough": {
        "chance": 0.18,
        "count": [
          1,
          2
        ]
      },
      "clearMinutes": 3.5
    }
  },
  "materials": {
    "composeSpecificFragments": 100,
    "universalExchangeCost": 2,
    "maxUniversalReplacement": 50,
    "essenceItemId": "relicEssence",
    "universalItemId": "relicUniversalFragment",
    "breakthroughItemId": "relicBreakthroughStone",
    "upgrade": {
      "essenceBase": 20,
      "essencePerCurrentLevel": 6,
      "breakthroughLevels": [
        10
      ],
      "breakthroughStoneCost": 1
    },
    "choiceBoxes": {
      "relicChoiceBoxBlue": {
        "name": "藍階以下秘寶碎片自選箱",
        "maxRarity": "blue",
        "fragmentAmount": 15,
        "tierKey": "blue"
      },
      "relicChoiceBoxPurple": {
        "name": "紫階以下秘寶碎片自選箱",
        "maxRarity": "purple",
        "fragmentAmount": 20,
        "tierKey": "purple"
      },
      "relicChoiceBoxOrange": {
        "name": "橙階以下秘寶碎片自選箱",
        "maxRarity": "orange",
        "fragmentAmount": 20,
        "tierKey": "orange"
      },
      "relicChoiceBoxPink": {
        "name": "桃紅階以下秘寶碎片自選箱",
        "maxRarity": "pink",
        "fragmentAmount": 25,
        "tierKey": "pink"
      }
    }
  },
  "tower": {
    "floorCount": 100,
    "essence": {
      "base": 10,
      "perTenFloorBand": 2,
      "eliteBonus": 8,
      "bossBonus": 20,
      "majorMilestoneBonus": 24
    },
    "universal": {
      "five": [
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        3,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        4,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5
      ],
      "ten": [
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        8,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        9,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10,
        10
      ]
    },
    "breakthrough": {
      "everyTen": 1
    },
    "majorMilestones": {
      "25": {
        "boxId": "relicChoiceBoxBlue"
      },
      "50": {
        "boxId": "relicChoiceBoxPurple"
      },
      "75": {
        "boxId": "relicChoiceBoxOrange"
      },
      "100": {
        "boxId": "relicChoiceBoxPink"
      }
    },
    "essenceByFloor": [
      12,
      12,
      12,
      12,
      20,
      12,
      12,
      12,
      12,
      40,
      14,
      14,
      14,
      14,
      22,
      14,
      14,
      14,
      14,
      42,
      16,
      16,
      16,
      16,
      48,
      16,
      16,
      16,
      16,
      44,
      18,
      18,
      18,
      18,
      26,
      18,
      18,
      18,
      18,
      46,
      20,
      20,
      20,
      20,
      28,
      20,
      20,
      20,
      20,
      72,
      22,
      22,
      22,
      22,
      30,
      22,
      22,
      22,
      22,
      50,
      24,
      24,
      24,
      24,
      32,
      24,
      24,
      24,
      24,
      52,
      26,
      26,
      26,
      26,
      58,
      26,
      26,
      26,
      26,
      54,
      28,
      28,
      28,
      28,
      36,
      28,
      28,
      28,
      28,
      56,
      30,
      30,
      30,
      30,
      38,
      30,
      30,
      30,
      30,
      82
    ]
  },
  "abyssRegions": [
    {
      "id": "east",
      "name": "東帝領域",
      "emperor": "東帝",
      "element": "earth",
      "elementLabel": "土",
      "bossSkills": [
        "flyingSandStrike",
        "dustStorm",
        "stoneSlash"
      ],
      "bossSupports": [],
      "ticketId": "ticketSetEarth",
      "bossEntry": "進入東帝王座",
      "bossArt": "assets/dungeons/abyss/east-emperor.webp"
    },
    {
      "id": "south",
      "name": "南帝領域",
      "emperor": "南帝",
      "element": "fire",
      "elementLabel": "火",
      "bossSkills": [
        "explosiveFlurry",
        "dragonSlash",
        "fireRocket"
      ],
      "bossSupports": [],
      "ticketId": "ticketSetFire",
      "bossEntry": "進入南帝炎宮",
      "bossArt": "assets/dungeons/abyss/south-emperor.webp"
    },
    {
      "id": "heaven",
      "name": "天帝領域",
      "emperor": "天帝",
      "element": "wind",
      "elementLabel": "風",
      "bossSkills": [
        "windHowlLightning",
        "stormFlurry",
        "windCrossSlash"
      ],
      "bossSupports": [],
      "ticketId": "ticketSetWind",
      "bossEntry": "踏入天帝天域",
      "bossArt": "assets/dungeons/abyss/heaven-emperor.webp"
    },
    {
      "id": "north",
      "name": "北帝領域",
      "emperor": "北帝",
      "element": "water",
      "elementLabel": "水",
      "bossSkills": [
        "floodBeast",
        "frostPunch",
        "waterKnife"
      ],
      "bossSupports": [],
      "ticketId": "ticketSetWater",
      "bossEntry": "進入北帝寒境",
      "bossArt": "assets/dungeons/abyss/north-emperor.webp"
    },
    {
      "id": "extreme",
      "name": "極帝領域",
      "emperor": "極帝天尊",
      "displayEmperor": "極帝",
      "element": "light",
      "elementLabel": "光",
      "bossSkills": [],
      "bossSupports": [
        "yuanZuBlessing"
      ],
      "ticketId": null,
      "bossEntry": "踏入極帝神域",
      "bossArt": "assets/dungeons/abyss/floor5-extreme-emperor.webp"
    }
  ],
  "abyssDifficulties": {
    "20": {
      "id": 20,
      "title": "虛空五帝・初境",
      "shortTitle": "初境",
      "unlockLevel": 20,
      "monsterLevel": 20,
      "skillLevel": 1,
      "normalGold": 120,
      "emperorGold": 500,
      "finalGold": 1500,
      "finalExp": 600,
      "cover": "assets/dungeons/abyss/abyss-cover.webp"
    },
    "40": {
      "id": 40,
      "title": "虛空五帝・真境",
      "shortTitle": "真境",
      "unlockLevel": 40,
      "monsterLevel": 40,
      "skillLevel": 2,
      "normalGold": 220,
      "emperorGold": 900,
      "finalGold": 3000,
      "finalExp": 1200,
      "cover": "assets/dungeons/abyss/abyss-cover-v17343.png"
    }
  },
  "adventureRewards": {
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
    }
  },
  "adventureMerchants": [
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
  ]
};
