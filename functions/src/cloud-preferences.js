"use strict";

const PREFERENCES_SCHEMA_VERSION=1;
const CONFIG_KEYS=["autoConfig","autoConfig2","autoConfig3"];
const CONFIG_FIELDS=["enabled","skill","hp","sp","returnToCityWhenEmpty"];
const SKILL_ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

class CloudPreferencesError extends Error{
    constructor(message,code="invalid-argument"){
        super(message);
        this.name="CloudPreferencesError";
        this.code=code;
    }
}
function plain(value){
    return !!value&&typeof value==="object"&&!Array.isArray(value)&&
        (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function exactKeys(value,keys){
    return plain(value)&&Object.keys(value).length===keys.length&&
        Object.keys(value).every(key=>keys.includes(key));
}
function normalizePreferences(value){
    if(!exactKeys(value,[...CONFIG_KEYS,"characterIds"])){
        throw new CloudPreferencesError("Only character-bound auto-battle configurations are permitted.");
    }
    if(!Array.isArray(value.characterIds)||value.characterIds.length!==3||
       typeof value.characterIds[0]!=="string"||!value.characterIds[0]||
       value.characterIds.some((id,index)=>id!==null&&
           (typeof id!=="string"||!id||id.length>64||/[\x00-\x1f]/.test(id)))||
       new Set(value.characterIds.filter(Boolean)).size!==value.characterIds.filter(Boolean).length){
        throw new CloudPreferencesError("Character identities are invalid.");
    }
    const normalized={characterIds:[...value.characterIds]};
    for(const key of CONFIG_KEYS){
        const config=value[key];
        if(!exactKeys(config,CONFIG_FIELDS)||typeof config.enabled!=="boolean"||
           typeof config.returnToCityWhenEmpty!=="boolean"||
           !SKILL_ID.test(config.skill)||
           !Number.isInteger(config.hp)||config.hp<0||config.hp>100||
           !Number.isInteger(config.sp)||config.sp<0||config.sp>100){
            throw new CloudPreferencesError(`${key} has invalid preference fields.`);
        }
        normalized[key]={
            enabled:config.enabled,skill:config.skill,hp:config.hp,sp:config.sp,
            returnToCityWhenEmpty:config.returnToCityWhenEmpty
        };
    }
    return normalized;
}
module.exports={CloudPreferencesError,PREFERENCES_SCHEMA_VERSION,normalizePreferences};
