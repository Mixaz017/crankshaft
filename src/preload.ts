﻿import * as fs from 'fs';
import * as path from 'path';
import { ipcRenderer } from 'electron';
import 'v8-compile-cache';
import { injectSettingsCss, createElement, toggleSettingCSS } from './utils';
import { renderSettings } from './settingsui';
///<reference path="global.d.ts" />

// get rid of client unsupported message
//@ts-ignore
window.OffCliV = true;

/** sharedUserscriptData */
export const su = {
    userscriptsPath: "",
    userscriptTrackerPath: "",
    userscripts: <userscript[]>[],
    userscriptTracker: <userscriptTracker>{}
}


let $assets = path.resolve(__dirname, "..", "assets")

// Lets us exit the game lmao
document.addEventListener("keydown", (event) => {
    if (event.code == "Escape") {
        document.exitPointerLock();
    }
})

window.errAlert = (err: Error, name: string) => {
    alert(`Userscript '${name}' had an error:\n\n${err.toString()}\n\nPlease fix the error, disable the userscript in the 'tracker.json' file or delete it.`)
}

// Settings Stuff
document.addEventListener("DOMContentLoaded", (event) => {
    ipcRenderer.send('preloadNeedSettings');
    // Side Menu Settings Thing
    const settingsSideMenu = document.querySelectorAll('.menuItem')[6];
    settingsSideMenu.setAttribute("onclick", "showWindow(1);SOUND.play(`select_0`,0.15);window.windows[0].changeTab(0)");
    settingsSideMenu.addEventListener("click", (event) => {
        UpdateSettingsTabs(0, true);
    });
    //@ts-ignore
    try { window.windows[0].toggleType({checked: true}) } catch (e) {  }
})

ipcRenderer.on('preloaduserscriptsPath', (event, recieved_userscriptsPath: string) => {
    su.userscriptsPath = recieved_userscriptsPath
    su.userscriptTrackerPath = path.resolve(su.userscriptsPath, "tracker.json")

    //init the userscripts (read, map and set up tracker)

    //remove all non .js files, map to {name, fullpath}
    su.userscripts = fs.readdirSync(su.userscriptsPath, {withFileTypes: true})
        .filter(entry => entry.name.endsWith(".js"))
        .map(entry => ({name: entry.name, fullpath: path.resolve(su.userscriptsPath, entry.name).toString()}))
    
    let tracker: userscriptTracker = {}
    su.userscripts.forEach(u => tracker[u.name] = false) //fill tracker with falses, so new userscripts get added disabled
    Object.assign(tracker, JSON.parse(fs.readFileSync(su.userscriptTrackerPath, {encoding: "utf-8"}))) //read and assign the tracker.json
    fs.writeFileSync(su.userscriptTrackerPath, JSON.stringify(tracker, null, 2), {encoding: "utf-8"}) //save with the new userscripts

    su.userscriptTracker = tracker
    
    //run the code in the userscript
    su.userscripts.forEach(u => {
        if (tracker[u.name]) { //if enabled
            const rawContent = fs.readFileSync(u.fullpath, { encoding: "utf-8" })
            let content

            try {
                content = require('esbuild').transformSync(rawContent, { minify: true })
            } catch (error) {
                window.errAlert(error, u.name)
                content = {code: "", warnings: ["FATAL: userscript failed to compile."]}
            }
            if (content.warnings.length > 0) { console.warn(`'${u.name}' compiled with warnings: `, content.warnings) }
            u.content = content.code

            let code = new String(`"use strict";try { ${content.code}; } catch (e) { window.errAlert(e, ${u.name}); }; `)
            try {
                //@ts-ignore
                Function(code)();
            } catch (error) {
                window.errAlert(error, u.name)
            }

            console.log(
                `%c[cs] %cexecuted %c'${u.name.toString()}'`, 
                "color: lightblue; font-weight: bold;", 
                "color: white;", "color: lightgreen;"
            )
        }
    })
    //console.log(userscripts)
})

/** actual css for settings that are style-based (hide ads, etc)*/
export const styleSettingsCss = {
    hideAds: `#aMerger,#aHolder,#adCon,#braveWarning,.endAHolder { display: none !important }`,
    menuTimer: fs.readFileSync(path.join($assets, 'menuTimer.css'), {encoding: "utf-8"})
}

