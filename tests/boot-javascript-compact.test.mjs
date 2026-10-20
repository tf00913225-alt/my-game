import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {compactBootJavaScript} from "../scripts/lib/boot-javascript-compact.mjs";

test("Boot lexical compact retains ASI, operators, regex, templates and literal bytes",()=>{
    const source=String.raw`
        const text="/* not a comment */ //  two spaces";
        const pattern=/a\/\/b[/*]/gu;
        const quotient=12 / 3 / 2;
        let x=2,y=3;
        const plus=x + +y,minus=x - -y;
        function asi(){return /* newline inside comment
        */ {wrong:true};}
        const template=\`line  one
        \${text} /* literal */\`;
        const 名字="漢字";
        const async=7;
        async
        function separate() { return 1; }
        const regexType=/x/ instanceof RegExp;
        x
        ++y;
        globalThis.result=[text,pattern.source,quotient,plus,minus,asi(),template,名字,x,y,async,separate(),regexType];
    `.replaceAll("\\`","`").replaceAll("\\${","${");
    const compact=compactBootJavaScript(source);
    const before={},after={};vm.runInNewContext(source,before);vm.runInNewContext(compact,after);
    assert.equal(JSON.stringify(after.result),JSON.stringify(before.result));
    assert.ok(compact.length<source.length);
    assert.equal(compactBootJavaScript(compact),compact);
    assert.ok(compact.includes('"/* not a comment */ //  two spaces"'));
    assert.ok(compact.includes("x+ +y"));assert.ok(compact.includes("x- -y"));
});

test("Boot compact validates the full actual boot sources and prefix without runtime changes",()=>{
    const builder=fs.readFileSync(new URL("../scripts/build-production.mjs",import.meta.url),"utf8");
    const list=builder.match(/const bootScripts=\[([\s\S]*?)\];/)[1];
    const paths=[...list.matchAll(/"([^"]+\.js)"/g)].map(match=>match[1]);
    assert.ok(paths.length>1);
    const prefix='window.__FOUR_SYMBOLS_BUILD__=Object.freeze({release:"test",firebaseBootstrap:"build/firebase/test.js"});\n';
    const source=prefix+paths.map(path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8")).join("\n");
    const compact=compactBootJavaScript(source);
    assert.ok(Buffer.byteLength(compact)<=70_000);
    assert.equal(compactBootJavaScript(compact),compact);
});
