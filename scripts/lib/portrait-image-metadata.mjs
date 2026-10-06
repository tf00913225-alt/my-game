import {execFileSync} from 'node:child_process';

// Import/audit only. Never execute image pixel analysis in battle runtime.
export function portraitImageMetadata(file){
    if(process.env.PORTRAIT_PYTHON){
        return JSON.parse(execFileSync(process.env.PORTRAIT_PYTHON,['-c',
            'import json,sys;from PIL import Image;im=Image.open(sys.argv[1]);im.load();a=im.convert("RGBA").getchannel("A");print(json.dumps(dict(format=im.format,width=im.width,height=im.height,alpha="A" in im.getbands(),opaque=a.getextrema()[0]==255,bounds=a.getbbox())))',file],{encoding:'utf8'}));
    }
    const [format,w,h,channels,opaque]=execFileSync('identify',['-format','%m|%w|%h|%[channels]|%[opaque]',file],{encoding:'utf8'}).trim().split('|');
    const width=Number(w),height=Number(h);
    const alpha=execFileSync('convert',[file,'-alpha','extract','-depth','8','gray:-'],{maxBuffer:width*height+1024});
    let left=width,top=height,right=0,bottom=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(alpha[y*width+x]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
    return {format,width,height,alpha:/a/i.test(channels),opaque:opaque==='True'||opaque==='true',bounds:right?[left,top,right,bottom]:null};
}
