'use strict'

const ipcRenderer = require('electron').ipcRenderer;
const DispatchInterface = require('./DispatchInterface')
const WindowsProxy = require('./WindowsProxy')

let dispatchInterface = new DispatchInterface()
const windows = new WindowsProxy()

const mainSwitchElement = document.getElementById('enable-service')
const networksElement = document.getElementById('networks')
const selectionWarningElement = document.getElementById('selection-warning')
const updateDialogElement = document.getElementById('update-dialog')
const agreeUpdateBtn = document.getElementById('agree-update-button')
const disagreeUpdateBtn = document.getElementById('disagree-update-button')

let selectedAdapters = new Set()
let hasUserSelection = false

function adapterKey(name, address) {
    return `${name}::${address}`
}

function setNetworks() {
    const networkAdapters = dispatchInterface.getNetworkAdapters()
    
    let allCardsFormatted = ''
    for (let i=0; i<networkAdapters.length; i++) {
        const {name, address} = networkAdapters[i]
        const key = adapterKey(name, address)
        const checked = !hasUserSelection || selectedAdapters.has(key)
        const icon = name.includes('net') ? 'code' : 'wifi';
        const card = `
            <x-card class="network-card">
                <header class="network-card__header">
                    <label class="network-card__label">
                        <input class="network-card__checkbox" type="checkbox" data-adapter-name="${name}" data-adapter-address="${address}" ${checked ? 'checked' : ''}/>
                        <x-icon name="${icon}" style="padding-right: 0.5rem;"></x-icon>
                        <strong class="network-card__name">${name}</strong>
                    </label>
                    <span class="network-card__address">(${address})</span>
                </header>
            </x-card>`
            allCardsFormatted += card 
    }

    networksElement.innerHTML = allCardsFormatted
    if (!hasUserSelection) {
        selectedAdapters = new Set(
            networkAdapters.map(({name, address}) => adapterKey(name, address))
        )
    }
    updateSelectionWarning()
}

function startBonding() {
    console.log("Starting service.")
    const selected = getSelectedAdapters()
    if (!selected.length) {
        updateSelectionWarning(true)
        return false
    }
    dispatchInterface.startSocks(selected)
    document.getElementById('label-enable-service').innerHTML = 'on'
    document.getElementById('main-card').style = "background-color: #009788;"
    updateSelectionWarning(false)
    return true
}

function stopBonding() {
    console.log("Stopping service.")
    dispatchInterface.stop()
    document.getElementById('label-enable-service').innerHTML = 'off'
    document.getElementById('main-card').style = ""
}

/*
    UI Actions
*/
function openUpdateDialog() {
    updateDialogElement.setAttribute('open', '')
}

function closeUpdateDialog() {
    updateDialogElement.removeAttribute('open')
}

function getSelectedAdapters() {
    const selected = []
    const checkboxes = networksElement.querySelectorAll('.network-card__checkbox')
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            selected.push({
                name: checkbox.dataset.adapterName,
                address: checkbox.dataset.adapterAddress,
                priority: 1
            })
        }
    })
    return selected
}

function updateSelectionWarning(show=null) {
    if (!selectionWarningElement) {
        return
    }
    const shouldShow = show !== null ? show : getSelectedAdapters().length === 0
    selectionWarningElement.classList.toggle('is-visible', shouldShow)
}

/*
    Event Listeners
*/
// Main start/stop toggle
mainSwitchElement.onclick = ()=> {
    if (this.running) {
        setNetworks()
        windows.disableSocksProxy()
        stopBonding()
        this.running = false
    } else {
        updateSelectionWarning(false)
        const started = startBonding()
        if (!started) {
            mainSwitchElement.checked = false
            mainSwitchElement.toggled = false
            mainSwitchElement.removeAttribute('toggled')
            return
        }
        this.running = true
        windows.enableSocksProxy()
    }
}

disagreeUpdateBtn.onclick = ()=> {
    closeUpdateDialog()
}

agreeUpdateBtn.onclick = ()=> {
    ipcRenderer.send('quitAndInstall')
}

// wait for an updateReady message
ipcRenderer.on('updateReady', function(event, text) {
    openUpdateDialog()
})

networksElement.addEventListener('change', (event) => {
    if (!event.target.classList.contains('network-card__checkbox')) {
        return
    }
    hasUserSelection = true
    selectedAdapters = new Set(getSelectedAdapters().map(({name, address}) => adapterKey(name, address)))
    updateSelectionWarning()
})

setNetworks()
// If not running then pool network list.
setInterval(()=> {
    if(!this.running)
        setNetworks()
}, 10000)
