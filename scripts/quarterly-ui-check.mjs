// Optional local visual check. Requires demo-only Vite at :5186 and isolated Chrome CDP at :9228.
import assert from 'node:assert/strict'
import { mkdirSync,writeFileSync } from 'node:fs'
const directory='/tmp/kdec-quarter-ui'
mkdirSync(directory,{recursive:true})
const pages=await (await fetch('http://127.0.0.1:9228/json/list')).json()
const page=pages.find(p=>p.type==='page')
const ws=new WebSocket(page.webSocketDebuggerUrl)
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}))
let id=0;const waiting=new Map();const errors=[]
ws.addEventListener('message',e=>{const message=JSON.parse(e.data);if(message.id){const entry=waiting.get(message.id);if(entry){waiting.delete(message.id);message.error?entry.reject(message.error):entry.resolve(message.result)}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text)})
const command=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;waiting.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))})
const evaluate=async expression=>(await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true})).result?.value
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const waitForSchedule=async()=>{
  for(let attempt=0;attempt<50;attempt++){
    if(await evaluate(`!!document.querySelector('section[aria-label="Quarterly schedule"],section[aria-label="الجدول ربع السنوي"]')`))return
    await pause(200)
  }
  throw new Error('Quarterly schedule did not finish loading')
}
await command('Page.enable');await command('Runtime.enable')
await command('Page.navigate',{url:'http://127.0.0.1:5186/schedule'})
await pause(1200)
const year=new Date().getFullYear(), month=Math.floor(new Date().getMonth()/3)*3+1
const people=Array.from({length:8},(_,i)=>({id:`qa-${i}`,name:`عضو تجريبي ${i+1} — Test Member with a long family name`,email:`test-${i}@example.invalid`,roles:[i?'Guitar':'Worship Leader'],role:i?'Guitar':'Worship Leader',access_level:i?'member':'super_admin',status:'active',availability:{sun:true},timeSlots:[]}))
const services=Array.from({length:4},(_,i)=>({id:`qa-service-${i}`,title:`Sunday Worship — اجتماع فريق التسبيح ${i+1}`,date:`${year}-${String(month).padStart(2,'0')}-${String(i+10).padStart(2,'0')}`,time:'18:30',status:'scheduled',type:'Sunday Service',notes:'',setlist:[],team:people.slice(0,3).map((p,i)=>({personId:p.id,role:p.role,status:i?'pending':'confirmed'})),practice:{enabled:true,date:`${year}-${String(month).padStart(2,'0')}-${String(i+9).padStart(2,'0')}`,time:'17:00',location:'قاعة الكنيسة — Church hall'}}))
await evaluate(`(()=>{localStorage.clear();localStorage.setItem('kdec_demo_seed_version','2026-08-data-integrity-1');localStorage.setItem('kdec_people',JSON.stringify(${JSON.stringify(people)}));localStorage.setItem('kdec_services',JSON.stringify(${JSON.stringify(services)}));localStorage.setItem('kdec_demo_user',JSON.stringify({id:'qa-0'}));localStorage.setItem('kdec_lang','en')})()`)
await command('Page.reload');await pause(1000)
for(const lang of ['en','ar']){
  await evaluate(`localStorage.setItem('kdec_lang','${lang}')`);await command('Page.reload');await pause(200);await waitForSchedule()
  for(const width of [1440,390]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500})
    await pause(200)
    const state=await evaluate(`({direction:document.documentElement.dir,width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText,services:JSON.parse(localStorage.getItem('kdec_services')).length})`)
    assert.equal(state.direction,lang==='ar'?'rtl':'ltr')
    assert.ok(state.scroll<=state.width,`${lang} at ${width}px overflows: ${state.scroll}`)
    assert.ok(state.text.includes(lang==='ar'?'الجدول ربع السنوي':'Quarterly schedule'),state.text.slice(0,1500))
    assert.equal(state.services,4,'reload must retain manually created services')
    assert.ok(state.text.includes('6:30 PM'))
    const screenshot=await command('Page.captureScreenshot',{format:'png'})
    writeFileSync(`${directory}/${lang}-${width}.png`,Buffer.from(screenshot.data,'base64'))
    console.log(`${lang} ${width}px: RTL, no overflow, saved services, 12-hour times passed`)
  }
}
await evaluate(`(()=>{window.__quarterPrinted=false;window.__quarterOriginalOpen=window.open;window.open=function(...args){const child=window.__quarterOriginalOpen.apply(window,args);if(child){child.print=()=>{window.__quarterPrinted=true};window.__quarterPopup=child}return child};[...document.querySelectorAll('button')].find(b=>b.textContent.includes('تصدير PDF')).click()})()`)
for(let attempt=0;attempt<30&&!await evaluate('window.__quarterPrinted');attempt++)await pause(100)
assert.equal(await evaluate('window.__quarterPrinted'),true,`PDF popup must invoke print: ${JSON.stringify(await evaluate("({exists:!!window.__quarterPopup,ready:window.__quarterPopup?.document.readyState,closed:window.__quarterPopup?.closed,print:window.__quarterPopup?.print.toString()})"))}`)
assert.equal(await evaluate("window.__quarterPopup.document.documentElement.dir"),'rtl')
assert.equal(await evaluate("window.__quarterPopup.document.querySelectorAll('tbody tr').length"),12)
await evaluate("window.__quarterPopup.close();window.open=()=>null;[...document.querySelectorAll('button')].find(b=>b.textContent.includes('تصدير PDF')).click()")
await pause(100)
assert.ok(await evaluate("document.body.innerText.includes('اسمح بالنوافذ المنبثقة')"),'blocked popup must show a useful error')
await evaluate('window.open=window.__quarterOriginalOpen')
console.log('PDF export popup, print readiness, RTL content and blocked-popup error passed')
assert.deepEqual(errors,[],'no browser runtime exceptions')
await command('Emulation.clearDeviceMetricsOverride')
ws.close();console.log(`Screenshots: ${directory}`)
