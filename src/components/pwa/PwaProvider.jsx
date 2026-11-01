/* eslint-disable react-refresh/only-export-components -- context hook belongs to this small provider. */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createPwaController } from '../../lib/pwaRuntime.js'

const PwaContext=createContext(null)
export function PwaProvider({children}) {
  const [controller]=useState(()=>createPwaController(window,{registerWorker:import.meta.env.PROD}))
  useEffect(()=>{controller.start();return()=>controller.destroy()},[controller])
  useEffect(()=>{
    const update=()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',document.documentElement.classList.contains('dark')?'#101923':'#f6f5f1')}
    update()
    const observer=new MutationObserver(update)
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class']})
    return()=>observer.disconnect()
  },[])
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
  return <PwaContext.Provider value={{...state,install:controller.install,applyUpdate:controller.applyUpdate,dismissReconnect:controller.dismissReconnect,retryWorker:controller.retryWorker}}>{children}</PwaContext.Provider>
}
export const usePwa=()=>useContext(PwaContext)
