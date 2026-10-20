import assert from "node:assert/strict";
import {parse,tokenizer} from "acorn";

const options={ecmaVersion:"latest",sourceType:"script"};
function tokens(source){
    return [...tokenizer(source,options)].map(token=>({
        start:token.start,end:token.end,label:token.type.label,raw:source.slice(token.start,token.end)
    }));
}
function syntax(value){
    if(Array.isArray(value)){ return value.map(syntax); }
    if(value instanceof RegExp){ return value; }
    if(value&&typeof value==="object"){
        return Object.fromEntries(Object.entries(value).filter(([key])=>key!=="start"&&key!=="end").map(([key,item])=>[key,syntax(item)]));
    }
    return value;
}

// Only Boot's whitespace/comments change. Preserve ASI/restricted-production
// line breaks and raw tokens; fail closed if lexical tokens or syntax differ.
export function compactBootJavaScript(source){
    const insertedSemicolons=new Set();
    const originalSyntax=parse(source,{...options,onInsertedSemicolon:position=>insertedSemicolons.add(position)});
    const original=tokens(source);
    let output="",previous=null;
    for(const token of original){
        if(previous){
            const gap=source.slice(previous.end,token.start);
            if(/[\r\n\u2028\u2029]/u.test(gap)&&
               (insertedSemicolons.has(previous.end)||/^(?:async|yield|return|throw|break|continue)$/u.test(previous.raw))){ output+="\n"; }
            else if(gap){
                const left=previous.raw.at(-1),right=token.raw[0];
                if(/[\p{ID_Continue}$\\]/u.test(left)&&/[\p{ID_Continue}$\\]/u.test(right)||
                   /[+\-/]/u.test(left)&&/[+\-/*]/u.test(right)||
                   previous.label==="regexp"&&/[\p{ID_Continue}$\\]/u.test(right)||
                   previous.label==="num"&&right==="."){
                    output+=" ";
                }
            }
        }
        output+=token.raw;previous=token;
    }
    output+="\n";
    assert.deepStrictEqual(tokens(output).map(({label,raw})=>[label,raw]),original.map(({label,raw})=>[label,raw]),"Boot compact changed tokens");
    assert.deepStrictEqual(syntax(parse(output,options)),syntax(originalSyntax),"Boot compact changed syntax");
    return output;
}
