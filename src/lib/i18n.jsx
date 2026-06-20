import { createContext, useContext, useState, useEffect } from 'react'

export const T = {
  // ── Navigation ───────────────────────────────────────────
  dashboard:        { ar:'لوحة التحكم',          en:'Dashboard'              },
  home:             { ar:'الرئيسية',              en:'Home'                   },
  services:         { ar:'الخدمات',               en:'Services'               },
  songs:            { ar:'الترانيم',              en:'Songs'                  },
  people:           { ar:'الفريق',                en:'Team'                   },
  schedule:         { ar:'الجدول',                en:'Schedule'               },
  attendance:       { ar:'الحضور',                en:'Attendance'             },
  events:           { ar:'الفعاليات',             en:'Events'                 },
  reports:          { ar:'التقارير',              en:'Reports'                },
  announcements:    { ar:'الإعلانات',             en:'Announcements'          },
  settings:         { ar:'الإعدادات',             en:'Settings'               },
  profile:          { ar:'ملفي الشخصي',           en:'My Profile'             },
  invitations:      { ar:'الدعوات',               en:'Invitations'            },
  whatsappBulk:     { ar:'واتساب الجماعي',        en:'WhatsApp'               },

  // ── Common actions ───────────────────────────────────────
  save:             { ar:'حفظ',                   en:'Save'                   },
  cancel:           { ar:'إلغاء',                 en:'Cancel'                 },
  delete:           { ar:'حذف',                   en:'Delete'                 },
  edit:             { ar:'تعديل',                 en:'Edit'                   },
  add:              { ar:'إضافة',                 en:'Add'                    },
  create:           { ar:'إنشاء',                 en:'Create'                 },
  send:             { ar:'إرسال',                 en:'Send'                   },
  close:            { ar:'إغلاق',                 en:'Close'                  },
  back:             { ar:'عودة',                  en:'Back'                   },
  confirm:          { ar:'تأكيد',                 en:'Confirm'                },
  search:           { ar:'بحث',                   en:'Search'                 },
  print:            { ar:'طباعة',                 en:'Print'                  },
  export:           { ar:'تصدير',                 en:'Export'                 },
  signOut:          { ar:'تسجيل الخروج',          en:'Sign Out'               },
  saveChanges:      { ar:'حفظ التعديلات',         en:'Save Changes'           },
  viewAll:          { ar:'عرض الكل',              en:'View All'               },
  new:              { ar:'جديد',                  en:'New'                    },
  yes:              { ar:'نعم',                   en:'Yes'                    },
  no:               { ar:'لا',                    en:'No'                     },
  loading:          { ar:'جار التحميل...',         en:'Loading...'             },
  noData:           { ar:'لا توجد بيانات',         en:'No data'               },
  optional:         { ar:'اختياري',               en:'Optional'               },
  required:         { ar:'مطلوب',                  en:'Required'              },
  copy:             { ar:'نسخ',                   en:'Copy'                   },
  copied:           { ar:'تم النسخ',              en:'Copied'                 },
  open:             { ar:'فتح',                   en:'Open'                   },
  filter:           { ar:'تصفية',                 en:'Filter'                 },
  reset:            { ar:'إعادة ضبط',             en:'Reset'                  },
  apply:            { ar:'تطبيق',                 en:'Apply'                  },
  select:           { ar:'اختر',                  en:'Select'                 },
  selectAll:        { ar:'اختر الكل',             en:'Select All'             },
  deselectAll:      { ar:'إلغاء الكل',            en:'Deselect All'           },
  preview:          { ar:'معاينة',                en:'Preview'                },
  template:         { ar:'نموذج الرسالة',         en:'Message Template'       },
  recipients:       { ar:'المستلمون',             en:'Recipients'             },
  recipient:        { ar:'مستلم',                 en:'recipient'              },

  // ── Auth ─────────────────────────────────────────────────
  signIn:           { ar:'تسجيل الدخول',          en:'Sign In'                },
  email:            { ar:'البريد الإلكتروني',     en:'Email'                  },
  password:         { ar:'كلمة المرور',           en:'Password'               },
  name:             { ar:'الاسم',                  en:'Name'                  },

  // ── Dashboard ────────────────────────────────────────────
  welcomeBack:      { ar:'أهلاً بك 👋',           en:'Welcome back 👋'        },
  nextService:      { ar:'الخدمة القادمة',         en:'Next service'           },
  upcomingServices: { ar:'الخدمات القادمة',        en:'Upcoming Services'      },
  topSongs:         { ar:'أكثر الترانيم استخداماً',en:'Top Songs'              },
  nextTeam:         { ar:'فريق الخدمة القادمة',   en:'Next Team'              },
  noUpcoming:       { ar:'لا توجد خدمات قادمة',   en:'No upcoming services'   },
  quickLinks:       { ar:'روابط سريعة',            en:'Quick Links'            },

  // ── Services ─────────────────────────────────────────────
  newService:       { ar:'خدمة جديدة',             en:'New Service'            },
  createService:    { ar:'إنشاء خدمة',             en:'Create Service'         },
  serviceTitle:     { ar:'عنوان الخدمة',           en:'Service Title'          },
  serviceType:      { ar:'نوع الخدمة',             en:'Service Type'           },
  upcoming:         { ar:'القادمة',                en:'Upcoming'               },
  past:             { ar:'السابقة',                en:'Past'                   },
  all:              { ar:'الكل',                   en:'All'                    },
  scheduled:        { ar:'مجدولة',                 en:'Scheduled'              },
  completed:        { ar:'مكتملة',                 en:'Completed'              },
  cancelled:        { ar:'ملغاة',                  en:'Cancelled'              },
  draft:            { ar:'مسودة',                  en:'Draft'                  },
  repeat:           { ar:'تكرار هذه الخدمة',       en:'Repeat this service'    },
  createServices:   { ar:'إنشاء الخدمات',          en:'Create Services'        },
  notes:            { ar:'ملاحظات',                en:'Notes'                  },
  date:             { ar:'التاريخ',                en:'Date'                   },
  time:             { ar:'الوقت',                  en:'Time'                   },
  startDate:        { ar:'تاريخ البداية',          en:'Start Date'             },
  endDate:          { ar:'تاريخ النهاية',          en:'End Date'               },
  noServices:       { ar:'لا توجد خدمات',          en:'No services found'      },

  // ── Setlist ──────────────────────────────────────────────
  setlist:          { ar:'قائمة الترانيم',         en:'Setlist'                },
  addSong:          { ar:'إضافة ترنيمة',           en:'Add Song'               },
  noSongsYet:       { ar:'لا توجد ترانيم في القائمة بعد', en:'No songs in setlist yet' },
  addBlock:         { ar:'أضف بلوك',               en:'Add block'              },
  songs_label:      { ar:'ترنيمة',                 en:'song'                   },
  minutes:          { ar:'دقيقة',                  en:'min'                    },

  // ── Team ─────────────────────────────────────────────────
  team:             { ar:'الفريق',                 en:'Team'                   },
  teamDirectory:    { ar:'دليل الفريق',            en:'Team Directory'          },
  addMember:        { ar:'إضافة عضو',              en:'Add Member'             },
  inviteMember:     { ar:'دعوة عضو',               en:'Invite Member'          },
  noTeamYet:        { ar:'لا يوجد أعضاء في الفريق',en:'No team members'        },
  role:             { ar:'الدور',                  en:'Role'                   },
  confirmed:        { ar:'مؤكد',                   en:'Confirmed'              },
  pending:          { ar:'انتظار',                 en:'Pending'                },
  declined:         { ar:'معتذر',                  en:'Declined'               },
  findSub:          { ar:'طلب بديل',               en:'Find Sub'               },
  requestSub:       { ar:'طلب بديل',               en:'Request Substitute'     },
  availableSubs:    { ar:'البدائل المتاحة',         en:'Available Substitutes'  },
  noSubs:           { ar:'لا يوجد بدائل بنفس الدور',en:'No substitutes with same role' },
  active:           { ar:'نشط',                   en:'Active'                  },
  inactive:         { ar:'غير نشط',               en:'Inactive'               },
  onLeave:          { ar:'إجازة',                  en:'On Leave'               },
  allRoles:         { ar:'كل الأدوار',             en:'All Roles'              },
  position:         { ar:'المنصب',                 en:'Position'               },
  phone:            { ar:'الهاتف',                 en:'Phone'                  },
  whatsapp:         { ar:'واتساب',                 en:'WhatsApp'               },
  availability:     { ar:'التوفر',                 en:'Availability'           },
  noPeople:         { ar:'لا يوجد أعضاء',          en:'No members found'       },
  // Team sub-pages
  byRole:           { ar:'حسب الدور',              en:'By Role'                },
  byStatus:         { ar:'حسب الحالة',             en:'By Status'              },
  roster:           { ar:'قائمة الفريق',           en:'Roster'                 },
  availabilityView: { ar:'التوفر الأسبوعي',        en:'Weekly Availability'    },
  totalMembers:     { ar:'إجمالي الأعضاء',         en:'Total Members'          },
  activeMembers:    { ar:'الأعضاء النشطون',        en:'Active Members'          },
  noMembersRole:    { ar:'لا يوجد أعضاء في هذا الدور',en:'No members in this role'},

  // ── Practice ─────────────────────────────────────────────
  practice:         { ar:'البروفة',                en:'Practice'               },
  schedulePractice: { ar:'جدولة بروفة',            en:'Schedule Practice'      },
  editPractice:     { ar:'تعديل البروفة',          en:'Edit Practice'          },
  noPractice:       { ar:'لا توجد بروفة مجدولة',  en:'No practice scheduled'   },
  location:         { ar:'المكان',                 en:'Location'               },
  practiceNotes:    { ar:'ملاحظات البروفة',        en:'Practice Notes'         },
  attending:        { ar:'حضور',                   en:'Attending'              },
  absent:           { ar:'غياب',                   en:'Absent'                 },
  maybe:            { ar:'ربما',                   en:'Maybe'                  },
  attendanceRecord: { ar:'سجل الحضور',             en:'Attendance Record'      },

  // ── Songs page ───────────────────────────────────────────
  songLibrary:      { ar:'مكتبة الترانيم',         en:'Song Library'           },
  newSong:          { ar:'إضافة ترنيمة',           en:'Add Song'               },
  arabicTitle:      { ar:'العنوان بالعربي',         en:'Arabic Title'           },
  englishTitle:     { ar:'العنوان بالإنجليزي',      en:'English Title'          },
  author:           { ar:'المؤلف',                 en:'Author'                 },
  key:              { ar:'الطبقة',                 en:'Key'                    },
  bpm:              { ar:'الإيقاع',                en:'BPM'                    },
  timeSig:          { ar:'الميزان',                en:'Time Sig'               },
  language:         { ar:'اللغة',                  en:'Language'               },
  structure:        { ar:'هيكل الترنيمة',          en:'Song Structure'         },
  allKeys:          { ar:'كل الطبقات',             en:'All Keys'               },
  arabic:           { ar:'عربي',                   en:'Arabic'                 },
  english:          { ar:'إنجليزي',                en:'English'                },
  both:             { ar:'الاثنان',                en:'Both'                   },
  noSongs:          { ar:'لا توجد ترانيم',         en:'No songs found'         },
  ccli:             { ar:'رقم CCLI',               en:'CCLI Number'            },
  usageCount:       { ar:'الاستخدام',              en:'Usage'                  },
  songTitleNote:    { ar:'العناوين بالعربي هي الأساس',en:'Song titles are in Arabic (primary)' },

  // ── Attendance ───────────────────────────────────────────
  newSession:       { ar:'جلسة جديدة',             en:'New Session'            },
  sessions:         { ar:'الجلسات',                en:'Sessions'               },
  records:          { ar:'السجلات',                en:'Records'                },
  checkIn:          { ar:'تسجيل الحضور',           en:'Check In'               },
  checkOut:         { ar:'تسجيل المغادرة',         en:'Check Out'              },
  history:          { ar:'سجلي',                   en:'History'                },
  onTime:           { ar:'في الوقت',               en:'On Time'                },
  late:             { ar:'متأخر',                  en:'Late'                   },
  acceptable:       { ar:'مقبول',                  en:'Acceptable'             },
  noSessions:       { ar:'لا توجد جلسات',          en:'No sessions yet'        },
  createSession:    { ar:'إنشاء جلسة',             en:'Create Session'         },
  sessionType:      { ar:'نوع الجلسة',             en:'Session Type'           },
  startTime:        { ar:'وقت البداية',             en:'Start Time'             },
  createAndQR:      { ar:'إنشاء وعرض QR',          en:'Create & Show QR'       },
  scanToCheckIn:    { ar:'امسح لتسجيل الحضور',     en:'Scan to check in'       },
  noActiveSessions: { ar:'لا توجد جلسات نشطة',     en:'No active sessions'     },
  attendanceReport: { ar:'تقرير الحضور',            en:'Attendance Report'      },

  // ── Events ───────────────────────────────────────────────
  newEvent:         { ar:'فعالية جديدة',            en:'New Event'             },
  eventTitle:       { ar:'عنوان الفعالية',          en:'Event Title'           },
  eventType:        { ar:'نوع الفعالية',            en:'Event Type'            },
  description:      { ar:'الوصف',                  en:'Description'            },
  willYouAttend:    { ar:'هل ستحضر؟',              en:'Will you attend?'       },
  noEvents:         { ar:'لا توجد فعاليات',         en:'No events yet'         },
  responses:        { ar:'ردود الأعضاء',            en:'Responses'              },
  deleteEvent:      { ar:'حذف الفعالية',            en:'Delete Event'          },

  // ── Announcements ────────────────────────────────────────
  newAnnouncement:  { ar:'إعلان جديد',              en:'New Announcement'      },
  post:             { ar:'نشر',                     en:'Post'                   },
  priority:         { ar:'الأولوية',                en:'Priority'              },
  urgent:           { ar:'عاجل',                   en:'Urgent'                 },
  normal:           { ar:'عادي',                   en:'Normal'                 },
  low:              { ar:'منخفض',                  en:'Low'                    },
  noAnnouncements:  { ar:'لا توجد إعلانات',         en:'No announcements yet'  },
  message:          { ar:'الرسالة',                 en:'Message'                },
  title:            { ar:'العنوان',                 en:'Title'                  },

  // ── WhatsApp Bulk ────────────────────────────────────────
  notifyTeam:       { ar:'إشعار الفريق',            en:'Notify Team'           },
  sendAll:          { ar:'إرسال للكل',              en:'Send to All'            },
  sent:             { ar:'تم',                      en:'Sent'                   },
  noPhone:          { ar:'لا يوجد رقم',             en:'No number'             },
  messagePreview:   { ar:'معاينة الرسالة',          en:'Message Preview'        },
  haveNumber:       { ar:'لديهم رقم',               en:'have a number'          },
  bulkWhatsApp:     { ar:'رسائل واتساب جماعية',     en:'Bulk WhatsApp Messages' },
  bulkSubtitle:     { ar:'أرسل تذكيرات لفريقك بضغطة واحدة', en:'Send reminders to your team in one click' },
  selectService:    { ar:'اختر الخدمة',             en:'Select Service'         },
  noServiceFilter:  { ar:'بدون خدمة محددة',         en:'No specific service'    },
  filterBy:         { ar:'تصفية حسب',               en:'Filter by'              },
  allMembers:       { ar:'كل الأعضاء',              en:'All Members'            },
  serviceTeamOnly:  { ar:'فريق الخدمة فقط',         en:'Service Team Only'      },
  byRoleFilter:     { ar:'حسب الدور',               en:'By Role'                },
  customSelect:     { ar:'اختيار يدوي',             en:'Custom Select'          },
  messageTemplate:  { ar:'نموذج الرسالة',           en:'Message Template'       },
  templateHelp:     { ar:'استخدم {name} للاسم، {service} للخدمة، {date} للتاريخ، {time} للوقت',
                      en:'Use {name} for name, {service} for service, {date} for date, {time} for time' },
  openAll:          { ar:'فتح كل المحادثات',        en:'Open All Chats'         },
  openAllConfirm:   { ar:'سيتم فتح محادثة لكل مستلم بالترتيب. جاهز؟', en:'A chat will open for each recipient in order. Ready?' },
  selectedCount:    { ar:'مختار',                  en:'selected'               },
  withPhone:        { ar:'لديهم رقم',              en:'with phone'             },
  noRecipients:     { ar:'لا يوجد مستلمون',        en:'No recipients selected' },
  sendIndividual:   { ar:'إرسال فردي',             en:'Send individually'      },
  bulkSendDone:     { ar:'تم فتح جميع المحادثات!', en:'All chats opened!'      },
  whatsappNote:     { ar:'سيتم فتح تطبيق واتساب لكل رسالة على حدة', en:'WhatsApp will open for each message individually' },

  // ── Profile ──────────────────────────────────────────────
  myInfo:           { ar:'معلوماتي',               en:'My Info'                },
  security:         { ar:'الأمان',                 en:'Security'               },
  myServices:       { ar:'خدماتي',                 en:'My Services'            },
  weeklyAvail:      { ar:'التوفر الأسبوعي',        en:'Weekly Availability'    },
  changePassword:   { ar:'تغيير كلمة المرور',      en:'Change Password'        },
  newPassword:      { ar:'كلمة المرور الجديدة',    en:'New Password'           },
  confirmPassword:  { ar:'تأكيد كلمة المرور',      en:'Confirm Password'       },
  updatePassword:   { ar:'تحديث كلمة المرور',      en:'Update Password'        },
  availableDays:    { ar:'أيام التوفر',             en:'Available Days'         },
  fullName:         { ar:'الاسم الكامل',           en:'Full Name'              },

  // ── Settings ─────────────────────────────────────────────
  orgSettings:      { ar:'إعدادات المؤسسة',        en:'Organization Settings'  },
  orgName:          { ar:'اسم الكنيسة',            en:'Church Name'            },
  timezone:         { ar:'المنطقة الزمنية',        en:'Timezone'               },
  defaultService:   { ar:'نوع الخدمة الافتراضي',   en:'Default Service Type'   },
  notifications:    { ar:'الإشعارات',              en:'Notifications'           },
  dataBackup:       { ar:'البيانات والنسخ الاحتياطية',en:'Data & Backup'        },
  exportBackup:     { ar:'تصدير نسخة احتياطية JSON',en:'Export JSON Backup'    },
  aboutPlatform:    { ar:'حول المنصة',             en:'About Platform'         },
  version:          { ar:'الإصدار',                en:'Version'                },
  database:         { ar:'قاعدة البيانات',         en:'Database'               },
  currentUser:      { ar:'المستخدم الحالي',        en:'Current User'           },

  // ── Reports ──────────────────────────────────────────────
  overview:         { ar:'نظرة عامة',              en:'Overview'               },
  confirmRate:      { ar:'نسبة التأكيد',           en:'Confirmation Rate'      },
  practiceRate:     { ar:'نسبة حضور البروفة',      en:'Practice Rate'          },
  declineRate:      { ar:'نسبة الاعتذارات',        en:'Decline Rate'           },
  pendingResponses: { ar:'ردود معلقة',             en:'Pending Responses'      },
  mostUsedSongs:    { ar:'أكثر الترانيم استخداماً',en:'Most Used Songs'         },
  servicesPerMonth: { ar:'الخدمات شهرياً',          en:'Services Per Month'     },
  teamByRole:       { ar:'الفريق حسب الدور',       en:'Team by Role'           },
  mostActive:       { ar:'الأعضاء الأكثر نشاطاً', en:'Most Active Members'    },
  serviceHistory:   { ar:'سجل الخدمات',            en:'Service History'        },
  servicesByType:   { ar:'الخدمات حسب النوع',      en:'Services by Type'       },
  practiceStats:    { ar:'إحصائيات البروفة',       en:'Practice Stats'         },
  setlistStats:     { ar:'إحصائيات قوائم الترانيم',en:'Setlist Stats'          },
  avgSongs:         { ar:'متوسط الترانيم',          en:'Avg songs'              },
  totalSlots:       { ar:'إجمالي مواضع الترانيم',  en:'Total song slots'       },
  avgTeamSize:      { ar:'متوسط حجم الفريق',       en:'Avg team size'          },

  // ── Days ─────────────────────────────────────────────────
  sun: { ar:'الأحد',    en:'Sun' }, mon: { ar:'الاثنين',  en:'Mon' },
  tue: { ar:'الثلاثاء', en:'Tue' }, wed: { ar:'الأربعاء', en:'Wed' },
  thu: { ar:'الخميس',   en:'Thu' }, fri: { ar:'الجمعة',   en:'Fri' },
  sat: { ar:'السبت',    en:'Sat' },

  // ── Misc ─────────────────────────────────────────────────
  months:       { ar:'أشهر',    en:'months'   },
  membersLabel: { ar:'أعضاء',   en:'Members'  },
  songsLabel:   { ar:'ترانيم',  en:'Songs'    },
  servicesLabel:{ ar:'خدمات',   en:'Services' },
  postsLabel:   { ar:'إعلانات', en:'Posts'    },
  times:        { ar:'مرة',     en:'times'    },
  of:           { ar:'من',      en:'of'       },
  at:           { ar:'الساعة',  en:'at'       },
  and:          { ar:'و',       en:'and'      },
  adminPlatform:{ ar:'منصة المسؤول',  en:'Admin Platform'  },
  teamPlatform: { ar:'منصة الفريق',   en:'Team Platform'   },
}

// ── Language Context ────────────────────────────────────────
const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('kdec_lang') || 'ar')

  useEffect(() => {
    localStorage.setItem('kdec_lang', lang)
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  // t(key) → always returns the correct language string
  const t = (key) => {
    if (!T[key]) return key
    return T[key][lang] ?? T[key].ar ?? key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, isAr: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
