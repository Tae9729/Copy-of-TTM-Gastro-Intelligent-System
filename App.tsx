import React, { useState, useEffect, useMemo } from 'react';
import { PatientData, Step, Doctor, Appointment, AuthUser, UserRole, Availability, PatientProfile } from './types';
import { TTMAIService } from './geminiService';
import { 
  Bot, AlertTriangle, Info, RefreshCw, Stethoscope, 
  ChevronRight, ClipboardList, UserCircle, Activity,
  FileText, Download, Check,
  Calendar, Clock, LogOut, Settings, Users, Briefcase, Plus, Trash2, Edit2, X, UserPlus, HeartPulse, Save, 
  CheckCircle2, XCircle, UserCheck, UserX, Search, Sparkles, Timer
} from 'lucide-react';

const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc1',
    name: 'พท.ป. กิตติพงษ์ วัฒนศิริ',
    specialty: 'เชี่ยวชาญด้านเส้นประธานสิบ และโรคระบบทางเดินอาหาร',
    image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
    availability: [
      { date: '2025-05-20', slots: ['09:00', '10:30', '13:00'] },
      { date: '2025-05-21', slots: ['14:30', '16:00'] }
    ]
  }
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const App: React.FC = () => {
  // Persistence using LocalStorage
  const [registeredUsers, setRegisteredUsers] = useState<AuthUser[]>(() => {
    const saved = localStorage.getItem('ttm_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    const saved = localStorage.getItem('ttm_doctors');
    return saved ? JSON.parse(saved) : INITIAL_DOCTORS;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('ttm_appointments');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginRole, setLoginRole] = useState<UserRole>('patient');
  const [currentStep, setCurrentStep] = useState<Step>(Step.LOGIN);
  
  // Registration States
  const [regData, setRegData] = useState({
    name: '', email: '', birthDate: '', chronicDisease: '', allergies: ''
  });

  const [subStep, setSubStep] = useState(0);
  const [patientData, setPatientData] = useState<PatientData>({
    name: '', age: '', gender: '', weather: '', timeOfDay: '',
    mainSymptom: '', painLocation: '', sensation: '', redFlags: []
  });
  
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [aiService] = useState(() => new TTMAIService());
  
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [isEditingDoctor, setIsEditingDoctor] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Partial<Doctor> | null>(null);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [doctorSelectedDate, setDoctorSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isConfirmingSchedule, setIsConfirmingSchedule] = useState(false);

  // New features states
  const [isCreatingFollowup, setIsCreatingFollowup] = useState(false);
  const [followupPatientId, setFollowupPatientId] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupSlot, setFollowupSlot] = useState('');

  // Generate the next 5 days for doctor scheduling
  const availableDoctorDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const thaiDay = d.toLocaleDateString('th-TH', { weekday: 'short' });
      const thaiDateNum = d.getDate();
      const thaiMonth = d.toLocaleDateString('th-TH', { month: 'short' });
      const thaiYear = (d.getFullYear() + 543).toString().slice(-2);
      dates.push({ iso, display: `${thaiDay} ${thaiDateNum} ${thaiMonth} ${thaiYear}` });
    }
    return dates;
  }, []);

  // Sync with LocalStorage
  useEffect(() => { localStorage.setItem('ttm_users', JSON.stringify(registeredUsers)); }, [registeredUsers]);
  useEffect(() => { localStorage.setItem('ttm_doctors', JSON.stringify(doctors)); }, [doctors]);
  useEffect(() => { localStorage.setItem('ttm_appointments', JSON.stringify(appointments)); }, [appointments]);

  const questions = [
    { id: 'gender', label: 'เพศ', type: 'choice', options: ['ชาย', 'หญิง', 'อื่นๆ'], step: Step.PROFILE },
    { id: 'weather', label: 'สภาพอากาศปัจจุบัน', type: 'choice', options: ['อากาศร้อน (คิมหันตฤดู)', 'ฝนตก/ชื้น (วสันตฤดู)', 'อากาศเย็น/หนาว (เหมันตฤดู)'], step: Step.SAMUTTHAN },
    { id: 'timeOfDay', label: 'ช่วงเวลาที่เริ่มมีอาการ', type: 'choice', options: ['06:00-10:00 น.', '10:00-14:00 น.', '14:00-18:00 น.', '18:00-22:00 น.', 'หลัง 22:00 น.'], step: Step.SAMUTTHAN },
    { id: 'mainSymptom', label: 'อาการหลักที่รู้สึก', type: 'choice', options: ['ท้องอืด/แน่นท้อง', 'แสบร้อนกลางอก', 'ปวดเกร็ง/มวนท้อง', 'ท้องผูกเรื้อรัง', 'คลื่นไส้/อาเจียน'], step: Step.SYMPTOMS },
    { id: 'painLocation', label: 'ตำแหน่งที่รู้สึกชัดเจนที่สุด', type: 'choice', options: ['เหนือสะดือ (ลิ้นปี่)', 'รอบสะดือ', 'ท้องน้อย', 'ร้าวไปแผ่นหลัง', 'ทั่วบริเวณท้อง'], step: Step.SYMPTOMS },
    { id: 'sensation', label: 'ลักษณะความรู้สึก', type: 'choice', options: ['เหมือนมีลมดันขึ้น', 'ร้อนผ่าวเหมือนไฟเผา', 'ปวดบีบเป็นพักๆ', 'หนักท้อง/ตื้อๆ', 'ปวดเสียวแปล๊บ'], step: Step.SYMPTOMS },
    { id: 'redFlags', label: 'สัญญาณอันตราย (กรุณาระบุหากมี)', type: 'multichoice', options: ['ไม่มีอาการรุนแรง', 'อาเจียนเป็นเลือด', 'ถ่ายอุจจาระสีดำ', 'มีไข้สูงร่วมด้วย', 'น้ำหนักลดฮวบ'], step: Step.RED_FLAGS },
  ];

  const currentQuestion = questions[subStep];

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getThaiVaya = (age: number) => {
    if (age <= 16) return `${age} ปี (ปฐมวัย - ธาตุน้ำ)`;
    if (age <= 32) return `${age} ปี (มัชฌิมวัย - ธาตุไฟ)`;
    return `${age} ปี (ปัจฉิมวัย - ธาตุลม)`;
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('th-TH', { month: 'long' });
    const yearBE = date.getFullYear() + 543;
    const dayOfWeek = date.toLocaleString('th-TH', { weekday: 'long' });
    return `${dayOfWeek}ที่ ${day} ${month} พ.ศ. ${yearBE}`;
  };

  const handleLogin = () => {
    if (loginRole === 'patient') {
      const user = registeredUsers.find(u => u.email === regData.email);
      if (user) {
        setCurrentUser(user);
        setCurrentStep(Step.DASHBOARD);
      } else {
        alert('ไม่พบข้อมูลอีเมลนี้ในระบบสมาชิก กรุณาสมัครสมาชิกก่อน');
      }
    } else if (loginRole === 'doctor') {
      const doc = doctors.find(d => d.id === 'doc1');
      if (doc) {
        setCurrentUser({ id: doc.id, name: doc.name, role: 'doctor', email: 'doctor@ttm.com' });
        setCurrentStep(Step.DASHBOARD);
      }
    } else {
      setCurrentUser({ id: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', email: 'admin@ttm.com' });
      setCurrentStep(Step.DASHBOARD);
    }
  };

  const handleRegister = () => {
    if (!regData.name || !regData.email || !regData.birthDate) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }
    const newUser: AuthUser = {
      id: 'u_' + Date.now(),
      name: regData.name,
      role: 'patient',
      email: regData.email,
      profile: {
        birthDate: regData.birthDate,
        initialElement: 'กำลังคำนวณ...',
        chronicDisease: regData.chronicDisease || 'ไม่มี',
        allergies: regData.allergies || 'ไม่มี'
      }
    };
    setRegisteredUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    setCurrentStep(Step.DASHBOARD);
    alert('สมัครสมาชิกสำเร็จ!');
  };

  const handleAnswer = (answer: string | string[]) => {
    const q = questions[subStep];
    const newData = { ...patientData };
    if (q.id === 'redFlags') {
      newData.redFlags = Array.isArray(answer) ? answer : [answer];
    } else {
      (newData as any)[q.id] = answer as string;
    }
    setPatientData(newData);

    if (subStep < questions.length - 1) {
      setSubStep(subStep + 1);
      setSelectedMulti([]);
    } else {
      const ageNum = calculateAge(currentUser?.profile?.birthDate || '');
      newData.age = getThaiVaya(ageNum);
      setPatientData(newData);
      setCurrentStep(Step.ANALYSIS);
      processAnalysis(newData);
    }
  };

  const processAnalysis = async (data: PatientData) => {
    setIsLoading(true);
    setQuotaExceeded(false);
    
    const profileInfo = currentUser?.profile ? `
    ข้อมูลทะเบียนประวัติคนไข้:
    - วันเกิด: ${currentUser.profile.birthDate} (อายุ ${calculateAge(currentUser.profile.birthDate)} ปี)
    - วัยตามหลัก TTM: ${getThaiVaya(calculateAge(currentUser.profile.birthDate))}
    - โรคประจำตัว: ${currentUser.profile.chronicDisease}
    - ประวัติแพ้ยา/สมุนไพร: ${currentUser.profile.allergies}
    ` : '';

    const prompt = `วิเคราะห์ข้อมูลคนไข้: ${currentUser?.name || data.name}, ${data.age}, อาการ: ${data.mainSymptom}. 
    ${profileInfo}
    โปรดวิเคราะห์ความสัมพันธ์ระหว่างวัย ธาตุเจ้าเรือน และอาการปัจจุบันตามหลัก TTM (เส้นประธานสิบ) สร้างรายงานเป็น [ส่วนที่ 1: สำหรับคนไข้] และ [ส่วนที่ 2: สำหรับแพทย์]`;
    
    const result = await aiService.sendMessage(prompt);
    
    if (result === "ERROR_QUOTA") {
      setQuotaExceeded(true);
      setIsLoading(false);
    } else {
      setReport(result);
      setIsLoading(false);
    }
  };

  const toggleDoctorSlot = (slot: string) => {
    if (!currentUser || currentUser.role !== 'doctor') return;
    setDoctors(prev => prev.map(doc => {
      if (doc.id !== currentUser.id) return doc;
      const newAvail = [...doc.availability];
      const dayIdx = newAvail.findIndex(a => a.date === doctorSelectedDate);
      
      if (dayIdx >= 0) {
        const slots = newAvail[dayIdx].slots.includes(slot) 
          ? newAvail[dayIdx].slots.filter(s => s !== slot) 
          : [...newAvail[dayIdx].slots, slot].sort();
        
        if (slots.length === 0) {
          newAvail.splice(dayIdx, 1);
        } else {
          newAvail[dayIdx] = { ...newAvail[dayIdx], slots };
        }
      } else {
        newAvail.push({ date: doctorSelectedDate, slots: [slot] });
      }
      
      return { ...doc, availability: newAvail.sort((a,b) => a.date.localeCompare(b.date)) };
    }));
  };

  const applyShiftTemplate = (type: 'morning' | 'afternoon' | 'full' | 'clear') => {
    if (!currentUser || currentUser.role !== 'doctor') return;
    
    let slots: string[] = [];
    if (type === 'morning') slots = ['08:00', '09:00', '10:00', '11:00', '12:00'];
    else if (type === 'afternoon') slots = ['13:00', '14:00', '15:00', '16:00', '17:00'];
    else if (type === 'full') slots = [...TIME_SLOTS];
    else if (type === 'clear') slots = [];

    setDoctors(prev => prev.map(doc => {
      if (doc.id !== currentUser.id) return doc;
      const newAvail = [...doc.availability];
      const dayIdx = newAvail.findIndex(a => a.date === doctorSelectedDate);
      
      if (dayIdx >= 0) {
        if (slots.length === 0) newAvail.splice(dayIdx, 1);
        else newAvail[dayIdx] = { ...newAvail[dayIdx], slots };
      } else if (slots.length > 0) {
        newAvail.push({ date: doctorSelectedDate, slots });
      }
      
      return { ...doc, availability: newAvail.sort((a,b) => a.date.localeCompare(b.date)) };
    }));
  };

  const handleSaveDoctor = () => {
    if (!editingDoctor?.name) {
      alert('กรุณากรอกชื่อแพทย์');
      return;
    }
    const docData: Doctor = {
      id: editingDoctor.id || 'doc_' + Date.now(),
      name: editingDoctor.name || '',
      specialty: editingDoctor.specialty || '',
      image: editingDoctor.image || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
      availability: editingDoctor.availability || []
    };

    if (editingDoctor.id) {
      setDoctors(prev => prev.map(d => d.id === editingDoctor.id ? docData : d));
    } else {
      setDoctors(prev => [...prev, docData]);
    }
    setIsEditingDoctor(false);
    setEditingDoctor(null);
  };

  const handleConfirmDeleteDoctor = () => {
    if (!doctorToDelete) return;
    setDoctors(prev => prev.filter(x => x.id !== doctorToDelete.id));
    setDoctorToDelete(null);
    alert('ลบข้อมูลแพทย์สำเร็จ');
  };

  const handleConfirmBooking = () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !currentUser) {
      alert('กรุณาเลือกข้อมูลให้ครบถ้วน');
      return;
    }
    const newAppt: Appointment = {
      id: 'ap_' + Date.now(),
      patientId: currentUser.id,
      patientName: currentUser.name,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      date: selectedDate,
      time: selectedSlot,
      status: 'pending',
      report: report || undefined
    };
    setAppointments(prev => [...prev, newAppt]);
    setCurrentStep(Step.DASHBOARD);
    alert('ส่งคำขอนัดหมายสำเร็จ!');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentStep(Step.LOGIN);
    setSubStep(0);
    setReport(null);
    setRegData({ name: '', email: '', birthDate: '', chronicDisease: '', allergies: '' });
  };

  const handleConfirmSchedule = () => {
    setIsConfirmingSchedule(true);
    setTimeout(() => {
      setIsConfirmingSchedule(false);
      alert('ยืนยันตารางเวลาว่างสำเร็จ!');
    }, 800);
  };

  // New features handlers
  const handleAcceptAppointment = (apptId: string) => {
    setAppointments(prev => prev.map(a => 
      a.id === apptId ? { ...a, status: 'confirmed' } : a
    ));
    alert('ยืนยันการรับนัดหมายสำเร็จ!');
  };

  const handleUpdateAttendance = (apptId: string, attendance: 'attended' | 'missed') => {
    setAppointments(prev => prev.map(a => 
      a.id === apptId ? { ...a, attendance, status: 'completed' } : a
    ));
    alert(attendance === 'attended' ? 'บันทึก: มาตามนัด' : 'บันทึก: ไม่มาตามนัด');
  };

  const handleCreateDoctorAppointment = () => {
    if (!followupPatientId || !followupDate || !followupSlot || !currentUser) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const patient = registeredUsers.find(u => u.id === followupPatientId);
    if (!patient) return;

    const newAppt: Appointment = {
      id: 'ap_' + Date.now(),
      patientId: patient.id,
      patientName: patient.name,
      doctorId: currentUser.id,
      doctorName: currentUser.name,
      date: followupDate,
      time: followupSlot,
      status: 'requested_by_doctor',
    };
    setAppointments(prev => [...prev, newAppt]);
    setIsCreatingFollowup(false);
    alert('ส่งคำขอนัดหมายติดตามอาการให้คนไข้แล้ว');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Custom Confirmation Modal for Doctor Deletion */}
      {doctorToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 shadow-inner ring-8 ring-rose-50/50">
                <AlertTriangle className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">ยืนยันการลบข้อมูล?</h3>
                <p className="text-slate-500 font-medium">คุณกำลังจะลบข้อมูลของ <span className="text-rose-600 font-black underline">{doctorToDelete.name}</span> ออกจากระบบอย่างถาวร</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-4">
                <button 
                  onClick={() => setDoctorToDelete(null)}
                  className="py-5 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" /> ยกเลิก
                </button>
                <button 
                  onClick={handleConfirmDeleteDoctor}
                  className="py-5 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> ยืนยันการลบ
                </button>
              </div>
              <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">การดำเนินการนี้ไม่สามารถย้อนคืนได้</p>
            </div>
          </div>
        </div>
      )}

      {/* Quota Exceeded Error Modal */}
      {quotaExceeded && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-amber-900/40 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-lg rounded-[4rem] p-12 shadow-2xl border-4 border-amber-100 animate-in slide-in-from-bottom-12 duration-500">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="w-28 h-28 bg-amber-50 rounded-[3rem] flex items-center justify-center text-amber-500 shadow-inner ring-12 ring-amber-50/30">
                <Timer className="w-16 h-16 animate-pulse" />
              </div>
              <div className="space-y-4">
                <h3 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">ถึงขีดจำกัดการใช้งานชั่วคราว</h3>
                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                  ระบบคัดกรองอัจฉริยะ (AI) กำลังประมวลผลข้อมูลคนไข้จำนวนมากในขณะนี้ กรุณารอประมาณ <span className="text-amber-600 font-black">60 วินาที</span> เพื่อให้ระบบรีเซ็ตโควต้าการวิเคราะห์ฟรี
                </p>
              </div>
              <div className="flex flex-col gap-4 w-full pt-6">
                <button 
                  onClick={() => processAnalysis(patientData)}
                  className="w-full py-6 bg-amber-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-amber-200 hover:bg-amber-700 active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <RefreshCw className="w-7 h-7" /> ลองใหม่อีกครั้ง
                </button>
                <button 
                  onClick={() => { setQuotaExceeded(false); setCurrentStep(Step.DASHBOARD); }}
                  className="w-full py-5 text-slate-400 font-black text-sm uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                >
                  กลับสู่หน้าแดชบอร์ด
                </button>
              </div>
              <div className="bg-amber-50 px-6 py-3 rounded-full border border-amber-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] text-amber-700 font-black uppercase tracking-widest">Resource Exhausted (429 Error)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Area */}
      <div className="print-only p-12 bg-white text-slate-900 text-sm">
        <div className="border-b-4 border-emerald-800 pb-8 mb-10 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-800 p-3 rounded-2xl">
              <Stethoscope className="text-white w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-emerald-800 tracking-tighter">รายงานเวชระเบียนแผนไทยอิเล็กทรอนิกส์</h1>
              <p className="text-slate-500 font-bold uppercase tracking-[0.1em] text-[10px] mt-1">TTM Gastro-Intelligent Screening System (v6.2)</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-base text-slate-800">{formatThaiDate(new Date().toISOString())}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Report ID: {Date.now()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
            <h2 className="font-black text-emerald-700 border-b border-emerald-100 mb-4 pb-2 text-lg uppercase tracking-tight">ทะเบียนข้อมูลผู้รับบริการ</h2>
            <div className="space-y-2 text-xs">
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">ชื่อ-นามสกุล:</span> <span className="font-bold text-slate-800">{currentUser?.name || patientData.name}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">รหัสสมาชิก:</span> <span className="font-bold text-slate-800">{currentUser?.id || 'GUEST-ID'}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">อายุ/ช่วงวัย:</span> <span className="font-bold text-slate-800">{patientData.age || 'ไม่ได้ระบุ'}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">โรคประจำตัว:</span> <span className="font-bold text-slate-800">{currentUser?.profile?.chronicDisease || 'ไม่มี'}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">ประวัติแพ้ยา:</span> <span className="font-bold text-rose-600">{currentUser?.profile?.allergies || 'ไม่มี'}</span></p>
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
            <h2 className="font-black text-emerald-700 border-b border-emerald-100 mb-4 pb-2 text-lg uppercase tracking-tight">ข้อมูลสมุฏฐานขณะคัดกรอง</h2>
            <div className="space-y-2 text-xs">
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">ฤดูกาล:</span> <span className="font-bold text-slate-800">{patientData.weather}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">กาล (เวลา):</span> <span className="font-bold text-slate-800">{patientData.timeOfDay}</span></p>
              <p><span className="text-slate-400 font-bold uppercase w-24 inline-block">อาการหลัก:</span> <span className="font-bold text-slate-800">{patientData.mainSymptom}</span></p>
            </div>
          </div>
        </div>

        <div className="mb-10 p-10 border-2 border-emerald-100 rounded-[3rem] bg-emerald-50/10 min-h-[400px]">
           <h2 className="font-black text-emerald-800 text-xl mb-6 flex items-center gap-2">
             <FileText className="w-6 h-6" /> ผลการวิเคราะห์และข้อแนะนำทางการแพทย์แผนไทย
           </h2>
           <div className="whitespace-pre-wrap leading-relaxed text-slate-800 text-base font-medium font-sarabun">
             {report || "ไม่พบข้อมูลรายงาน"}
           </div>
        </div>
      </div>

      <header className="no-print bg-emerald-800 text-white px-6 shadow-2xl flex items-center justify-between sticky top-0 z-50 h-[80px]">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-xl group hover:rotate-12 transition-all cursor-pointer">
            <Stethoscope className="text-emerald-800 w-8 h-8" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-2xl font-black leading-tight tracking-tighter">TTM Intelligence</h1>
            <p className="text-[10px] text-emerald-200 uppercase tracking-[0.3em] font-black opacity-90">Thai Traditional Medicine (GI)</p>
          </div>
        </div>
        {currentUser && (
          <div className="flex items-center gap-6">
            <div className="text-right flex flex-col items-end">
              <p className="text-lg font-black leading-none tracking-tight">{currentUser.name}</p>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-[9px] px-2 py-0.5 bg-white/20 text-white rounded font-black uppercase tracking-widest">{currentUser.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="p-3 bg-emerald-700 hover:bg-emerald-600 rounded-2xl transition-all shadow-xl active:scale-90 border border-emerald-600/50"><LogOut className="w-6 h-6" /></button>
          </div>
        )}
      </header>

      <main className="no-print flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          {currentStep === Step.LOGIN && renderLogin()}
          {currentStep === Step.REGISTER && renderRegister()}
          {currentStep === Step.DASHBOARD && (
            <>
              {currentUser?.role === 'patient' && renderPatientDashboard()}
              {currentUser?.role === 'doctor' && renderDoctorDashboard()}
              {currentUser?.role === 'admin' && renderAdminDashboard()}
            </>
          )}

          {/* Questionnaire Views */}
          {(currentStep === Step.PROFILE || currentStep === Step.SAMUTTHAN || currentStep === Step.SYMPTOMS || currentStep === Step.RED_FLAGS) && !isLoading && (
            <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500 max-w-2xl mx-auto">
              <div className="text-center space-y-3">
                <div className="inline-block px-6 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black mb-4 uppercase tracking-[0.2em] shadow-sm ring-4 ring-emerald-50">ส่วนที่ {subStep + 1} จาก {questions.length}</div>
                <h2 className="text-5xl font-black text-slate-800 leading-none tracking-tighter">{currentQuestion.label}</h2>
                <p className="text-slate-400 text-sm font-black italic mt-2 uppercase tracking-widest opacity-60">โปรโตคอลการคัดกรองอาการ</p>
              </div>
              <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600"></div>
                {currentQuestion.type === 'choice' && (
                  <div className="grid grid-cols-1 gap-4">
                    {currentQuestion.options?.map((opt, i) => (
                      <button key={i} onClick={() => handleAnswer(opt)} className="w-full text-left p-8 rounded-[2rem] border-2 border-slate-50 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all font-black text-xl text-slate-600 flex justify-between items-center group">
                        {opt} <ChevronRight className="w-8 h-8 text-slate-200 group-hover:text-emerald-500 transition-all group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                )}
                {currentQuestion.type === 'multichoice' && (
                  <div className="space-y-10">
                    <div className="grid grid-cols-1 gap-4">
                      {currentQuestion.options?.map((opt, i) => (
                        <button key={i} onClick={() => {
                          const newSel = selectedMulti.includes(opt) ? selectedMulti.filter(x => x !== opt) : [...selectedMulti, opt];
                          setSelectedMulti(newSel);
                        }} className={`w-full text-left p-8 rounded-[2rem] border-2 transition-all flex items-center justify-between ${selectedMulti.includes(opt) ? 'border-emerald-600 bg-emerald-50 shadow-2xl shadow-emerald-500/10' : 'border-slate-50 bg-slate-50 hover:bg-white'}`}>
                          <span className={`font-black text-xl ${selectedMulti.includes(opt) ? 'text-emerald-800' : 'text-slate-500'}`}>{opt}</span>
                          <div className={`w-10 h-10 rounded-2xl border-4 flex items-center justify-center transition-all ${selectedMulti.includes(opt) ? 'bg-emerald-600 border-emerald-600 shadow-xl shadow-emerald-300' : 'border-slate-200 bg-white'}`}>{selectedMulti.includes(opt) && <Check className="w-6 h-6 text-white" />}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => handleAnswer(selectedMulti.length > 0 ? selectedMulti : ['ไม่มีอาการรุนแรง'])} className="w-full py-8 rounded-[2.5rem] font-black text-2xl bg-emerald-600 text-white shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-30" disabled={selectedMulti.length === 0}>วิเคราะห์ข้อมูลเบื้องต้น</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === Step.ANALYSIS && report && (
            <div className="animate-in zoom-in-95 duration-500 space-y-10 pb-20 max-w-4xl mx-auto">
              <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-emerald-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12 scale-150">
                  <FileText className="w-64 h-64 text-emerald-800" />
                </div>
                <div className="border-b-4 border-slate-50 pb-8 mb-12">
                  <h2 className="text-4xl font-black text-emerald-800 flex items-center gap-5 tracking-tighter"><FileText className="w-12 h-12" /> รายงานการคัดกรองอัจฉริยะ</h2>
                  <p className="text-sm text-slate-400 mt-2 font-black italic uppercase tracking-[0.2em] opacity-60">Thai Traditional Medicine Analytics</p>
                </div>
                <div className="prose prose-emerald max-w-none text-slate-700 leading-relaxed space-y-8">
                  {report.split('\n').map((line, i) => (
                    <p key={i} className={`${line.includes('[') ? 'font-black text-3xl text-emerald-800 mt-16 mb-6 border-l-[12px] border-emerald-600 pl-8 leading-none' : 'text-xl font-medium opacity-90 font-sarabun'}`}>{line}</p>
                  ))}
                </div>
                <div className="mt-20 pt-12 border-t-4 border-slate-50 flex flex-wrap gap-6 no-print">
                  <button onClick={() => window.print()} className="flex-1 bg-emerald-800 text-white py-6 px-10 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 hover:bg-emerald-900 shadow-2xl shadow-emerald-200 transition-all active:scale-95">
                    <Download className="w-7 h-7" /> บันทึกรายงาน PDF
                  </button>
                  <button onClick={() => setCurrentStep(Step.BOOKING)} className="flex-1 bg-white border-4 border-emerald-800 text-emerald-800 py-6 px-10 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 hover:bg-emerald-50 transition-all active:scale-95">
                    <Calendar className="w-7 h-7" /> นัดหมายพบแพทย์แผนไทย
                  </button>
                  <button onClick={() => setCurrentStep(Step.DASHBOARD)} className="w-full text-slate-400 font-black py-4 text-sm hover:text-slate-600 transition-colors uppercase tracking-[0.3em] mt-4">กลับหน้าหลักแดชบอร์ด</button>
                </div>
              </div>
            </div>
          )}

          {currentStep === Step.BOOKING && renderBookingView()}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-48 space-y-12 animate-in fade-in duration-700">
              <div className="relative">
                <div className="w-40 h-40 border-[12px] border-emerald-50 border-t-emerald-600 rounded-full animate-spin shadow-2xl" />
                <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600 w-16 h-16 animate-bounce" />
              </div>
              <div className="text-center space-y-6">
                <h3 className="text-4xl font-black text-emerald-800 animate-pulse tracking-tighter">AI กำลังวิเคราะห์อาการเชิงลึก...</h3>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="no-print p-6 bg-white border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-300 font-black uppercase tracking-[0.3em] h-[64px]">
        <span className="flex items-center gap-3"><Info className="w-4 h-4 text-emerald-600 opacity-30" /> Traditional Thai Medicine Gastro-Intelligent System</span>
        <div className="bg-slate-50 text-slate-400 px-5 py-1.5 rounded-full border border-slate-100">RELEASE v6.6 (QUOTA HANDLED)</div>
      </footer>
    </div>
  );

  // Helper functions for UI views

  function renderLogin() {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-emerald-100 rounded-[2rem] flex items-center justify-center text-emerald-700 mx-auto mb-6 shadow-inner ring-4 ring-emerald-50">
            <UserCircle className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">เข้าสู่ระบบ</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">TTM Intelligent Health System</p>
        </div>

        <div className="space-y-6">
          <div className="flex bg-slate-100 p-2 rounded-2xl gap-2">
            {(['patient', 'doctor', 'admin'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setLoginRole(role)}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  loginRole === role ? 'bg-white text-emerald-800 shadow-lg' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {role === 'patient' ? 'คนไข้' : role === 'doctor' ? 'แพทย์' : 'แอดมิน'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">อีเมลผู้ใช้งาน</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold"
                value={regData.email}
                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full py-5 bg-emerald-800 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-900 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              ยืนยันการเข้าใช้งาน <ChevronRight className="w-5 h-5" />
            </button>
            {loginRole === 'patient' && (
              <button
                onClick={() => setCurrentStep(Step.REGISTER)}
                className="w-full py-4 text-emerald-600 font-black text-sm uppercase tracking-widest hover:text-emerald-800 transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> ยังไม่มีบัญชี? สมัครสมาชิก
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderRegister() {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-12 bg-white rounded-[4rem] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-8 duration-500">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-black text-slate-800 tracking-tighter">ลงทะเบียนสมาชิก</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-3">ระบบคัดกรองโรคทางเดินอาหาร (TTM)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">ชื่อ-นามสกุล</label>
            <input
              type="text"
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold"
              value={regData.name}
              onChange={(e) => setRegData({ ...regData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">อีเมล</label>
            <input
              type="email"
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold"
              value={regData.email}
              onChange={(e) => setRegData({ ...regData, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">วัน/เดือน/ปี เกิด</label>
            <input
              type="date"
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold"
              value={regData.birthDate}
              onChange={(e) => setRegData({ ...regData, birthDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">โรคประจำตัว</label>
            <input
              type="text"
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold"
              value={regData.chronicDisease}
              onChange={(e) => setRegData({ ...regData, chronicDisease: e.target.value })}
              placeholder="ถ้าไม่มีให้ระบุ - "
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-2">ประวัติการแพ้ยา/สมุนไพร</label>
            <textarea
              className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold min-h-[100px]"
              value={regData.allergies}
              onChange={(e) => setRegData({ ...regData, allergies: e.target.value })}
              placeholder="ถ้าไม่มีให้ระบุ - "
            />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4">
          <button
            onClick={handleRegister}
            className="w-full py-6 bg-emerald-800 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-100 hover:bg-emerald-900 transition-all active:scale-95"
          >
            สร้างบัญชีผู้ใช้งาน
          </button>
          <button
            onClick={() => setCurrentStep(Step.LOGIN)}
            className="text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            ย้อนกลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  function renderBookingView() {
    return (
      <div className="animate-in slide-in-from-right duration-500 space-y-10 max-w-2xl mx-auto pb-20">
        <div className="text-center mb-10">
          <h2 className="text-5xl font-black text-slate-800 tracking-tighter leading-none">นัดหมายพบแพทย์</h2>
          <p className="text-slate-400 mt-4 font-black italic uppercase tracking-[0.2em] text-xs">Expert TTM Consultation Booking</p>
        </div>

        <div className="space-y-6">
          {doctors.map(doc => (
            <div 
              key={doc.id}
              onClick={() => { setSelectedDoctor(doc); setSelectedDate(''); setSelectedSlot(null); }}
              className={`cursor-pointer p-8 rounded-[3rem] border-4 transition-all flex gap-8 items-center ${
                selectedDoctor?.id === doc.id ? 'border-emerald-500 bg-emerald-50 shadow-2xl scale-[1.02] ring-8 ring-emerald-50' : 'border-slate-50 bg-white hover:border-slate-100'
              }`}
            >
              <img src={doc.image} className="w-24 h-24 rounded-[2rem] object-cover shadow-2xl ring-4 ring-white" alt="" />
              <div className="flex-1">
                 <h3 className="font-black text-slate-800 text-2xl tracking-tight">{doc.name}</h3>
                 <p className="text-xs text-emerald-600 font-black uppercase tracking-widest mt-2 bg-emerald-100/50 inline-block px-4 py-1.5 rounded-full">{doc.specialty}</p>
              </div>
            </div>
          ))}
        </div>

        {selectedDoctor && (
          <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-50 animate-in fade-in slide-in-from-bottom-8 space-y-12">
            <div className="space-y-6">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
                <Calendar className="w-5 h-5 text-emerald-600" /> 1. เลือกวันที่ที่คุณสะดวก
              </label>
              <div className="flex flex-wrap gap-3">
                {selectedDoctor.availability.map(avail => (
                  <button
                    key={avail.date}
                    onClick={() => { setSelectedDate(avail.date); setSelectedSlot(null); }}
                    className={`py-4 px-8 rounded-2xl border-2 font-black text-sm transition-all ${
                      selectedDate === avail.date ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xl shadow-emerald-200' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-600 shadow-sm'
                    }`}
                  >
                    {formatThaiDate(avail.date).split('ที่')[1].trim()}
                  </button>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3 ml-2">
                  <Clock className="w-5 h-5 text-emerald-600" /> 2. เลือกช่วงเวลาเข้าตรวจที่ว่าง
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {selectedDoctor.availability.find(a => a.date === selectedDate)?.slots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-5 px-4 rounded-2xl border-4 font-black text-xl transition-all ${
                        selectedSlot === slot ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xl shadow-emerald-300' : 'border-slate-50 bg-slate-50 text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {slot} น.
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={handleConfirmBooking}
              disabled={!selectedSlot}
              className="w-full mt-12 py-8 rounded-[2.5rem] font-black text-2xl transition-all flex items-center justify-center gap-4 bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xl active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
            >
              ส่งคำขอนัดหมาย <Check className="w-8 h-8" />
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderPatientDashboard() {
    const myAppointments = appointments.filter(a => a.patientId === currentUser?.id);
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.05] pointer-events-none scale-150"><Activity className="w-64 h-64 text-emerald-800" /></div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-700 shadow-inner">
              <HeartPulse className="w-12 h-12 animate-pulse" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-800 tracking-tighter leading-tight">ยินดีต้อนรับคุณ {currentUser?.name}</h2>
              <div className="flex flex-wrap gap-3 mt-3">
                <span className="text-[10px] px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-black uppercase tracking-[0.1em] border border-emerald-200">ทะเบียน ID: {currentUser?.id}</span>
                {currentUser?.profile && (
                  <span className="text-[10px] px-3 py-1 bg-slate-800 text-white rounded-lg font-black uppercase tracking-[0.1em] shadow-lg">
                    วัย: {getThaiVaya(calculateAge(currentUser.profile.birthDate))}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => { setCurrentStep(Step.PROFILE); setSubStep(0); }} className="w-full md:w-auto bg-emerald-600 text-white px-10 py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 hover:bg-emerald-700 shadow-2xl transition-all active:scale-[0.98]">
            <Activity className="w-7 h-7" /> เริ่มประเมินอาการตอนนี้
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 text-xl"><Calendar className="w-6 h-6 text-emerald-600" /> นัดหมายและการแจ้งเตือน</h3>
            {myAppointments.length === 0 ? (
               <div className="py-20 text-center text-slate-300 italic font-bold border-4 border-dashed border-slate-50 rounded-[2.5rem]">ท่านยังไม่มีรายการนัดหมาย</div>
            ) : (
              <div className="space-y-4">
                {myAppointments.map(appt => (
                  <div key={appt.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-black text-xl text-slate-800">{appt.doctorName}</p>
                        <p className="text-[11px] text-slate-500 font-black mt-1 uppercase tracking-wider">{formatThaiDate(appt.date)} | {appt.time} น.</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest text-white ${
                          appt.status === 'confirmed' ? 'bg-emerald-600' : 
                          appt.status === 'requested_by_doctor' ? 'bg-amber-500 animate-pulse' : 
                          appt.status === 'completed' ? 'bg-slate-500' : 'bg-blue-600'
                        }`}>
                          {appt.status === 'requested_by_doctor' ? 'หมอนัดติดตามอาการ' : appt.status}
                        </span>
                        {appt.attendance && (
                          <span className={`text-[8px] font-black uppercase ${appt.attendance === 'attended' ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {appt.attendance === 'attended' ? '✓ มาตามนัด' : '✗ ไม่มาตามนัด'}
                          </span>
                        )}
                      </div>
                    </div>
                    {appt.status === 'requested_by_doctor' && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-3 font-medium">แพทย์ต้องการนัดหมายคุณเพื่อติดตามอาการ กรุณายืนยันการตอบรับ</p>
                        <button 
                          onClick={() => handleAcceptAppointment(appt.id)}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md"
                        >
                          <CheckCircle2 className="w-4 h-4" /> ยืนยันรับนัดหมาย
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 text-xl"><ClipboardList className="w-6 h-6 text-emerald-600" /> ข้อมูลทะเบียนประวัติ</h3>
            <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4 border border-slate-100 shadow-inner">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400 font-black uppercase tracking-widest">วันเกิด:</span>
                 <span className="text-slate-700 font-black">{currentUser?.profile?.birthDate}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400 font-black uppercase tracking-widest">โรคประจำตัว:</span>
                 <span className="text-slate-700 font-black">{currentUser?.profile?.chronicDisease || 'ไม่มี'}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-400 font-black uppercase tracking-widest">ประวัติแพ้:</span>
                 <span className="text-rose-500 font-black">{currentUser?.profile?.allergies || 'ไม่มี'}</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDoctorDashboard() {
    const myDoc = doctors.find(d => d.id === currentUser?.id);
    const currentAvailability = myDoc?.availability.find(a => a.date === doctorSelectedDate);
    const myAppointments = appointments.filter(a => a.doctorId === currentUser?.id);

    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col md:flex-row items-center gap-8">
          <img src={myDoc?.image} className="w-32 h-32 rounded-[2.5rem] border-4 border-emerald-50 object-cover shadow-2xl" alt="Doctor" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{myDoc?.name}</h2>
            <p className="text-xs text-emerald-600 font-black uppercase tracking-[0.2em] mt-2 bg-emerald-50 inline-block px-4 py-1.5 rounded-full">{myDoc?.specialty}</p>
          </div>
          <button 
            onClick={() => setIsCreatingFollowup(true)}
            className="bg-emerald-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-emerald-900 shadow-xl shadow-emerald-100 transition-all active:scale-95"
          >
            <UserPlus className="w-5 h-5" /> นัดหมายติดตามอาการ
          </button>
        </div>

        {isCreatingFollowup && (
          <div className="bg-white p-10 rounded-[3rem] border-4 border-emerald-100 shadow-2xl space-y-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800">นัดหมายคนไข้ล่วงหน้า</h3>
              <button onClick={() => setIsCreatingFollowup(false)}><X className="text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. เลือกคนไข้</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-emerald-500"
                  value={followupPatientId}
                  onChange={(e) => setFollowupPatientId(e.target.value)}
                >
                  <option value="">เลือกชื่อคนไข้...</option>
                  {registeredUsers.filter(u => u.role === 'patient').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. วันที่นัด</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-emerald-500"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                >
                  <option value="">เลือกวันที่...</option>
                  {availableDoctorDates.map(d => (
                    <option key={d.iso} value={d.iso}>{d.display}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. เวลาที่นัด</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-emerald-500"
                  value={followupSlot}
                  onChange={(e) => setFollowupSlot(e.target.value)}
                >
                  <option value="">เลือกเวลา...</option>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s} น.</option>)}
                </select>
              </div>
            </div>
            <button 
              onClick={handleCreateDoctorAppointment}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 shadow-xl transition-all"
            >
              ส่งคำขอนัดหมายให้คนไข้
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 text-xl"><Users className="w-6 h-6 text-emerald-600" /> นัดหมายและการเข้าตรวจ</h3>
            <div className="space-y-4">
              {myAppointments.length === 0 ? (
                <div className="py-24 text-center text-slate-300 flex flex-col items-center gap-4">
                  <Activity className="w-16 h-16 opacity-10 animate-pulse" />
                  <p className="text-lg italic font-bold">ยังไม่มีรายการนัดหมาย</p>
                </div>
              ) : (
                myAppointments.sort((a,b) => b.id.localeCompare(a.id)).map(appt => (
                  <div key={appt.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:bg-white hover:shadow-2xl transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-black text-xl text-slate-800">{appt.patientName}</p>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase text-white ${
                          appt.status === 'confirmed' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}>{appt.status}</span>
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatThaiDate(appt.date)}</p>
                        <p className="text-[11px] text-emerald-600 font-black uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> {appt.time} น.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {appt.attendance ? (
                        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black text-xs border-2 ${
                          appt.attendance === 'attended' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {appt.attendance === 'attended' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          {appt.attendance === 'attended' ? 'มาตามนัดแล้ว' : 'ไม่มาตามนัด'}
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleUpdateAttendance(appt.id, 'attended')}
                            className="flex-1 sm:flex-none px-4 py-3 bg-white border-2 border-emerald-100 text-emerald-600 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          >
                            <UserCheck className="w-4 h-4" /> มาตามนัด
                          </button>
                          <button 
                            onClick={() => handleUpdateAttendance(appt.id, 'missed')}
                            className="flex-1 sm:flex-none px-4 py-3 bg-white border-2 border-rose-100 text-rose-500 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                          >
                            <UserX className="w-4 h-4" /> ไม่มาตามนัด
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => { if (appt.report) { setReport(appt.report); setCurrentStep(Step.ANALYSIS); } }}
                        className="w-full sm:w-auto px-4 py-3 bg-emerald-800 text-white rounded-xl font-black text-xs hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-100"
                      >
                        วิเคราะห์อาการ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-10">
            <div>
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-xl mb-4"><Clock className="w-6 h-6 text-emerald-600" /> ควบคุมตารางเข้าตรวจ</h3>
              <p className="text-xs text-slate-400 font-bold mb-6 italic uppercase tracking-wider">เลือกวันที่และช่วงเวลาเพื่อเปิดรับการนัดหมาย</p>
            </div>

            {/* Custom 5-Day Navigator */}
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">1. เลือกวันที่เข้าตรวจ (พ.ศ. {new Date().getFullYear() + 543})</label>
               <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar">
                  {availableDoctorDates.map(d => (
                    <button
                      key={d.iso}
                      onClick={() => setDoctorSelectedDate(d.iso)}
                      className={`min-w-[100px] p-4 rounded-2xl border-4 transition-all flex flex-col items-center gap-1 ${
                        doctorSelectedDate === d.iso 
                        ? 'bg-emerald-800 border-emerald-600 text-white shadow-xl scale-105' 
                        : 'bg-slate-50 border-slate-50 text-slate-400 hover:border-slate-100'
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase opacity-60">{d.display.split(' ')[0]}</span>
                      <span className="text-xl font-black">{d.display.split(' ')[1]}</span>
                      <span className="text-[9px] font-bold">{d.display.split(' ')[2]} {d.display.split(' ')[3]}</span>
                    </button>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest">2. กำหนดช่วงเวลาว่าง</label>
                  <button onClick={() => applyShiftTemplate('clear')} className="text-[9px] text-rose-400 hover:text-rose-600 font-black uppercase tracking-widest underline decoration-2 underline-offset-4 transition-colors">Clear All Slots</button>
               </div>

               {/* Shift Templates */}
               <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => applyShiftTemplate('morning')} className="px-4 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-full text-[10px] font-black border border-slate-200 hover:border-emerald-200 transition-all">08:00 - 12:00 (เช้า)</button>
                  <button onClick={() => applyShiftTemplate('afternoon')} className="px-4 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-full text-[10px] font-black border border-slate-200 hover:border-emerald-200 transition-all">13:00 - 17:00 (บ่าย)</button>
                  <button onClick={() => applyShiftTemplate('full')} className="px-4 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-full text-[10px] font-black border border-slate-200 hover:border-emerald-200 transition-all">All Day</button>
               </div>

               <div className="grid grid-cols-2 gap-3">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    onClick={() => toggleDoctorSlot(slot)}
                    className={`p-5 rounded-2xl text-base font-black border-2 transition-all flex items-center justify-between group ${
                      currentAvailability?.slots.includes(slot) 
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-xl ring-4 ring-emerald-50' 
                      : 'border-slate-50 bg-slate-50 text-slate-300 hover:bg-white hover:border-emerald-100 hover:text-slate-600'
                    }`}
                  >
                    {slot} น.
                    {currentAvailability?.slots.includes(slot) ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-slate-200 rounded-full group-hover:border-emerald-200" />}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={handleConfirmSchedule}
              disabled={isConfirmingSchedule}
              className={`w-full py-6 rounded-3xl font-black flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${
                currentAvailability && currentAvailability.slots.length > 0
                ? 'bg-emerald-800 text-white shadow-2xl hover:bg-emerald-900 active:scale-95'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              {isConfirmingSchedule ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-6 h-6 text-emerald-300 group-hover:animate-pulse" />
                  บันทึกตารางเวลาเข้าตรวจ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderAdminDashboard() {
    return (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter">แผงควบคุมแอดมิน</h2>
            <p className="text-slate-400 text-sm font-bold italic uppercase tracking-widest">การจัดการระบบแพทย์แผนไทย</p>
          </div>
          <button 
            onClick={() => { setEditingDoctor({}); setIsEditingDoctor(true); }}
            className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-emerald-700 shadow-xl transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> เพิ่มแพทย์คนใหม่
          </button>
        </div>

        {isEditingDoctor && (
          <div className="bg-white p-10 rounded-[3rem] border-2 border-emerald-100 shadow-2xl space-y-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-50 pb-6">
              <h3 className="font-black text-slate-800 text-2xl">{editingDoctor?.id ? 'แก้ไขข้อมูลแพทย์' : 'ลงทะเบียนแพทย์ใหม่'}</h3>
              <button onClick={() => { setIsEditingDoctor(false); setEditingDoctor(null); }} className="text-slate-300 hover:text-slate-500 bg-slate-50 p-2.5 rounded-2xl transition-all"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อ-นามสกุล แพทย์</label>
                <input type="text" value={editingDoctor?.name || ''} onChange={e => setEditingDoctor({...editingDoctor, name: e.target.value})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-[1.5rem] p-5 focus:border-emerald-500 focus:bg-white outline-none transition-all font-black text-slate-700" placeholder="พท.ป. สุขภาพ ดีเยี่ยม" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ความเชี่ยวชาญ</label>
                <input type="text" value={editingDoctor?.specialty || ''} onChange={e => setEditingDoctor({...editingDoctor, specialty: e.target.value})} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-[1.5rem] p-5 focus:border-emerald-500 focus:bg-white outline-none transition-all font-black text-slate-700" placeholder="เชี่ยวชาญด้านคัมภีร์ธาตุบรรจบ" />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 pt-4">
               <button onClick={handleSaveDoctor} className="flex-1 bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-2xl hover:bg-emerald-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"><Save className="w-6 h-6" /> บันทึกข้อมูลแพทย์</button>
               <button onClick={() => setIsEditingDoctor(false)} className="px-10 bg-slate-100 text-slate-500 py-5 rounded-2xl font-black hover:bg-slate-200 transition-all">ยกเลิก</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map(doc => (
            <div key={doc.id} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 group transition-all">
              <div className="relative">
                <img src={doc.image} className="w-full aspect-square rounded-[2rem] object-cover shadow-lg" alt="" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => { setEditingDoctor(doc); setIsEditingDoctor(true); }} className="p-3 bg-white/90 backdrop-blur text-emerald-600 rounded-2xl shadow-xl hover:bg-emerald-600 hover:text-white transition-all"><Edit2 className="w-5 h-5" /></button>
                  <button onClick={() => setDoctorToDelete(doc)} className="p-3 bg-white/90 backdrop-blur text-rose-500 rounded-2xl shadow-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="mt-6 px-2">
                <h3 className="text-xl font-black text-slate-800">{doc.name}</h3>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">{doc.specialty}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
};

export default App;