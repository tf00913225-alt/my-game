/* V145 — Wind skill icon assets only. No skill names, stats, effects, costs or combat formulas changed. */
(function installV145WindSkillIcons(){
    "use strict";
    if(typeof elementSkillIconMap==="undefined"){ return; }
    Object.assign(elementSkillIconMap,{
        stormRain:"assets/skills/wind-storm-rain.jpg",
        stormFist:"assets/skills/wind-storm-fist.jpg",
        windCrossSlash:"assets/skills/wind-cross-slash.jpg",
        dizzyFist:"assets/skills/wind-dizzy-fist.jpg",
        stormCircle:"assets/skills/wind-storm-circle.jpg",
        windHowlLightning:"assets/skills/wind-howl-lightning.jpg",
        stealthSkill:"assets/skills/wind-stealth.jpg",
        dodgeSkill:"assets/skills/wind-dodge.jpg",
        dinghaishenzhen:"assets/skills/wind-dinghaishenzhen.jpg",
        windSpell:"assets/skills/wind-spell.jpg"
    });
})();
