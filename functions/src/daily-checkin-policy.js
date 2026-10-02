"use strict";

// One server-owned day and reward policy for issuance, evidence and settlement.
const REWARD_GOLD=50;
const ZONE="Asia/Taipei";

function taipeiDay(instant){
    const date=new Date(instant);
    if(!Number.isFinite(date.getTime())){ throw new Error("Invalid server time"); }
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
        timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(date).map(part=>[part.type,part.value]));
    return `${parts.year}${parts.month}${parts.day}`;
}

module.exports={taipeiDay,REWARD_GOLD};
