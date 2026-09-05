from pathlib import Path


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f"{label} anchor not found")


growth_path = Path("js/28-v133-economy-rebalance.js")
growth = growth_path.read_text(encoding="utf-8")

helper = '''    function v173CaptureExpPoolViewport(){
        if(typeof document==="undefined"){ return null; }
        const scroller=document.getElementById("characterTabContent");
        if(!scroller){ return null; }
        return {
            scroller,
            top:Math.max(0,Number(scroller.scrollTop)||0),
            left:Math.max(0,Number(scroller.scrollLeft)||0)
        };
    }
    function v173RestoreExpPoolViewport(snapshot){
        if(!snapshot||!snapshot.scroller){ return; }
        const restore=function(){
            const scroller=snapshot.scroller;
            if(!scroller||scroller.isConnected===false){ return; }
            scroller.scrollTop=snapshot.top;
            scroller.scrollLeft=snapshot.left;
        };
        restore();
        if(typeof requestAnimationFrame==="function"){
            requestAnimationFrame(function(){
                restore();
                requestAnimationFrame(restore);
            });
        }else if(typeof setTimeout==="function"){
            setTimeout(restore,0);
        }
    }
    function v173BlurExpPoolAction(){
        if(typeof document==="undefined"){ return; }
        const active=document.activeElement;
        if(active&&typeof active.blur==="function"&&active.matches&&
            active.matches("#homeExpPoolCard .v131-exp-preview-btn, #homeExpPoolCard .v131-exp-confirm, #homeExpPoolCard .v131-exp-back")){
            active.blur();
        }
    }
    function v173ScheduleExpPoolDecoration(snapshot){
        v173RestoreExpPoolViewport(snapshot);
        const finish=function(){
            decorateExpPoolDistributionUi();
            v173RestoreExpPoolViewport(snapshot);
        };
        if(typeof setTimeout==="function"){ setTimeout(finish,0); }
        else{ finish(); }
    }

'''
anchor = '    function wrapExpPreviewForCatchUp(){\n'
if "function v173CaptureExpPoolViewport()" not in growth:
    if anchor not in growth:
        raise SystemExit("wrapExpPreviewForCatchUp anchor missing")
    growth = growth.replace(anchor, helper + anchor, 1)

growth = replace_once(
    growth,
    '''        const previousPreview=window.v131PreviewExpLevel;
        const previousConfirm=window.v131ConfirmExpPreview;
        window.v131PreviewExpLevel=function(index){
            settleExpPoolCharge(Date.now());
''',
    '''        const previousPreview=window.v131PreviewExpLevel;
        const previousConfirm=window.v131ConfirmExpPreview;
        const previousCancel=window.v131CancelExpPreview;
        window.v131PreviewExpLevel=function(index){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
''',
    "preview wrapper",
)

growth = replace_once(
    growth,
    '''            finally{
                sharedExp=actual;
                if(typeof setTimeout==="function"){ setTimeout(decorateExpPoolDistributionUi,0); }
                else{ decorateExpPoolDistributionUi(); }
            }
        };
        window.v131ConfirmExpPreview=function(){
            settleExpPoolCharge(Date.now());
''',
    '''            finally{
                sharedExp=actual;
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        window.v131ConfirmExpPreview=function(){
            const viewport=v173CaptureExpPoolViewport();
            v173BlurExpPoolAction();
            settleExpPoolCharge(Date.now());
''',
    "preview finally / confirm wrapper",
)

growth = replace_once(
    growth,
    '''                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                if(typeof setTimeout==="function"){ setTimeout(decorateExpPoolDistributionUi,0); }
                else{ decorateExpPoolDistributionUi(); }
            }
        };
    }

    function syncDailyQuestGrowthRewards(){
''',
    '''                if(typeof updateUI==="function"){ updateUI(); }
                if(typeof saveGame==="function"){ saveGame(); }
                v173ScheduleExpPoolDecoration(viewport);
            }
        };
        if(typeof previousCancel==="function"){
            window.v131CancelExpPreview=function(){
                const viewport=v173CaptureExpPoolViewport();
                v173BlurExpPoolAction();
                try{ return previousCancel.apply(this,arguments); }
                finally{ v173ScheduleExpPoolDecoration(viewport); }
            };
        }
    }

    function syncDailyQuestGrowthRewards(){
''',
    "confirm finally / cancel wrapper",
)

growth_path.write_text(growth, encoding="utf-8")

css_path = Path("css/49-v169-rpg-ui.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* V173.49 — EXP POOL TAP / SCROLL STABILITY */"
block = '''

/* V173.49 — EXP POOL TAP / SCROLL STABILITY
   Keep Android Chrome from changing the character scroll position when the
   EXP preview list is replaced, and do not let a tiny finger drift on an
   action button become a vertical pan. */
#game-stage #homeExpPoolCard,
#game-stage #homeExpPoolCard .exp-pool-hero,
#game-stage #homeExpPoolCard .v173-exp-charge-status,
#game-stage #homeExpPoolCard #expDistributeList,
#game-stage #homeExpPoolCard #expDistributeList *{
    overflow-anchor:none !important;
}
#game-stage #homeExpPoolCard .v131-exp-preview-btn,
#game-stage #homeExpPoolCard .v131-exp-confirm,
#game-stage #homeExpPoolCard .v131-exp-back{
    touch-action:none !important;
    -webkit-user-select:none !important;
    user-select:none !important;
}
#game-stage #homeFeatureModal #characterTabContent:has(#homeExpPoolCard){
    scroll-behavior:auto !important;
}
'''
if marker not in css:
    css = css.rstrip() + block
css_path.write_text(css.rstrip() + "\n", encoding="utf-8")

loader_path = Path("js/20-anonymous-20.js")
loader = loader_path.read_text(encoding="utf-8")
loader = replace_once(
    loader,
    'const V_ASSET_VERSION="173.48";',
    'const V_ASSET_VERSION="173.49";',
    "asset version",
)
loader_path.write_text(loader, encoding="utf-8")

ui_path = Path("js/51-v169-rpg-ui.js")
ui = ui_path.read_text(encoding="utf-8")
ui = replace_once(
    ui,
    "js/equipment-progression.js?v=173.48",
    "js/equipment-progression.js?v=173.49",
    "equipment runtime version",
)
ui_path.write_text(ui, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
if "173.48" in index:
    index = index.replace("173.48", "173.49")
elif "173.49" not in index:
    raise SystemExit("index release version missing")
index_path.write_text(index, encoding="utf-8")

for p in Path("tests").glob("*.js"):
    s = p.read_text(encoding="utf-8")
    n = s.replace(r"173\.48", r"173\.49").replace("173.48", "173.49")
    if p.name == "v173.48-premium-shop-layout.test.js":
        n = n.replace(r"V173\.49 — PREMIUM ONE-SCREEN SHOP", r"V173\.48 — PREMIUM ONE-SCREEN SHOP")
    if n != s:
        p.write_text(n, encoding="utf-8")

print("V173.49 patch applied")
