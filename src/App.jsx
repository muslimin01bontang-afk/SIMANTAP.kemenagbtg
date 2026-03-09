import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, Users, FileText, CheckSquare, LogOut, 
  UserCheck, AlertCircle, CheckCircle2, Clock, User, FileSignature
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'simantap-bontang';

// --- Constants ---
const SATKER_LIST = [
  'TU', 'Bimas', 'Pendis', 'KUA Bontang Barat', 'KUA Bontang Utara', 'KUA Bontang Selatan'
];

const DEFAULT_ADMINS = [
  { nip: 'admintu', name: 'Admin TU', satker: 'TU' },
  { nip: 'adminbimas', name: 'Admin Bimas', satker: 'Bimas' },
  { nip: 'adminpendis', name: 'Admin Pendis', satker: 'Pendis' },
  { nip: 'adminkuabarat', name: 'Admin KUA Bontang Barat', satker: 'KUA Bontang Barat' },
  { nip: 'adminkuautara', name: 'Admin KUA Bontang Utara', satker: 'KUA Bontang Utara' },
  { nip: 'adminkuaselatan', name: 'Admin KUA Bontang Selatan', satker: 'KUA Bontang Selatan' },
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // App Data
  const [usersData, setUsersData] = useState([]);
  const [tasksData, setTasksData] = useState([]);
  const [reportsData, setReportsData] = useState([]);
  
  // Current logged in profile
  const [appUser, setAppUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  
  const seedFlag = useRef(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data & Seed Admins safely
  useEffect(() => {
    if (!firebaseUser) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'simantap_users');
    const tasksRef = collection(db, 'artifacts', appId, 'public', 'data', 'simantap_tasks');
    const reportsRef = collection(db, 'artifacts', appId, 'public', 'data', 'simantap_reports');

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersData(data);
      
      // Seed all admins if they don't exist yet
      if (!seedFlag.current) {
        seedFlag.current = true;
        DEFAULT_ADMINS.forEach(async (admin) => {
          if (!data.some(u => u.nip === admin.nip)) {
            await addDoc(usersRef, {
              nip: admin.nip,
              name: admin.name,
              password: 'admin', // Password default untuk semua admin
              role: 'admin',
              satker: admin.satker,
              status: 'verified',
              createdAt: new Date().toISOString()
            });
          }
        });
      }
    });

    const unsubTasks = onSnapshot(tasksRef, (snap) => {
      setTasksData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubReports = onSnapshot(reportsRef, (snap) => {
      setReportsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubUsers();
      unsubTasks();
      unsubReports();
    };
  }, [firebaseUser]);

  // Handle auto-login state from localStorage
  useEffect(() => {
    const savedUserId = localStorage.getItem('simantap_user_id');
    if (savedUserId && usersData.length > 0 && !appUser) {
      const user = usersData.find(u => u.id === savedUserId);
      if (user) setAppUser(user);
    }
  }, [usersData, appUser]);

  const handleLogin = (user) => {
    setAppUser(user);
    localStorage.setItem('simantap_user_id', user.id);
    setActiveTab('home');
    showToast(`Selamat datang, ${user.name}`);
  };

  const handleLogout = () => {
    setAppUser(null);
    localStorage.removeItem('simantap_user_id');
    setActiveTab('home');
  };

  if (isInitializing) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500 animate-pulse">Memuat SIMANTAP...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-white transition-opacity ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      {!appUser ? (
        <AuthScreen 
          onLogin={handleLogin} 
          users={usersData} 
          showToast={showToast} 
        />
      ) : appUser.status === 'pending' ? (
        <PendingScreen onLogout={handleLogout} />
      ) : (
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <Sidebar 
            role={appUser.role} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            onLogout={handleLogout} 
          />
          
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <header className="bg-white shadow px-6 py-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold text-green-800">SIMANTAP</h2>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{appUser.name}</p>
                  <p className="text-xs text-gray-500">{appUser.satker} - {appUser.role === 'admin' ? 'Admin' : 'Pegawai'}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                  {appUser.name.charAt(0)}
                </div>
              </div>
            </header>

            <main className="p-6">
              {appUser.role === 'admin' && (
                <>
                  {activeTab === 'home' && <AdminHome users={usersData} tasks={tasksData} reports={reportsData} satker={appUser.satker} />}
                  {activeTab === 'disposisi' && <AdminDisposisi users={usersData} tasks={tasksData} satker={appUser.satker} showToast={showToast} />}
                  {activeTab === 'laporan' && <AdminLaporan users={usersData} reports={reportsData} satker={appUser.satker} showToast={showToast} />}
                  {activeTab === 'verifikasi' && <AdminVerifikasi users={usersData} satker={appUser.satker} showToast={showToast} />}
                </>
              )}

              {appUser.role === 'pegawai' && (
                <>
                  {activeTab === 'home' && <PegawaiHome user={appUser} tasks={tasksData} reports={reportsData} />}
                  {activeTab === 'disposisi' && <PegawaiDisposisi user={appUser} tasks={tasksData} showToast={showToast} />}
                  {activeTab === 'laporan' && <PegawaiLaporan user={appUser} reports={reportsData} showToast={showToast} />}
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// AUTHENTICATION COMPONENTS
// ==========================================

function AuthScreen({ onLogin, users, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ nip: '', password: '', name: '', satker: SATKER_LIST[0] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      const user = users.find(u => u.nip === form.nip && u.password === form.password);
      if (user) {
        onLogin(user);
      } else {
        showToast('NIP atau Password salah!', 'error');
      }
    } else {
      // Registration
      if (users.some(u => u.nip === form.nip)) {
        showToast('NIP sudah terdaftar!', 'error');
        return;
      }
      try {
        const usersRef = collection(getFirestore(), 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'simantap-bontang', 'public', 'data', 'simantap_users');
        await addDoc(usersRef, {
          nip: form.nip,
          name: form.name,
          password: form.password,
          role: 'pegawai',
          satker: form.satker,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        showToast('Pendaftaran berhasil. Silakan tunggu verifikasi Admin.', 'success');
        setIsLogin(true);
      } catch (err) {
        showToast('Terjadi kesalahan sistem.', 'error');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-700 to-green-900">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl flex flex-col md:flex-row">
        {/* Info Banner */}
        <div className="md:w-5/12 bg-green-800 text-white p-8 flex flex-col justify-center">
          <div className="mb-6 flex justify-center">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-3">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Lambang_Kementerian_Agama.svg/1200px-Lambang_Kementerian_Agama.svg.png" alt="Logo Kemenag" className="object-contain w-full h-full" onError={(e) => e.target.style.display='none'} />
             </div>
          </div>
          <h1 className="text-3xl font-bold mb-2 text-center">SIMANTAP</h1>
          <p className="text-green-100 text-center text-sm mb-8">Sistem Manajemen Terpadu Pegawai<br/>Kementerian Agama Kota Bontang</p>
          
          <div className="bg-green-900 bg-opacity-50 p-4 rounded-lg text-sm">
            <h3 className="font-bold mb-3 flex items-center gap-2 border-b border-green-700 pb-2"><AlertCircle size={16}/> Daftar Akun Admin Satker</h3>
            <div className="grid grid-cols-2 gap-2 text-green-100 text-xs">
              <div><strong>TU:</strong> admintu</div>
              <div><strong>Bimas:</strong> adminbimas</div>
              <div><strong>Pendis:</strong> adminpendis</div>
              <div><strong>KUA Barat:</strong> adminkuabarat</div>
              <div><strong>KUA Utara:</strong> adminkuautara</div>
              <div><strong>KUA Selatan:</strong> adminkuaselatan</div>
            </div>
            <div className="mt-3 pt-2 border-t border-green-700 text-center bg-green-950 bg-opacity-40 rounded py-1">
               Password semua admin: <strong className="text-white tracking-widest">admin</strong>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="md:w-7/12 p-8 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{isLogin ? 'Masuk ke Akun Anda' : 'Daftar Akun Pegawai'}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input required type="text" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nama Lengkap" />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIP / Username</label>
              <input required type="text" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" 
                value={form.nip} onChange={e => setForm({...form, nip: e.target.value})} placeholder="Masukkan NIP atau Username" />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Satuan Kerja (Satker)</label>
                <select className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none"
                  value={form.satker} onChange={e => setForm({...form, satker: e.target.value})}>
                  {SATKER_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kata Sandi</label>
              <input required type="password" className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-green-500 focus:outline-none" 
                value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="********" />
            </div>

            <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition">
              {isLogin ? 'Masuk' : 'Daftar Sekarang'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">{isLogin ? "Belum punya akun?" : "Sudah punya akun?"}</span>
            <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-green-600 font-bold hover:underline">
              {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingScreen({ onLogout }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
        <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Menunggu Verifikasi</h2>
        <p className="text-gray-600 mb-6">Akun Anda sedang menunggu persetujuan dari Admin Satker Anda. Silakan cek kembali nanti.</p>
        <button onClick={onLogout} className="bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded hover:bg-gray-300 transition">
          Keluar
        </button>
      </div>
    </div>
  );
}

// ==========================================
// NAVIGATION
// ==========================================

function Sidebar({ role, activeTab, setActiveTab, onLogout }) {
  const menuItems = role === 'admin' ? [
    { id: 'home', icon: LayoutDashboard, label: 'Halaman Utama' },
    { id: 'disposisi', icon: CheckSquare, label: 'e-Disposisi' },
    { id: 'laporan', icon: FileText, label: 'Laporan Kinerja' },
    { id: 'verifikasi', icon: UserCheck, label: 'Verifikasi Akun' },
  ] : [
    { id: 'home', icon: LayoutDashboard, label: 'Halaman Utama' },
    { id: 'disposisi', icon: CheckSquare, label: 'e-Disposisi' },
    { id: 'laporan', icon: FileText, label: 'Laporan Kinerja Harian' },
  ];

  return (
    <div className="w-64 bg-green-800 text-white flex flex-col">
      <div className="p-6 text-center border-b border-green-700">
        <h1 className="text-2xl font-extrabold tracking-wider">SIMANTAP</h1>
        <p className="text-green-200 text-xs mt-1">Kemenag Bontang</p>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === item.id ? 'bg-green-700 text-white font-semibold' : 'text-green-100 hover:bg-green-700 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-green-700">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-200 hover:bg-red-600 hover:text-white transition-colors">
          <LogOut size={20} />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// ADMIN COMPONENTS
// ==========================================

function AdminHome({ users, tasks, reports, satker }) {
  const myUsers = useMemo(() => users.filter(u => u.satker === satker && u.role === 'pegawai' && u.status === 'verified'), [users, satker]);
  const myTasks = useMemo(() => tasks.filter(t => t.satker === satker), [tasks, satker]);
  const myReports = useMemo(() => reports.filter(r => r.satker === satker), [reports, satker]);

  const stats = {
    totalPegawai: myUsers.length,
    tugasBerjalan: myTasks.filter(t => t.status !== 'Selesai').length,
    tugasSelesai: myTasks.filter(t => t.status === 'Selesai').length,
    totalLaporan: myReports.length
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin - {satker}</h1>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Pegawai" value={stats.totalPegawai} icon={Users} color="bg-blue-500" />
        <StatCard title="Tugas Berjalan" value={stats.tugasBerjalan} icon={Clock} color="bg-yellow-500" />
        <StatCard title="Tugas Selesai" value={stats.tugasSelesai} icon={CheckCircle2} color="bg-green-500" />
        <StatCard title="Total Laporan" value={stats.totalLaporan} icon={FileText} color="bg-purple-500" />
      </div>

      {/* Matriks Kinerja */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><FileSignature size={24} className="text-green-600"/> Matriks Kinerja Pegawai</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="p-3 border-b">Nama Pegawai</th>
                <th className="p-3 border-b text-center">Tugas Selesai</th>
                <th className="p-3 border-b text-center">Laporan Sangat Baik</th>
                <th className="p-3 border-b text-center">Laporan Baik</th>
                <th className="p-3 border-b text-center">Laporan Kurang</th>
              </tr>
            </thead>
            <tbody>
              {myUsers.map(u => {
                const userTasks = myTasks.filter(t => t.pegawaiId === u.id && t.status === 'Selesai');
                const userReports = myReports.filter(r => r.pegawaiId === u.id);
                const countSangatBaik = userReports.filter(r => r.penilaian === 'Sangat Baik').length;
                const countBaik = userReports.filter(r => r.penilaian === 'Baik').length;
                const countKurang = userReports.filter(r => r.penilaian === 'Kurang Baik').length;

                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="p-3 border-b font-medium">{u.name}</td>
                    <td className="p-3 border-b text-center">{userTasks.length}</td>
                    <td className="p-3 border-b text-center text-green-600 font-bold">{countSangatBaik}</td>
                    <td className="p-3 border-b text-center text-blue-600 font-bold">{countBaik}</td>
                    <td className="p-3 border-b text-center text-red-600 font-bold">{countKurang}</td>
                  </tr>
                );
              })}
              {myUsers.length === 0 && (
                <tr><td colSpan="5" className="p-4 text-center text-gray-500">Belum ada pegawai terverifikasi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminDisposisi({ users, tasks, satker, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const myUsers = users.filter(u => u.satker === satker && u.role === 'pegawai' && u.status === 'verified');
  const myTasks = tasks.filter(t => t.satker === satker).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const [form, setForm] = useState({ pegawaiId: '', taskName: '', deadline: '', location: '', time: '', link: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'simantap_tasks');
      await addDoc(colRef, {
        ...form,
        satker,
        status: 'Belum Diambil', // Belum Diambil -> Proses -> Selesai
        penilaian: '',
        buktiLink: '',
        createdAt: new Date().toISOString()
      });
      showToast('Tugas berhasil ditambahkan');
      setShowForm(false);
      setForm({ pegawaiId: '', taskName: '', deadline: '', location: '', time: '', link: '' });
    } catch (err) {
      showToast('Gagal menambah tugas', 'error');
    }
  };

  const handleNilai = async (taskId, nilai) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'simantap_tasks', taskId);
      await updateDoc(docRef, { penilaian: nilai });
      showToast('Penilaian tersimpan');
    } catch (err) {
      showToast('Gagal menyimpan penilaian', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen e-Disposisi</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
          {showForm ? 'Batal' : '+ Berikan Tugas'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold mb-4">Form Pemberian Tugas Baru</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pilih Pegawai</label>
              <select required className="w-full border p-2 rounded" value={form.pegawaiId} onChange={e => setForm({...form, pegawaiId: e.target.value})}>
                <option value="">-- Pilih Pegawai --</option>
                {myUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Tugas</label>
              <input required type="text" className="w-full border p-2 rounded" value={form.taskName} onChange={e => setForm({...form, taskName: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Batas Waktu (Deadline)</label>
              <input required type="date" className="w-full border p-2 rounded" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Waktu Pelaksanaan</label>
              <input required type="time" className="w-full border p-2 rounded" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tempat Tugas</label>
              <input required type="text" className="w-full border p-2 rounded" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Link Surat Tugas (opsional)</label>
              <input type="url" placeholder="https://" className="w-full border p-2 rounded" value={form.link} onChange={e => setForm({...form, link: e.target.value})} />
            </div>
            <div className="md:col-span-2 text-right mt-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700">Simpan Tugas</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="p-3 border-b">Pegawai</th>
              <th className="p-3 border-b">Tugas & Tempat</th>
              <th className="p-3 border-b">Waktu & Deadline</th>
              <th className="p-3 border-b">Status</th>
              <th className="p-3 border-b text-center">Aksi / Penilaian</th>
            </tr>
          </thead>
          <tbody>
            {myTasks.map(t => {
              const pegName = myUsers.find(u => u.id === t.pegawaiId)?.name || 'Unknown';
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-3 border-b font-medium">{pegName}</td>
                  <td className="p-3 border-b">
                    <div>{t.taskName}</div>
                    <div className="text-xs text-gray-500">{t.location}</div>
                    {t.link && <a href={t.link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Surat Tugas</a>}
                  </td>
                  <td className="p-3 border-b text-sm">
                    <div>Waktu: {t.time}</div>
                    <div className="text-red-500">Batas: {t.deadline}</div>
                  </td>
                  <td className="p-3 border-b">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="p-3 border-b text-center">
                    {t.status === 'Selesai' ? (
                      <div className="flex flex-col gap-1 items-center">
                         {t.buktiLink && <a href={t.buktiLink} target="_blank" rel="noreferrer" className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mb-1 hover:bg-blue-200">Lihat Bukti</a>}
                         {t.penilaian ? (
                            <span className="text-green-600 font-bold text-sm bg-green-100 px-2 py-1 rounded">Nilai: {t.penilaian}</span>
                         ) : (
                            <select className="border p-1 text-sm rounded bg-gray-50" onChange={(e) => handleNilai(t.id, e.target.value)} defaultValue="">
                              <option value="" disabled>Beri Nilai</option>
                              <option value="Sangat Baik">Sangat Baik</option>
                              <option value="Baik">Baik</option>
                              <option value="Cukup">Cukup</option>
                            </select>
                         )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Menunggu...</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {myTasks.length === 0 && (
              <tr><td colSpan="5" className="p-4 text-center text-gray-500">Belum ada tugas disposisi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminLaporan({ users, reports, satker, showToast }) {
  const myReports = reports.filter(r => r.satker === satker).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const myUsers = users.filter(u => u.satker === satker);

  const handleNilai = async (reportId, field, value) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'simantap_reports', reportId);
      await updateDoc(docRef, { [field]: value });
      showToast(`Data ${field} diperbarui`);
    } catch (err) {
      showToast('Gagal memperbarui data', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Evaluasi Laporan Kinerja</h1>

      <div className="grid gap-4">
        {myReports.map(r => {
          const pegName = myUsers.find(u => u.id === r.pegawaiId)?.name || 'Unknown';
          return (
            <div key={r.id} className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{pegName}</h3>
                  <p className="text-sm text-gray-500">{r.date} | Pukul: {r.time}</p>
                </div>
                {r.buktiLink && (
                  <a href={r.buktiLink} target="_blank" rel="noreferrer" className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100">
                    Lihat Bukti
                  </a>
                )}
              </div>
              
              <div className="mb-4 bg-gray-50 p-3 rounded">
                <p className="text-sm font-semibold mb-1">Kegiatan:</p>
                <p className="text-sm text-gray-700 mb-2">{r.activity}</p>
                <p className="text-sm font-semibold mb-1">Kendala:</p>
                <p className="text-sm text-gray-700 italic">{r.constraints || '-'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Penilaian Kinerja</label>
                  <select 
                    className={`w-full border p-2 rounded text-sm font-medium ${r.penilaian ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white'}`}
                    value={r.penilaian || ''} 
                    onChange={(e) => handleNilai(r.id, 'penilaian', e.target.value)}
                  >
                    <option value="" disabled>-- Pilih Penilaian --</option>
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Baik">Baik</option>
                    <option value="Kurang Baik">Kurang Baik</option>
                  </select>
                </div>
                
                {r.penilaian === 'Kurang Baik' && (
                  <div>
                    <label className="block text-xs font-bold text-red-500 mb-1">Rekomendasi (Wajib untuk Kurang Baik)</label>
                    <textarea 
                      className="w-full border p-2 rounded text-sm" 
                      rows="2"
                      placeholder="Masukkan rekomendasi perbaikan..."
                      defaultValue={r.rekomendasi}
                      onBlur={(e) => handleNilai(r.id, 'rekomendasi', e.target.value)}
                    ></textarea>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {myReports.length === 0 && (
          <div className="bg-white p-8 text-center text-gray-500 rounded shadow">Belum ada laporan harian yang disubmit.</div>
        )}
      </div>
    </div>
  );
}

function AdminVerifikasi({ users, satker, showToast }) {
  const pendingUsers = users.filter(u => u.satker === satker && u.role === 'pegawai' && u.status === 'pending');

  const handleVerify = async (userId, action) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'simantap_users', userId);
      if (action === 'approve') {
        await updateDoc(docRef, { status: 'verified' });
        showToast('Akun berhasil diverifikasi');
      } else {
        await deleteDoc(docRef);
        showToast('Pengajuan akun ditolak dan dihapus', 'error');
      }
    } catch (err) {
      showToast('Gagal memproses verifikasi', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Verifikasi Akun Pegawai</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="p-4 border-b">Nama</th>
              <th className="p-4 border-b">NIP</th>
              <th className="p-4 border-b">Waktu Daftar</th>
              <th className="p-4 border-b text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="p-4 border-b font-medium">{u.name}</td>
                <td className="p-4 border-b">{u.nip}</td>
                <td className="p-4 border-b text-sm">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
                <td className="p-4 border-b text-center space-x-2">
                  <button onClick={() => handleVerify(u.id, 'approve')} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">Setujui</button>
                  <button onClick={() => handleVerify(u.id, 'reject')} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Tolak</button>
                </td>
              </tr>
            ))}
            {pendingUsers.length === 0 && (
              <tr><td colSpan="4" className="p-6 text-center text-gray-500">Tidak ada pengajuan akun baru yang perlu diverifikasi.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ==========================================
// PEGAWAI COMPONENTS
// ==========================================

function PegawaiHome({ user, tasks, reports }) {
  const myTasks = tasks.filter(t => t.pegawaiId === user.id);
  const myReports = reports.filter(r => r.pegawaiId === user.id);

  const stats = {
    tugasBaru: myTasks.filter(t => t.status === 'Belum Diambil').length,
    tugasProses: myTasks.filter(t => t.status === 'Proses').length,
    tugasSelesai: myTasks.filter(t => t.status === 'Selesai').length,
    totalLaporan: myReports.length
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard Pegawai</h1>
      
      {/* Profil Singkat */}
      <div className="bg-white p-6 rounded-lg shadow flex items-center gap-6">
        <div className="w-24 h-24 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
          <User size={48} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
          <p className="text-gray-600">NIP: {user.nip}</p>
          <p className="inline-block mt-2 px-3 py-1 bg-green-50 text-green-700 font-medium border border-green-200 rounded-full text-sm">
            Satker: {user.satker}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Tugas Baru" value={stats.tugasBaru} icon={AlertCircle} color="bg-red-500" />
        <StatCard title="Sedang Diproses" value={stats.tugasProses} icon={Clock} color="bg-yellow-500" />
        <StatCard title="Tugas Selesai" value={stats.tugasSelesai} icon={CheckCircle2} color="bg-green-500" />
        <StatCard title="Laporan Dikirim" value={stats.totalLaporan} icon={FileText} color="bg-blue-500" />
      </div>

      {/* Matriks Kinerja Personal */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckSquare size={24} className="text-green-600"/> Ringkasan Penilaian Anda</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
             <div className="text-sm text-gray-500">Laporan Sangat Baik</div>
             <div className="text-3xl font-bold text-green-600">{myReports.filter(r => r.penilaian === 'Sangat Baik').length}</div>
          </div>
          <div className="border rounded p-4 text-center">
             <div className="text-sm text-gray-500">Laporan Baik</div>
             <div className="text-3xl font-bold text-blue-600">{myReports.filter(r => r.penilaian === 'Baik').length}</div>
          </div>
          <div className="border rounded p-4 text-center">
             <div className="text-sm text-gray-500">Laporan Kurang Baik</div>
             <div className="text-3xl font-bold text-red-600">{myReports.filter(r => r.penilaian === 'Kurang Baik').length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PegawaiDisposisi({ user, tasks, showToast }) {
  const myTasks = tasks.filter(t => t.pegawaiId === user.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const [activeTask, setActiveTask] = useState(null);
  const [buktiLink, setBuktiLink] = useState('');

  const updateStatus = async (taskId, newStatus, extraData = {}) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'simantap_tasks', taskId);
      await updateDoc(docRef, { status: newStatus, ...extraData });
      showToast(`Status tugas diperbarui menjadi ${newStatus}`);
      setActiveTask(null);
      setBuktiLink('');
    } catch (err) {
      showToast('Gagal memperbarui status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Tugas e-Disposisi Saya</h1>

      <div className="grid gap-4">
        {myTasks.map(t => (
          <div key={t.id} className="bg-white p-5 rounded-lg shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{t.taskName}</h3>
                <StatusBadge status={t.status} />
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>📍 Tempat: {t.location} | ⏰ Waktu: {t.time}</p>
                <p className="text-red-500 font-medium">⏳ Deadline: {t.deadline}</p>
              </div>
              {t.link && (
                <a href={t.link} target="_blank" rel="noreferrer" className="inline-block mt-2 text-sm text-blue-600 hover:underline">
                  📄 Buka Surat Tugas
                </a>
              )}
              {t.penilaian && (
                <div className="mt-2 text-sm bg-green-50 text-green-700 p-2 rounded border border-green-200 inline-block">
                  <strong>Penilaian Admin:</strong> {t.penilaian}
                </div>
              )}
            </div>

            <div className="w-full md:w-auto flex flex-col gap-2">
              {t.status === 'Belum Diambil' && (
                <button onClick={() => updateStatus(t.id, 'Proses')} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 w-full md:w-auto text-sm font-bold">
                  Ambil Tugas
                </button>
              )}
              
              {t.status === 'Proses' && activeTask !== t.id && (
                <button onClick={() => setActiveTask(t.id)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 w-full md:w-auto text-sm font-bold">
                  Selesaikan Tugas
                </button>
              )}

              {t.status === 'Proses' && activeTask === t.id && (
                <div className="bg-gray-50 p-3 rounded border w-full md:w-72">
                  <label className="block text-xs font-bold mb-1">Link Bukti Dukung (G-Drive, dll)</label>
                  <input type="url" className="w-full border p-2 rounded text-sm mb-2" placeholder="https://" value={buktiLink} onChange={e => setBuktiLink(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(t.id, 'Selesai', { buktiLink })} className="bg-green-600 text-white px-3 py-1 rounded text-sm flex-1">Kirim</button>
                    <button onClick={() => setActiveTask(null)} className="bg-gray-400 text-white px-3 py-1 rounded text-sm">Batal</button>
                  </div>
                </div>
              )}

              {t.status === 'Selesai' && t.buktiLink && (
                 <a href={t.buktiLink} target="_blank" rel="noreferrer" className="text-center bg-gray-100 text-gray-700 px-4 py-2 rounded border text-sm hover:bg-gray-200">
                   Lihat Bukti Saya
                 </a>
              )}
            </div>
          </div>
        ))}
        {myTasks.length === 0 && (
          <div className="bg-white p-8 text-center text-gray-500 rounded shadow">Belum ada tugas yang diberikan kepada Anda.</div>
        )}
      </div>
    </div>
  );
}

function PegawaiLaporan({ user, reports, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const myReports = reports.filter(r => r.pegawaiId === user.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], time: '', activity: '', constraints: '', buktiLink: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'simantap_reports');
      await addDoc(colRef, {
        ...form,
        pegawaiId: user.id,
        satker: user.satker,
        penilaian: '',
        rekomendasi: '',
        createdAt: new Date().toISOString()
      });
      showToast('Laporan berhasil dikirim');
      setShowForm(false);
      setForm({ date: new Date().toISOString().split('T')[0], time: '', activity: '', constraints: '', buktiLink: '' });
    } catch (err) {
      showToast('Gagal mengirim laporan', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Laporan Kinerja Harian</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
          {showForm ? 'Batal' : '+ Buat Laporan'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal</label>
                <input required type="date" className="w-full border p-2 rounded" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Waktu (Jam)</label>
                <input required type="time" className="w-full border p-2 rounded" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Uraian Kegiatan</label>
              <textarea required rows="3" className="w-full border p-2 rounded" placeholder="Deskripsikan kegiatan yang dilakukan..." value={form.activity} onChange={e => setForm({...form, activity: e.target.value})}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kendala / Masalah (Opsional)</label>
              <textarea rows="2" className="w-full border p-2 rounded" placeholder="Hambatan yang dialami..." value={form.constraints} onChange={e => setForm({...form, constraints: e.target.value})}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Link Bukti Dukung (Opsional)</label>
              <input type="url" placeholder="https:// (Google Drive, Docs, dll)" className="w-full border p-2 rounded" value={form.buktiLink} onChange={e => setForm({...form, buktiLink: e.target.value})} />
            </div>
            <div className="text-right">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700">Kirim Laporan</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {myReports.map(r => (
          <div key={r.id} className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-bold text-gray-800">{r.date} | {r.time}</h3>
                {r.penilaian && (
                   <span className={`px-2 py-1 text-xs font-bold rounded ${
                     r.penilaian === 'Sangat Baik' ? 'bg-green-100 text-green-700' : 
                     r.penilaian === 'Baik' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                   }`}>
                     Dinilai: {r.penilaian}
                   </span>
                )}
              </div>
              <p className="mt-2 text-gray-700 text-sm">{r.activity}</p>
              {r.constraints && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                  <strong>Kendala:</strong> {r.constraints}
                </div>
              )}
              {r.rekomendasi && (
                <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-100">
                  <strong>Rekomendasi Admin:</strong> {r.rekomendasi}
                </div>
              )}
            </div>
            <div className="md:w-32 flex flex-col justify-center">
              {r.buktiLink && (
                <a href={r.buktiLink} target="_blank" rel="noreferrer" className="text-center text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded border">
                  Lihat Bukti
                </a>
              )}
            </div>
          </div>
        ))}
        {myReports.length === 0 && !showForm && (
          <div className="bg-white p-8 text-center text-gray-500 rounded shadow">Belum ada catatan laporan kinerja.</div>
        )}
      </div>
    </div>
  );
}


// ==========================================
// UTILITY COMPONENTS
// ==========================================

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  let color = 'bg-gray-100 text-gray-700';
  if (status === 'Belum Diambil') color = 'bg-red-100 text-red-700';
  if (status === 'Proses') color = 'bg-yellow-100 text-yellow-700';
  if (status === 'Selesai') color = 'bg-green-100 text-green-700';

  return <span className={`px-2 py-1 rounded text-xs font-bold ${color}`}>{status}</span>;
}
