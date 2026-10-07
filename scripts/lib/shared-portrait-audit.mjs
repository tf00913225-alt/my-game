// Shared rows extend the canonical portrait assetPool, never a second registry.
export function auditSharedPortraits(registry, previous){
    const entries=registry.assetPool?.entries||[], errors=[];
    const shared=entries.filter(e=>e.assetClass==='shared-npc'||/^NPC_SHARED_/.test(e.assetId));
    const old=(previous?.assetPool?.entries||[]).filter(e=>/^NPC_SHARED_/.test(e.assetId));
    const ids=new Set(), paths=new Set(), hashes=new Set();
    const contentFields=['element','tier','rank','level','stats','faction','storyRole','monsterId','skills','drops','ai'];
    for(const e of shared){
        const bad=reason=>errors.push(`${e.assetId}: ${reason}`);
        if(!/^NPC_SHARED_\d{3,}$/.test(e.assetId)||e.assetClass!=='shared-npc')bad('invalid shared asset identity');
        if(ids.has(e.assetId)||entries.filter(other=>other.assetId===e.assetId).length!==1)bad('duplicate assetId');
        ids.add(e.assetId);
        if(paths.has(e.sourcePath)||entries.some(other=>other!==e&&other.sourcePath===e.sourcePath))bad('duplicate sourcePath; reference original assetId');
        paths.add(e.sourcePath);
        if(hashes.has(e.sourceSha256)||entries.some(other=>other!==e&&other.sourceSha256===e.sourceSha256))bad('duplicate SHA-256; reference original assetId');
        hashes.add(e.sourceSha256);
        if(e.sourceBranch!=='assets-library'||!/^assets\/inbox\/.+\.png$/.test(e.sourcePath||'')||e.sourcePath.split('/').includes('..')||!/^[a-f0-9]{40}$/.test(e.sourceCommit||'')||!/^[a-f0-9]{64}$/.test(e.sourceSha256||''))bad('incomplete Master provenance');
        if(contentFields.some(field=>Object.hasOwn(e,field)))bad('Gameplay identity belongs to Content Owner');
        if(!e.displayName||!e.notes||!Array.isArray(e.allowedContexts)||!e.allowedContexts.length||!registry.dimensions[e.sizeClass])bad('missing asset metadata');
        if(!['reserved','adopted','retired'].includes(e.status))bad('invalid lifecycle status');
        if(e.exclusive!==false&&!(e.exclusive===true&&e.reusePolicy==='exclusive'&&e.exclusiveAuthorization))bad('exclusive needs explicit user authorization');
        if(e.exclusive===false&&e.reusePolicy!=='reusable')bad('shared reuse policy mismatch');
        const image=e.sourceImage;
        if(!image||image.format!=='png'||!(image.width>0&&image.height>0)||!image.alpha||!image.transparentPixels||!image.decodeVerified)bad('Master image verification missing');
        if(e.status==='reserved'&&(e.runtimePath||e.usedIn?.length||e.references?.length))bad('reserved cannot claim Runtime adoption');
        if(e.status==='adopted'&&!/^assets\/.+\.webp$/.test(e.runtimePath||''))bad('adopted needs verified Runtime WebP');
        if(Object.values(registry.groups||{}).flat().some(row=>row[0]===e.assetId))bad('shared art cannot acquire a Monster identity row');
    }
    const oldMax=Math.max(0,...old.map(e=>Number(e.assetId.slice(11))));
    for(const e of old){
        const current=shared.find(n=>n.assetId===e.assetId);
        if(!current)errors.push(`${e.assetId}: removed historical ID; retain retired row`);
        else if(current.sourceSha256!==e.sourceSha256||current.sourcePath!==e.sourcePath||current.sourceCommit!==e.sourceCommit)errors.push(`${e.assetId}: immutable identity reassigned`);
    }
    for(const e of shared)if(!old.some(n=>n.assetId===e.assetId)&&Number(e.assetId.slice(11))<=oldMax)errors.push(`${e.assetId}: reused historical sequence`);
    return errors;
}
