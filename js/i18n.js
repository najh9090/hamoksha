// English + colloquial Arabic strings and language switching.

const dict = {
  en: {
    tagline: 'Learn smarter. A curious cat is on your side.',
    heroText: 'Ask questions, practise with an AI teaching assistant, and join live classes with your teacher.',
    login: 'Log in',
    signup: 'Sign up',
    logout: 'Log out',
    email: 'Email',
    password: 'Password',
    name: 'Your name',
    iAm: 'I am a',
    student: 'Student',
    teacher: 'Teacher',
    teacherCode: 'Teacher code (if your school gave you one)',
    createAccount: 'Create account',
    checkEmail: 'Account created. Check your email to confirm it, then log in.',
    badCode: 'That teacher code is not valid.',
    configMissing: 'Setup needed: add your Supabase URL and anon key in js/config.js.',
    chats: 'Chats',
    subjects: 'Subjects',
    general: 'General chat',
    math: 'Mathematics',
    languages: 'Languages',
    programming: 'Programming',
    science: 'Science',
    liveClasses: 'Live classes',
    teacherDashboard: 'Teacher dashboard',
    recent: 'Recent chats',
    newChat: 'New chat',
    newChatTitle: 'New chat',
    typeMessage: 'Write your message',
    send: 'Send',
    thinking: 'HAMOKSHA is thinking',
    aiError: 'HAMOKSHA could not answer right now. Please try again.',
    you: 'You',
    teacherLabel: 'Teacher',
    emptyChat: 'Say hello. HAMOKSHA is listening.',
    emptyRooms: 'No chats yet.',
    welcome: 'Welcome',
    // teacher
    studentChats: 'Student chats',
    allSubjects: 'All subjects',
    pickRoom: 'Select a student chat to watch it and join in.',
    monitoring: 'Monitoring',
    teacherReplyHint: 'You are in this chat as the teacher. The student will see your messages.',
    noStudentChats: 'No student chats yet.',
    startClass: 'Start a class',
    classTitle: 'Class title',
    start: 'Start',
    myClasses: 'My live classes',
    rejoin: 'Open',
    endClass: 'End',
    noClasses: 'No live classes right now.',
    join: 'Join',
    hostedBy: 'Hosted by',
    // meeting
    mic: 'Mic',
    cam: 'Camera',
    leave: 'Leave',
    endForAll: 'End class',
    mediaError: 'Could not access camera or microphone. Check browser permissions.',
    waitingStudents: 'Waiting for students to join.',
    connecting: 'Connecting to the teacher',
    classEnded: 'The class has ended.',
    peerError: 'Connection problem. Please try again.',
    // generic
    loading: 'Loading',
    error: 'Something went wrong.',
    language: 'Language',
  },
  ar: {
    tagline: 'تعلّم صح، وحموكشا معاك.',
    heroText: 'اسأل، تمرّن مع مساعد تعليمي ذكي، وادخل حصص مباشرة مع معلمك.',
    login: 'سجّل دخول',
    signup: 'سوّ حساب',
    logout: 'اطلع',
    email: 'الإيميل',
    password: 'كلمة السر',
    name: 'اسمك',
    iAm: 'أنا',
    student: 'طالب',
    teacher: 'معلم',
    teacherCode: 'كود المعلم (إذا عطتك المدرسة واحد)',
    createAccount: 'سوّ الحساب',
    checkEmail: 'انسوّى الحساب. شيّك على إيميلك وأكّده، وبعدين سجّل دخول.',
    badCode: 'كود المعلم مو صحيح.',
    configMissing: 'لازم تكمّل الإعداد: حط رابط Supabase والمفتاح في js/config.js.',
    chats: 'المحادثات',
    subjects: 'المواد',
    general: 'سوالف عامة',
    math: 'الرياضيات',
    languages: 'اللغات',
    programming: 'البرمجة',
    science: 'العلوم',
    liveClasses: 'الحصص المباشرة',
    teacherDashboard: 'لوحة المعلم',
    recent: 'آخر المحادثات',
    newChat: 'محادثة جديدة',
    newChatTitle: 'محادثة جديدة',
    typeMessage: 'اكتب رسالتك',
    send: 'أرسل',
    thinking: 'حموكشا يفكّر',
    aiError: 'حموكشا ما قدر يرد الحين. جرّب مرة ثانية.',
    you: 'أنت',
    teacherLabel: 'المعلم',
    emptyChat: 'قول هلا. حموكشا يسمعك.',
    emptyRooms: 'ما عندك محادثات للحين.',
    welcome: 'هلا',
    studentChats: 'محادثات الطلاب',
    allSubjects: 'كل المواد',
    pickRoom: 'اختار محادثة طالب عشان تتابعها وتدخل معاه.',
    monitoring: 'متابعة',
    teacherReplyHint: 'أنت داخل المحادثة كمعلم. الطالب بيشوف رسايلك.',
    noStudentChats: 'ما فيه محادثات طلاب للحين.',
    startClass: 'ابدأ حصة',
    classTitle: 'عنوان الحصة',
    start: 'ابدأ',
    myClasses: 'حصصي المباشرة',
    rejoin: 'افتح',
    endClass: 'أنهي',
    noClasses: 'ما فيه حصص مباشرة الحين.',
    join: 'ادخل',
    hostedBy: 'مع',
    mic: 'المايك',
    cam: 'الكاميرا',
    leave: 'اطلع',
    endForAll: 'أنهي الحصة',
    mediaError: 'ما قدرنا نوصل للكاميرا أو المايك. شيّك على صلاحيات المتصفح.',
    waitingStudents: 'ننتظر الطلاب يدخلون.',
    connecting: 'نتصل بالمعلم',
    classEnded: 'خلصت الحصة.',
    peerError: 'فيه مشكلة في الاتصال. جرّب مرة ثانية.',
    loading: 'لحظة',
    error: 'صار خطأ.',
    language: 'اللغة',
  },
};

let lang = 'en';
try {
  const saved = localStorage.getItem('hmk_lang');
  lang = saved === 'ar' || saved === 'en' ? saved : (navigator.language || '').startsWith('ar') ? 'ar' : 'en';
} catch (_) {}

export const getLang = () => lang;

export function t(key) {
  return (dict[lang] && dict[lang][key]) ?? dict.en[key] ?? key;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach((n) => (n.placeholder = t(n.dataset.i18nPlaceholder)));
  root.querySelectorAll('[data-i18n-title]').forEach((n) => (n.title = t(n.dataset.i18nTitle)));
}

export function initLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  applyI18n();
}

export function setLang(next) {
  lang = next === 'ar' ? 'ar' : 'en';
  try { localStorage.setItem('hmk_lang', lang); } catch (_) {}
  initLang();
  window.dispatchEvent(new Event('langchange'));
}