ipcRenderer.on('injectClientCss', (event, injectSplash, {hideAds, menuTimer}, userscripts, version) => {
    const splashId = "Crankshaft-splash-css"
    const settId = "Crankshaft-settings-css"
    
    if (document.getElementById(settId) === null) {
        const settCss = fs.readFileSync(path.join($assets, 'settingCss.css'), {encoding: "utf-8"})
        injectSettingsCss(settCss, settId)
    }
    
    if (document.getElementById(splashId) === null && injectSplash === true) {
        let splashCSS = fs.readFileSync(path.join($assets, 'splashCss.css'), {encoding: "utf-8"})
        injectSettingsCss(splashCSS, splashId)
        const initLoader = document.getElementById("initLoader")
        if (initLoader === null) {throw "Krunker didn't create #initLoader"}
        
        initLoader.appendChild(createElement("svg", {
            id: "crankshaft-logo",
            innerHTML: fs.readFileSync(path.join($assets, "splashLogoFragment.html"))
        }))

        //make our won bottom corner holders incase krunker changes it's shit. we only rely on the loading text from krunker.
        try { document.querySelector("#loadInfoRHolder").remove() } catch (e) {  }
        try { document.querySelector("#loadInfoLHolder").remove() } catch (e) {  } 
        initLoader.appendChild(createElement("div", {class: "crankshaft-holder-l", id: "#loadInfoLHolder", text: `v${version}`}))
        initLoader.appendChild(createElement("div", {class: "crankshaft-holder-r", id: "#loadInfoRHolder", text: /*`KraXen72 & LukeTheDuke`*/ `Client by KraXen72`}))
    }

    //TODO rewrite, this is not well scalable
    if (hideAds) { toggleSettingCSS(styleSettingsCss.hideAds, "hideAds", true) }
    if (menuTimer) { toggleSettingCSS(styleSettingsCss.menuTimer, "menuTimer", true) }
    if (userscripts) { ipcRenderer.send("preloadNeedsuserscriptsPath") }
});




/**
 * make sure our setting tab is always called as it should be and has the proper onclick
 */
function UpdateSettingsTabs(activeTab: number, hookSearch = true) {
    // Settings Menu
    //ipcRenderer.send("logMainConsole", windows[0].searchList)

    //we yeet basic settings. its advanced now. deal with it.
    //@ts-ignore
    if (window.windows[0].settingsType === "basic") { window.windows[0].toggleType({checked: true}) }
    //document.querySelector(".advancedSwitch").style.display = "none"

    if (hookSearch) { 
        // only hook search ONCE to ensure the client settings still work while searching. 
        // it will not yield the client settings tho, that's pain to implement
        const settSearchCallback = () => { UpdateSettingsTabs(0, false) }
        try { document.getElementById("settSearch").removeEventListener("input", settSearchCallback) } catch (e) {}
        document.getElementById("settSearch").addEventListener("input", settSearchCallback)
    }

    const advSliderElem = document.querySelector(".advancedSwitch input#typeBtn")
    const advSwitchCallback = () => { 
        advSliderElem.setAttribute("disabled", "disabled")
        setTimeout(() => {
            advSliderElem.removeAttribute("disabled")
            UpdateSettingsTabs(0, true) 
        }, 700) 
    }
    try { advSliderElem.removeEventListener("change", advSwitchCallback) } catch (e) { }
    advSliderElem.addEventListener("change", advSwitchCallback)

    //modifications we do the the dom:

    const tabs = document.getElementById('settingsTabLayout').children
    const clientTab = tabs[tabs.length - 1]
    
    clientTab.textContent = "Crankshaft"

    try { clientTab.removeEventListener("click", renderSettings) } catch (e) {}
    clientTab.addEventListener("click", renderSettings)

    //re-hook all tabs so the name stays the same and onclick
    const settingTabArray = document.getElementById('settingsTabLayout').children;
    for (let i = 0; i < settingTabArray.length; i++) {
        //TODO this might not want to run for every tab?
        const currentTabCallback = () => {UpdateSettingsTabs(i, true)}
        try { settingTabArray[i].removeEventListener("click", currentTabCallback) } catch (e) {  }
        settingTabArray[i].addEventListener("click", currentTabCallback)

        if (i == activeTab) { // if the current selected tab is our settings, just add active class
            settingTabArray[i].setAttribute('class', 'settingTab tabANew');
        }
    }
}