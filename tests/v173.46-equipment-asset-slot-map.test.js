"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");

function gitBlobSha(path){
    const data=fs.readFileSync(path);
    return crypto.createHash("sha1").update(Buffer.from(`blob ${data.length}\0`)).update(data).digest("hex");
}

const expected={
    "assets/equipment/warrior/head-01.png":"63e29282b2951944b531dbc590cc602f3d42f10f",
    "assets/equipment/warrior/head-02.png":"9af99df6ac5dc3b616f9fd12e54c722935924669",
    "assets/equipment/warrior/armor-01.png":"96fe0ef1815a1d0991d4abda84ba1aa11cf7b7fd",
    "assets/equipment/warrior/armor-02.png":"5b000aecfe298cf89607cb6c969dce3dcab1e3e5",
    "assets/equipment/warrior/bracer-01.png":"915656f7031be8d349b388fda4eb3e0feb7988bf",
    "assets/equipment/warrior/bracer-02.png":"ad65a2e5244a1ce477a9027f355234ad348d8199",
    "assets/equipment/warrior/shoes-01.png":"8cc1d32d09e7d35f79d299a840bbce534be373c1",
    "assets/equipment/warrior/shoes-02.png":"c3edb61f261c9c06d64a7e43bb8d39979422d0f1",

    "assets/equipment/mage/head-01.png":"07708a56c07d506ff18e93bd3fe625a2fce960ed",
    "assets/equipment/mage/head-02.png":"6d09b25f17be5df7a60150c44b27a4949a92aed7",
    "assets/equipment/mage/bracer-01.png":"3ec83b4bc4624dc10ae3d39b878e3aa734a4f8b4",
    "assets/equipment/mage/bracer-02.png":"f0f54e4dd495a856e9bab4f5e6473489b46c3f02",
    "assets/equipment/mage/armor-01.png":"79b894745b981344f3233dd38d4ff32e4fd1be84",
    "assets/equipment/mage/armor-02.png":"a08389283141691d291817bcac735922770144a1",
    "assets/equipment/mage/shoes-01.png":"eb7b3d6f1bde154bd4be137cfc3a0147a2c27ca5",
    "assets/equipment/mage/shoes-02.png":"5ca4be84e7d64e889a046dab7f005875cb67f58a",
    "assets/equipment/mage/weapon-01.png":"d2cf68a5b08d5ca97121ef9a48998645de9456e2",
    "assets/equipment/mage/weapon-02.png":"2dd466d5df89e4c4cd883defd89d540adfbaca21",
    "assets/equipment/mage/weapon-03.png":"ec8d165b4b760ba492a231aea420d28105a7c733",
    "assets/equipment/mage/weapon-04.png":"e6452cd5fcf45ec3f84dc958d315e5085a6078a2"
};

for(const [path,sha] of Object.entries(expected)){
    assert.equal(gitBlobSha(path),sha,path+" must contain the asset classified for that equipment slot");
}

console.log("V173.46 equipment asset slot mapping checks passed");
