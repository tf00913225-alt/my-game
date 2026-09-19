/*
   Release Update Notification System
   ----------------------------------
   Player-facing release notices are owned by release/release-update.json.
   This app-shell module deliberately reuses #homeFeatureModal and the native
   #game-overlay-layer; it does not introduce a second modal or announcement
   framework.
*/
(function installReleaseUpdateNotification(global){
    "use strict";

    if(!global||global.FourSymbolsReleaseUpdate){ return; }

    const RELEASE_NOTICE_PATH="release/release-update.json";
    const CHECK_INTERVAL_MS=4*60*1000;
    const MIN_CHECK_GAP_MS=45*1000;
    const REMINDER_COOLDOWN_MS=20*60*1000;
    const REQUEST_TIMEOUT_MS=8000;
    const PENDING_RECHECK_MS=1500;
    const STORAGE_NAMESPACE="four-symbols:release-update:";
    const DEV_PREVIEW_QUERY="releaseUpdatePreview";
    const DEV_PREVIEW_HOSTS=new Set([
        "dev.four-symbols-dev.pages.dev",
        "localhost",
        "127.0.0.1",
        "::1"
    ]);

    const state={
        started:false,
        checking:null,
        lastCheckAt:0,
        manifest:null,
        loadedReleaseVersion:null,
        marquee:null,
        pollTimer:null,
        pendingTimer:null,
        pendingNormalReload:false,
        pendingForcedUpdate:false,
        pendingAnnouncement:false,
        loginAnnouncementShown:false,
        forcedModalLock:false,
        modalOpen:false,
        modalKind:null,
        devPreviewMode:null,
        criticalOperations:new Map(),
        nextOperationId:1
    };

    function now(){ return Date.now(); }

    function getLocationHostname(){
        try{
            const location=global.location;
            const hostname=String(location&&location.hostname||"")
                .trim()
                .toLowerCase()
                .replace(/^\[|\]$/g,"");
            if(hostname){ return hostname; }
            const href=String(location&&location.href||"");
            return href?new URL(href).hostname.toLowerCase().replace(/^\[|\]$/g,""):"";
        }catch(_){ return ""; }
    }

    function getDevPreviewMode(){
        if(!DEV_PREVIEW_HOSTS.has(getLocationHostname())){ return null; }
        try{
            const location=global.location;
            const base=(global.document&&global.document.baseURI)||(location&&location.href)||undefined;
            const mode=new URL(String(location&&location.href||""),base)
                .searchParams
                .get(DEV_PREVIEW_QUERY);
            return mode==="marquee"||mode==="modal"?mode:null;
        }catch(_){ return null; }
    }

    function normalizeVersion(value){
        const raw=String(value==null?"":value).trim().replace(/^V/i,"");
        return raw ? "V"+raw : "";
    }

    function parseVersion(value){
        const normalized=normalizeVersion(value).replace(/^V/,"");
        if(!/^\d+(?:\.\d+)+$/.test(normalized)){ return null; }
        return normalized.split(".").map(part=>Number(part));
    }

    function compareVersions(left,right){
        const a=parseVersion(left);
        const b=parseVersion(right);
        if(!a||!b){ return null; }
        const length=Math.max(a.length,b.length);
        for(let index=0;index<length;index++){
            const delta=(a[index]||0)-(b[index]||0);
            if(delta!==0){ return delta>0?1:-1; }
        }
        return 0;
    }

    function escapeHtml(value){
        return String(value==null?"":value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/\"/g,"&quot;")
            .replace(/'/g,"&#039;");
    }

    function getLoadedReleaseVersion(){
        const build=global.__FOUR_SYMBOLS_BUILD__;
        const value=build&&build.release;
        return normalizeVersion(value);
    }

    function getStorage(){
        try{ return global.localStorage||null; }
        catch(_){ return null; }
    }

    function storageKey(suffix){
        const repository=global.FourSymbolsAccountSave;
        try{
            if(repository&&typeof repository.accountKey==="function"){
                return repository.accountKey("release-update-"+suffix);
            }
        }catch(_){ }
        return STORAGE_NAMESPACE+suffix;
    }

    function readStorage(suffix){
        const storage=getStorage();
        if(!storage){ return null; }
        try{ return storage.getItem(storageKey(suffix)); }
        catch(_){ return null; }
    }

    function writeStorage(suffix,value){
        const storage=getStorage();
        if(!storage){ return; }
        try{ storage.setItem(storageKey(suffix),String(value)); }
        catch(_){ }
    }

    function removeStorage(suffix){
        const storage=getStorage();
        if(!storage){ return; }
        try{
            if(typeof storage.removeItem==="function"){ storage.removeItem(storageKey(suffix)); }
        }catch(_){ }
    }

    function localDateKey(value){
        const date=new Date(value==null?now():value);
        if(Number.isNaN(date.getTime())){ return ""; }
        const yyyy=date.getFullYear();
        const mm=String(date.getMonth()+1).padStart(2,"0");
        const dd=String(date.getDate()).padStart(2,"0");
        return yyyy+"-"+mm+"-"+dd;
    }

    function readTodaySuppression(){
        try{
            const value=JSON.parse(readStorage("suppress-today")||"null");
            return value&&typeof value==="object"?value:null;
        }catch(_){ return null; }
    }

    function isCurrentNoticeSuppressedToday(manifest){
        if(!manifest){ return false; }
        const value=readTodaySuppression();
        return !!(
            value&&
            value.noticeId===manifest.noticeId&&
            value.dateKey===localDateKey()
        );
    }

    function setCurrentNoticeSuppressedToday(enabled){
        const manifest=state.manifest;
        if(!manifest){ return; }
        if(enabled){
            writeStorage("suppress-today",JSON.stringify({
                noticeId:manifest.noticeId,
                dateKey:localDateKey()
            }));
        }else{
            removeStorage("suppress-today");
        }
    }

    function validateManifest(value){
        if(!value||typeof value!=="object"||Array.isArray(value)){ return null; }
        const releaseVersion=normalizeVersion(value.releaseVersion);
        const updateMode=value.updateMode;
        const minimumVersion=value.minimumVersion===null||value.minimumVersion===undefined||value.minimumVersion===""
            ? null
            : normalizeVersion(value.minimumVersion);
        const content=Array.isArray(value.content)?value.content:null;
        if(
            value.schemaVersion!==1||
            typeof value.publicNotice!=="boolean"||
            !parseVersion(releaseVersion)||
            typeof value.noticeId!=="string"||!value.noticeId.trim()||
            typeof value.title!=="string"||!value.title.trim()||
            typeof value.summary!=="string"||!value.summary.trim()||
            !content||content.length===0||content.some(item=>typeof item!=="string"||!item.trim())||
            typeof value.publishedAt!=="string"||!value.publishedAt.trim()||
            !Number.isFinite(Date.parse(value.publishedAt))||
            (updateMode!=="normal"&&updateMode!=="forced")||
            (minimumVersion!==null&&!parseVersion(minimumVersion))
        ){
            return null;
        }
        return {
            schemaVersion:1,
            publicNotice:value.publicNotice,
            releaseVersion,
            noticeId:value.noticeId.trim(),
            title:value.title.trim(),
            summary:value.summary.trim(),
            content:content.map(item=>item.trim()),
            publishedAt:value.publishedAt,
            updateMode,
            minimumVersion
        };
    }

    function hasUnreadReleaseNotice(){
        const manifest=state.manifest;
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(!manifest||!manifest.publicNotice||!loaded){ return false; }
        if(compareVersions(loaded,manifest.releaseVersion)!==0){ return false; }
        return (
            readStorage("last-seen-version")!==manifest.releaseVersion||
            readStorage("last-seen-notice")!==manifest.noticeId
        );
    }

    function markCurrentNoticeSeen(){
        const manifest=state.manifest;
        if(!manifest){ return; }
        writeStorage("last-seen-version",manifest.releaseVersion);
        writeStorage("last-seen-notice",manifest.noticeId);
        refreshNotificationDots();
    }

    function shouldAutoShowLoginAnnouncement(manifest){
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(
            state.loginAnnouncementShown||
            state.pendingAnnouncement||
            !manifest||
            !manifest.publicNotice||
            !loaded||
            compareVersions(loaded,manifest.releaseVersion)!==0
        ){
            return false;
        }
        return !isCurrentNoticeSuppressedToday(manifest);
    }

    function isSharedModalAvailableForAnnouncement(){
        const parts=getSharedModalParts();
        return !!(
            parts&&
            (!parts.modal.classList||!parts.modal.classList.contains("show"))
        );
    }

    function readReminder(){
        try{
            const value=JSON.parse(readStorage("last-reminder")||"null");
            return value&&typeof value==="object"?value:null;
        }catch(_){ return null; }
    }

    function shouldShowReminder(manifest){
        const reminder=readReminder();
        return !reminder||reminder.noticeId!==manifest.noticeId||now()-Number(reminder.at||0)>=REMINDER_COOLDOWN_MS;
    }

    function rememberReminder(manifest){
        writeStorage("last-reminder",JSON.stringify({noticeId:manifest.noticeId,at:now()}));
    }

    function getUnsafeReasons(){
        const reasons=[];
        try{
            if(typeof battleActive!=="undefined"&&battleActive){ reasons.push("battle"); }
            if(typeof battlePhase!=="undefined"&&battlePhase==="resolve"){ reasons.push("battle-resolution"); }
        }catch(_){ }
        try{
            if(
                global.FourSymbolsBattleFlow&&
                typeof global.FourSymbolsBattleFlow.isPresentationActive==="function"&&
                global.FourSymbolsBattleFlow.isPresentationActive()
            ){
                reasons.push("battle-presentation");
            }
        }catch(_){ }
        if(state.criticalOperations.size){ reasons.push("critical-operation"); }

        const documentRef=global.document;
        if(!documentRef||typeof documentRef.getElementById!=="function"){ return reasons; }
        const reward=documentRef.getElementById("v132RewardModal");
        if(reward&&reward.classList&&reward.classList.contains("show")){ reasons.push("reward"); }
        const dialog=documentRef.getElementById("v169RpgDialogLayer");
        if(dialog&&dialog.classList&&dialog.classList.contains("show")){ reasons.push("transaction-dialog"); }
        const modal=documentRef.getElementById("homeFeatureModal");
        if(
            modal&&modal.classList&&modal.classList.contains("show")&&
            !modal.classList.contains("release-update-modal")&&
            (
                modal.classList.contains("v141-synthesis-modal")||
                modal.classList.contains("v131-shop-open")||
                modal.classList.contains("team-relic-modal")
            )
        ){
            reasons.push("high-value-feature");
        }
        return reasons;
    }

    function canSafelyReloadForUpdate(){
        return getUnsafeReasons().length===0;
    }

    function beginCriticalOperation(label){
        const operationId=state.nextOperationId++;
        let active=true;
        state.criticalOperations.set(operationId,String(label||"critical-operation"));
        return function endCriticalOperation(){
            if(!active){ return; }
            active=false;
            state.criticalOperations.delete(operationId);
            resolvePendingWhenSafe();
        };
    }

    function getOverlayLayer(){
        const documentRef=global.document;
        return documentRef&&documentRef.getElementById
            ? documentRef.getElementById("game-overlay-layer")
            : null;
    }

    function ensureMarquee(){
        if(state.marquee&&state.marquee.isConnected!==false){ return state.marquee; }
        const documentRef=global.document;
        const layer=getOverlayLayer();
        if(!documentRef||!layer||typeof documentRef.createElement!=="function"){ return null; }
        const marquee=documentRef.createElement("button");
        marquee.type="button";
        marquee.id="releaseUpdateMarquee";
        marquee.className="release-update-marquee";
        marquee.setAttribute("aria-live","polite");
        marquee.setAttribute("aria-label","查看版本更新內容");
        marquee.innerHTML=
            '<span class="release-update-marquee-tag">更新</span>'+
            '<span class="release-update-marquee-text"></span>'+
            '<span class="release-update-marquee-action">查看</span>';
        marquee.addEventListener("click",()=>{
            const manifest=state.manifest;
            if(!manifest){ return; }
            if(state.devPreviewMode){
                openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"preview");
                return;
            }
            if(isForcedForLoadedVersion(manifest)&&!canSafelyReloadForUpdate()){
                showMarquee(manifest,"forced-pending");
                schedulePendingResolution();
                return;
            }
            openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"update");
        });
        layer.appendChild(marquee);
        state.marquee=marquee;
        return marquee;
    }

    function showMarquee(manifest,kind){
        const marquee=ensureMarquee();
        if(!marquee||!manifest){ return; }
        const tag=marquee.querySelector(".release-update-marquee-tag");
        const text=marquee.querySelector(".release-update-marquee-text");
        const action=marquee.querySelector(".release-update-marquee-action");
        const pending=kind==="normal-pending"||kind==="forced-pending";
        if(tag){ tag.textContent=kind&&kind.indexOf("forced")===0?"重要更新":"更新"; }
        if(text){
            text.textContent=pending
                ? manifest.releaseVersion+" 已發布；目前操作完成後將自動進行更新。"
                : manifest.releaseVersion+" 已發布，"+manifest.summary;
        }
        if(action){ action.textContent=pending?"待更新":"查看"; }
        marquee.classList.toggle("is-forced",kind&&kind.indexOf("forced")===0);
        marquee.classList.toggle("is-pending",!!pending);
        marquee.hidden=false;
    }

    function hideMarquee(){
        if(state.marquee){ state.marquee.hidden=true; }
    }

    function isForcedForLoadedVersion(manifest){
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        if(!manifest||!loaded){ return false; }
        if(manifest.updateMode==="forced"){ return true; }
        return !!(
            manifest.minimumVersion&&
            compareVersions(loaded,manifest.minimumVersion)!==null&&
            compareVersions(loaded,manifest.minimumVersion)<0
        );
    }

    function getSharedModalParts(){
        const documentRef=global.document;
        if(!documentRef||typeof documentRef.getElementById!=="function"){ return null; }
        const modal=documentRef.getElementById("homeFeatureModal");
        const title=documentRef.getElementById("homeFeatureModalTitle");
        const body=documentRef.getElementById("homeFeatureModalBody");
        if(!modal||!title||!body){ return null; }
        return {modal,title,body};
    }

    function renderReleaseContent(manifest,kind){
        const forced=kind==="forced";
        const update=kind==="update"||kind==="preview";
        const intro=forced
            ? "目前版本已停止使用，請更新後繼續遊戲。"
            : update
                ? "發現新版本。你可先完成目前操作，再更新至最新版本。"
                : "以下是本次正式版本更新內容。";
        const notes=manifest.content.map(item=>"<li>"+escapeHtml(item)+"</li>").join("");
        const actions=forced
            ? '<div class="release-update-actions"><button type="button" class="release-update-primary" data-release-update-action="reload">立即更新</button></div>'
            : update
                ? '<div class="release-update-actions"><button type="button" data-release-update-action="later">稍後更新</button><button type="button" class="release-update-primary" data-release-update-action="reload">立即更新</button></div>'
                : '<div class="release-update-actions"><button type="button" class="release-update-primary" data-release-update-action="acknowledge">我知道了</button></div>';
        const suppressToday=!forced&&!update
            ? '<label class="release-update-suppress-today"><input class="release-update-suppress-today-input" type="checkbox" data-release-update-suppress-today="true"><span>今日不再跳出提醒</span></label>'
            : '';
        return (
            '<section class="release-update-detail" data-release-update-kind="'+escapeHtml(kind)+'">'+
                '<p class="release-update-version">'+escapeHtml(manifest.releaseVersion)+'　'+escapeHtml(manifest.summary)+'</p>'+
                '<p class="release-update-intro">'+escapeHtml(intro)+'</p>'+
                '<h3>更新內容</h3>'+
                '<ul class="release-update-notes">'+notes+'</ul>'+
                '<p class="release-update-published">發布時間：'+escapeHtml(formatPublishedAt(manifest.publishedAt))+'</p>'+
                suppressToday+
                actions+
            '</section>'
        );
    }

    function formatPublishedAt(value){
        const date=new Date(value);
        if(Number.isNaN(date.getTime())){ return value; }
        const yyyy=date.getFullYear();
        const mm=String(date.getMonth()+1).padStart(2,"0");
        const dd=String(date.getDate()).padStart(2,"0");
        return yyyy+"-"+mm+"-"+dd;
    }

    function bindReleaseActions(body,kind){
        if(!body||typeof body.querySelectorAll!=="function"){ return; }
        body.querySelectorAll("[data-release-update-action]").forEach(button=>{
            button.addEventListener("click",()=>{
                const action=button.getAttribute("data-release-update-action");
                if(action==="reload"){ requestReload(); }
                else if(action==="later"){ deferNormalUpdate(); }
                else if(action==="acknowledge"){ acknowledgeCurrentRelease(); }
            });
        });
    }

    function openReleaseDetail(kind){
        const manifest=state.manifest;
        const parts=getSharedModalParts();
        if(!manifest||!parts){ return false; }
        const forced=kind==="forced";
        if(forced&&!canSafelyReloadForUpdate()){
            state.pendingForcedUpdate=true;
            showMarquee(manifest,"forced-pending");
            schedulePendingResolution();
            return false;
        }

        /* Existing owner performs its normal borrowed-element cleanup first. */
        state.forcedModalLock=false;
        if(typeof global.closeHomeFeature==="function"){
            global.closeHomeFeature();
        }else{
            parts.modal.classList.remove("show");
        }

        parts.modal.classList.add("release-update-modal");
        parts.modal.classList.toggle("release-update-forced",forced);
        parts.title.textContent=manifest.title;
        parts.body.innerHTML=renderReleaseContent(manifest,kind);
        parts.modal.classList.add("show");
        state.modalOpen=true;
        state.modalKind=kind;
        state.forcedModalLock=forced;
        if(kind==="acknowledge"){ state.loginAnnouncementShown=true; }
        bindReleaseActions(parts.body,kind);
        if(forced){
            const primary=parts.body.querySelector(".release-update-primary");
            if(primary&&typeof primary.focus==="function"){ primary.focus(); }
        }
        return true;
    }

    function onSharedModalClosed(){
        const parts=getSharedModalParts();
        if(parts){
            parts.modal.classList.remove("release-update-modal","release-update-forced");
        }
        state.modalOpen=false;
        state.modalKind=null;
        state.forcedModalLock=false;
    }

    function shouldPreventSharedModalClose(){
        return state.forcedModalLock&&state.modalOpen;
    }

    function isForcedUpdateBlocking(){
        return shouldPreventSharedModalClose();
    }

    function announceForcedLock(){
        const parts=getSharedModalParts();
        if(parts&&parts.modal.classList.contains("release-update-forced")){
            const primary=parts.body.querySelector(".release-update-primary");
            if(primary&&typeof primary.focus==="function"){ primary.focus(); }
        }
    }

    function closeReleaseDetail(){
        state.forcedModalLock=false;
        if(typeof global.closeHomeFeature==="function"){
            global.closeHomeFeature();
        }else{
            const parts=getSharedModalParts();
            if(parts){ parts.modal.classList.remove("show"); }
            onSharedModalClosed();
        }
    }

    function acknowledgeCurrentRelease(){
        const parts=getSharedModalParts();
        const checkbox=parts&&parts.body&&typeof parts.body.querySelector==="function"
            ?parts.body.querySelector(".release-update-suppress-today-input")
            :null;
        setCurrentNoticeSuppressedToday(!!(checkbox&&checkbox.checked));
        markCurrentNoticeSeen();
        state.pendingAnnouncement=false;
        closeReleaseDetail();
        refreshNotificationDots();
    }

    function deferNormalUpdate(){
        const manifest=state.manifest;
        if(!manifest){ return; }
        if(state.devPreviewMode){
            closeReleaseDetail();
            return;
        }
        markCurrentNoticeSeen();
        hideMarquee();
        closeReleaseDetail();
        refreshNotificationDots();
    }

    function performReload(){
        try{
            if(global.location&&typeof global.location.reload==="function"){
                global.location.reload();
            }
        }catch(_){ }
    }

    function requestReload(){
        const manifest=state.manifest;
        if(!manifest){ return false; }
        if(state.devPreviewMode){
            closeReleaseDetail();
            return false;
        }
        markCurrentNoticeSeen();
        const forced=isForcedForLoadedVersion(manifest);
        if(!canSafelyReloadForUpdate()){
            if(forced){ state.pendingForcedUpdate=true; }
            else{ state.pendingNormalReload=true; }
            state.forcedModalLock=false;
            closeReleaseDetail();
            showMarquee(manifest,forced?"forced-pending":"normal-pending");
            schedulePendingResolution();
            return false;
        }
        performReload();
        return true;
    }

    function hasPendingWork(){
        return state.pendingForcedUpdate||state.pendingNormalReload||state.pendingAnnouncement;
    }

    function schedulePendingResolution(){
        if(!hasPendingWork()||state.pendingTimer!==null){ return; }
        state.pendingTimer=global.setTimeout(()=>{
            state.pendingTimer=null;
            resolvePendingWhenSafe();
        },PENDING_RECHECK_MS);
    }

    function resolvePendingWhenSafe(){
        if(!hasPendingWork()){ return; }
        if(!canSafelyReloadForUpdate()){
            schedulePendingResolution();
            return;
        }
        if(state.pendingForcedUpdate){
            state.pendingForcedUpdate=false;
            openReleaseDetail("forced");
            return;
        }
        if(state.pendingNormalReload){
            state.pendingNormalReload=false;
            performReload();
            return;
        }
        if(state.pendingAnnouncement){
            if(isCurrentNoticeSuppressedToday(state.manifest)){
                state.pendingAnnouncement=false;
                return;
            }
            if(!isSharedModalAvailableForAnnouncement()){
                schedulePendingResolution();
                return;
            }
            state.pendingAnnouncement=false;
            openReleaseDetail("acknowledge");
        }
    }

    function refreshNotificationDots(){
        try{
            if(typeof global.v141UpdateNotificationDots==="function"){
                global.v141UpdateNotificationDots();
            }
        }catch(_){ }
    }

    function refreshAnnouncementSurface(){
        const parts=getSharedModalParts();
        if(
            !parts||state.modalOpen||!parts.modal.classList.contains("show")||
            parts.title.textContent!=="公告"
        ){
            return;
        }
        const content=renderAnnouncementContent();
        if(content){ parts.body.innerHTML=content; }
    }

    function renderAnnouncementContent(){
        const manifest=state.manifest;
        if(!manifest||!manifest.publicNotice){ return ""; }
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        const comparison=loaded?compareVersions(loaded,manifest.releaseVersion):null;
        const needsUpdate=comparison!==null&&comparison<0;
        const actionLabel=needsUpdate?"查看更新內容":"查看本次更新";
        const status=needsUpdate
            ? "已有新版本可更新；完成目前操作後即可更新。"
            : "目前正式版本的更新內容。";
        return (
            '<section class="release-update-announcement">'+
                '<p class="release-update-announcement-version">'+escapeHtml(manifest.releaseVersion)+' 更新</p>'+
                '<p>'+escapeHtml(manifest.summary)+'</p>'+
                '<p class="release-update-announcement-status">'+escapeHtml(status)+'</p>'+
                '<button type="button" class="release-update-primary" onclick="window.FourSymbolsReleaseUpdate.openFromAnnouncement()">'+actionLabel+'</button>'+
            '</section>'
        );
    }

    function openFromAnnouncement(){
        const manifest=state.manifest;
        if(!manifest){ return false; }
        const loaded=state.loadedReleaseVersion||getLoadedReleaseVersion();
        const needsUpdate=loaded&&compareVersions(loaded,manifest.releaseVersion)<0;
        return openReleaseDetail(needsUpdate&&isForcedForLoadedVersion(manifest)?"forced":needsUpdate?"update":"acknowledge");
    }

    async function fetchManifest(){
        const fetcher=typeof global.fetch==="function"?global.fetch.bind(global):null;
        if(!fetcher){ return null; }
        let timeoutId=null;
        let controller=null;
        try{
            if(typeof global.AbortController==="function"){
                controller=new global.AbortController();
                timeoutId=global.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
            }
            let url=RELEASE_NOTICE_PATH;
            try{
                const base=(global.document&&global.document.baseURI)||(global.location&&global.location.href)||undefined;
                const parsed=new URL(RELEASE_NOTICE_PATH,base);
                parsed.searchParams.set("release-update-check",String(now()));
                url=parsed.toString();
            }catch(_){
                url=RELEASE_NOTICE_PATH+"?release-update-check="+now();
            }
            const response=await fetcher(url,{
                cache:"no-store",
                headers:{"Cache-Control":"no-cache"},
                ...(controller?{signal:controller.signal}:{})
            });
            if(!response||response.ok===false||typeof response.json!=="function"){ return null; }
            return validateManifest(await response.json());
        }catch(_){
            /* Offline, timeout, malformed JSON and temporary deploy gaps must never block play. */
            return null;
        }finally{
            if(timeoutId!==null){ global.clearTimeout(timeoutId); }
        }
    }

    function handleManifest(manifest){
        if(!manifest){ return; }
        state.manifest=manifest;
        state.loadedReleaseVersion=getLoadedReleaseVersion();
        state.devPreviewMode=null;
        if(!manifest.publicNotice||!state.loadedReleaseVersion){
            hideMarquee();
            return;
        }
        const devPreviewMode=getDevPreviewMode();
        if(devPreviewMode){
            state.devPreviewMode=devPreviewMode;
            if(devPreviewMode==="modal"){
                openReleaseDetail(isForcedForLoadedVersion(manifest)?"forced":"preview");
            }else{
                showMarquee(manifest,isForcedForLoadedVersion(manifest)?"forced":"update");
            }
            return;
        }
        const comparison=compareVersions(state.loadedReleaseVersion,manifest.releaseVersion);
        if(comparison===null||comparison>0){ return; }
        if(comparison===0){
            refreshAnnouncementSurface();
            refreshNotificationDots();
            if(shouldAutoShowLoginAnnouncement(manifest)){
                if(canSafelyReloadForUpdate()&&isSharedModalAvailableForAnnouncement()){
                    openReleaseDetail("acknowledge");
                }else{
                    state.pendingAnnouncement=true;
                    showMarquee(manifest,"announcement-pending");
                    schedulePendingResolution();
                }
            }
            return;
        }

        const forced=isForcedForLoadedVersion(manifest);
        if(forced){
            if(isForcedUpdateBlocking()){ return; }
            state.pendingForcedUpdate=true;
            showMarquee(manifest,canSafelyReloadForUpdate()?"forced":"forced-pending");
            if(canSafelyReloadForUpdate()){
                resolvePendingWhenSafe();
            }else{
                schedulePendingResolution();
            }
            return;
        }

        if(shouldShowReminder(manifest)){
            rememberReminder(manifest);
            showMarquee(manifest,"update");
        }
        refreshAnnouncementSurface();
        refreshNotificationDots();
    }

    function checkForUpdate(reason,options){
        const force=!!(options&&options.force);
        if(state.checking){ return state.checking; }
        if(!force&&state.lastCheckAt&&now()-state.lastCheckAt<MIN_CHECK_GAP_MS){
            return Promise.resolve(null);
        }
        state.lastCheckAt=now();
        state.checking=fetchManifest().then(manifest=>{
            if(manifest){ handleManifest(manifest,reason); }
            return manifest;
        }).finally(()=>{
            state.checking=null;
        });
        return state.checking;
    }

    function start(){
        if(state.started){ return; }
        state.started=true;
        checkForUpdate("boot",{force:true});
        state.pollTimer=global.setInterval(()=>checkForUpdate("poll"),CHECK_INTERVAL_MS);
        const documentRef=global.document;
        if(documentRef&&typeof documentRef.addEventListener==="function"){
            documentRef.addEventListener("visibilitychange",()=>{
                if(documentRef.hidden||documentRef.visibilityState==="hidden"){ return; }
                checkForUpdate("visibility");
            });
            documentRef.addEventListener("keydown",event=>{
                if(event&&event.key==="Escape"&&isForcedUpdateBlocking()){
                    event.preventDefault();
                    if(typeof event.stopImmediatePropagation==="function"){ event.stopImmediatePropagation(); }
                    announceForcedLock();
                }
            },true);
        }
        if(typeof global.addEventListener==="function"){
            global.addEventListener("online",()=>checkForUpdate("online"));
        }
    }

    function stop(){
        if(state.pollTimer!==null){ global.clearInterval(state.pollTimer); state.pollTimer=null; }
        if(state.pendingTimer!==null){ global.clearTimeout(state.pendingTimer); state.pendingTimer=null; }
        state.started=false;
    }

    function getState(){
        return {
            loadedReleaseVersion:state.loadedReleaseVersion||getLoadedReleaseVersion(),
            availableReleaseVersion:state.manifest&&state.manifest.releaseVersion||null,
            noticeId:state.manifest&&state.manifest.noticeId||null,
            pendingNormalReload:state.pendingNormalReload,
            pendingForcedUpdate:state.pendingForcedUpdate,
            pendingAnnouncement:state.pendingAnnouncement,
            loginAnnouncementShown:state.loginAnnouncementShown,
            suppressedToday:isCurrentNoticeSuppressedToday(state.manifest),
            criticalOperationCount:state.criticalOperations.size,
            unsafeReasons:getUnsafeReasons().slice(),
            pollIntervalMs:CHECK_INTERVAL_MS,
            minimumCheckGapMs:MIN_CHECK_GAP_MS,
            devPreviewMode:state.devPreviewMode
        };
    }

    global.FourSymbolsReleaseUpdate=Object.freeze({
        start,
        stop,
        checkForUpdate,
        getState,
        parseVersion,
        compareVersions,
        canSafelyReloadForUpdate,
        beginCriticalOperation,
        notifySafeState:resolvePendingWhenSafe,
        hasUnreadReleaseNotice,
        isCurrentNoticeSuppressedToday:()=>isCurrentNoticeSuppressedToday(state.manifest),
        renderAnnouncementContent,
        openFromAnnouncement,
        openReleaseDetail,
        requestReload,
        isForcedUpdateBlocking,
        shouldPreventSharedModalClose,
        announceForcedLock,
        onSharedModalClosed
    });
    global.canSafelyReloadForUpdate=canSafelyReloadForUpdate;

    const documentRef=global.document;
    if(documentRef&&typeof documentRef.addEventListener==="function"){
        documentRef.addEventListener("four-symbols:startup-ready",start,{once:true});
    }
    try{
        const startupState=global.FourSymbolsStartupPolicy&&global.FourSymbolsStartupPolicy.getState&&global.FourSymbolsStartupPolicy.getState();
        if(startupState==="READY"||startupState==="OFFLINE_READY"){
            global.setTimeout(start,0);
        }
    }catch(_){ }

})(window);
