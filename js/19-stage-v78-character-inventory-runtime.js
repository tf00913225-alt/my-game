
(function(){
"use strict";

let rafId=0;

function getStageScale(){
    const stage=
        document.getElementById(
            "game-stage"
        );

    if(!stage){
        return 1;
    }

    const rect=
        stage.getBoundingClientRect();

    const scale=
        rect.width/1080;

    return (
        Number.isFinite(scale) &&
        scale>0
    )
        ? scale
        : 1;
}

function applyNow(){
    const modal=
        document.getElementById(
            "homeFeatureModal"
        );

    const body=
        document.getElementById(
            "homeFeatureModalBody"
        );

    const root=
        document.getElementById(
            "characterTabContent"
        );

    const inventory=
        document.getElementById(
            "inventoryPage"
        );

    if(
        !modal ||
        !body ||
        !root ||
        !modal.classList.contains("show")
    ){
        return;
    }

    const box=
        modal.querySelector(
            ".home-feature-modal-box.wide"
        );

    if(!box){
        return;
    }

    box.style.setProperty(
        "display",
        "flex",
        "important"
    );

    box.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    box.style.setProperty(
        "height",
        "96%",
        "important"
    );

    box.style.setProperty(
        "max-height",
        "96%",
        "important"
    );

    box.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    box.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    body.style.setProperty(
        "display",
        "flex",
        "important"
    );

    body.style.setProperty(
        "flex-direction",
        "column",
        "important"
    );

    body.style.setProperty(
        "flex",
        "1 1 auto",
        "important"
    );

    body.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    body.style.setProperty(
        "overflow",
        "hidden",
        "important"
    );

    /*
       實際算出 modal 裡可用高度，
       給 characterTabContent 一個有限 viewport。

       ★ 修正（根源問題，取代原本用
       getBoundingClientRect() + getStageScale()
       換算的作法）：

       原本的算法假設 root（characterTabContent）跟它上面
       所有祖層都活在同一個「#game-stage 整體縮放
       （transform:scale(rect.width/1080)）」座標系底下，
       所以用畫面上量到的像素差（boxRect/bodyRect 這些
       getBoundingClientRect() 量出來的、已經套用過縮放的
       「螢幕座標」）去反推「縮放前」的高度時，
       要除以 scale 換算回去。

       但實際量測發現：body（#homeFeatureModalBody）自己的
       getBoundingClientRect().height 跟它的 clientHeight
       幾乎完全一樣（669 vs 668.78），代表這個彈出視窗
       實際渲染時的「畫面座標」跟「排版座標」根本是1:1，
       並沒有被 game-stage 那層縮放影響到
       （不確定確切原因，可能是這個彈窗這幾版下來
       已經改用別的容器/機制呈現，跟 game-stage 的
       1080寬設計稿縮放系統已經脫鉤了）。

       這代表原本拿 rect 差距去除以 scale（0.389）的做法，
       等於把可用高度平白放大了 1/0.389 ≈ 2.57倍，
       root 因此被設成遠超過 body 實際可用空間的高度，
       多出來的部分被 body 的 overflow:hidden 直接裁掉，
       表面上 root 自己「可以捲動」，實際上捲不到的內容
       早就被外層裁掉了，整段捲動因此失效
       （這正是「技能欄/經驗池頁面無法捲動」的根本原因）。

       修正方式：不再依賴 getBoundingClientRect() 反推、
       也不用 scale 換算，直接用 body.clientHeight
       （跟 root 的 CSS height 屬性一樣，都是「排版座標」，
       兩者互相比較、設定完全不需要換算，
       不管上層縮放系統實際上是怎麼運作的都不會出錯）
       當作 root 可用的高度上限。
    */
    const availableLogical=
        Math.max(
            360,
            body.clientHeight-
            10
        );

    root.style.setProperty(
        "height",
        availableLogical+"px",
        "important"
    );

    root.style.setProperty(
        "max-height",
        availableLogical+"px",
        "important"
    );

    root.style.setProperty(
        "min-height",
        "0",
        "important"
    );

    const inventoryOwnsScroll=
        !!(
            inventory &&
            inventory.parentElement===root
        );

    root.style.setProperty(
        "overflow-y",
        inventoryOwnsScroll
            ? "hidden"
            : "scroll",
        "important"
    );

    root.style.setProperty(
        "overflow-x",
        "hidden",
        "important"
    );

    root.style.setProperty(
        "-webkit-overflow-scrolling",
        "touch",
        "important"
    );

    root.style.setProperty(
        "overscroll-behavior-y",
        "contain",
        "important"
    );

    root.style.setProperty(
        "touch-action",
        "pan-y",
        "important"
    );

    if(inventoryOwnsScroll){
        inventory.style.setProperty(
            "overflow",
            "visible",
            "important"
        );

        inventory.style.setProperty(
            "transform",
            "none",
            "important"
        );

        /*
           V77 的 1/3 再縮小 1/3：
           1/3 × 2/3 = 2/9 可視高度。
        */
        const stageHeight=
            Math.max(
                180,
                Math.min(
                    300,
                    Math.round(
                        availableLogical*
                        2/9
                    )
                )
            );

        inventory.style.setProperty(
            "--inventory-stage-height",
            stageHeight+"px"
        );
    }
}

function schedule(){
    if(rafId){
        cancelAnimationFrame(
            rafId
        );
    }

    rafId=
        requestAnimationFrame(
            function(){
                rafId=0;
                applyNow();
            }
        );
}

if(
    document.readyState===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        schedule,
        {once:true}
    );
}
else{
    schedule();
}

const observer=
    new MutationObserver(
        schedule
    );

observer.observe(
    document.body,
    {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:["class"]
    }
);

document.addEventListener(
    "click",
    schedule,
    {passive:true}
);

window.addEventListener(
    "resize",
    schedule,
    {passive:true}
);

window.v78ApplyCharacterInventoryLayout=
    schedule;
})();
