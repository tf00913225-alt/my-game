// Prototype-only wiring. Production consumes scene.js/runtime.js through its existing builder.
import './scene.js';
import './runtime.js';
export function mountCorner(root){
  const dialog=root.querySelector('[data-dialog]');dialog.hidden=true;
  const controller=globalThis.FourSymbolsExploration.mount(root,{
    eventToPoint:event=>window.eventToGamePoint(event),
    onInteract({close}){
      const button=dialog.querySelector('button');dialog.hidden=false;
      button.addEventListener('click',close);button.focus();
      return ()=>{button.removeEventListener('click',close);dialog.hidden=true;};
    }
  });
  controller.enter();return ()=>controller.destroy();
}
