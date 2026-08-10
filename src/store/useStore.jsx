/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the provider with its public store helpers */
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase, hasValidConfiguration, isDemoMode as configuredDemoMode } from '../lib/supabase.js'
import { attendanceOccurrenceDate, attendanceTiming } from '../lib/attendance.js'
import { generateOccurrences } from '../lib/recurrence.js'
import { mergeAuthenticatedProfile } from '../lib/authProfile.js'

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
export function buildWhatsAppUrl(phone, message) {
  const clean = phone.replace(/\s+/g,'').replace(/[^+\d]/g,'')
  const num = clean.startsWith('+') ? clean.slice(1) : clean
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`
}
export function buildServiceNotificationMsg(service, person, role) {
  return `🎵 *KDEC Worship – Service Assignment*\n\nHi ${person.name}!\n\nYou've been assigned to serve:\n\n📅 *${service.title}*\n🗓 ${service.date} at ${service.time}\n🎸 Your role: *${role}*\n\nPlease confirm your attendance.\n\n— KDEC Worship Team`
}
export function buildInvitationMsg(inviteCode, inviterName) {
  const url = `${window.location.origin}?invite=${inviteCode}`
  return `🎵 *You're invited to KDEC Worship Platform!*\n\n${inviterName} has invited you to join.\n\n🔗 ${url}\n\nThis link expires in 7 days.\n\nGod bless! 🙏`
}

