"use strict";

// Exact static Lv.1-19 thresholds from js/28-v133-economy-rebalance.js.
// Lv.20+ depends on the live training-zone roster and is not inferred here.
const ANCHORS=Object.freeze([{level:1,value:300},{level:5,value:600},
    {level:10,value:1200},{level:15,value:2500},{level:20,value:8000}]);

function newcomerExpNext(level){
    if(!Number.isSafeInteger(level)||level<1||level>=20){
        throw new Error("Trusted EXP threshold is unavailable at this level.");
    }
    for(let i=1;i<ANCHORS.length;i++){
        const left=ANCHORS[i-1],right=ANCHORS[i];
        if(level<=right.level){
            return Math.round(left.value+
                (right.value-left.value)*(level-left.level)/(right.level-left.level));
        }
    }
    throw new Error("Trusted EXP threshold is unavailable at this level.");
}

module.exports={newcomerExpNext};
