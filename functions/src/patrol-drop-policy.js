/* Shared Wild drop data and reward sampling only. Samples are supplied by the
   caller; this Owner creates no RNG, combat result, eligibility or entitlement. */
(function installPatrolDropPolicy(global){
    "use strict";
    const normalRows=Object.freeze([
        {itemId:"freezeTalismanLow",chance:.05,quantity:1},
        {itemId:"stealthTalismanLow",chance:.05,quantity:1},
        {itemId:"barrierTalismanLow",chance:.05,quantity:1},
        {itemId:"oreLow",chance:.05,quantity:1}
    ].map(Object.freeze));
    const eliteRows=Object.freeze([
        {itemId:"ticketSetFire",chance:.01,quantity:1},
        {itemId:"ticketSetWater",chance:.01,quantity:1},
        {itemId:"ticketSetEarth",chance:.01,quantity:1},
        {itemId:"ticketSetWind",chance:.01,quantity:1},
        {itemId:"freezeTalismanMid",chance:.05,quantity:1},
        {itemId:"stealthTalismanMid",chance:.05,quantity:1},
        {itemId:"barrierTalismanMid",chance:.05,quantity:1}
    ].map(Object.freeze));
    // One row per call preserves the Client's interleaving of random draws,
    // definition lookup and inventory insertion, including capacity failures.
    function normalDrop(rowIndex,sample){
        const row=normalRows[rowIndex];
        if(sample>=row.chance){return null;}
        return row;
    }
    function eliteDrop(sample){
        let remaining=sample;
        return eliteRows.find(row=>(remaining-=row.chance)<0)||null;
    }
    const api=Object.freeze({normalRows,eliteRows,normalDrop,eliteDrop});
    global.FourSymbolsPatrolDropPolicy=api;
    if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
