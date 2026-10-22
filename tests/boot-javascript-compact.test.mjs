import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import {createHash} from "node:crypto";
import {compactBootJavaScript} from "../scripts/lib/boot-javascript-compact.mjs";

test("Production target hashes and publishes identical LF bytes for LF, CRLF and mixed sources",()=>{
    const builder=fs.readFileSync(new URL("../scripts/build-production.mjs",import.meta.url),"utf8");
    const hash=builder.match(/const hash=value=>[^\n]+/),target=builder.match(/function target\(name,extension,content\)\{[\s\S]*?\n\}/);
    assert.ok(hash);assert.ok(target);
    const context={crypto};vm.createContext(context);vm.runInContext(hash[0]+"\n"+target[0],context);
    const canonical='/* 江湖 */\nconst title="山關";\nconst dialogue=`首句\n次句`;\n';
    const digest=crypto.createHash('sha256').update(Buffer.from(canonical,'utf8')).digest('hex').slice(0,12);
    for(const source of [canonical,canonical.replaceAll('\n','\r\n'),canonical.replace('*/\n','*/\r\n').replace('首句\n','首句\r\n')]){
        const output=context.target('newline-regression','js',source);
        assert.equal(output.content,canonical);assert.equal(output.digest,digest);assert.equal(output.path,`build/newline-regression.${digest}.js`);
        assert.deepEqual(Buffer.from(output.content,'utf8'),Buffer.from(canonical,'utf8'));
        const repeated=context.target('newline-regression','js',output.content);assert.equal(repeated.path,output.path);assert.equal(repeated.content,output.content);
    }
});

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
test("Production text bundles keep identical filenames and served hashes across Git line endings",()=>{
    const builder=fs.readFileSync(new URL("../scripts/build-production.mjs",import.meta.url),"utf8");
    const start=builder.indexOf('function target('),end=builder.indexOf('function writeTarget(',start);
    const context={hash:value=>createHash('sha256').update(value).digest('hex').slice(0,12)};
    vm.createContext(context);vm.runInContext(builder.slice(start,end),context);
    for(const extension of ['js','css']){
        const lf=extension==='js'?'const value=`first\nsecond`;\nglobalThis.result=value;\n':'body {\n color: red;\n}\n';
        const a=context.target('example',extension,lf),b=context.target('example',extension,lf.replaceAll('\n','\r\n'));
        assert.equal(b.path,a.path);assert.equal(b.content,a.content);
        assert.equal(createHash('sha256').update(Buffer.from(b.content)).digest('hex').slice(0,12),b.digest);
        assert.equal(b.content.includes('\r'),false);
        if(extension==='js'){
            const before={},after={};vm.runInNewContext(lf.replaceAll('\n','\r\n'),before);vm.runInNewContext(b.content,after);
            assert.equal(after.result,before.result);
        }
    }
});
