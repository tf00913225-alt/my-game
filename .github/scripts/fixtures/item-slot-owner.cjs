"use strict";
const fs=require("node:fs");
const source=fs.readFileSync("js/00-main.js","utf8").replace(/\r\n/g,"\n");
module.exports=source.slice(source.indexOf("const EQUIPMENT_RARITY_VISUALS="),source.indexOf("function renderEquipment(){"));
