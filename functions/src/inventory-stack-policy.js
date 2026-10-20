/* Shared stack planning only. Callers retain definition admission, canonical
   input validation, presentation, item cloning and equipment instance owners. */
(function installInventoryStackPolicy(global){
    "use strict";
    const constants=Object.freeze({maxEntries:120,maxStack:999});
    function quantity(amount){return Math.max(1,Math.floor(Number(amount)||1));}
    function capacity(items,itemId,maxStack=constants.maxStack){
        const matching=items.filter(item=>item&&item.id===itemId);
        const stackFreeSpace=maxStack<=1?0:matching.reduce((sum,item)=>
            sum+Math.max(0,maxStack-(Number(item.count)||0)),0);
        return stackFreeSpace+Math.max(0,constants.maxEntries-items.length)*maxStack;
    }
    function plan(items,itemId,amount,maxStack=constants.maxStack){
        const requested=quantity(amount),available=capacity(items,itemId,maxStack);
        const result={quantity:requested,capacity:available,canAdd:requested<=available,
            success:false,updates:[],appendCounts:[]};
        if(!result.canAdd)return result;
        let remaining=requested;
        // Retain both the original iteration order and touched zero-space rows:
        // the Client synchronizes ticket presentation for every visited stack.
        if(maxStack>1){
            items.forEach((item,index)=>{
                if(!item||item.id!==itemId||remaining<=0)return;
                const current=Math.max(0,Math.floor(Number(item.count)||0));
                const add=Math.min(Math.max(0,maxStack-current),remaining);
                result.updates.push({index,count:current+add});remaining-=add;
            });
        }
        while(remaining>0){
            if(items.length+result.appendCounts.length>=constants.maxEntries)return result;
            const count=Math.min(maxStack,remaining);
            result.appendCounts.push(count);remaining-=count;
        }
        result.success=true;
        return result;
    }
    const api=Object.freeze({constants,quantity,capacity,plan});
    global.FourSymbolsInventoryStackPolicy=api;
    if(typeof module!=="undefined"&&module.exports){module.exports=api;}
})(typeof window!=="undefined"?window:globalThis);
