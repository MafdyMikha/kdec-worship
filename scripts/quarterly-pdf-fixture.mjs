// Local synthetic visual fixture: no member data and no network requests.
import { mkdirSync, writeFileSync } from 'node:fs'
import { schedulePrintHtml } from '../src/lib/schedulePdf.js'
const destination = process.argv[2] || '/tmp/kdec-quarter-pdf'
mkdirSync(destination, { recursive:true })
for (const isAr of [false,true]) {
  const people = Array.from({length:8},(_,i)=>({id:`person-${i}`,name:isAr?`عضو تجريبي ${i+1} — اسم عربي طويل لاختبار التفاف النص`: `Test member ${i+1} — a deliberately long family name for wrapping`}))
  const services = Array.from({length:15},(_,i)=>({id:`service-${i}`,title:isAr?'اجتماع فريق التسبيح — خدمة الأحد':'Sunday Worship — quarterly team service',date:`2027-01-${String(i+2).padStart(2,'0')}`,time:'18:30',status:'scheduled',practice:{enabled:true,date:`2027-01-${String(i+1).padStart(2,'0')}`,time:'17:00',location:isAr?'قاعة الكنيسة':'Church hall'},team:people.map((p,j)=>({personId:p.id,role:isAr?(j?'عازف وعضو فريق التسبيح':'قائد التسبيح'):(j?'Acoustic Guitar':'Worship Leader'),status:j%2?'pending':'confirmed'}))}))
  writeFileSync(`${destination}/${isAr?'ar':'en'}.html`,schedulePrintHtml({services,people,slots:[],year:2027,quarter:1,isAr,generatedAt:new Date('2026-10-26T12:00:00Z')}))
}
console.log(`Synthetic EN/AR print fixtures saved to ${destination}`)
