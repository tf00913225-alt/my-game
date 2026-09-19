/* First-screen-safe Team Relic summary catalog.
   Owns only the static fields required by the main-city summary and the full relic catalog. */
(function installRelicSummaryCatalog(global){
    "use strict";
    if(!global||global.FourSymbolsRelicSummaryCatalog){ return; }
    const entries=[
        ["relic_qiankun_flask","乾坤玉壺","奇數回合結束時"],
        ["relic_sun_orb","烈陽神珠","偶數回合開始時"],
        ["relic_xuanwu_seal","玄武靈印","每第3回合開始時"],
        ["relic_soul_bell","鎮魂古鐘","每第4回合開始時"],
        ["relic_tiangang_banner","天罡戰旗","我方累積受到6次敵方有效攻擊後"],
        ["relic_nine_dragon_fire","九龍神火罩","敵方累積完成7次有效行動後"],
        ["relic_cold_spring_jade","寒泉玉珮","任一我方角色在傷害結算後低於35%最大HP時"],
        ["relic_qinglan_feather","青嵐羽符","戰鬥開始時"],
        ["relic_rock_mountain_seal","岩岳鎮印","開場；另於我方累積受8次有效攻擊時"],
        ["relic_returning_wheel","回天寶輪","本場第一次有我方角色將受到致命傷害時"],
        ["relic_origin_talisman","太初聖符","每第4回合結束"],
        ["relic_broken_army_scroll","破軍殘卷","角色攻擊／技能擊敗敵人後"],
        ["relic_red_sky_war_mark","赤霄戰紋","戰鬥開始時"],
        ["relic_ice_mirror_heart","玄冰鏡心","每第3回合結束"],
        ["relic_wind_chasing_talisman","追風行符","每第3回合開始"],
        ["relic_mountain_river_cauldron","山河寶鼎","我方累積受7次有效攻擊後"],
        ["relic_burning_star_mark","焚星殘印","偶數回合結束"],
        ["relic_spirit_spring_bottle","靈泉法瓶","每第3回合結束"],
        ["relic_demon_suppressing_seal","伏魔金印","戰鬥開始；首次成功受到一般負面狀態"],
        ["relic_all_returning_array","萬象歸元盤","每第4回合開始"]
    ];
    global.FourSymbolsRelicSummaryCatalog=Object.freeze(Object.fromEntries(entries.map(entry=>[
        entry[0],
        Object.freeze({id:entry[0],name:entry[1],triggerText:entry[2]})
    ])));
})(typeof window!=="undefined"?window:globalThis);