function createSecureToken(byteLength = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export const ROLES = ['Worship Leader','Music Director','Pianist/Keys','Acoustic Guitar','Electric Guitar','Bass Guitar','Drummer','Vocalist','AUX Instrument','Sound Engineer','Projection','Camera']
export const POSITIONS = ['Leader','Member','Volunteer','Admin']
export const DEFAULT_ORGANIZATION_SETTINGS = {
  id: true,
  orgNameAr: 'KDEC فريق التسبيح',
  orgNameEn: 'KDEC Worship Team',
  defaultService: 'Sunday Service',
  timezone: 'Africa/Cairo',
  attendanceLateMinutes: 15,
  excuseLimit: 3,
  excusePeriod: 'monthly',
  notificationPreferences: { reminders:true, newSongs:true, teamChanges:false, events:true },
}

const normalizeProfile = (profile) => ({
  ...profile,
  isAdmin: profile.is_admin,
  joinDate: profile.join_date,
  timeSlots: profile.time_slots || [],
  tags: profile.tags || [],
  availability: profile.availability || {},
  roles: Array.isArray(profile.roles) && profile.roles.length > 0
    ? profile.roles
    : (profile.role ? [profile.role] : []),
})

const normalizeSong = (song) => ({
  ...song,
  title: song.title_ar || song.title || '',
  titleEn: song.title || '',
  titleAr: song.title_ar || '',
  timeSignature: song.time_signature,
  ccliNumber: song.ccli_number || '',
  usageCount: song.usage_count || 0,
  lastUsed: song.last_used,
  arrangements: song.arrangements || [],
  sequence: song.sequence || [],
  themes: song.themes || [],
})

const normalizeService = (service) => ({
  ...service,
  recurrenceGroupId: service.recurrence_group_id,
  recurrenceIndex: service.recurrence_index,
  recurrenceFrequency: service.recurrence_frequency,
  setlistBlocks: service.setlist_blocks || {},
  setlist: (service.setlist || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => ({
      id: item.id,
      songId: item.song_id,
      key: item.key,
      notes: item.notes || '',
      order: item.sort_order,
      song: item.song ? normalizeSong(item.song) : null,
    })),
  team: (service.team || []).map(member => ({
    personId: member.person_id,
    role: member.role,
    status: member.status,
    person: member.person ? normalizeProfile(member.person) : null,
  })),
})

const normalizeEvent = (event) => ({
  ...event,
  title: event.title_ar || event.title || '',
  titleEn: event.title || '',
  description: event.description_ar || event.description || '',
  descriptionEn: event.description || '',
  endDate: event.end_date || '',
  createdBy: event.created_by,
})

const normalizeAttendanceSession = (session) => ({
  ...session,
  id: session.id || session.session_id,
  serviceId: session.service_id,
  service: session.service || (session.service_title ? {
    id:session.service_id, title:session.service_title, date:session.service_date, time:session.service_time,
  } : null),
  sessionDate: session.session_date || session.service_date || session.service?.date || '',
  sessionTime: session.session_time || '',
  endTime: session.end_time || '',
  maxAttendees: session.max_attendees,
  repeatFreq: session.repeat_freq || 'weekly',
})

const groupAttendanceRecords = (rows = []) => rows.reduce((grouped, record) => {
  const sessionId = record.session_id
  grouped[sessionId] = [...(grouped[sessionId] || []), record]
  return grouped
}, {})

// ─────────────────────────────────────────────────────────
// Demo seed data — rich realistic KDEC data for testing
// ─────────────────────────────────────────────────────────
const today = new Date()
const fmt   = (d) => format(d,'yyyy-MM-dd')
const daysUntil = (dow) => { const d = new Date(today); const diff = (dow - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return d }
const nextSun  = daysUntil(0)
const nextWed  = daysUntil(3)
const nextFri  = daysUntil(5)
const in2Suns  = new Date(nextSun);  in2Suns.setDate(nextSun.getDate()  + 7)
const in3Suns  = new Date(nextSun);  in3Suns.setDate(nextSun.getDate()  + 14)
const lastSun  = new Date(today);    lastSun.setDate(today.getDate() - ((today.getDay() + 7) % 7 || 7))

// ── 14 Team Members ───────────────────────────────────────
const DEMO_PEOPLE = [
  // ── Admins ──
  { id:'p1',  name:'مافدي حنا',       nameEn:'Mafdy Hanna',       email:'mafdy@kdec.org',      phone:'+20 100 111 0001', whatsapp:'+20 100 111 0001', role:'Worship Leader',roles:['Worship Leader','Pianist/Keys'],  position:'Admin',    status:'active', isAdmin:true,  is_admin:true,  notes:'قائد التسبيح الرئيسي',  joinDate:'2020-01-15', availability:{sun:true,wed:true,fri:true,mon:false,tue:false,thu:false,sat:false},  timeSlots:[], tags:[] },
  { id:'p2',  name:'كريستين رمزي',   nameEn:'Christine Ramzy',   email:'christine@kdec.org',  phone:'+20 100 111 0002', whatsapp:'+20 100 111 0002', role:'Music Director',roles:['Music Director','Vocalist'],  position:'Admin',    status:'active', isAdmin:true,  is_admin:true,  notes:'مديرة موسيقية',         joinDate:'2019-06-01', availability:{sun:true,wed:true,fri:true,mon:false,tue:false,thu:false,sat:false},  timeSlots:[], tags:[] },
  // ── Members ──
  { id:'p3',  name:'سارة ميخائيل',   nameEn:'Sarah Mikhail',     email:'sarah@kdec.org',      phone:'+20 100 111 0003', whatsapp:'+20 100 111 0003', role:'Pianist/Keys',roles:['Pianist/Keys'],    position:'Leader',   status:'active', isAdmin:false, is_admin:false, notes:'بيانو رئيسي، تعزف من سنة ٢٠١٨', joinDate:'2020-03-10', availability:{sun:true,wed:false,fri:true,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p4',  name:'داود سمير',      nameEn:'David Samir',       email:'david@kdec.org',      phone:'+20 100 111 0004', whatsapp:'+20 100 111 0004', role:'Acoustic Guitar',roles:['Acoustic Guitar'], position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'جيتار أكوستيك',         joinDate:'2021-06-01', availability:{sun:true,wed:true,fri:false,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p5',  name:'مريم جورج',      nameEn:'Mary George',       email:'mary@kdec.org',       phone:'+20 100 111 0005', whatsapp:'+20 100 111 0005', role:'Vocalist',roles:['Vocalist'],        position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'ألتو — الصوت الأول',     joinDate:'2021-09-15', availability:{sun:true,wed:false,fri:true,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p6',  name:'بطرس نجيب',      nameEn:'Peter Naguib',      email:'peter@kdec.org',      phone:'+20 100 111 0006', whatsapp:'+20 100 111 0006', role:'Bass Guitar',roles:['Bass Guitar'],     position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'باس جيتار',              joinDate:'2022-01-20', availability:{sun:false,wed:true,fri:true,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p7',  name:'يوحنا فارس',     nameEn:'John Fares',        email:'john@kdec.org',       phone:'+20 100 111 0007', whatsapp:'+20 100 111 0007', role:'Drummer',roles:['Drummer'],         position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'طبول',                   joinDate:'2020-11-05', availability:{sun:true,wed:false,fri:true,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p8',  name:'ريتا بشارة',     nameEn:'Rita Beshara',      email:'rita@kdec.org',       phone:'+20 100 111 0008', whatsapp:'+20 100 111 0008', role:'Vocalist',roles:['Vocalist'],        position:'Volunteer',status:'active', isAdmin:false, is_admin:false, notes:'سوبرانو',                joinDate:'2023-02-14', availability:{sun:true,wed:true,fri:true,mon:false,tue:false,thu:false,sat:false},  timeSlots:[], tags:[] },
  { id:'p9',  name:'مرقس يوسف',      nameEn:'Mark Youssef',      email:'mark@kdec.org',       phone:'+20 100 111 0009', whatsapp:'+20 100 111 0009', role:'Sound Engineer',roles:['Sound Engineer','Projection'],  position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'مهندس الصوت',            joinDate:'2021-04-22', availability:{sun:true,wed:true,fri:false,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p10', name:'ناديا فريد',     nameEn:'Nadia Farid',       email:'nadia@kdec.org',      phone:'+20 100 111 0010', whatsapp:'+20 100 111 0010', role:'Projection',roles:['Projection'],      position:'Volunteer',status:'active', isAdmin:false, is_admin:false, notes:'عرض وبروجكتر',           joinDate:'2023-07-01', availability:{sun:true,wed:false,fri:false,mon:false,tue:false,thu:false,sat:false},timeSlots:[], tags:[] },
  { id:'p11', name:'هاني أسعد',      nameEn:'Hany Asaad',        email:'hany@kdec.org',       phone:'+20 100 111 0011', whatsapp:'+20 100 111 0011', role:'Electric Guitar',roles:['Electric Guitar'], position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'جيتار كهربائي',          joinDate:'2022-08-10', availability:{sun:true,wed:true,fri:true,mon:false,tue:false,thu:false,sat:false},  timeSlots:[], tags:[] },
  { id:'p12', name:'مينا أنطون',     nameEn:'Mina Anton',        email:'mina@kdec.org',       phone:'+20 100 111 0012', whatsapp:'+20 100 111 0012', role:'Vocalist',roles:['Vocalist','Drummer'],        position:'Member',   status:'active', isAdmin:false, is_admin:false, notes:'تينور',                  joinDate:'2022-05-01', availability:{sun:true,wed:true,fri:false,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p13', name:'فيفي وليم',      nameEn:'Fifi William',      email:'fifi@kdec.org',       phone:'+20 100 111 0013', whatsapp:'+20 100 111 0013', role:'Pianist/Keys',roles:['Pianist/Keys'],    position:'Volunteer',status:'active', isAdmin:false, is_admin:false, notes:'بيانو احتياطي',          joinDate:'2024-01-10', availability:{sun:true,wed:false,fri:true,mon:false,tue:false,thu:false,sat:false}, timeSlots:[], tags:[] },
  { id:'p14', name:'بولس شحاتة',    nameEn:'Boles Shehata',     email:'boles@kdec.org',      phone:'+20 100 111 0014', whatsapp:'+20 100 111 0014', role:'Camera',roles:['Camera','Projection'],          position:'Volunteer',status:'active', isAdmin:false, is_admin:false, notes:'مصور',                   joinDate:'2024-03-15', availability:{sun:true,wed:false,fri:false,mon:false,tue:false,thu:false,sat:false},timeSlots:[], tags:[] },
]

// ── 16 Songs — Arabic primary ─────────────────────────────
const DEMO_SONGS = [
  { id:'s1',  title:'عظيم أمانتك',            titleEn:'Great Is Thy Faithfulness', author:'Thomas O. Chisholm', key:'D',  bpm:72, timeSignature:'3/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'كابو ٢ على الجيتار', ccliNumber:'18723',   usageCount:24, lastUsed:'2026-03-30', status:'active' },
  { id:'s2',  title:'كم هو عظيم إلهنا',       titleEn:'How Great Is Our God',      author:'Chris Tomlin',       key:'G',  bpm:76, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'',               ccliNumber:'4348399', usageCount:31, lastUsed:'2026-04-06', status:'active' },
  { id:'s3',  title:'يا مالئ كوني',            titleEn:'',                          author:'KDEC Worship',       key:'Am', bpm:68, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر'],               notes:'ترنيمة عربية',   ccliNumber:'',        usageCount:18, lastUsed:'2026-04-06', status:'active' },
  { id:'s4',  title:'صلاح الله',               titleEn:'Goodness of God',           author:'Beth Redman',        key:'C',  bpm:70, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'',               ccliNumber:'7117726', usageCount:15, lastUsed:'2026-03-23', status:'active' },
  { id:'s5',  title:'صانع الطريق',             titleEn:'Way Maker',                 author:'Sinach',             key:'Bb', bpm:74, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','جسر','ختام'],                         notes:'',               ccliNumber:'7115744', usageCount:27, lastUsed:'2026-04-01', status:'active' },
  { id:'s6',  title:'أنت تستحق',               titleEn:'',                          author:'KDEC Worship',       key:'G',  bpm:66, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة'],                    notes:'',               ccliNumber:'',        usageCount:9,  lastUsed:'2026-03-16', status:'active' },
  { id:'s7',  title:'ابنِ حياتي',              titleEn:'Build My Life',             author:'Pat Barrett',        key:'E',  bpm:68, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','قبل اللازمة','لازمة','مقطع ٢','لازمة','جسر'], notes:'',               ccliNumber:'7070345', usageCount:12, lastUsed:'2026-02-23', status:'active' },
  { id:'s8',  title:'محيطات',                  titleEn:'Oceans',                    author:'Hillsong United',    key:'D',  bpm:60, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'جسر طويل',       ccliNumber:'6428767', usageCount:8,  lastUsed:'2026-01-19', status:'active' },
  { id:'s9',  title:'أنا لك يا رب',            titleEn:'I Am Yours Lord',           author:'KDEC Worship',       key:'F',  bpm:65, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر'],               notes:'',               ccliNumber:'',        usageCount:14, lastUsed:'2026-03-09', status:'active' },
  { id:'s10', title:'روح الرب',                 titleEn:'Spirit of the Lord',        author:'KDEC Worship',       key:'A',  bpm:72, timeSignature:'4/4', language:'ar', sequence:['مقدمة','مقطع ١','لازمة','مقطع ٢','لازمة','جسر'],       notes:'',               ccliNumber:'',        usageCount:11, lastUsed:'2026-02-16', status:'active' },
  { id:'s11', title:'تعظّم',                    titleEn:'Glorious',                  author:'Paul Baloche',       key:'C',  bpm:80, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'',               ccliNumber:'5590997', usageCount:6,  lastUsed:'2026-01-05', status:'active' },
  { id:'s12', title:'مجدك ملأ الأرض',          titleEn:'Your Glory Fills the Earth', author:'KDEC Worship',      key:'D',  bpm:70, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','جسر','لازمة'],                        notes:'ترنيمة عيد القيامة', ccliNumber:'',    usageCount:5,  lastUsed:'2025-12-28', status:'active' },
  { id:'s13', title:'كل مجدي',                  titleEn:'All My Glory',              author:'KDEC Worship',       key:'Bb', bpm:68, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر','لازمة'],       notes:'',               ccliNumber:'',        usageCount:7,  lastUsed:'2026-02-02', status:'active' },
  { id:'s14', title:'أملي ثابت',                titleEn:'My Hope Is Certain',        author:'KDEC Worship',       key:'C',  bpm:66, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','مقطع ٢','لازمة'],                    notes:'ختامية هادئة',   ccliNumber:'',        usageCount:10, lastUsed:'2026-03-02', status:'active' },
  { id:'s15', title:'لأنك أنت الرب',            titleEn:'For You Are the Lord',      author:'KDEC Worship',       key:'G',  bpm:64, timeSignature:'4/4', language:'ar', sequence:['مقطع ١','لازمة','جسر','لازمة','ختام'],                 notes:'ترنيمة تقليدية', ccliNumber:'',        usageCount:13, lastUsed:'2026-03-16', status:'active' },
  { id:'s16', title:'في حضرتك',                 titleEn:'In Your Presence',          author:'KDEC Worship',       key:'Dm', bpm:58, timeSignature:'4/4', language:'ar', sequence:['مقدمة','مقطع ١','لازمة','مقطع ٢','لازمة','جسر'],       notes:'ختام تأملي',     ccliNumber:'',        usageCount:16, lastUsed:'2026-04-06', status:'active' },
]

// ── 4 Services with full setlists ────────────────────────
const DEMO_SERVICES = [
  // 1 ─ This Sunday
  {
    id:'sv1', title:'خدمة أحد التسبيح',
    date:fmt(nextSun), time:'10:00',
    type:'Sunday Service', status:'scheduled',
    notes:'أحد الشعانين - ترانيم فرح وتسبيح',
    recurrenceGroupId:null, recurrenceIndex:0,
    practice:{
      enabled:true, date:fmt(nextFri), time:'18:00',
      location:'قاعة الكنيسة - الدور الثاني',
      notes:'نركز على ترنيمة يا مالئ كوني والجسر',
      attendance:[
        {personId:'p1',status:'attending'},{personId:'p2',status:'attending'},
        {personId:'p3',status:'attending'},{personId:'p4',status:'maybe'},
        {personId:'p5',status:'attending'},{personId:'p7',status:'attending'},
        {personId:'p8',status:'absent'},
      ]
    },
    setlist:[
      { id:'sl1',  songId:'s1',  key:'Am', notes:'ابدأ بقوة',          order:1,  song:null },
      { id:'sl2',  songId:'s5',  key:'G',  notes:'',                    order:2,  song:null },
      { id:'sl3',  songId:'s6',  key:'A',  notes:'أسرع قليلاً',        order:3,  song:null },
      { id:'sl4',  songId:'s2',  key:'G',  notes:'الجسر مرتين',         order:4,  song:null },
      { id:'sl5',  songId:'s4',  key:'D',  notes:'أهدأ تدريجياً',       order:5,  song:null },
      { id:'sl6',  songId:'s16', key:'Dm', notes:'ختام هادئ',           order:6,  song:null },
    ],
    team:[
      { personId:'p1',  role:'Worship Leader',  status:'confirmed', person:null },
      { personId:'p2',  role:'Music Director',  status:'confirmed', person:null },
      { personId:'p3',  role:'Pianist/Keys',    status:'confirmed', person:null },
      { personId:'p4',  role:'Acoustic Guitar', status:'pending',   person:null },
      { personId:'p11', role:'Electric Guitar', status:'confirmed', person:null },
      { personId:'p6',  role:'Bass Guitar',     status:'confirmed', person:null },
      { personId:'p7',  role:'Drummer',         status:'pending',   person:null },
      { personId:'p5',  role:'Vocalist',        status:'confirmed', person:null },
      { personId:'p8',  role:'Vocalist',        status:'confirmed', person:null },
      { personId:'p12', role:'Vocalist',        status:'pending',   person:null },
      { personId:'p9',  role:'Sound Engineer',  status:'confirmed', person:null },
      { personId:'p10', role:'Projection',      status:'confirmed', person:null },
      { personId:'p14', role:'Camera',          status:'pending',   person:null },
    ],
  },
  // 2 ─ Wednesday prayer
  {
    id:'sv2', title:'ليلة الصلاة الأسبوعية',
    date:fmt(nextWed), time:'19:00',
    type:'Prayer Night', status:'scheduled',
    notes:'تسبيح هادئ وصلاة شفاعية - أقل من ٦ ترانيم',
    recurrenceGroupId:null, recurrenceIndex:0, practice:null,
    setlist:[
      { id:'sl7',  songId:'s16', key:'Dm', notes:'افتح بهدوء',          order:1,  song:null },
      { id:'sl8',  songId:'s11', key:'F',  notes:'',                    order:2,  song:null },
      { id:'sl9',  songId:'s7',  key:'C',  notes:'',                    order:3,  song:null },
      { id:'sl10', songId:'s9',  key:'D',  notes:'جسر مفتوح للصلاة',   order:4,  song:null },
      { id:'sl11', songId:'s14', key:'C',  notes:'ختام',               order:5,  song:null },
    ],
    team:[
      { personId:'p1',  role:'Worship Leader',  status:'confirmed', person:null },
      { personId:'p3',  role:'Pianist/Keys',    status:'confirmed', person:null },
      { personId:'p5',  role:'Vocalist',        status:'confirmed', person:null },
      { personId:'p8',  role:'Vocalist',        status:'pending',   person:null },
      { personId:'p9',  role:'Sound Engineer',  status:'confirmed', person:null },
      { personId:'p10', role:'Projection',      status:'confirmed', person:null },
    ],
  },
  // 3 ─ Next Sunday
  {
    id:'sv3', title:'خدمة أحد الفصح',
    date:fmt(in2Suns), time:'10:00',
    type:'Sunday Service', status:'scheduled',
    notes:'أحد القيامة - خدمة احتفالية',
    recurrenceGroupId:null, recurrenceIndex:0, practice:null,
    setlist:[
      { id:'sl12', songId:'s3',  key:'D',  notes:'افتتاح احتفالي',      order:1,  song:null },
      { id:'sl13', songId:'s10', key:'A',  notes:'',                    order:2,  song:null },
      { id:'sl14', songId:'s5',  key:'G',  notes:'',                    order:3,  song:null },
      { id:'sl15', songId:'s15', key:'G',  notes:'تقليدي',              order:4,  song:null },
      { id:'sl16', songId:'s2',  key:'G',  notes:'',                    order:5,  song:null },
      { id:'sl17', songId:'s4',  key:'D',  notes:'ختام',               order:6,  song:null },
    ],
    team:[
      { personId:'p1',  role:'Worship Leader',  status:'pending',   person:null },
      { personId:'p2',  role:'Music Director',  status:'confirmed', person:null },
      { personId:'p13', role:'Pianist/Keys',    status:'confirmed', person:null },
      { personId:'p4',  role:'Acoustic Guitar', status:'confirmed', person:null },
      { personId:'p11', role:'Electric Guitar', status:'pending',   person:null },
      { personId:'p6',  role:'Bass Guitar',     status:'pending',   person:null },
      { personId:'p7',  role:'Drummer',         status:'confirmed', person:null },
      { personId:'p5',  role:'Vocalist',        status:'confirmed', person:null },
      { personId:'p8',  role:'Vocalist',        status:'confirmed', person:null },
      { personId:'p9',  role:'Sound Engineer',  status:'confirmed', person:null },
      { personId:'p10', role:'Projection',      status:'pending',   person:null },
    ],
  },
  // 4 ─ 3rd Sunday (recurring example)
  {
    id:'sv4', title:'خدمة أحد الاعتيادية',
    date:fmt(in3Suns), time:'10:00',
    type:'Sunday Service', status:'scheduled',
    notes:'',
    recurrenceGroupId:'rg1', recurrenceIndex:1, practice:null,
    setlist:[
      { id:'sl18', songId:'s6',  key:'Bb', notes:'',  order:1, song:null },
      { id:'sl19', songId:'s12', key:'Bb', notes:'',  order:2, song:null },
      { id:'sl20', songId:'s8',  key:'E',  notes:'',  order:3, song:null },
      { id:'sl21', songId:'s13', key:'Bb', notes:'',  order:4, song:null },
      { id:'sl22', songId:'s11', key:'F',  notes:'',  order:5, song:null },
    ],
    team:[
      { personId:'p1',  role:'Worship Leader',  status:'pending', person:null },
      { personId:'p2',  role:'Music Director',  status:'pending', person:null },
      { personId:'p3',  role:'Pianist/Keys',    status:'pending', person:null },
      { personId:'p4',  role:'Acoustic Guitar', status:'pending', person:null },
      { personId:'p6',  role:'Bass Guitar',     status:'pending', person:null },
      { personId:'p7',  role:'Drummer',         status:'pending', person:null },
      { personId:'p5',  role:'Vocalist',        status:'pending', person:null },
      { personId:'p12', role:'Vocalist',        status:'pending', person:null },
      { personId:'p9',  role:'Sound Engineer',  status:'pending', person:null },
      { personId:'p10', role:'Projection',      status:'pending', person:null },
    ],
  },
]

const DEMO_ANNOUNCEMENTS = [
  { id:'a1', title:'بروفة هذا الجمعة', content:'لدينا بروفة كاملة مع الفريق الجمعة الساعة ٦ م. من فضلكم أكدوا حضوركم. سنركز على ترانيم أحد الشعانين.', priority:'high',   author_id:'p1', authorName:'مافدي حنا',    created_at: new Date().toISOString() },
  { id:'a2', title:'ترنيمة جديدة في المكتبة', content:'تم إضافة ترنيمة "يسوع أنت جميل" للمكتبة. من فضلكم استمعوا إليها قبل الأحد.', priority:'normal', author_id:'p2', authorName:'كريستين رمزي', created_at: new Date(Date.now()-86400000).toISOString() },
  { id:'a3', title:'اجتماع الفريق الأسبوع القادم', content:'سيكون هناك اجتماع فريق التسبيح الأسبوع القادم الثلاثاء الساعة ٧ م لمناقشة خطة ترانيم شهر مايو.', priority:'normal', author_id:'p1', authorName:'مافدي حنا', created_at: new Date(Date.now()-172800000).toISOString() },
  { id:'a4', title:'تذكير: حضور البروفات', content:'الحضور الثابت في البروفات ضروري جداً لجودة الخدمة. من فضلكم أبلغوا مسبقاً في حالة الغياب.', priority:'low',    author_id:'p2', authorName:'كريستين رمزي', created_at: new Date(Date.now()-259200000).toISOString() },
]

function hydrateDemoServices(services, songs, people) {
  return services.map(s => ({
    ...s,
    setlistBlocks: s.setlistBlocks || {},
    setlist: (s.setlist || []).map(item => ({ ...item, song: songs.find(sg => sg.id === item.songId) || null })),
    team:    (s.team || []).map(t => ({ ...t, person: people.find(p => p.id === t.personId) || null })),
  }))
}

// ─────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const isDemoMode = configuredDemoMode
  const configurationError = !hasValidConfiguration

  // ── State ───────────────────────────────────────────────
  const [currentUser,    setCurrentUser]    = useState(null)
  const [authLoading,    setAuthLoading]    = useState(() => !configurationError)
  const [people,         setPeople]         = useState([])
  const [songs,          setSongs]          = useState([])
  const [services,       setServices]       = useState([])
  const [announcements,  setAnnouncements]  = useState([])
  const [invitations,    setInvitations]    = useState([])
  const [events,         setEvents]         = useState([])
  const [eventResponses, setEventResponses] = useState({})
  const [attendanceSessions, setAttendanceSessions] = useState([])
  const [attendanceRecords,  setAttendanceRecords]  = useState({})
  const [excuseRequests, setExcuseRequests] = useState([])
  const [substituteRequests, setSubstituteRequests] = useState([])
  const [organizationSettings, setOrganizationSettings] = useState(DEFAULT_ORGANIZATION_SETTINGS)
  const [notifications,  setNotifications]  = useState([])
  const [loading,        setLoading]        = useState(false)
  const [demoReady,      setDemoReady]      = useState(false)
  const authGenerationRef = useRef(0)
  const activeUserIdRef = useRef(null)

  const toast = useCallback((msg, type='success') => {
    const id = Date.now()
    setNotifications(n => [...n, { id, msg, type }])
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 3500)
  }, [])

  const clearLoadedData = useCallback(() => {
    authGenerationRef.current += 1
    activeUserIdRef.current = null
    setPeople([])
    setSongs([])
    setServices([])
    setAnnouncements([])
    setInvitations([])
    setEvents([])
    setEventResponses({})
    setAttendanceSessions([])
    setAttendanceRecords({})
    setExcuseRequests([])
    setSubstituteRequests([])
    setOrganizationSettings(DEFAULT_ORGANIZATION_SETTINGS)
    setLoading(false)
  }, [])

  // ── DEMO MODE bootstrap ─────────────────────────────────
  useEffect(() => {
    if (!isDemoMode) return
    // Load from localStorage; an intentionally empty collection must stay empty.
    const storedUser = localStorage.getItem('kdec_demo_user')
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('kdec_demo_user')
      }
    }

    const storedPeople = localStorage.getItem('kdec_people')
    const storedSongs  = localStorage.getItem('kdec_songs')
    const storedSvcs   = localStorage.getItem('kdec_services')
    const storedAnns   = localStorage.getItem('kdec_announcements')
    const storedEvents = localStorage.getItem('kdec_events')
    const storedEventResponses = localStorage.getItem('kdec_event_responses')
    const storedSessions = localStorage.getItem('kdec_attendance_sessions')
    const storedRecords = localStorage.getItem('kdec_attendance_records')
    const storedExcuses = localStorage.getItem('kdec_excuse_requests')
    const storedSubstitutes = localStorage.getItem('kdec_substitute_requests')
    const storedOrganization = localStorage.getItem('kdec_organization_settings')
    const demoWasInitialized = localStorage.getItem('kdec_demo_seed_version') === '2026-08-data-integrity-1'
    const allCoreCollectionsEmpty = [storedPeople,storedSongs,storedSvcs,storedAnns].every(raw => {
      try { return Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length===0 }
      catch { return false }
    })

    const parseSafe = (raw, fallback, validator = Array.isArray, seedEmptyBeforeMigration = false) => {
      if (!raw) return fallback
      try {
        const parsed = JSON.parse(raw)
        if (seedEmptyBeforeMigration && (!demoWasInitialized||allCoreCollectionsEmpty) && Array.isArray(parsed) && parsed.length===0) return fallback
        return validator(parsed) ? parsed : fallback
      } catch { return fallback }
    }

    const p      = parseSafe(storedPeople, DEMO_PEOPLE, Array.isArray, true)
    const s      = parseSafe(storedSongs,  DEMO_SONGS, Array.isArray, true)
    const a      = parseSafe(storedAnns,   DEMO_ANNOUNCEMENTS, Array.isArray, true)
    const rawSvcs = parseSafe(storedSvcs,  DEMO_SERVICES, Array.isArray, true)
    const evts   = parseSafe(storedEvents, [])
    const sessions = parseSafe(storedSessions, [])
    const excuses = parseSafe(storedExcuses, [])
    const substitutes = parseSafe(storedSubstitutes, [])
    const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    const responses = parseSafe(storedEventResponses, {}, isPlainObject)
    const records = parseSafe(storedRecords, {}, isPlainObject)
    const organization = parseSafe(storedOrganization, DEFAULT_ORGANIZATION_SETTINGS, isPlainObject)

    setPeople(p)
    setSongs(s)
    setAnnouncements(a)
    setServices(hydrateDemoServices(rawSvcs, s, p))
    setEvents(evts)
    setEventResponses(responses)
    setAttendanceSessions(sessions.map(session => ({
      ...session,
      service: rawSvcs.find(service => service.id === session.service_id) || session.service || null,
    })))
    setAttendanceRecords(records)
    setExcuseRequests(excuses)
    setSubstituteRequests(substitutes)
    setOrganizationSettings({ ...DEFAULT_ORGANIZATION_SETTINGS, ...organization })
    localStorage.setItem('kdec_demo_seed_version','2026-08-data-integrity-1')
    setDemoReady(true)
    setAuthLoading(false)
  }, [isDemoMode])

  // Save demo data to localStorage on change, including intentional deletions.
  useEffect(() => {
    if (!isDemoMode || !demoReady) return
    localStorage.setItem('kdec_people', JSON.stringify(people))
  }, [demoReady, isDemoMode, people])

  useEffect(() => {
    if (!isDemoMode || !demoReady) return
    localStorage.setItem('kdec_songs', JSON.stringify(songs))
  }, [demoReady, isDemoMode, songs])

  useEffect(() => {
    if (!isDemoMode || !demoReady) return
    // strip the hydrated .song and .person before saving (re-hydrated on load)
    const stripped = services.map(s => ({
      ...s,
      setlist: (s.setlist || []).map(i => ({ ...i, song: null })),
      team:    (s.team || []).map(t => ({ ...t, person: null })),
    }))
    localStorage.setItem('kdec_services', JSON.stringify(stripped))
  }, [demoReady, isDemoMode, services])

  useEffect(() => {
    if (!isDemoMode || !demoReady) return
    localStorage.setItem('kdec_announcements', JSON.stringify(announcements))
  }, [announcements, demoReady, isDemoMode])

  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_events', JSON.stringify(events)) }, [demoReady, events, isDemoMode])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_event_responses', JSON.stringify(eventResponses)) }, [demoReady, eventResponses, isDemoMode])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_attendance_sessions', JSON.stringify(attendanceSessions.map(session => ({ ...session, service: undefined })))) }, [attendanceSessions, demoReady, isDemoMode])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_attendance_records', JSON.stringify(attendanceRecords)) }, [attendanceRecords, demoReady, isDemoMode])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_excuse_requests', JSON.stringify(excuseRequests)) }, [demoReady, excuseRequests, isDemoMode])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_substitute_requests', JSON.stringify(substituteRequests)) }, [demoReady, isDemoMode, substituteRequests])
  useEffect(() => { if (isDemoMode&&demoReady) localStorage.setItem('kdec_organization_settings', JSON.stringify(organizationSettings)) }, [demoReady, isDemoMode, organizationSettings])

  // ── SUPABASE MODE bootstrap ─────────────────────────────
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => window.location.pathname === '/reset-password')

  const loadAll = useCallback(async (includeAdminData = false, expectedGeneration = authGenerationRef.current) => {
    if (isDemoMode || !supabase) return
    if (!includeAdminData) {
      setInvitations([])
      setAttendanceSessions([])
    }
    setLoading(true)
    try {
      const queries = [
        ['profiles', supabase.from('profiles').select('*').order('name')],
        ['songs', supabase.from('songs').select('*').order('title')],
        ['services', supabase.from('services').select('*, setlist:setlist_items(*, song:songs(*)), team:service_team(*, person:profiles(*))').order('date')],
        ['announcements', supabase.from('announcements').select('*, author:profiles(name)').order('created_at',{ascending:false})],
        ['events', supabase.from('events').select('*').order('date')],
        ['eventResponses', supabase.from('event_responses').select('*')],
        ['attendanceRecords', supabase.from('attendance_records').select('*').order('created_at',{ascending:false})],
        ['excuses', supabase.from('excuses').select('*').order('created_at',{ascending:false})],
        ['substitutes', supabase.from('substitute_requests').select('*').order('created_at',{ascending:false})],
        ['organization', supabase.from('organization_settings').select('*').eq('id',1).maybeSingle()],
      ]
      if (includeAdminData) {
        queries.push(
          ['invitations', supabase.from('invitations').select('*').order('created_at',{ascending:false})],
          ['attendanceSessions', supabase.from('attendance_sessions').select('*, service:services(*)').order('created_at',{ascending:false})],
        )
      }

      const resolved = await Promise.all(queries.map(async ([key, query]) => [key, await query]))
      if (expectedGeneration !== authGenerationRef.current) return
      const resultByKey = Object.fromEntries(resolved)
      const firstError = resolved.find(([, result]) => result.error)?.[1].error
      if (firstError) toast(`Some data could not be loaded: ${firstError.message}`, 'error')

      const profilesResult = resultByKey.profiles
      const songsResult = resultByKey.songs
      const servicesResult = resultByKey.services
      const announcementsResult = resultByKey.announcements
      if (profilesResult.data) setPeople(profilesResult.data.map(normalizeProfile))
      if (songsResult.data) setSongs(songsResult.data.map(normalizeSong))
      if (servicesResult.data) setServices(servicesResult.data.map(normalizeService))
      if (announcementsResult.data) {
        setAnnouncements(announcementsResult.data.map(announcement => ({
          ...announcement,
          author: announcement.author_id,
          authorName: announcement.author?.name,
        })))
      }
      if (resultByKey.events?.data) setEvents(resultByKey.events.data.map(normalizeEvent))
      if (resultByKey.eventResponses?.data) {
        setEventResponses(resultByKey.eventResponses.data.reduce((responses, row) => ({
          ...responses,
          [row.event_id]: { ...(responses[row.event_id] || {}), [row.person_id]: row.response },
        }), {}))
      }
      if (resultByKey.attendanceRecords?.data) setAttendanceRecords(groupAttendanceRecords(resultByKey.attendanceRecords.data))
      if (resultByKey.excuses?.data) setExcuseRequests(resultByKey.excuses.data)
      if (resultByKey.substitutes?.data) setSubstituteRequests(resultByKey.substitutes.data)
      if (resultByKey.organization?.data) {
        const settings = resultByKey.organization.data
        setOrganizationSettings({
          id: true,
          orgNameAr: settings.name_ar || DEFAULT_ORGANIZATION_SETTINGS.orgNameAr,
          orgNameEn: settings.name || DEFAULT_ORGANIZATION_SETTINGS.orgNameEn,
          defaultService: settings.default_service_type || DEFAULT_ORGANIZATION_SETTINGS.defaultService,
          timezone: settings.timezone || DEFAULT_ORGANIZATION_SETTINGS.timezone,
          attendanceLateMinutes: settings.attendance_late_minutes ?? DEFAULT_ORGANIZATION_SETTINGS.attendanceLateMinutes,
          excuseLimit: settings.excuse_limit ?? DEFAULT_ORGANIZATION_SETTINGS.excuseLimit,
          excusePeriod: settings.excuse_period || DEFAULT_ORGANIZATION_SETTINGS.excusePeriod,
          notificationPreferences: settings.notification_preferences || DEFAULT_ORGANIZATION_SETTINGS.notificationPreferences,
        })
      }
      if (resultByKey.invitations?.data) setInvitations(resultByKey.invitations.data)
      if (resultByKey.attendanceSessions?.data) setAttendanceSessions(resultByKey.attendanceSessions.data.map(normalizeAttendanceSession))
      if (!includeAdminData) {
        setInvitations([])
        setAttendanceSessions([])
      }
    } finally {
      if (expectedGeneration === authGenerationRef.current) setLoading(false)
    }
  }, [isDemoMode, toast])

  const loadCurrentUser = useCallback(async (user) => {
    setAuthLoading(true)
    setCurrentUser(null)
    clearLoadedData()
    const expectedGeneration = authGenerationRef.current
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (expectedGeneration !== authGenerationRef.current) return
    if (error || !profile) {
      setCurrentUser(null)
      setAuthLoading(false)
      toast('Your account profile could not be loaded. Contact an administrator.', 'error')
      await supabase.auth.signOut({ scope:'local' })
      return
    }
    if (profile.status !== 'active') {
      setCurrentUser(null)
      setAuthLoading(false)
      toast('This account is inactive. Ask an administrator to activate it.', 'error')
      await supabase.auth.signOut({ scope: 'local' })
      return
    }
    setCurrentUser(mergeAuthenticatedProfile(normalizeProfile(profile), user))
    activeUserIdRef.current = user.id
    await loadAll(Boolean(profile.is_admin), expectedGeneration)
    if (expectedGeneration === authGenerationRef.current) setAuthLoading(false)
  }, [clearLoadedData, loadAll, toast])

  useEffect(() => {
    if (isDemoMode || configurationError) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setAuthLoading(false)
        return
      }
      if (session) {
        const shouldReload = activeUserIdRef.current !== session.user.id || ['INITIAL_SESSION','SIGNED_IN'].includes(event)
        if (shouldReload) void loadCurrentUser(session.user)
        else setAuthLoading(false)
      }
      else {
        activeUserIdRef.current = null
        setCurrentUser(null)
        clearLoadedData()
        setAuthLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [clearLoadedData, configurationError, isDemoMode, loadCurrentUser, toast])

  const updatePassword = async (newPassword) => {
    if (isDemoMode) return { error: 'Not available in demo mode.' }
    if (!newPassword || newPassword.length < 6) return { error: 'Password must be at least 6 characters.' }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return { success: true }
  }

  const finishPasswordRecovery = () => setIsPasswordRecovery(false)

  // ── AUTH ────────────────────────────────────────────────
  const login = async (email, password) => {
    if (isDemoMode) {
      // Match seeded people by email
      const p = DEMO_PEOPLE.find(u => u.email.toLowerCase() === email.toLowerCase())
      if (p) {
        const user = { ...p, id: p.id, personId: p.id }
        setCurrentUser(user)
        localStorage.setItem('kdec_demo_user', JSON.stringify(user))
        return { success: true }
      }
      return { error: 'Unknown demo account. Use mafdy@kdec.org (admin) or sarah@kdec.org (member).' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { success: true }
  }

  const logout = async () => {
    if (isDemoMode) {
      localStorage.removeItem('kdec_demo_user')
      setCurrentUser(null)
      return
    }
    const { error } = await supabase.auth.signOut({ scope:'local' })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setCurrentUser(null)
    activeUserIdRef.current = null
    clearLoadedData()
    return { success:true }
  }

  const registerWithInvite = async (inviteCode, email, password, name) => {
    if (isDemoMode) return { error: 'Registration is disabled in demo mode. Use a demo account to log in.' }
    if (!inviteCode) return { error: 'A valid invitation link is required.' }

    const normalizedEmail = email.trim().toLowerCase()
    const { data: isValid, error: validationError } = await supabase.rpc('validate_invitation', {
      p_code: inviteCode,
      p_email: normalizedEmail,
    })
    if (validationError) return { error: 'Invitation validation is unavailable. Ask an administrator to apply the latest database migration.' }
    if (!isValid) return { error: 'This invitation is invalid, expired, cancelled, or belongs to another email address.' }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: name || normalizedEmail.split('@')[0],
          invite_code: inviteCode,
        },
      }
    })

    if (error) return { error: error.message }
    if (data.session) return { success: true, autoLoggedIn: true }
    return {
      success: true,
      autoLoggedIn: false,
      message: 'Account created. Check your email to confirm it, then sign in.',
    }
  }

  const forgotPassword = async (email) => {
    if (isDemoMode) return { error: 'Password reset is not available in demo mode.' }
    if (!email) return { error: 'Please enter your email address.' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) return { error: error.message }
    return { success: true }
  }

  const updateProfile = async (data) => {
    if (isDemoMode) {
      const updates = { name:data.name, phone:data.phone, whatsapp:data.whatsapp, notes:data.notes, availability:data.availability, timeSlots:data.timeSlots||[] }
      setCurrentUser(prev => ({ ...prev, ...updates }))
      setPeople(prev => prev.map(p => p.id === currentUser.id ? { ...p, ...updates } : p))
      toast('Profile updated')
      return { success:true }
    }
    const updates = { name:data.name, phone:data.phone, whatsapp:data.whatsapp, notes:data.notes, availability:data.availability, time_slots:data.timeSlots||[] }
    const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    const localUpdates = { ...updates, timeSlots:updates.time_slots }
    setCurrentUser(prev => ({ ...prev, ...localUpdates }))
    setPeople(prev => prev.map(p => p.id===currentUser.id?{...p,...localUpdates}:p))
    toast('Profile updated')
    return { success:true }
  }

  const updatePersonAvailability = async (personId, availability) => {
    if (isDemoMode) { setPeople(prev => prev.map(p => p.id===personId?{...p,availability}:p)); toast('Availability updated'); return }
    const { error } = await supabase.from('profiles').update({ availability }).eq('id', personId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setPeople(prev => prev.map(p => p.id===personId?{...p,availability}:p))
    toast('Availability updated')
    return { success:true }
  }

  // ── INVITATIONS ─────────────────────────────────────────
  const createInvitation = async (email, roles, method) => {
    const code = createSecureToken()
    const rolesArr = Array.isArray(roles) ? roles : [roles]
    const primaryRole = rolesArr[0] || ''
    if (isDemoMode) {
      const inv = { id:'inv_'+Date.now(), code, email, role:primaryRole, roles:rolesArr, method, status:'pending', created_by:currentUser.id, expires_at: new Date(Date.now()+7*86400000).toISOString(), created_at: new Date().toISOString() }
      setInvitations(prev => [inv, ...prev]); toast(`Invitation created for ${email}`); return inv
    }
    const { data, error } = await supabase.from('invitations').insert({ code, email, role:primaryRole, roles:rolesArr, method, created_by:currentUser.id, expires_at: new Date(Date.now()+7*86400000).toISOString() }).select().single()
    if (!error) { setInvitations(prev => [data,...prev]); toast(`Invitation created for ${email}`); return data }
    toast('Failed to create invitation','error'); return null
  }

  const cancelInvitation = async (id) => {
    if (isDemoMode) { setInvitations(prev => prev.map(i => i.id===id?{...i,status:'cancelled'}:i)); toast('Cancelled','error'); return }
    const { error } = await supabase.from('invitations').update({ status:'cancelled' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return }
    setInvitations(prev => prev.map(i => i.id===id?{...i,status:'cancelled'}:i))
    toast('Invitation cancelled','error')
  }

  // ── PEOPLE ──────────────────────────────────────────────
  const addPerson    = async ()      => toast('Invite members via the Invitations page','info')
  const updatePerson = async (id, data) => {
    if (id===currentUser?.id && data.status!=='active') {
      const message = 'You cannot deactivate your signed-in account.'
      toast(message,'error'); return { error:message }
    }
    const rolesArr = Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : (data.role ? [data.role] : [])
    const updates = {
      name: data.name, phone: data.phone, whatsapp: data.whatsapp,
      role: rolesArr[0] || '',   // primary role kept for backward-compat badges/filters
      roles: rolesArr,           // full set of roles/capabilities
      position: data.position, status: data.status, notes: data.notes,
      availability: data.availability,
      isAdmin: id===currentUser?.id ? Boolean(currentUser.isAdmin || currentUser.is_admin) : data.position === 'Admin',
      is_admin: id===currentUser?.id ? Boolean(currentUser.isAdmin || currentUser.is_admin) : data.position === 'Admin',
    }
    if (isDemoMode) { setPeople(prev => prev.map(p => p.id===id?{...p,...updates}:p)); toast('Updated'); return }
    const { error } = await supabase.from('profiles').update({
      name:updates.name, phone:updates.phone, whatsapp:updates.whatsapp,
      role:updates.role, roles:updates.roles, position:updates.position,
      status:updates.status, notes:updates.notes, availability:updates.availability,
      is_admin:updates.isAdmin,
    }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setPeople(prev => prev.map(p => p.id===id?{...p,...updates}:p)); toast('Updated')
    return { success:true }
  }
  const deletePerson = async (id) => {
    if (id===currentUser?.id) {
      const message = 'You cannot deactivate your signed-in account.'
      toast(message,'error'); return { error:message }
    }
    if (isDemoMode) { setPeople(prev => prev.map(p => p.id===id?{...p,status:'inactive'}:p)); toast('Marked inactive','error'); return }
    const { error } = await supabase.from('profiles').update({ status:'inactive' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setPeople(prev => prev.map(p => p.id===id?{...p,status:'inactive'}:p)); toast('Marked inactive','error')
    return { success:true }
  }

  // ── SONGS ───────────────────────────────────────────────
  const addSong = async (data) => {
    const song = { ...data, id:'s'+Date.now(), usageCount:0, status:'active', titleAr:data.title||'', arrangements:data.arrangements||[], themes:data.themes||[], sequence:data.sequence||[] }
    if (isDemoMode) { setSongs(prev => [...prev, song]); toast('Song added'); return { success:true } }
    const { data:s, error } = await supabase.from('songs').insert({ title:data.titleEn||data.title, title_ar:data.title, author:data.author||'', key:data.key, bpm:data.bpm||null, time_signature:data.timeSignature||'4/4', language:data.language||'ar', sequence:data.sequence||[], themes:data.themes||[], notes:data.notes||'', ccli_number:data.ccliNumber||'', usage_count:0, status:'active', created_by:currentUser.id }).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setSongs(prev => [...prev, normalizeSong(s)]); toast('Song added'); return { success:true }
  }
  const updateSong = async (id, data) => {
    if (isDemoMode) { setSongs(prev => prev.map(s => s.id===id?{...s,...data,titleAr:data.title}:s)); toast('Song updated'); return { success:true } }
    const { error } = await supabase.from('songs').update({ title:data.titleEn||data.title, title_ar:data.title, author:data.author, key:data.key, bpm:data.bpm||null, time_signature:data.timeSignature, language:data.language, sequence:data.sequence||[], themes:data.themes||[], notes:data.notes||'', ccli_number:data.ccliNumber||'' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setSongs(prev => prev.map(s => s.id===id?{...s,...data}:s)); toast('Song updated')
    return { success:true }
  }
  const deleteSong = async (id) => {
    if (isDemoMode) { setSongs(prev => prev.map(s => s.id===id?{...s,status:'inactive'}:s)); toast('Song archived'); return }
    const { error } = await supabase.from('songs').update({ status:'inactive' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setSongs(prev => prev.map(s => s.id===id?{...s,status:'inactive'}:s)); toast('Song archived')
    return { success:true }
  }

  // ── SERVICES ────────────────────────────────────────────
  const addService = async (data) => {
    const totalOccurrences = data.recurrence?.enabled
      ? Math.max(2, Number(data.recurrence?.count) || 2)
      : 1
    const followUpRecurrence = data.recurrence?.enabled
      ? { ...data.recurrence, count:totalOccurrences - 1 }
      : data.recurrence
    const recurrenceFrequency = data.recurrence?.frequency || 'weekly'
    if (isDemoMode) {
      const base = { ...data, id:'sv'+Date.now(), status:'scheduled', setlist:[], setlistBlocks:{}, team:[], practice:null, recurrenceGroupId:null, recurrenceIndex:0 }
      const newSvcs = [base]
      if (data.recurrence?.enabled) {
        const occs = generateOccurrences({ ...base, recurrence_group_id: base.id }, followUpRecurrence)
        if (!occs.length) {
          const message = 'The recurrence end date must include at least two services.'
          toast(message,'error'); return { error:message }
        }
        const updBase = { ...base, recurrenceGroupId: base.id, recurrenceFrequency }
        occs.forEach((o,i) => newSvcs.push({ ...o, id:`sv${Date.now()}_${i}`, setlist:[], setlistBlocks:{}, team:[], practice:null, recurrenceGroupId:base.id, recurrenceIndex:i+1, recurrenceFrequency }))
        newSvcs[0] = updBase
        toast(`Created ${newSvcs.length} services`)
      } else toast('Service created')
      setServices(prev => [...prev, ...newSvcs])
      return { success:true }
    }
    const basePayload = { title:data.title, date:data.date, time:data.time, type:data.type, status:'scheduled', notes:data.notes||'', created_by:currentUser.id }
    if (data.recurrence?.enabled) {
      const groupId = crypto.randomUUID()
      const occs = generateOccurrences({ ...data, id:groupId, recurrence_group_id:groupId }, followUpRecurrence)
      if (!occs.length) {
        const message = 'The recurrence end date must include at least two services.'
        toast(message,'error'); return { error:message }
      }
      const rows = [
        { ...basePayload, id:groupId, recurrence_group_id:groupId, recurrence_index:0, recurrence_frequency:recurrenceFrequency },
        ...occs.map(occ => ({ title:occ.title, date:occ.date, time:occ.time, type:occ.type, status:'scheduled', notes:occ.notes||'', recurrence_group_id:groupId, recurrence_index:occ.recurrence_index, recurrence_frequency:recurrenceFrequency, created_by:currentUser.id })),
      ]
      const { error } = await supabase.from('services').insert(rows)
      if (error) { toast(error.message,'error'); return { error:error.message } }
      toast(`Created ${rows.length} services`)
    } else {
      const { error } = await supabase.from('services').insert(basePayload)
      if (error) { toast(error.message,'error'); return { error:error.message } }
      toast('Service created')
    }
    await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    return { success:true }
  }

  const updateService = async (id, data) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id===id?{...s,...data}:s)); toast('Service updated'); return { success:true } }
    const u = {}
    ;['title','date','time','type','status','notes','practice'].forEach(k => { if (data[k]!==undefined) u[k]=data[k] })
    const { error } = await supabase.from('services').update(u).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id===id?{...s,...data}:s)); toast('Service updated')
    return { success:true }
  }

  const updateRecurringService = async (id, data, scope) => {
    const svc = services.find(s => s.id===id)
    if (!svc?.recurrenceGroupId || scope==='this') return updateService(id, data)
    if (isDemoMode) {
      setServices(prev => prev.map(s => {
        if (s.recurrenceGroupId !== svc.recurrenceGroupId) return s
        if (scope==='this_and_future' && parseISO(s.date) < parseISO(svc.date)) return s
        return { ...s, ...data }
      })); toast('Series updated'); return { success:true }
    }
    const u = {}
    ;['title','time','type','notes'].forEach(k => { if (data[k]!==undefined) u[k]=data[k] })
    const q = supabase.from('services').update(u).eq('recurrence_group_id',svc.recurrenceGroupId)
    if (scope==='this_and_future') q.gte('date',svc.date)
    const { data:updated, error } = await q.select('id')
    if (error || !updated?.length) { const message=error?.message||'No recurring services were updated.'; toast(message,'error'); return { error:message } }
    toast('Series updated'); await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    return { success:true }
  }

  const deleteService = async (id) => {
    if (isDemoMode) { setServices(prev => prev.map(service => service.id===id?{...service,status:'cancelled'}:service)); toast('Service cancelled'); return { success:true } }
    const { error } = await supabase.from('services').update({ status:'cancelled' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(service => service.id===id?{...service,status:'cancelled'}:service)); toast('Service cancelled')
    return { success:true }
  }

  const deleteRecurringService = async (id, scope) => {
    const svc = services.find(s => s.id===id)
    if (!svc?.recurrenceGroupId || scope==='this') return deleteService(id)
    if (isDemoMode) {
      setServices(prev => prev.map(service => {
        if (service.recurrenceGroupId !== svc.recurrenceGroupId) return service
        if (scope==='this_and_future' && parseISO(service.date) < parseISO(svc.date)) return service
        return { ...service, status:'cancelled' }
      })); toast('Services cancelled'); return { success:true }
    }
    const q = supabase.from('services').update({ status:'cancelled' }).eq('recurrence_group_id',svc.recurrenceGroupId)
    if (scope==='this_and_future') q.gte('date',svc.date)
    const { data:updated, error } = await q.select('id')
    if (error || !updated?.length) { const message=error?.message||'No recurring services were cancelled.'; toast(message,'error'); return { error:message } }
    toast('Services cancelled'); await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    return { success:true }
  }

  const generateMoreOccurrences = async (groupId, count) => {
    const group = services.filter(s => s.recurrenceGroupId===groupId).sort((a,b)=>parseISO(a.date)-parseISO(b.date))
    if (!group.length) return
    const first = group[0]
    const last = group[group.length-1]
    let frequency = first.recurrenceFrequency || 'weekly'
    if (!first.recurrenceFrequency && group.length>=2) { const diff=Math.round((parseISO(group[1].date)-parseISO(group[0].date))/86400000); if(diff>=28)frequency='monthly'; else if(diff>=14)frequency='biweekly' }
    const maxIndex = Math.max(...group.map(service => service.recurrenceIndex || 0))
    const newOnes = generateOccurrences({ ...first, recurrence_group_id:groupId }, { enabled:true, frequency, count, startIndex:maxIndex, endDate:null })
    if (isDemoMode) {
      const newSvcs = newOnes.map((o,i) => ({ ...o, id:`sv${Date.now()}_${i}`, setlist:[], setlistBlocks:{}, team: last.team.map(t=>({...t,status:'pending'})), practice:null, recurrenceGroupId:groupId, recurrenceIndex:maxIndex+i+1, recurrenceFrequency:frequency }))
      setServices(prev => [...prev, ...newSvcs]); toast(`Added ${count} more`); return
    }
    const occurrences = newOnes.map(occ => ({
      title:occ.title, date:occ.date, time:occ.time, type:occ.type,
      notes:occ.notes||'', recurrence_index:occ.recurrenceIndex,
    }))
    const { error } = await supabase.rpc('generate_service_occurrences', {
      p_group_id:groupId,
      p_source_service_id:last.id,
      p_occurrences:occurrences,
    })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    toast(`Added ${count} more`); await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    return { success:true }
  }

  // ── SETLIST ─────────────────────────────────────────────
  const addToSetlist = async (serviceId, songId, key, notes) => {
    const svc = services.find(s => s.id===serviceId)
    const order = (svc?.setlist?.length||0)+1
    const song  = songs.find(s => s.id===songId)
    const item  = { id:'sl'+Date.now(), songId, key: key||song?.key, notes:notes||'', order, song }
    if (isDemoMode) {
      setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,setlist:[...s.setlist,item]}))
      setSongs(prev => prev.map(s => s.id===songId?{...s,usageCount:(s.usageCount||0)+1,lastUsed:fmt(new Date())}:s))
      toast('Song added'); return
    }
    const { error } = await supabase.from('setlist_items').insert({ service_id:serviceId, song_id:songId, key:key||song?.key, notes:notes||'', sort_order:order })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    toast('Song added'); await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    return { success:true }
  }

  const removeFromSetlist = async (serviceId, itemId) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,setlist:s.setlist.filter(i=>i.id!==itemId)})); return }
    const { error } = await supabase.from('setlist_items').delete().eq('id',itemId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,setlist:s.setlist.filter(i=>i.id!==itemId)}))
    return { success:true }
  }

  const reorderSetlist = async (serviceId, newSetlist) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,setlist:newSetlist})); return }
    const payload = newSetlist.map((item,idx) => ({ id:item.id, service_id:serviceId, song_id:item.songId, sort_order:idx+1, key:item.key, notes:item.notes||'' }))
    const { error } = await supabase.from('setlist_items').upsert(payload, { onConflict:'id' })
    if (error) { toast(error.message,'error'); return }
    setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,setlist:newSetlist.map((i,idx)=>({...i,order:idx+1}))}))
    return { success:true }
  }

  const updateSetlistBlocks = async (serviceId, setlistBlocks) => {
    if (isDemoMode) {
      setServices(prev => prev.map(service => service.id===serviceId ? { ...service, setlistBlocks } : service))
      return { success:true }
    }
    const { error } = await supabase.from('services').update({ setlist_blocks:setlistBlocks }).eq('id',serviceId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(service => service.id===serviceId ? { ...service, setlistBlocks } : service))
    return { success:true }
  }

  // ── TEAM ────────────────────────────────────────────────
  const addTeamMember = async (serviceId, personId, role) => {
    const person = people.find(p => p.id===personId)
    const entry  = { personId, role, status:'pending', person }
    if (isDemoMode) { setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:[...s.team,entry]})); toast('Added'); return { success:true } }
    const { error } = await supabase.from('service_team').insert({ service_id:serviceId, person_id:personId, role, status:'pending' })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:[...s.team,entry]})); toast('Added')
    return { success:true }
  }

  const updateTeamMemberStatus = async (serviceId, personId, status) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:s.team.map(t=>t.personId===personId?{...t,status}:t)})); return { success:true } }
    const { error } = personId===currentUser?.id
      ? await supabase.rpc('respond_to_service_assignment', { p_service_id:serviceId, p_status:status })
      : await supabase.from('service_team').update({ status }).eq('service_id',serviceId).eq('person_id',personId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:s.team.map(t=>t.personId===personId?{...t,status}:t)}))
    return { success:true }
  }

  const removeTeamMember = async (serviceId, personId) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:s.team.filter(t=>t.personId!==personId)})); return { success:true } }
    const { error } = await supabase.from('service_team').delete().eq('service_id',serviceId).eq('person_id',personId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id!==serviceId?s:{...s,team:s.team.filter(t=>t.personId!==personId)}))
    return { success:true }
  }

  // ── ANNOUNCEMENTS ───────────────────────────────────────
  const addAnnouncement = async (data) => {
    const ann = { ...data, id:'a'+Date.now(), author_id:currentUser.id, authorName:currentUser.name||currentUser.email, created_at:new Date().toISOString() }
    if (isDemoMode) { setAnnouncements(prev => [ann,...prev]); toast('Posted'); return }
    const { data:a, error } = await supabase.from('announcements').insert({ title:data.title, content:data.content, priority:data.priority||'normal', author_id:currentUser.id }).select('*, author:profiles(name)').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setAnnouncements(prev => [{...a, author:a.author_id, authorName:a.author?.name},...prev]); toast('Posted')
    return { success:true }
  }

  const deleteAnnouncement = async (id) => {
    if (isDemoMode) { setAnnouncements(prev => prev.filter(a => a.id!==id)); toast('Deleted','error'); return }
    const { error } = await supabase.from('announcements').delete().eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setAnnouncements(prev => prev.filter(a => a.id!==id)); toast('Deleted','error')
    return { success:true }
  }

  // ── PRACTICE ────────────────────────────────────────────
  const setPractice = async (serviceId, practice) => {
    if (isDemoMode) { setServices(prev => prev.map(s => s.id===serviceId?{...s,practice}:s)); toast(practice?.enabled?'Practice saved':'Practice removed'); return }
    const { error } = await supabase.from('services').update({ practice }).eq('id',serviceId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id===serviceId?{...s,practice}:s)); toast(practice?.enabled?'Practice saved':'Practice removed')
    return { success:true }
  }

  const updatePracticeAttendance = async (serviceId, personId, status) => {
    const svc = services.find(s => s.id===serviceId)
    const attendance = svc?.practice?.attendance || []
    const exists = attendance.find(a => a.personId===personId)
    const newAtt = exists ? attendance.map(a => a.personId===personId?{...a,status}:a) : [...attendance,{personId,status}]
    const newPractice = { ...svc.practice, attendance:newAtt }
    if (isDemoMode) { setServices(prev => prev.map(s => s.id===serviceId?{...s,practice:newPractice}:s)); toast('Updated'); return }
    const { error } = await supabase.from('services').update({ practice:newPractice }).eq('id',serviceId).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setServices(prev => prev.map(s => s.id===serviceId?{...s,practice:newPractice}:s)); toast('Updated')
    return { success:true }
  }

  // ── EVENTS & RSVP ───────────────────────────────────────
  const addEvent = async (data) => {
    const localEvent = { ...data, id:`evt_${Date.now()}`, created_by:currentUser.id, created_at:new Date().toISOString() }
    if (isDemoMode) { setEvents(prev => [localEvent, ...prev]); toast('Event created'); return { success:true, data:localEvent } }
    const payload = {
      title:data.titleEn||data.title, title_ar:data.title,
      description:data.descriptionEn||data.description||'', description_ar:data.description||'',
      date:data.date, end_date:data.endDate||null, time:data.time||'', location:data.location||'',
      type:data.type, status:data.status||'upcoming', created_by:currentUser.id,
    }
    const { data:event, error } = await supabase.from('events').insert(payload).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    const normalized = normalizeEvent(event)
    setEvents(prev => [normalized, ...prev]); toast('Event created'); return { success:true, data:normalized }
  }

  const updateEvent = async (id, data) => {
    if (isDemoMode) { setEvents(prev => prev.map(event => event.id===id ? { ...event, ...data } : event)); toast('Event updated'); return { success:true } }
    const payload = {
      title:data.titleEn||data.title, title_ar:data.title,
      description:data.descriptionEn||data.description||'', description_ar:data.description||'',
      date:data.date, end_date:data.endDate||null, time:data.time||'', location:data.location||'',
      type:data.type, status:data.status||'upcoming',
    }
    const { data:event, error } = await supabase.from('events').update(payload).eq('id',id).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    const normalized = normalizeEvent(event)
    setEvents(prev => prev.map(item => item.id===id ? normalized : item)); toast('Event updated'); return { success:true }
  }

  const deleteEvent = async (id) => {
    if (isDemoMode) {
      setEvents(prev => prev.map(event => event.id===id?{...event,status:'cancelled'}:event))
      toast('Event cancelled'); return { success:true }
    }
    const { error } = await supabase.from('events').update({ status:'cancelled' }).eq('id',id).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setEvents(prev => prev.map(event => event.id===id?{...event,status:'cancelled'}:event))
    toast('Event cancelled'); return { success:true }
  }

  const setEventResponse = async (eventId, response) => {
    if (!currentUser?.id) return { error:'You must be signed in.' }
    if (isDemoMode) {
      setEventResponses(prev => ({ ...prev, [eventId]:{ ...(prev[eventId]||{}), [currentUser.id]:response } }))
      return { success:true }
    }
    const { error } = await supabase.from('event_responses').upsert({ event_id:eventId, person_id:currentUser.id, response, responded_at:new Date().toISOString() }, { onConflict:'event_id,person_id' })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setEventResponses(prev => ({ ...prev, [eventId]:{ ...(prev[eventId]||{}), [currentUser.id]:response } }))
    return { success:true }
  }

  // ── ATTENDANCE ──────────────────────────────────────────
  const createAttendanceSession = async (form) => {
    const service = form.serviceId ? services.find(item => item.id===form.serviceId) : null
    const sessionDate = form.sessionDate || service?.date
    const sessionTime = form.sessionTime || service?.time || null
    const endTime = form.endTime || null
    if (!sessionDate || !sessionTime || !endTime) {
      const message = 'Session date, start time, and end time are required.'
      toast(message, 'error')
      return { error:message }
    }
    const scheduledEnd = sessionDate && endTime ? new Date(`${sessionDate}T${endTime}:00`) : null
    if (scheduledEnd && sessionTime && endTime <= sessionTime) scheduledEnd.setDate(scheduledEnd.getDate() + 1)
    const expiresAt = form.repeatable
      ? new Date(Date.now() + 90 * 86400000).toISOString()
      : scheduledEnd && !Number.isNaN(scheduledEnd.getTime())
        ? new Date(scheduledEnd.getTime() + 6 * 3600000).toISOString()
        : new Date(Date.now() + 86400000).toISOString()
    const localSession = {
      id:`sess_${Date.now()}`, name:form.name || service?.title || form.label,
      service_id:form.serviceId||null, service:service||null, label:form.label,
      session_date:sessionDate, session_time:sessionTime, end_time:endTime,
      max_attendees:form.maxAttendees?Number(form.maxAttendees):null,
      repeatable:Boolean(form.repeatable), repeat_freq:form.repeatable?(form.repeatFreq||'weekly'):null, qr_code:createSecureToken(12),
      active:true, expires_at:expiresAt, created_at:new Date().toISOString(), created_by:currentUser.id,
    }
    if (isDemoMode) {
      setAttendanceSessions(prev => [localSession, ...prev]); setAttendanceRecords(prev => ({ ...prev, [localSession.id]:[] }))
      toast('Attendance session created'); return { success:true, data:localSession }
    }
    const payload = {
      name:localSession.name, service_id:localSession.service_id, label:localSession.label,
      session_date:localSession.session_date, session_time:localSession.session_time, end_time:localSession.end_time,
      max_attendees:localSession.max_attendees,
      repeatable:localSession.repeatable, repeat_freq:localSession.repeat_freq,
      qr_code:localSession.qr_code, active:true, expires_at:localSession.expires_at,
      created_by:localSession.created_by,
    }
    const { data:session, error } = await supabase.from('attendance_sessions').insert(payload).select('*, service:services(*)').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    const normalized = normalizeAttendanceSession(session)
    setAttendanceSessions(prev => [normalized, ...prev]); setAttendanceRecords(prev => ({ ...prev, [normalized.id]:[] }))
    toast('Attendance session created'); return { success:true, data:normalized }
  }

  const closeAttendanceSession = async (sessionId) => {
    if (!isDemoMode) {
      const { error } = await supabase.from('attendance_sessions').update({ active:false }).eq('id',sessionId).select('id').single()
      if (error) { toast(error.message,'error'); return { error:error.message } }
    }
    setAttendanceSessions(prev => prev.map(session => session.id===sessionId ? { ...session, active:false } : session))
    toast('Attendance session closed'); return { success:true }
  }

  const deleteAttendanceSession = closeAttendanceSession

  const resolveAttendanceSession = useCallback(async (qrCode) => {
    if (!qrCode) return { error:'Missing attendance code.' }
    if (isDemoMode) {
      const session = attendanceSessions.find(item => item.qr_code===qrCode)
      if (!session || !session.active || (session.expires_at && new Date(session.expires_at) < new Date())) return { error:'This attendance link is invalid or expired.' }
      return { success:true, data:session }
    }
    const { data, error } = await supabase.rpc('get_attendance_session', { p_qr_code:qrCode })
    const session = Array.isArray(data) ? data[0] : data
    if (error || !session) return { error:error?.message || 'This attendance link is invalid or expired.' }
    return { success:true, data:normalizeAttendanceSession({ ...session, qr_code:qrCode }) }
  }, [attendanceSessions, isDemoMode])

  const checkInAttendance = async (qrCode) => {
    if (isDemoMode) {
      const sessionResult = await resolveAttendanceSession(qrCode)
      if (sessionResult.error) return sessionResult
      const session = sessionResult.data
      const occurrenceDate = attendanceOccurrenceDate(session, organizationSettings.timezone)
      const existing = (attendanceRecords[session.id]||[]).find(record => record.person_id===currentUser.id && record.occurrence_date===occurrenceDate)
      if (existing?.check_in_at) return { success:true, data:existing }
      if (session.max_attendees && (attendanceRecords[session.id]||[]).filter(record => record.occurrence_date===occurrenceDate && record.check_in_at).length>=session.max_attendees) return { error:'This attendance session is full.' }
      const record = { id:`rec_${Date.now()}`, session_id:session.id, person_id:currentUser.id, occurrence_date:occurrenceDate, check_in_at:new Date().toISOString(), check_out_at:null, status:'present' }
      record.status = attendanceTiming(record, session, organizationSettings.timezone, organizationSettings.attendanceLateMinutes).arrival === 'late' ? 'late' : 'present'
      setAttendanceRecords(prev => ({ ...prev, [session.id]:[...(prev[session.id]||[]),record] }))
      return { success:true, data:record }
    }
    const { data, error } = await supabase.rpc('check_in_attendance', { p_qr_code:qrCode })
    const record = Array.isArray(data) ? data[0] : data
    if (error || !record) { const message=error?.message||'Check-in failed.'; toast(message,'error'); return { error:message } }
    setAttendanceRecords(prev => ({ ...prev, [record.session_id]:[...(prev[record.session_id]||[]).filter(item => item.id!==record.id),record] }))
    return { success:true, data:record }
  }

  const checkOutAttendance = async (sessionId) => {
    if (isDemoMode) {
      const session = attendanceSessions.find(item => item.id===sessionId)
      const occurrenceDate = attendanceOccurrenceDate(session, organizationSettings.timezone)
      const existing = (attendanceRecords[sessionId]||[]).find(record => record.person_id===currentUser.id && record.occurrence_date===occurrenceDate)
      if (!existing) return { error:'Check-in record not found.' }
      const updated = { ...existing, check_out_at:new Date().toISOString() }
      setAttendanceRecords(prev => ({ ...prev, [sessionId]:(prev[sessionId]||[]).map(record => record.id===updated.id ? updated : record) }))
      return { success:true, data:updated }
    }
    const { data, error } = await supabase.rpc('check_out_attendance', { p_session_id:sessionId })
    const record = Array.isArray(data) ? data[0] : data
    if (error || !record) { const message=error?.message||'Check-out failed.'; toast(message,'error'); return { error:message } }
    setAttendanceRecords(prev => ({ ...prev, [sessionId]:(prev[sessionId]||[]).map(item => item.id===record.id ? record : item) }))
    return { success:true, data:record }
  }

  // ── MEMBER REQUESTS ─────────────────────────────────────
  const submitExcuse = async (serviceId, reason) => {
    if (!reason?.trim()) return { error:'A reason is required.' }
    const request = { id:`exc_${Date.now()}`, service_id:serviceId, person_id:currentUser.id, reason:reason.trim(), status:'pending', created_at:new Date().toISOString() }
    if (isDemoMode) {
      setExcuseRequests(prev => [request,...prev])
      const result = await updateTeamMemberStatus(serviceId,currentUser.id,'declined')
      if (result?.error) return result
    } else {
      const { data, error } = await supabase.rpc('submit_service_excuse', { p_service_id:serviceId, p_reason:reason.trim() })
      if (error) { toast(error.message,'error'); return { error:error.message } }
      const savedRequest = Array.isArray(data) ? data[0] : data
      setExcuseRequests(prev => [savedRequest,...prev])
      setServices(prev => prev.map(service => service.id!==serviceId ? service : {
        ...service,
        team:service.team.map(member => member.personId===currentUser.id ? { ...member, status:'declined' } : member),
      }))
    }
    toast('Excuse submitted'); return { success:true }
  }

  const requestSubstitute = async (serviceId, role, note='') => {
    if (!role) return { error:'Assignment role is required.' }
    const request = { id:`sub_${Date.now()}`, service_id:serviceId, requester_id:currentUser.id, substitute_id:null, role, note, status:'open', created_at:new Date().toISOString() }
    if (isDemoMode) setSubstituteRequests(prev => [request,...prev])
    else {
      const { data, error } = await supabase.from('substitute_requests').insert({ service_id:serviceId, requester_id:currentUser.id, role, note, status:'open' }).select().single()
      if (error) { toast(error.message,'error'); return { error:error.message } }
      setSubstituteRequests(prev => [data,...prev])
    }
    toast('Substitute request sent'); return { success:true }
  }

  const reviewExcuse = async (requestId, status) => {
    if (!['approved','rejected'].includes(status)) return { error:'Invalid excuse decision.' }
    if (isDemoMode) {
      const reviewedAt = new Date().toISOString()
      setExcuseRequests(prev => prev.map(request => request.id===requestId ? { ...request, status, reviewed_by:currentUser.id, reviewed_at:reviewedAt } : request))
      toast(`Excuse ${status}`); return { success:true }
    }
    const { data, error } = await supabase.from('excuses').update({ status }).eq('id',requestId).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setExcuseRequests(prev => prev.map(request => request.id===requestId ? data : request))
    toast(`Excuse ${status}`); return { success:true, data }
  }

  const cancelExcuse = async requestId => {
    if (isDemoMode) {
      setExcuseRequests(prev => prev.map(request => request.id===requestId ? { ...request, status:'cancelled' } : request))
      toast('Excuse cancelled'); return { success:true }
    }
    const { data, error } = await supabase.from('excuses').update({ status:'cancelled' }).eq('id',requestId).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setExcuseRequests(prev => prev.map(request => request.id===requestId ? data : request))
    toast('Excuse cancelled'); return { success:true, data }
  }

  const fillSubstituteRequest = async (requestId, substituteId) => {
    if (!substituteId) return { error:'Choose a substitute.' }
    if (isDemoMode) {
      const request = substituteRequests.find(item => item.id===requestId)
      const person = people.find(item => item.id===substituteId)
      if (!request || !person) return { error:'Request or substitute not found.' }
      setSubstituteRequests(prev => prev.map(item => item.id===requestId ? { ...item, substitute_id:substituteId, status:'filled', resolved_by:currentUser.id, resolved_at:new Date().toISOString() } : item))
      setServices(prev => prev.map(service => service.id!==request.service_id ? service : {
        ...service,
        team:[
          ...service.team.map(member => member.personId===request.requester_id ? { ...member, status:'declined' } : member),
          ...service.team.some(member => member.personId===substituteId) ? [] : [{ personId:substituteId, role:request.role, status:'pending', person }],
        ],
      }))
      toast('Substitute assigned'); return { success:true }
    }
    const { data, error } = await supabase.rpc('fill_substitute_request', { p_request_id:requestId, p_substitute_id:substituteId })
    if (error) { toast(error.message,'error'); return { error:error.message } }
    const savedRequest = Array.isArray(data) ? data[0] : data
    setSubstituteRequests(prev => prev.map(item => item.id===requestId ? savedRequest : item))
    await loadAll(Boolean(currentUser?.isAdmin || currentUser?.is_admin))
    toast('Substitute assigned'); return { success:true, data:savedRequest }
  }

  const cancelSubstituteRequest = async requestId => {
    if (isDemoMode) {
      setSubstituteRequests(prev => prev.map(item => item.id===requestId ? { ...item, status:'cancelled' } : item))
      toast('Request cancelled'); return { success:true }
    }
    const { data, error } = await supabase.from('substitute_requests').update({ status:'cancelled' }).eq('id',requestId).select().single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setSubstituteRequests(prev => prev.map(item => item.id===requestId ? data : item))
    toast('Request cancelled'); return { success:true, data }
  }

  // ── ORGANIZATION SETTINGS ───────────────────────────────
  const updateOrganizationSettings = async (settings) => {
    const next = { ...organizationSettings, ...settings, id:true }
    if (isDemoMode) { setOrganizationSettings(next); toast('Settings saved'); return { success:true } }
    const { error } = await supabase.from('organization_settings').update({
      name_ar:next.orgNameAr, name:next.orgNameEn,
      default_service_type:next.defaultService, timezone:next.timezone,
      attendance_late_minutes:Number(next.attendanceLateMinutes),
      excuse_limit:Number(next.excuseLimit), excuse_period:next.excusePeriod,
      notification_preferences:next.notificationPreferences,
      updated_by:currentUser.id, updated_at:new Date().toISOString(),
    }).eq('id',1).select('id').single()
    if (error) { toast(error.message,'error'); return { error:error.message } }
    setOrganizationSettings(next); toast('Settings saved'); return { success:true }
  }

  const value = {
    isDemoMode, configurationError, currentUser, authLoading, loading, isPasswordRecovery,
    people, songs, services, announcements, invitations, events, eventResponses,
    attendanceSessions, attendanceRecords, excuseRequests, substituteRequests,
    organizationSettings, notifications,
    ROLES, POSITIONS,
    login, logout, registerWithInvite, forgotPassword, updatePassword, finishPasswordRecovery, updateProfile,
    createInvitation, cancelInvitation,
    addPerson, updatePerson, deletePerson, updatePersonAvailability,
    addSong, updateSong, deleteSong,
    addService, updateService, updateRecurringService,
    deleteService, deleteRecurringService, generateMoreOccurrences,
    addToSetlist, removeFromSetlist, reorderSetlist, updateSetlistBlocks,
    addTeamMember, updateTeamMemberStatus, removeTeamMember,
    addAnnouncement, deleteAnnouncement,
    setPractice, updatePracticeAttendance,
    addEvent, updateEvent, deleteEvent, setEventResponse,
    createAttendanceSession, closeAttendanceSession, deleteAttendanceSession,
    resolveAttendanceSession, checkInAttendance, checkOutAttendance,
    submitExcuse, requestSubstitute, reviewExcuse, cancelExcuse, fillSubstituteRequest, cancelSubstituteRequest,
    updateOrganizationSettings,
    toast, loadAll,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useStore = () => useContext(AppContext)
