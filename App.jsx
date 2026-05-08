import React, { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';

// ── API layer (connects to Hexagonal Architecture backend) ────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getToken = () => localStorage.getItem('livvora_token');
const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
async function apiRequest(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const authApi    = {
  register: b => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
  login:    b => apiRequest('/auth/login',    { method: 'POST', body: JSON.stringify(b) }),
  me:       () => apiRequest('/auth/me'),
};
const libraryApi  = { add:    gameId => apiRequest('/library/add',      { method: 'POST', body: JSON.stringify({ gameId }) }) };
const sessionsApi = { launch: gameId => apiRequest('/sessions/launch',  { method: 'POST', body: JSON.stringify({ gameId }) }) };

// ─────────────────────────────────────────────────────────────────────────────
const ThemeCtx = createContext();
const AuthCtx  = createContext();
const useTheme = () => useContext(ThemeCtx);
const useAuth  = ()  => useContext(AuthCtx);

const DARK = {
  mode:'dark', bg:'#07091a', bg2:'#0d1030', bgCard:'#0d1030', bgPanel:'#0d1030',
  border:'rgba(109,40,217,0.2)', borderHi:'rgba(109,40,217,0.55)',
  text:'#e8e0ff', textSub:'#c4b8f0', textMuted:'#6b5fa0', textDim:'#2a2050',
  navBg:'rgba(7,9,26,0.96)', inputBg:'rgba(109,40,217,0.06)', inputText:'#d4c8ff',
  inputBorder:'rgba(109,40,217,0.22)', footerBg:'#040612',
  heroGrad:'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(109,40,217,0.25) 0%, transparent 65%)',
  heroTitleGrad:'linear-gradient(135deg,#ffffff 0%,#c4b5fd 45%,#60a5fa 100%)',
  heroSub:'#4a3d6a', cardHover:'0 20px 48px rgba(109,40,217,0.35)',
  selectBg:'#0d1030', muted:'#2d2550', scrollTrack:'#0d1020', scrollThumb:'#6d28d9',
  tagBg:'rgba(7,9,26,0.9)', tagBorder:'rgba(255,255,255,0.12)',
  announceBg:'linear-gradient(90deg,#4c1d95,#1e40af)',
};
const LIGHT = {
  mode:'light', bg:'#f0ebff', bg2:'#ffffff', bgCard:'#ffffff', bgPanel:'#ffffff',
  border:'rgba(109,40,217,0.15)', borderHi:'rgba(109,40,217,0.45)',
  text:'#1a1040', textSub:'#2d1b69', textMuted:'#7c6fa0', textDim:'#9988bb',
  navBg:'rgba(255,255,255,0.92)', inputBg:'rgba(109,40,217,0.04)', inputText:'#1a1040',
  inputBorder:'rgba(109,40,217,0.2)', footerBg:'#0f0a1e',
  heroGrad:'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(109,40,217,0.13) 0%, transparent 65%)',
  heroTitleGrad:'linear-gradient(135deg,#3b0764 0%,#7c3aed 45%,#0ea5e9 100%)',
  heroSub:'#7c6fa0', cardHover:'0 20px 48px rgba(109,40,217,0.18)',
  selectBg:'#ffffff', muted:'#9988bb', scrollTrack:'#e8e0ff', scrollThumb:'#6d28d9',
  tagBg:'rgba(255,255,255,0.95)', tagBorder:'rgba(109,40,217,0.2)',
  announceBg:'linear-gradient(90deg,#4c1d95,#1e40af)',
};

// ── FIX 1: GlobalStyle rewritten to avoid React StrictMode double-fire blank page crash ──
// Original bug: cleanup `el.remove()` fired twice in StrictMode, leaving the DOM
// without any styles and crashing the render tree silently → blank page.
// Fix: Use a stable style tag (find existing or create once) and never double-remove.
function GlobalStyle({ T }) {
  useEffect(() => {
    const STYLE_ID = 'lv-global';
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body { background: ${T.bg}; color: ${T.text}; font-family: 'Rajdhani', sans-serif; overflow-x: hidden; transition: background .3s, color .3s; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: ${T.scrollTrack}; }
      ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 4px; }
      .rail::-webkit-scrollbar { display: none; }
      .card-hover { transition: transform .24s cubic-bezier(.34,1.56,.64,1), box-shadow .24s; }
      .card-hover:hover { transform: translateY(-7px) scale(1.015); }
      .btn-press:active { transform: scale(0.96) !important; }
      .nav-link:hover { color: #a78bfa !important; }
      .social-btn:hover { border-color: #a78bfa !important; }
      .foot-link:hover { color: #a78bfa !important; }
      select option { background: ${T.selectBg}; color: ${T.text}; }
      @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.6; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      .hero-anim-1 { animation: fadeUp .65s ease both; }
    `;
    // No cleanup removal — the tag is intentionally persistent and shared.
    // It gets updated in-place on theme change, preventing the StrictMode double-remove crash.
  }, [T]);
  return null;
}

/* ─── FIX 2: ErrorBoundary — catches any render error and shows a message instead of blank page ─── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Livvora App Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#07091a', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', fontFamily: "'Rajdhani', sans-serif", color: '#e8e0ff', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '20px', fontWeight: 900, letterSpacing: '3px',
            color: '#ef4444', marginBottom: '12px' }}>APP ERROR</div>
          <div style={{ fontSize: '13px', color: '#6b5fa0', maxWidth: '480px', lineHeight: 1.8, marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </div>
          <button onClick={() => window.location.reload()}
            style={{ background: 'linear-gradient(90deg,#6d28d9,#0ea5e9)', color: '#fff', border: 'none',
              padding: '12px 32px', borderRadius: '10px', fontWeight: 900, fontSize: '12px',
              letterSpacing: '3px', cursor: 'pointer', fontFamily: "'Rajdhani', sans-serif" }}>
            RELOAD PAGE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── DATA ─── */
const SPECS = {
  c1:['CPU: Custom AMD Zen 2','GPU: 10.28 TFLOPS RDNA2','RAM: 16GB GDDR6','Storage: 825GB NVMe SSD'],
  c2:['CPU: Custom AMD Zen 2','GPU: 10.28 TFLOPS RDNA2','RAM: 16GB GDDR6','Storage: 1TB NVMe SSD'],
  c3:['CPU: Custom AMD Zen 2','GPU: 12 TFLOPS RDNA2','RAM: 16GB GDDR6','Storage: 1TB NVMe SSD'],
  c4:['CPU: Custom AMD Zen 2','GPU: 4 TFLOPS RDNA2','RAM: 10GB DDR4','Storage: 512GB NVMe SSD'],
  c5:['CPU: Custom ARM v8.2','Display: 8" LCD / 7" LCD','RAM: 12GB LPDDR5','Storage: 256GB UFS'],
  c6:['CPU: Custom ARM','Display: 7" OLED 720p','RAM: 4GB LPDDR4','Storage: 64GB eMMC'],
  h1:['CPU: AMD Ryzen Z1 Extreme','GPU: Radeon 780M','RAM: 16GB LPDDR5','Display: 7" 1080p 120Hz'],
  h2:['CPU: AMD Ryzen Z1 Extreme','GPU: Radeon 780M','RAM: 24GB LPDDR5','Battery: 65Wh'],
  h3:['CPU: AMD APU (Aerith)','GPU: Custom RDNA2','RAM: 16GB LPDDR5','Display: 7.4" OLED 90Hz'],
  h4:['CPU: AMD Ryzen 7 7840U','GPU: Radeon 780M','RAM: 32GB LPDDR5','Display: 7" IPS 144Hz'],
  h5:['CPU: AMD Ryzen 7 7840U','Form: Clamshell DS','RAM: 32GB LPDDR5','Display: Dual 5.5" OLED'],
  h6:['CPU: AMD Ryzen Z1 Extreme','GPU: Radeon 780M','RAM: 16GB LPDDR5','Display: 8.8" QHD 144Hz'],
  h7:['CPU: AMD Ryzen 7 7840U','GPU: Radeon 780M','RAM: 32GB LPDDR5','Form: QWERTY Sliding'],
  h8:['CPU: AMD Ryzen 7 7840U','GPU: Radeon 780M','RAM: 32GB LPDDR5','Display: 8.4" IPS 144Hz'],
  r1:['Back Buttons: 4 custom','Trigger: Adjustable stops','Connectivity: USB-C/BT5.1','Profile Slots: 3 saved'],
  r2:['Haptic Feedback: Adaptive','Trigger: Dynamic resistance','Touch: Capacitive trackpad','Battery: 12hrs'],
  r3:['Haptic Feedback: Adaptive','Trigger: Dynamic resistance','Touch: Capacitive trackpad','Colour: Midnight Black'],
  r4:['Back Paddles: 4 mappable','Hair Trigger: Lock switch','Tension: 3-level thumbstick','Battery: 40hrs'],
  r5:['Connectivity: 2.4GHz/BT','Texture: Carbon pattern','Trigger: Standard','Battery: 40hrs'],
  r6:['Connectivity: BT/Wired','Gyro: 6-axis motion','Battery: 40hrs','Compatibility: Switch/PC'],
  r7:['Back Buttons: 4 extra','Display: OLED status','Connectivity: 2.4GHz','Trigger: Adjustable stops'],
  r8:['Hall-Effect Sticks: Yes','Back Buttons: 2 mappable','Connectivity: 2.4GHz/BT','Battery: 22hrs'],
  r9:['Back Buttons: 4 extra','Mech Switches: Clicky','Connectivity: 2.4GHz BT','Trigger: Hair trigger lock'],
  a1:['Driver: 40mm Neodymium','Freq: 12Hz–18kHz','Connectivity: USB/3D audio','Mic: Detachable beam'],
  a2:['Driver: 40mm','Freq: 20Hz–20kHz','Connectivity: 3.5mm/BT','Mic: Boom mic'],
  a3:['Ports: USB-A x3, HDMI','Output: 65W USB-C PD','Compatibility: ROG Ally','Stand: adjustable angle'],
  a4:['Driver: 40mm','Freq: 10Hz–40kHz','ANC: Hybrid active','Mic: ClearCast Gen2'],
  a5:['Keys: 32 LCD keys','Connectivity: USB-C','Software: Stream Deck app','Profiles: unlimited'],
  a6:['Capacity: 10 games','Material: EVA hardshell','Straps: dual accessory','Compatibility: All Switch'],
};

const CONSOLES = [
  { id:'c1', name:'PlayStation 5',        price:185000, tag:'HOT',     cat:'Console',    c1:'#00439C', c2:'#003380', stock:3 },
  { id:'c2', name:'PS5 Slim',             price:169000, tag:'NEW',     cat:'Console',    c1:'#1a1a3e', c2:'#0d0d2e', stock:7 },
  { id:'c3', name:'Xbox Series X',        price:175000, tag:'ELITE',   cat:'Console',    c1:'#0a3d0a', c2:'#052005', stock:5 },
  { id:'c4', name:'Xbox Series S',        price:120000, tag:'VALUE',   cat:'Console',    c1:'#1c1c1c', c2:'#0a0a0a', stock:12 },
  { id:'c5', name:'Nintendo Switch 2',    price:155000, tag:'LAUNCH',  cat:'Console',    c1:'#C0392B', c2:'#7B241C', stock:2 },
  { id:'c6', name:'Nintendo Switch OLED', price:98000,  tag:'CLASSIC', cat:'Console',    c1:'#2c3e50', c2:'#1a252f', stock:9 },
];
const HANDHELDS = [
  { id:'h1', name:'ROG Ally Z1 Extreme', price:245000, tag:'FLAGSHIP', cat:'Handheld', c1:'#3d0070', c2:'#1a0035', stock:4 },
  { id:'h2', name:'ROG Ally X',          price:265000, tag:'UPGRADED', cat:'Handheld', c1:'#5c0085', c2:'#2d0045', stock:3 },
  { id:'h3', name:'Steam Deck OLED',     price:195000, tag:'LIMITED',  cat:'Handheld', c1:'#1b2838', c2:'#0f1922', stock:2 },
  { id:'h4', name:'AYA NEO 2S',          price:230000, tag:'PRO',      cat:'Handheld', c1:'#0f3460', c2:'#081a35', stock:5 },
  { id:'h5', name:'AYA NEO Flip DS',     price:218000, tag:'NEW',      cat:'Handheld', c1:'#150050', c2:'#0a0030', stock:6 },
  { id:'h6', name:'Lenovo Legion Go',    price:220000, tag:'POPULAR',  cat:'Handheld', c1:'#3d1500', c2:'#1a0800', stock:4 },
  { id:'h7', name:'GPD Win 4',           price:210000, tag:'COMPACT',  cat:'Handheld', c1:'#0b132b', c2:'#060c1a', stock:8 },
  { id:'h8', name:'OneXPlayer 2 Pro',    price:240000, tag:'PRO',      cat:'Handheld', c1:'#03045e', c2:'#020340', stock:3 },
];
const CONTROLLERS = [
  { id:'r1', name:'PS5 DualSense Edge',      price:38000, tag:'PRO',      cat:'Controller', c1:'#1a0050', c2:'#0d0030', stock:8 },
  { id:'r2', name:'PS5 DualSense White',     price:22000, tag:'OFFICIAL', cat:'Controller', c1:'#2d2d4a', c2:'#1a1a30', stock:15 },
  { id:'r3', name:'PS5 DualSense Midnight',  price:24000, tag:'DARK',     cat:'Controller', c1:'#0a0a2e', c2:'#050518', stock:10 },
  { id:'r4', name:'Xbox Elite Series 2',     price:42000, tag:'ELITE',    cat:'Controller', c1:'#1b1b1b', c2:'#0a0a0a', stock:6 },
  { id:'r5', name:'Xbox Wireless Carbon',    price:18000, tag:'CLASSIC',  cat:'Controller', c1:'#14532d', c2:'#0a2e18', stock:14 },
  { id:'r6', name:'Nintendo Pro Controller', price:18500, tag:'OFFICIAL', cat:'Controller', c1:'#7f1d1d', c2:'#4a1010', stock:11 },
  { id:'r7', name:'ROG Raikiri Pro',         price:32000, tag:'HOT',      cat:'Controller', c1:'#3d005c', c2:'#1e0030', stock:7 },
  { id:'r8', name:'8BitDo Ultimate 2C',      price:14000, tag:'VALUE',    cat:'Controller', c1:'#1e3a5f', c2:'#0f1e30', stock:20 },
  { id:'r9', name:'Razer Wolverine V3 Pro',  price:36000, tag:'FAST',     cat:'Controller', c1:'#001a00', c2:'#000d00', stock:5 },
];
const ACCESSORIES = [
  { id:'a1', name:'PS5 Pulse 3D Headset',        price:22000, tag:'AUDIO',   cat:'Accessory', c1:'#10002b', c2:'#080018', stock:9 },
  { id:'a2', name:'Xbox Stereo Headset',          price:16000, tag:'AUDIO',   cat:'Accessory', c1:'#1a3300', c2:'#0d1a00', stock:12 },
  { id:'a3', name:'ROG Ally Charging Dock',       price:12000, tag:'CHARGE',  cat:'Accessory', c1:'#2a0055', c2:'#150030', stock:8 },
  { id:'a4', name:'SteelSeries Arctis Nova Pro',  price:28000, tag:'STUDIO',  cat:'Accessory', c1:'#0a0a0a', c2:'#000000', stock:4 },
  { id:'a5', name:'Elgato Stream Deck MK.2',      price:35000, tag:'STREAM',  cat:'Accessory', c1:'#0d1117', c2:'#060810', stock:6 },
  { id:'a6', name:'Switch Carry Case Pro',        price:4500,  tag:'PROTECT', cat:'Accessory', c1:'#1a1a1a', c2:'#0a0a0a', stock:25 },
];
const ALL = [...CONSOLES, ...HANDHELDS, ...CONTROLLERS, ...ACCESSORIES];

const DEALS = [
  { id:'c3', discount:8,  label:'WEEKEND SALE' },
  { id:'h1', discount:5,  label:'BUNDLE DEAL' },
  { id:'r4', discount:10, label:'CLEARANCE' },
  { id:'a4', discount:12, label:'FLASH DEAL' },
];

const CAT_GRAD = {
  Console:   'linear-gradient(135deg,#6d28d9,#9333ea)',
  Handheld:  'linear-gradient(135deg,#0369a1,#0ea5e9)',
  Controller:'linear-gradient(135deg,#92400e,#d97706)',
  Accessory: 'linear-gradient(135deg,#065f46,#10b981)',
};
const CAT_GLOW = {
  Console:'rgba(109,40,217,0.55)', Handheld:'rgba(14,165,233,0.55)',
  Controller:'rgba(217,119,6,0.55)', Accessory:'rgba(16,185,129,0.55)',
};

/* ─── PRODUCT IMAGE ─── */
function ProductImage({ item, height = 170 }) {
  const [err, setErr] = useState(false);
  if (!err) return (
    <img src={`/images/products/${item.id}.jpg`} alt={item.name}
      onError={() => setErr(true)}
      style={{ width:'100%', height, objectFit:'cover', display:'block' }} />
  );
  return (
    <div style={{ width:'100%', height, background:`linear-gradient(145deg,${item.c1},${item.c2})`,
      display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 50%,${CAT_GLOW[item.cat]} 0%,transparent 65%)` }}/>
      <span style={{ fontSize:'10px', letterSpacing:'3px', color:'rgba(255,255,255,0.25)', zIndex:1, fontFamily:"'Orbitron',sans-serif" }}>{item.cat.toUpperCase()}</span>
    </div>
  );
}

/* ─── AUTH MODAL ─── */
function AuthModal({ onClose }) {
  const { T } = useTheme();
  const { login }  = useAuth();
  const [tab, setTab]   = useState('login');
  const [form, setForm] = useState({ username:'', email:'', password:'' });
  const [err, setErr]   = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setErr(''); setLoading(true);
    try {
      if (tab === 'register') {
        await authApi.register({ username: form.username, email: form.email, password: form.password });
        setTab('login');
        setErr('Registered! Please log in.');
      } else {
        const res = await authApi.login({ email: form.email, password: form.password });
        localStorage.setItem('livvora_token', res.data.token);
        // FIX 3: Guard against backend returning user at different nesting levels
        const user = res.data?.user ?? res.user ?? res.data ?? null;
        login(user);
        onClose();
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = (ph, k, type = 'text') => (
    <input key={k} placeholder={ph} type={type} value={form[k]}
      onChange={e => set(k, e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', outline:'none', marginBottom:'8px',
        border:`1px solid ${T.inputBorder}`, background: T.inputBg, color: T.inputText,
        fontSize:'13px', boxSizing:'border-box', fontFamily:"'Rajdhani',sans-serif" }} />
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bgCard, borderRadius:'18px', padding:'32px', width:'100%', maxWidth:'380px',
        border:`1px solid ${T.border}`, boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:900, fontSize:'16px', letterSpacing:'2px',
            background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {tab === 'login' ? 'LOGIN' : 'REGISTER'}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color: T.textMuted, fontSize:'20px' }}>×</button>
        </div>

        <div style={{ display:'flex', gap:'6px', marginBottom:'20px' }}>
          {['login','register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(''); }} style={{
              flex:1, padding:'8px', borderRadius:'8px', border:'1px solid', cursor:'pointer',
              borderColor: tab === t ? '#6d28d9' : T.border,
              background: tab === t ? 'rgba(109,40,217,0.15)' : T.inputBg,
              color: tab === t ? '#a78bfa' : T.textMuted,
              fontWeight:800, fontSize:'10px', letterSpacing:'2px', fontFamily:"'Rajdhani',sans-serif",
            }}>{t.toUpperCase()}</button>
          ))}
        </div>

        {tab === 'register' && inp('Username', 'username')}
        {inp('Email', 'email', 'email')}
        {inp('Password', 'password', 'password')}

        {err && (
          <div style={{ fontSize:'11px', padding:'8px 10px', borderRadius:'7px', marginBottom:'8px',
            background: err.includes('Registered') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border:`1px solid ${err.includes('Registered') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: err.includes('Registered') ? '#10b981' : '#ef4444' }}>
            {err}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width:'100%', padding:'11px', border:'none', borderRadius:'9px', color:'#fff',
          fontWeight:900, fontSize:'11px', letterSpacing:'2px', cursor: loading ? 'default' : 'pointer',
          fontFamily:"'Rajdhani',sans-serif", marginTop:'4px',
          background: loading ? 'rgba(109,40,217,0.4)' : 'linear-gradient(90deg,#6d28d9,#0ea5e9)',
          boxShadow:'0 6px 20px rgba(109,40,217,0.4)',
        }}>
          {loading ? 'LOADING...' : tab === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
        </button>
      </div>
    </div>
  );
}

/* ─── NAVBAR ─── */
function Navbar({ cartCount, wishlistCount, onAuthOpen }) {
  const { T, toggleTheme } = useTheme();
  const { user, logout }   = useAuth();
  const loc = useLocation();
  const [searchVal, setSearchVal] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef  = useRef(null);
  const userMenuRef = useRef(null);
  // FIX 4: active() correctly uses === for exact matching (was already correct,
  // but added explicit comment to avoid future regression)
  const active = p => loc.pathname === p;

  useEffect(() => {
    if (searchVal.trim().length < 2) { setSearchResults([]); return; }
    const q = searchVal.toLowerCase();
    setSearchResults(ALL.filter(d => d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q)).slice(0, 6));
  }, [searchVal]);

  useEffect(() => {
    const handler = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchFocused(false); setSearchVal(''); setSearchResults([]); }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav style={{ position:'sticky', top:0, zIndex:9999, background: T.navBg, backdropFilter:'blur(20px)',
      borderBottom:`1px solid ${T.border}`, fontFamily:"'Rajdhani',sans-serif", transition:'background .3s' }}>

      <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 28px' }}>
        <Link to="/" style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:900, fontSize:'16px', letterSpacing:'4px',
          textDecoration:'none', color:'#a78bfa', flexShrink:0 }}>LIVVORA</Link>

        {/* SEARCH */}
        <div ref={searchRef} style={{ flex:1, maxWidth:'480px', margin:'0 auto', position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px',
            background: searchFocused ? (T.mode==='dark' ? 'rgba(109,40,217,0.1)' : 'rgba(255,255,255,0.95)') : T.inputBg,
            border:`1.5px solid ${searchFocused ? '#6d28d9' : T.inputBorder}`,
            borderRadius:'10px', padding:'0 14px', transition:'all .2s' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={searchVal} onChange={e => setSearchVal(e.target.value)} onFocus={() => setSearchFocused(true)}
              placeholder="Search consoles, handhelds, controllers..."
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color: T.inputText,
                fontSize:'13px', height:'38px', fontFamily:"'Rajdhani',sans-serif", fontWeight:600 }} />
            {searchVal && (
              <button onClick={() => { setSearchVal(''); setSearchResults([]); }}
                style={{ background:'none', border:'none', cursor:'pointer', color: T.textMuted, fontSize:'18px', lineHeight:1 }}>×</button>
            )}
          </div>
          {searchResults.length > 0 && searchFocused && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0,
              background: T.mode==='dark' ? '#0d1030' : '#ffffff',
              border:`1px solid ${T.border}`, borderRadius:'12px',
              boxShadow:`0 20px 48px ${T.mode==='dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)'}`,
              overflow:'hidden', zIndex:1000 }}>
              {searchResults.map(item => (
                <Link key={item.id} to="/devices"
                  onClick={() => { setSearchFocused(false); setSearchVal(''); setSearchResults([]); }}
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px',
                    textDecoration:'none', borderBottom:`1px solid ${T.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.inputBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'8px', flexShrink:0,
                    background:`linear-gradient(135deg,${item.c1},${item.c2})` }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color: T.textSub }}>{item.name}</div>
                    <div style={{ fontSize:'11px', color: T.textMuted }}>Rs. {item.price.toLocaleString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
          <Link to="/wishlist" style={{ position:'relative', width:'36px', height:'36px', borderRadius:'8px',
            border:`1px solid ${T.border}`, background: T.inputBg, textDecoration:'none',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlistCount > 0 ? '#e11d48' : 'none'}
              stroke={wishlistCount > 0 ? '#e11d48' : T.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {wishlistCount > 0 && (
              <span style={{ position:'absolute', top:'-4px', right:'-4px', background:'#e11d48', color:'#fff',
                borderRadius:'50%', width:'14px', height:'14px', fontSize:'8px',
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>{wishlistCount}</span>
            )}
          </Link>

          <button onClick={toggleTheme} className="btn-press"
            style={{ width:'36px', height:'36px', borderRadius:'8px', border:`1px solid ${T.border}`,
              background: T.inputBg, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {T.mode === 'dark'
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>

          {/* USER AUTH BUTTON */}
          {user ? (
            <div ref={userMenuRef} style={{ position:'relative' }}>
              <button onClick={() => setUserMenuOpen(o => !o)} style={{
                display:'flex', alignItems:'center', gap:'7px',
                background:'linear-gradient(90deg,rgba(109,40,217,0.2),rgba(14,165,233,0.2))',
                border:'1px solid rgba(109,40,217,0.4)', color:'#a78bfa',
                padding:'7px 14px', borderRadius:'8px', fontWeight:900,
                fontSize:'10px', letterSpacing:'1px', cursor:'pointer', fontFamily:"'Rajdhani',sans-serif",
              }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%',
                  background:'linear-gradient(135deg,#6d28d9,#0ea5e9)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'8px', color:'#fff', fontWeight:900 }}>
                  {user.username?.slice(0,1).toUpperCase()}
                </div>
                {user.username?.toUpperCase()}
              </button>
              {userMenuOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, minWidth:'170px',
                  background: T.mode==='dark' ? '#0d1030' : '#fff',
                  border:`1px solid ${T.border}`, borderRadius:'10px',
                  boxShadow:'0 20px 40px rgba(0,0,0,0.3)', zIndex:1000, overflow:'hidden' }}>
                  <Link to="/library" onClick={() => setUserMenuOpen(false)}
                    style={{ display:'block', padding:'10px 16px', textDecoration:'none',
                      color: T.textSub, fontSize:'12px', fontWeight:700, borderBottom:`1px solid ${T.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = T.inputBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    MY LIBRARY ({user.library?.length || 0})
                  </Link>
                  <button onClick={() => { logout(); setUserMenuOpen(false); }}
                    style={{ width:'100%', padding:'10px 16px', textAlign:'left', background:'none',
                      border:'none', cursor:'pointer', color:'#ef4444', fontSize:'12px', fontWeight:700,
                      fontFamily:"'Rajdhani',sans-serif" }}>
                    LOGOUT
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={onAuthOpen} className="btn-press" style={{
              padding:'8px 16px', borderRadius:'8px', border:'1px solid rgba(109,40,217,0.4)',
              background: T.inputBg, color:'#a78bfa', fontWeight:900, fontSize:'10px',
              letterSpacing:'2px', cursor:'pointer', fontFamily:"'Rajdhani',sans-serif",
            }}>LOGIN</button>
          )}

          <Link to="/cart" className="btn-press" style={{
            display:'flex', alignItems:'center', gap:'7px',
            background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
            textDecoration:'none', padding:'8px 16px', borderRadius:'8px',
            fontWeight:900, fontSize:'10px', letterSpacing:'2px',
            boxShadow:'0 4px 16px rgba(109,40,217,0.4)', fontFamily:"'Rajdhani',sans-serif",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            CART <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:'20px', padding:'1px 7px', fontSize:'9px' }}>{cartCount}</span>
          </Link>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'2px', padding:'0 28px 8px', borderTop:`1px solid ${T.border}` }}>
        {[['/', 'HOME'],['/devices','ARMORY'],['/deals','DEALS'],['/wishlist','WISHLIST'],['/library','LIBRARY'],['/blog','BLOG'],['/about','ABOUT'],['/faq','FAQ']].map(([path, label]) => (
          <Link key={path} to={path} className="nav-link" style={{
            color: active(path) ? '#a78bfa' : T.textMuted, textDecoration:'none',
            fontWeight:700, fontSize:'10px', letterSpacing:'2px', padding:'5px 11px', borderRadius:'6px',
            background: active(path) ? 'rgba(109,40,217,0.12)' : 'transparent', transition:'all .2s', whiteSpace:'nowrap',
          }}>{label}</Link>
        ))}
      </div>
    </nav>
  );
}

/* ─── PRODUCT CARD ─── */
function ProductCard({ item, onAdd, onWishlist, inWishlist, onAuthOpen }) {
  const { T } = useTheme();
  const { user } = useAuth();
  const [added, setAdded]       = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchMsg, setLaunchMsg] = useState('');
  const specs    = SPECS[item.id] || [];
  const dealInfo = DEALS.find(d => d.id === item.id);
  const displayPrice = dealInfo ? Math.round(item.price * (1 - dealInfo.discount / 100)) : item.price;
  const inLibrary = user?.library?.includes(item.id);

  const handleAdd = () => { onAdd(item); setAdded(true); setTimeout(() => setAdded(false), 1500); };

  const handleLaunch = async () => {
    if (!user) { onAuthOpen?.(); return; }
    setLaunching(true); setLaunchMsg('');
    try {
      const res = await sessionsApi.launch(item.id);
      setLaunchMsg(`🎮 Session started! ID: ${res.data.session.id.slice(0,8)}...`);
    } catch (e) {
      setLaunchMsg(e.message);
    } finally {
      setLaunching(false);
      setTimeout(() => setLaunchMsg(''), 3500);
    }
  };

  return (
    <div className="card-hover" style={{ flex:'0 0 210px', borderRadius:'14px', overflow:'hidden',
      background: T.bgCard, border:`1px solid ${T.border}`, position:'relative', transition:'box-shadow .24s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = T.cardHover}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

      <ProductImage item={item} />

      <div style={{ position:'absolute', top:'10px', left:'10px',
        background: T.tagBg, backdropFilter:'blur(8px)', border:`1px solid ${T.tagBorder}`,
        color: T.mode === 'dark' ? '#e8e0ff' : '#4c1d95',
        fontSize:'8px', fontWeight:700, letterSpacing:'1.5px', padding:'3px 9px', borderRadius:'20px' }}>
        {item.tag}
      </div>

      {onWishlist && (
        <button onClick={() => onWishlist(item)} style={{
          position:'absolute', top:'10px', right:'10px', width:'28px', height:'28px', borderRadius:'8px',
          background: T.tagBg, border:`1px solid ${T.tagBorder}`, cursor:'pointer', fontSize:'14px',
          display:'flex', alignItems:'center', justifyContent:'center',
          color: inWishlist ? '#e11d48' : T.textMuted,
        }}>{inWishlist ? '♥' : '♡'}</button>
      )}

      {item.stock <= 3 && (
        <div style={{ position:'absolute', bottom:'145px', left:'10px',
          background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)',
          color:'#ef4444', fontSize:'8px', fontWeight:700, letterSpacing:'1px', padding:'2px 8px', borderRadius:'20px',
          animation:'pulse 2s infinite' }}>
          ONLY {item.stock} LEFT
        </div>
      )}

      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'7px' }}>
          <span style={{ fontSize:'8px', fontWeight:900, letterSpacing:'2px', padding:'2px 8px',
            borderRadius:'20px', color:'#fff', background:CAT_GRAD[item.cat] }}>
            {item.cat.toUpperCase()}
          </span>
          <button onClick={() => setSpecsOpen(s => !s)} style={{
            background:'none', border:'none', cursor:'pointer', fontSize:'9px', color: T.textMuted,
            letterSpacing:'1px', fontFamily:"'Rajdhani',sans-serif", fontWeight:700, padding:'2px 6px',
          }}>{specsOpen ? 'LESS ▲' : 'SPECS ▼'}</button>
        </div>

        <div style={{ fontSize:'13px', fontWeight:700, color: T.textSub, lineHeight:1.35, marginBottom:'5px' }}>{item.name}</div>

        {specsOpen && specs.length > 0 && (
          <div style={{ marginBottom:'8px', background: T.mode === 'dark' ? 'rgba(109,40,217,0.06)' : 'rgba(109,40,217,0.04)',
            borderRadius:'6px', padding:'7px 9px', border:`1px solid ${T.border}` }}>
            {specs.map((s, i) => (
              <div key={i} style={{ fontSize:'10px', color: T.textMuted, padding:'2px 0',
                borderBottom: i < specs.length-1 ? `1px solid ${T.border}` : 'none' }}>{s}</div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
          <div style={{ fontSize:'17px', fontWeight:900,
            background:'linear-gradient(90deg,#a78bfa,#60a5fa)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Rs. {displayPrice.toLocaleString()}
          </div>
          {dealInfo && <>
            <div style={{ textDecoration:'line-through', fontSize:'11px', color: T.textMuted }}>
              Rs. {item.price.toLocaleString()}
            </div>
            <div style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)',
              color:'#10b981', fontSize:'8px', fontWeight:700, letterSpacing:'1px', padding:'2px 6px', borderRadius:'20px' }}>
              -{dealInfo.discount}%
            </div>
          </>}
        </div>

        <button className="btn-press" onClick={handleAdd} style={{
          width:'100%', padding:'8px', border:'none', borderRadius:'8px', color:'#fff',
          fontWeight:900, fontSize:'10px', letterSpacing:'2px', cursor:'pointer',
          fontFamily:"'Rajdhani',sans-serif", transition:'all .2s', marginBottom:'5px',
          background: added ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#6d28d9,#0ea5e9)',
          boxShadow: added ? '0 4px 14px rgba(5,150,105,0.4)' : '0 4px 14px rgba(109,40,217,0.3)',
        }}>{added ? '✓ ADDED TO CART' : 'ADD TO CART'}</button>

        {inLibrary && (
          <button className="btn-press" onClick={handleLaunch} disabled={launching} style={{
            width:'100%', padding:'6px', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'8px',
            background:'rgba(16,185,129,0.08)', color:'#10b981',
            fontWeight:900, fontSize:'9px', letterSpacing:'2px', cursor:'pointer',
            fontFamily:"'Rajdhani',sans-serif",
          }}>{launching ? 'LAUNCHING...' : '▶ LAUNCH SESSION'}</button>
        )}

        {launchMsg && (
          <div style={{ fontSize:'10px', color:'#10b981', marginTop:'5px', textAlign:'center', lineHeight:1.4 }}>{launchMsg}</div>
        )}
      </div>
    </div>
  );
}

/* ─── CAROUSEL ─── */
function Carousel({ title, items, onAdd, onWishlist, wishlist, onAuthOpen }) {
  const { T } = useTheme();
  const ref = useRef(null);
  const scroll = d => ref.current?.scrollBy({ left: d * 240, behavior:'smooth' });
  return (
    <div style={{ padding:'4px 0 32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', marginBottom:'14px' }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'13px', fontWeight:700, letterSpacing:'3px', color:'#a78bfa' }}>{title}</div>
        <div style={{ display:'flex', gap:'6px' }}>
          {['‹','›'].map((a, i) => (
            <button key={a} className="btn-press" onClick={() => scroll(i ? 1 : -1)} style={{
              width:'30px', height:'30px', borderRadius:'7px', border:`1px solid ${T.border}`,
              background: T.inputBg, color:'#a78bfa', cursor:'pointer', fontSize:'17px',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>{a}</button>
          ))}
        </div>
      </div>
      <div ref={ref} className="rail"
        style={{ display:'flex', gap:'13px', overflowX:'auto', padding:'6px 32px 12px' }}
        onWheel={e => { e.preventDefault(); ref.current.scrollLeft += e.deltaY * 2; }}>
        {items.map(d => (
          <ProductCard key={d.id} item={d} onAdd={onAdd} onWishlist={onWishlist}
            inWishlist={wishlist?.some(w => w.id === d.id)} onAuthOpen={onAuthOpen} />
        ))}
      </div>
    </div>
  );
}

/* ─── LIBRARY PAGE ─── */
// FIX 5: Removed unused `login` destructure from useAuth (was causing dead import warning
// that could mask real runtime errors in strict linting setups)
function LibraryPage({ onAdd, onWishlist, wishlist, onAuthOpen }) {
  const { T }    = useTheme();
  const { user } = useAuth();
  const [apiError, setApiError] = useState('');

  if (!user) return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:'18px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'16px', letterSpacing:'3px', color: T.textMuted }}>LOGIN TO VIEW YOUR LIBRARY</div>
      <button onClick={onAuthOpen} style={{ background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
        border:'none', padding:'12px 32px', borderRadius:'10px', fontWeight:900,
        fontSize:'12px', letterSpacing:'3px', cursor:'pointer', fontFamily:"'Rajdhani',sans-serif" }}>
        LOG IN / REGISTER
      </button>
    </div>
  );

  const libraryItems = ALL.filter(item => user.library?.includes(item.id));

  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'28px', fontWeight:900, letterSpacing:'4px', marginBottom:'6px',
        background:'linear-gradient(90deg,#10b981,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        MY LIBRARY
      </div>
      <div style={{ color: T.textMuted, fontSize:'10px', letterSpacing:'3px', marginBottom:'28px' }}>
        {libraryItems.length} OWNED DEVICES · LAUNCH ANY GAME SESSION FROM HERE
      </div>

      {apiError && (
        <div style={{ padding:'10px', borderRadius:'8px', background:'rgba(239,68,68,0.1)',
          border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontSize:'12px', marginBottom:'16px' }}>
          {apiError}
        </div>
      )}

      {libraryItems.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ fontSize:'13px', color: T.textMuted, letterSpacing:'2px', marginBottom:'16px' }}>NO ITEMS IN LIBRARY YET</div>
          <Link to="/devices" style={{ background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
            textDecoration:'none', padding:'12px 32px', borderRadius:'10px',
            fontWeight:900, fontSize:'12px', letterSpacing:'3px' }}>BROWSE ARMORY</Link>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
          {libraryItems.map(item => (
            <ProductCard key={item.id} item={item} onAdd={onAdd} onWishlist={onWishlist}
              inWishlist={wishlist?.some(w => w.id === item.id)} onAuthOpen={onAuthOpen} />
          ))}
        </div>
      )}
      <div style={{ marginTop:'44px' }}><Footer /></div>
    </div>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer style={{ background:'#040612', borderTop:'1px solid rgba(109,40,217,0.15)', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'24px', padding:'44px 32px 28px' }}>
        <div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:900, fontSize:'16px', letterSpacing:'3px', marginBottom:'10px',
            background:'linear-gradient(90deg,#a78bfa,#38bdf8)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>LIVVORA</div>
          <div style={{ color:'#3d3060', fontSize:'12px', lineHeight:1.85, marginBottom:'14px' }}>Pakistan's #1 premium gaming store. Authentic products, fast delivery, 1-year warranty.</div>
          <div style={{ display:'flex', gap:'7px' }}>
            {['F','I','X','Y'].map(ic => (
              <div key={ic} className="social-btn" style={{ width:'30px', height:'30px', borderRadius:'7px',
                border:'1px solid rgba(109,40,217,0.25)', background:'rgba(109,40,217,0.06)',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                fontSize:'11px', fontWeight:700, color:'#6d28d9', transition:'all .2s' }}>{ic}</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'3px', color:'#6d28d9', marginBottom:'13px' }}>SHOP</div>
          {[['Consoles','/devices'],['Handhelds','/devices'],['Controllers','/devices'],['Accessories','/devices'],['Deals','/deals']].map(([l,h]) => (
            <Link key={l} to={h} className="foot-link" style={{ display:'block', color:'#3d3060', textDecoration:'none', fontSize:'12px', marginBottom:'7px', transition:'color .2s' }}>{l}</Link>
          ))}
        </div>
        <div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'3px', color:'#6d28d9', marginBottom:'13px' }}>COMPANY</div>
          {[['Home','/'],['About','/about'],['Blog','/blog'],['FAQ','/faq'],['Library','/library']].map(([l,h]) => (
            <Link key={l} to={h} className="foot-link" style={{ display:'block', color:'#3d3060', textDecoration:'none', fontSize:'12px', marginBottom:'7px', transition:'color .2s' }}>{l}</Link>
          ))}
        </div>
        <div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'3px', color:'#6d28d9', marginBottom:'13px' }}>SUPPORT</div>
          <div style={{ color:'#3d3060', fontSize:'12px', lineHeight:2.1 }}>
            <div>Lahore, Punjab, Pakistan</div>
            <div>+92 300 0000000</div>
            <div>support@livvora.pk</div>
            <div>Mon–Sat, 10am–8pm PKT</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'3px', color:'#6d28d9', marginBottom:'13px' }}>NEWSLETTER</div>
          <div style={{ color:'#3d3060', fontSize:'11px', marginBottom:'10px', lineHeight:1.7 }}>Get exclusive deals, new arrivals & gaming news.</div>
          <input placeholder="your@email.com" style={{ width:'100%', padding:'8px 10px', borderRadius:'7px',
            border:'1px solid rgba(109,40,217,0.25)', background:'rgba(109,40,217,0.06)', color:'#a78bfa',
            fontSize:'11px', fontFamily:"'Rajdhani',sans-serif", outline:'none', marginBottom:'7px' }} />
          <button className="btn-press" style={{ width:'100%', padding:'8px', borderRadius:'7px', border:'none',
            background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
            fontWeight:900, fontSize:'9px', letterSpacing:'2px', cursor:'pointer', fontFamily:"'Rajdhani',sans-serif" }}>
            SUBSCRIBE
          </button>
        </div>
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.04)', padding:'14px 32px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'7px',
        color:'#1e1840', fontSize:'9px', letterSpacing:'1px' }}>
        <span>© 2026 LIVVORA ELITE HUB. ALL RIGHTS RESERVED.</span>
        <span style={{ display:'flex', gap:'14px' }}>
          {['Privacy Policy','Terms of Service','Refund Policy','Warranty Policy'].map(t => (
            <span key={t} style={{ cursor:'pointer' }}>{t}</span>
          ))}
        </span>
      </div>
    </footer>
  );
}

/* ─── HOME PAGE ─── */
function Home({ onAdd, onWishlist, wishlist, onAuthOpen }) {
  const { T } = useTheme();
  const featuredDeals = DEALS.map(d => ({ ...ALL.find(a => a.id === d.id), ...d }));
  return (
    <div style={{ minHeight:'100vh', background: T.bg, transition:'background .3s' }}>
      <div style={{ background: T.announceBg, padding:'8px 32px', textAlign:'center',
        fontSize:'10px', fontWeight:700, letterSpacing:'3px', color:'#fff' }}>
        FREE DELIVERY ON ORDERS ABOVE RS. 5,000 · USE CODE LIVVORA10 FOR 10% OFF · SAME-DAY DELIVERY IN LAHORE
      </div>
      <div style={{ position:'relative', overflow:'hidden', padding:'90px 40px 64px', textAlign:'center' }}>
        <div style={{ position:'absolute', inset:0, background: T.heroGrad, pointerEvents:'none' }} />
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'clamp(34px,7.5vw,82px)', fontWeight:900, lineHeight:1.05,
          letterSpacing:'2px', marginBottom:'14px', background: T.heroTitleGrad,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          LIVVORA<br/>ELITE HUB
        </div>
        <div style={{ fontSize:'12px', letterSpacing:'5px', color: T.heroSub, marginBottom:'8px' }}>Pakistan's Premium Gaming Hardware Store</div>
        <div style={{ fontSize:'11px', letterSpacing:'3px', color: T.textMuted, marginBottom:'32px' }}>28+ Devices · Authentic · 1-Year Warranty · Nationwide Delivery</div>
        <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap', marginBottom:'40px' }}>
          <Link to="/devices" className="btn-press" style={{ background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
            textDecoration:'none', padding:'12px 36px', borderRadius:'10px', fontWeight:900,
            fontSize:'12px', letterSpacing:'3px', boxShadow:'0 8px 28px rgba(109,40,217,0.4)', fontFamily:"'Rajdhani',sans-serif" }}>
            ENTER THE ARMORY
          </Link>
          <Link to="/deals" className="btn-press" style={{ background:'transparent', color:'#a78bfa',
            textDecoration:'none', padding:'12px 26px', borderRadius:'10px', fontWeight:700, fontSize:'12px',
            letterSpacing:'2px', border:'1px solid rgba(167,139,250,0.35)', fontFamily:"'Rajdhani',sans-serif" }}>
            VIEW DEALS
          </Link>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:'32px', flexWrap:'wrap' }}>
          {[['28+','Devices'],['5,000+','Gamers'],['100%','Authentic'],['1yr','Warranty'],['Free','Delivery']].map(([n,l]) => (
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'20px', fontWeight:900,
                background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{n}</div>
              <div style={{ fontSize:'9px', letterSpacing:'2px', color: T.heroSub }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', padding:'0 32px 8px' }}>
        {[
          { label:'CONSOLES',    sub:'PS5 · Xbox · Nintendo',    bg:'linear-gradient(135deg,#4c1d95,#7c3aed)', count: CONSOLES.length },
          { label:'HANDHELDS',   sub:'ROG Ally · Steam Deck',    bg:'linear-gradient(135deg,#0c4a6e,#0284c7)', count: HANDHELDS.length },
          { label:'CONTROLLERS', sub:'DualSense · Elite · ROG',  bg:'linear-gradient(135deg,#78350f,#d97706)', count: CONTROLLERS.length },
          { label:'ACCESSORIES', sub:'Headsets · Docks · Cases', bg:'linear-gradient(135deg,#064e3b,#059669)', count: ACCESSORIES.length },
        ].map(c => (
          <Link key={c.label} to="/devices" style={{ textDecoration:'none' }}>
            <div className="btn-press card-hover" style={{ background:c.bg, borderRadius:'12px', padding:'18px 14px',
              color:'#fff', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'9px', fontWeight:700, letterSpacing:'2px', marginBottom:'4px' }}>{c.label}</div>
              <div style={{ fontSize:'10px', opacity:.65, marginBottom:'6px', lineHeight:1.4 }}>{c.sub}</div>
              <div style={{ fontSize:'9px', opacity:.5, letterSpacing:'1px' }}>{c.count} PRODUCTS</div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ padding:'36px 32px 8px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'13px', fontWeight:700, letterSpacing:'3px', color:'#10b981' }}>FEATURED DEALS</div>
          <Link to="/deals" style={{ fontSize:'10px', color:'#10b981', textDecoration:'none', letterSpacing:'2px', fontWeight:700 }}>VIEW ALL →</Link>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
          {featuredDeals.map(item => (
            <ProductCard key={item.id} item={item} onAdd={onAdd} onWishlist={onWishlist}
              inWishlist={wishlist?.some(w => w.id === item.id)} onAuthOpen={onAuthOpen} />
          ))}
        </div>
      </div>
      <div style={{ paddingTop:'28px' }}>
        <Carousel title="CONSOLES"    items={CONSOLES}    onAdd={onAdd} onWishlist={onWishlist} wishlist={wishlist} onAuthOpen={onAuthOpen} />
        <Carousel title="HANDHELDS"   items={HANDHELDS}   onAdd={onAdd} onWishlist={onWishlist} wishlist={wishlist} onAuthOpen={onAuthOpen} />
        <Carousel title="CONTROLLERS" items={CONTROLLERS} onAdd={onAdd} onWishlist={onWishlist} wishlist={wishlist} onAuthOpen={onAuthOpen} />
        <Carousel title="ACCESSORIES" items={ACCESSORIES} onAdd={onAdd} onWishlist={onWishlist} wishlist={wishlist} onAuthOpen={onAuthOpen} />
      </div>
      <div style={{ padding:'44px 32px 8px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'16px', fontWeight:700, letterSpacing:'3px', color:'#a78bfa' }}>WHY LIVVORA?</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'12px' }}>
          {[
            { t:'100% Authentic',   d:'Every product includes manufacturer warranty and official invoice.' },
            { t:'Fast Delivery',    d:'Same-day Lahore. 2–3 days nationwide via TCS / Leopards.' },
            { t:'Secure Payments',  d:'Card, JazzCash, EasyPaisa, Bank Transfer & Cash on Delivery.' },
            { t:'1-Year Warranty',  d:'Full warranty on all consoles and handheld devices.' },
            { t:'WhatsApp Support', d:'Instant support via WhatsApp, Mon–Sat 10am to 8pm.' },
            { t:'Easy Returns',     d:'7-day return window on all unopened or defective items.' },
          ].map(w => (
            <div key={w.t} style={{ background: T.bgCard, borderRadius:'12px', padding:'20px 16px',
              border:`1px solid ${T.border}`, textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:'13px', color: T.textSub, marginBottom:'7px' }}>{w.t}</div>
              <div style={{ fontSize:'11px', color: T.textMuted, lineHeight:1.7 }}>{w.d}</div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ─── ARMORY PAGE ─── */
function Armory({ onAdd, onWishlist, wishlist, onAuthOpen }) {
  const { T } = useTheme();
  const [filter, setFilter] = useState('All');
  const [sort, setSort]     = useState('default');
  const [search, setSearch] = useState('');
  const cats = ['All','Console','Handheld','Controller','Accessory'];
  let filtered = filter === 'All' ? ALL : ALL.filter(d => d.cat === filter);
  if (search.trim()) filtered = filtered.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  if (sort === 'price-asc')  filtered = [...filtered].sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') filtered = [...filtered].sort((a,b) => b.price - a.price);
  if (sort === 'name')       filtered = [...filtered].sort((a,b) => a.name.localeCompare(b.name));
  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'28px', fontWeight:900, letterSpacing:'4px',
        background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>THE ARMORY</div>
      <div style={{ color: T.textMuted, letterSpacing:'3px', fontSize:'10px', marginTop:'5px', marginBottom:'20px' }}>{filtered.length} PRODUCTS IN STOCK</div>
      <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {cats.map(c => (
            <button key={c} className="btn-press" onClick={() => setFilter(c)} style={{
              padding:'6px 16px', borderRadius:'8px', border:'1px solid', transition:'all .2s', cursor:'pointer',
              borderColor: filter===c ? '#6d28d9' : T.border,
              background: filter===c ? 'linear-gradient(90deg,#6d28d9,#0ea5e9)' : T.inputBg,
              color: filter===c ? '#fff' : T.textMuted,
              fontWeight:800, fontSize:'10px', letterSpacing:'2px', fontFamily:"'Rajdhani',sans-serif",
            }}>{c.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:'180px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name..."
            style={{ width:'100%', padding:'7px 12px', borderRadius:'8px', border:`1px solid ${T.inputBorder}`,
              background: T.inputBg, color: T.inputText, fontSize:'12px', fontFamily:"'Rajdhani',sans-serif", outline:'none' }} />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          padding:'7px 12px', borderRadius:'8px', border:`1px solid ${T.inputBorder}`,
          background: T.inputBg, color: T.textMuted, fontSize:'11px', fontFamily:"'Rajdhani',sans-serif", outline:'none', cursor:'pointer',
        }}>
          <option value="default">SORT: DEFAULT</option>
          <option value="price-asc">PRICE: LOW → HIGH</option>
          <option value="price-desc">PRICE: HIGH → LOW</option>
          <option value="name">NAME: A → Z</option>
        </select>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
        {filtered.map(d => (
          <ProductCard key={d.id} item={d} onAdd={onAdd} onWishlist={onWishlist}
            inWishlist={wishlist?.some(w => w.id === d.id)} onAuthOpen={onAuthOpen} />
        ))}
      </div>
      <div style={{ marginTop:'44px' }}><Footer /></div>
    </div>
  );
}

/* ─── DEALS PAGE ─── */
function DealsPage({ onAdd, onWishlist, wishlist, onAuthOpen }) {
  const { T } = useTheme();
  const dealItems = DEALS.map(d => ({ ...ALL.find(a => a.id === d.id), ...d }));
  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'28px', fontWeight:900, letterSpacing:'4px',
        background:'linear-gradient(90deg,#10b981,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'6px' }}>
        CURRENT DEALS</div>
      <div style={{ color: T.textMuted, fontSize:'10px', letterSpacing:'3px', marginBottom:'28px' }}>LIMITED TIME OFFERS · WHILE STOCKS LAST</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px', marginBottom:'40px' }}>
        {dealItems.map(item => (
          <ProductCard key={item.id} item={item} onAdd={onAdd} onWishlist={onWishlist}
            inWishlist={wishlist?.some(w => w.id === item.id)} onAuthOpen={onAuthOpen} />
        ))}
      </div>
      <div style={{ background: T.bgCard, borderRadius:'14px', padding:'28px', border:`1px solid ${T.border}`, textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'14px', fontWeight:700, letterSpacing:'2px', color:'#a78bfa', marginBottom:'8px' }}>BUNDLE DISCOUNTS</div>
        <div style={{ color: T.textMuted, fontSize:'12px', lineHeight:2 }}>
          Buy any Console + Controller → <span style={{ color:'#10b981', fontWeight:700 }}>Extra 3% OFF</span><br />
          Buy any Handheld + Accessory → <span style={{ color:'#10b981', fontWeight:700 }}>Extra 5% OFF</span><br />
          Buy 3+ items in one order → <span style={{ color:'#10b981', fontWeight:700 }}>Extra 7% OFF</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ─── WISHLIST PAGE ─── */
function WishlistPage({ wishlist, onAdd, onWishlist, onAuthOpen }) {
  const { T } = useTheme();
  if (!wishlist.length) return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:'18px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'16px', letterSpacing:'3px', color: T.textMuted }}>WISHLIST IS EMPTY</div>
      <Link to="/devices" style={{ background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
        textDecoration:'none', padding:'12px 32px', borderRadius:'10px', fontWeight:900, fontSize:'12px', letterSpacing:'3px', fontFamily:"'Rajdhani',sans-serif" }}>
        BROWSE ARMORY
      </Link>
    </div>
  );
  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'24px', fontWeight:900, letterSpacing:'4px', marginBottom:'24px',
        background:'linear-gradient(90deg,#e11d48,#f97316)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        WISHLIST ({wishlist.length})</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
        {wishlist.map(item => (
          <ProductCard key={item.id} item={item} onAdd={onAdd} onWishlist={onWishlist} inWishlist onAuthOpen={onAuthOpen} />
        ))}
      </div>
      <div style={{ marginTop:'44px' }}><Footer /></div>
    </div>
  );
}

/* ─── BLOG PAGE ─── */
const POSTS = [
  { id:1, title:'ROG Ally Z1 Extreme vs Steam Deck OLED: Which Handheld is Right for You?', date:'Apr 28, 2026', cat:'REVIEW', read:'6 min' },
  { id:2, title:'Top 5 Gaming Controllers for Competitive Play in 2026', date:'Apr 20, 2026', cat:'GUIDE', read:'4 min' },
  { id:3, title:'PS5 vs Xbox Series X in 2026: Still Worth It?', date:'Apr 12, 2026', cat:'COMPARISON', read:'5 min' },
  { id:4, title:'How to Choose the Best Gaming Headset for Your Budget', date:'Apr 5, 2026', cat:'GUIDE', read:'3 min' },
  { id:5, title:'Nintendo Switch 2 Launch Review: Is the Upgrade Worth It?', date:'Mar 28, 2026', cat:'REVIEW', read:'7 min' },
  { id:6, title:'Setting Up Your Home Gaming Station on a Budget', date:'Mar 15, 2026', cat:'SETUP', read:'5 min' },
];
function BlogPage() {
  const { T } = useTheme();
  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'28px', fontWeight:900, letterSpacing:'4px',
        background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'6px' }}>GAMING BLOG</div>
      <div style={{ color: T.textMuted, fontSize:'10px', letterSpacing:'3px', marginBottom:'28px' }}>REVIEWS · GUIDES · NEWS</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
        {POSTS.map(p => (
          <div key={p.id} className="card-hover" style={{ background: T.bgCard, borderRadius:'14px', padding:'22px',
            border:`1px solid ${T.border}`, cursor:'pointer' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = T.cardHover}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <span style={{ fontSize:'8px', fontWeight:900, letterSpacing:'2px', padding:'3px 9px', borderRadius:'20px',
                background:'rgba(109,40,217,0.12)', color:'#a78bfa' }}>{p.cat}</span>
              <span style={{ fontSize:'10px', color: T.textMuted }}>{p.read} read</span>
            </div>
            <div style={{ fontWeight:700, fontSize:'14px', color: T.textSub, lineHeight:1.45, marginBottom:'10px' }}>{p.title}</div>
            <div style={{ fontSize:'11px', color: T.textMuted }}>{p.date}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:'44px' }}><Footer /></div>
    </div>
  );
}

/* ─── CART ─── */
function Cart({ cart, setCart }) {
  const { T } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payMethod, setPayMethod] = useState('card');
  const [success, setSuccess]     = useState(false);
  const [form, setForm]           = useState({ name:'', phone:'', address:'', cardNumber:'', cardName:'', expMonth:'', expYear:'', cvv:'', mobileNum:'', bankName:'', iban:'' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fmtCard  = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtMonth = v => { const n = v.replace(/\D/g,'').slice(0,2); return n.length===2 && +n>12 ? '12' : n; };
  const remove   = idx => setCart(p => p.filter((_,i) => i !== idx));
  const subtotal = cart.reduce((s,i) => s + i.price, 0);
  const shipping = cart.length ? 500 : 0;
  const total    = subtotal + shipping;

  const handleOrder = () => {
    if (!form.name || !form.phone) { alert('Please fill in Name and Phone!'); return; }
    setSuccess(true); setCart([]);
    setTimeout(() => navigate('/'), 3500);
  };

  const inp = (ph, key, extra={}) => (
    <input key={key} placeholder={ph} type={extra.type||'text'} maxLength={extra.max} value={form[key]}
      onChange={e => { let v = e.target.value;
        if (key==='cardNumber') v=fmtCard(v);
        if (key==='expMonth') v=fmtMonth(v);
        if (key==='expYear') v=v.replace(/\D/g,'').slice(0,2);
        if (key==='cvv') v=v.replace(/\D/g,'').slice(0,4);
        set(key,v);
      }}
      style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', outline:'none', marginBottom:'8px',
        border:`1px solid ${form[key] ? T.borderHi : T.inputBorder}`,
        background: T.inputBg, color: T.inputText, fontSize:'13px', boxSizing:'border-box',
        fontFamily: key==='cardNumber' ? "'Orbitron',sans-serif" : "'Rajdhani',sans-serif",
        letterSpacing: key==='cardNumber' ? '3px':'normal', transition:'border-color .2s' }} />
  );

  if (success) return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', fontFamily:"'Rajdhani',sans-serif" }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'20px', fontWeight:900, letterSpacing:'3px',
          background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'10px' }}>
          ORDER CONFIRMED!</div>
        <div style={{ color: T.textMuted, fontSize:'13px' }}>Our team will WhatsApp you within 30 minutes.</div>
        <div style={{ color: T.textDim, fontSize:'11px', marginTop:'5px' }}>Redirecting to home...</div>
      </div>
    </div>
  );

  if (!cart.length) return (
    <div style={{ minHeight:'100vh', background: T.bg, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:'18px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'16px', letterSpacing:'3px', color: T.textMuted }}>CART IS EMPTY</div>
      <Link to="/devices" style={{ background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', color:'#fff',
        textDecoration:'none', padding:'12px 32px', borderRadius:'10px', fontWeight:900, fontSize:'12px', letterSpacing:'3px', fontFamily:"'Rajdhani',sans-serif" }}>
        BROWSE ARMORY
      </Link>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background: T.bg, padding:'40px 32px', fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'24px', fontWeight:900, letterSpacing:'3px', marginBottom:'24px',
        background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        CART ({cart.length})</div>
      {/* FIX 6: Cart grid — use proper responsive columns that don't break on narrow screens */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr min(390px, 100%)', gap:'20px', alignItems:'start' }}>
        <div>
          {cart.map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'13px',
              background: T.bgCard, borderRadius:'12px', padding:'13px', marginBottom:'9px', border:`1px solid ${T.border}` }}>
              <div style={{ width:'56px', height:'56px', borderRadius:'10px', flexShrink:0,
                background:`linear-gradient(135deg,${item.c1},${item.c2})` }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:700, color: T.textSub }}>{item.name}</div>
                <div style={{ fontSize:'14px', fontWeight:900, background:'linear-gradient(90deg,#a78bfa,#60a5fa)',
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginTop:'3px' }}>
                  Rs. {item.price.toLocaleString()}</div>
              </div>
              <button onClick={() => remove(i)} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                color:'#ef4444', cursor:'pointer', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', fontFamily:"'Rajdhani',sans-serif" }}>✕</button>
            </div>
          ))}
        </div>

        <div style={{ background: T.bgPanel, borderRadius:'16px', padding:'20px', border:`1px solid ${T.border}`, position:'sticky', top:'70px' }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'12px', fontWeight:700, letterSpacing:'2px', color:'#a78bfa', marginBottom:'14px' }}>ORDER SUMMARY</div>
          {[[`Subtotal (${cart.length})`,`Rs. ${subtotal.toLocaleString()}`],['Shipping',`Rs. ${shipping.toLocaleString()}`],['Discount','Rs. 0']].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontSize:'12px', color: T.textMuted }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${T.border}`, margin:'10px 0' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:900, fontSize:'15px', color: T.text, marginBottom:'16px' }}>
            <span>TOTAL</span><span>Rs. {total.toLocaleString()}</span>
          </div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'2px', color:'#6d28d9', marginBottom:'9px' }}>PAYMENT METHOD</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'13px' }}>
            {[['card','Card'],['jazz','JazzCash'],['easy','EasyPaisa'],['bank','Bank'],['cod','Cash on Delivery']].map(([id,lb]) => (
              <button key={id} className="btn-press" onClick={() => setPayMethod(id)} style={{
                padding:'8px 5px', borderRadius:'8px', border:'1px solid', cursor:'pointer',
                borderColor: payMethod===id ? '#6d28d9' : T.border,
                background: payMethod===id ? 'rgba(109,40,217,0.15)' : T.inputBg,
                color: payMethod===id ? '#a78bfa' : T.textMuted,
                fontWeight:800, fontSize:'9px', letterSpacing:'1px', fontFamily:"'Rajdhani',sans-serif",
                gridColumn: id==='cod' ? 'span 2' : 'span 1', transition:'all .2s',
              }}>{lb}</button>
            ))}
          </div>
          <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'2px', color:'#6d28d9', marginBottom:'8px' }}>DELIVERY DETAILS</div>
          {user && <div style={{ fontSize:'11px', color:'#10b981', marginBottom:'8px', padding:'6px 10px',
            background:'rgba(16,185,129,0.08)', borderRadius:'7px', border:'1px solid rgba(16,185,129,0.2)' }}>
            Logged in as {user.username}
          </div>}
          {inp('Full Name *','name')}
          {inp('Phone / WhatsApp *','phone',{type:'tel'})}
          {inp('Delivery Address','address')}
          {payMethod==='card' && (
            <div>
              <div style={{ fontSize:'9px', fontWeight:900, letterSpacing:'2px', color:'#6d28d9', margin:'5px 0 9px' }}>CARD DETAILS</div>
              {inp('1234  5678  9012  3456','cardNumber')}
              {inp('Cardholder Name','cardName')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'7px' }}>
                <input placeholder="MM" value={form.expMonth} maxLength={2} onChange={e => set('expMonth', fmtMonth(e.target.value))}
                  style={{ padding:'10px 6px', borderRadius:'8px', outline:'none', border:`1px solid ${T.inputBorder}`, background: T.inputBg, color: T.inputText, fontSize:'13px', textAlign:'center', boxSizing:'border-box', fontFamily:"'Rajdhani',sans-serif" }} />
                <input placeholder="YY" value={form.expYear} maxLength={2} onChange={e => set('expYear', e.target.value.replace(/\D/g,'').slice(0,2))}
                  style={{ padding:'10px 6px', borderRadius:'8px', outline:'none', border:`1px solid ${T.inputBorder}`, background: T.inputBg, color: T.inputText, fontSize:'13px', textAlign:'center', boxSizing:'border-box', fontFamily:"'Rajdhani',sans-serif" }} />
                <input placeholder="CVV" value={form.cvv} maxLength={4} type="password" onChange={e => set('cvv', e.target.value.replace(/\D/g,'').slice(0,4))}
                  style={{ padding:'10px 6px', borderRadius:'8px', outline:'none', border:`1px solid ${T.inputBorder}`, background: T.inputBg, color: T.inputText, fontSize:'13px', textAlign:'center', boxSizing:'border-box', fontFamily:"'Rajdhani',sans-serif" }} />
              </div>
            </div>
          )}
          {payMethod==='cod' && (
            <div style={{ fontSize:'11px', color: T.textMuted, lineHeight:1.7, padding:'10px', borderRadius:'8px',
              background: T.inputBg, border:`1px solid ${T.border}`, marginBottom:'2px' }}>
              Pay cash on delivery. Available across Pakistan.
            </div>
          )}
          <button className="btn-press" onClick={handleOrder} style={{
            width:'100%', padding:'12px', border:'none', borderRadius:'10px', color:'#fff',
            fontWeight:900, fontSize:'12px', letterSpacing:'3px', cursor:'pointer',
            fontFamily:"'Orbitron',sans-serif", marginTop:'13px',
            background:'linear-gradient(90deg,#6d28d9,#0ea5e9)', boxShadow:'0 6px 20px rgba(109,40,217,0.4)',
          }}>{payMethod==='cod' ? 'PLACE ORDER' : 'CONFIRM PAYMENT'}</button>
          <div style={{ textAlign:'center', marginTop:'9px', fontSize:'8px', color: T.textDim, letterSpacing:'2px' }}>
            SECURE · 100% AUTHENTIC · FREE RETURNS
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ABOUT ─── */
function About() {
  const { T } = useTheme();
  return (
    <div style={{ minHeight:'100vh', background: T.bg, fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ padding:'70px 32px 48px', textAlign:'center', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'clamp(24px,5vw,42px)', fontWeight:900,
          background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:'12px' }}>LIVVORA ELITE HUB</div>
        <div style={{ color: T.textMuted, fontSize:'13px', lineHeight:1.9, maxWidth:'500px', margin:'0 auto' }}>
          Founded in Lahore, Pakistan. Every product is personally vetted by our team for authenticity and quality.
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(195px,1fr))', gap:'13px', padding:'40px 32px' }}>
        {[
          { name:'Talha', role:'FOUNDER & DEVELOPER', desc:'Built Livvora with a passion for gaming and web technology. CS grad, full-stack developer.' },
          { name:'Gaming Team', role:'PRODUCT CURATORS', desc:'Hardcore gamers who test every device before listing. We play before we sell.' },
          { name:'Logistics', role:'DELIVERY PARTNERS', desc:'Partnered with TCS and Leopards for fast, reliable nationwide delivery.' },
          { name:'Support', role:'CUSTOMER CARE', desc:'6 days a week, 10am–8pm. WhatsApp preferred. Response within 30 minutes.' },
        ].map(m => (
          <div key={m.name} style={{ background: T.bgCard, borderRadius:'14px', padding:'22px', textAlign:'center', border:`1px solid ${T.border}` }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'linear-gradient(135deg,#6d28d9,#0ea5e9)',
              margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif", fontWeight:900, fontSize:'13px', color:'#fff' }}>
              {m.name.slice(0,2).toUpperCase()}</div>
            <div style={{ fontWeight:900, fontSize:'14px', color: T.textSub }}>{m.name}</div>
            <div style={{ fontSize:'8px', letterSpacing:'3px', color:'#6d28d9', margin:'5px 0 9px' }}>{m.role}</div>
            <div style={{ fontSize:'11px', color: T.textMuted, lineHeight:1.7 }}>{m.desc}</div>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}

/* ─── FAQ ─── */
const FAQS = [
  { q:'Are all products 100% authentic?',       a:'Yes. Every product is sourced from official distributors with invoice and original warranty card.' },
  { q:'What payment methods do you accept?',     a:'Credit/Debit Card, JazzCash, EasyPaisa, Bank Transfer, and Cash on Delivery.' },
  { q:'How long does delivery take?',            a:'Same-day in Lahore. 2–3 days in Karachi, Islamabad, Faisalabad. Up to 5 days remote areas.' },
  { q:'Do products come with warranty?',         a:'Consoles and handhelds: 1 year. Controllers and accessories: 6 months.' },
  { q:'Can I return a product?',                 a:'Yes, within 7 days if unopened or defective. Email support@livvora.pk or WhatsApp us.' },
  { q:'How do I use the Library feature?',       a:'Register an account, purchase any device, and it appears in your Library. From there you can launch game sessions.' },
  { q:'What is a Game Session?',                 a:'When you launch a session, we track your play time and device usage. Future features include leaderboards and multiplayer matchmaking.' },
  { q:'Do you offer Cash on Delivery?',          a:'Yes across all of Pakistan. Small handling fee may apply outside Lahore.' },
  { q:'Do you offer bundles or discounts?',      a:'Yes! Check our Deals page. Bundle any console + controller for an extra 3% off.' },
  { q:'How do I track my order?',                a:'WhatsApp tracking message sent within 24 hours of dispatch.' },
];
function FAQ() {
  const { T } = useTheme();
  const [open, setOpen] = useState(null);
  return (
    <div style={{ minHeight:'100vh', background: T.bg, fontFamily:"'Rajdhani',sans-serif" }}>
      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'48px 32px' }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:'28px', fontWeight:900, letterSpacing:'4px', marginBottom:'5px',
          background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>FAQs</div>
        <div style={{ color: T.textMuted, letterSpacing:'3px', fontSize:'9px', marginBottom:'28px' }}>FREQUENTLY ASKED QUESTIONS</div>
        {FAQS.map((f,i) => (
          <div key={i} style={{ background: T.bgCard, borderRadius:'11px', marginBottom:'9px',
            border:`1px solid ${open===i ? T.borderHi : T.border}`, overflow:'hidden' }}>
            <div onClick={() => setOpen(open===i ? null : i)} style={{ padding:'13px 17px', fontWeight:800, fontSize:'13px',
              color: T.textSub, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>{f.q}</span>
              <span style={{ color:'#6d28d9', fontSize:'20px', lineHeight:1, flexShrink:0, marginLeft:'11px' }}>{open===i ? '−' : '+'}</span>
            </div>
            {open===i && <div style={{ padding:'0 17px 13px', fontSize:'12px', color: T.textMuted, lineHeight:1.85 }}>{f.a}</div>}
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}

/* ─── APP ROOT ─── */
export default function App() {
  const [cart, setCart]         = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isDark, setIsDark]     = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const T = isDark ? DARK : LIGHT;
  const toggleTheme = () => setIsDark(d => !d);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('livvora_token');
    if (token) {
      authApi.me()
        .then(res => {
          // FIX 7: Guard against varying backend response shapes for /auth/me
          const user = res.data ?? res;
          setAuthUser(user);
        })
        .catch(() => localStorage.removeItem('livvora_token'));
    }
  }, []);

  const addToCart      = useCallback(item => setCart(p => [...p, item]), []);
  const toggleWishlist = useCallback(item => {
    setWishlist(p => p.some(w => w.id === item.id) ? p.filter(w => w.id !== item.id) : [...p, item]);
  }, []);

  const authValue = {
    user:   authUser,
    login:  (u) => setAuthUser(u),
    logout: () => { localStorage.removeItem('livvora_token'); setAuthUser(null); },
  };

  const commonProps = { onAdd: addToCart, onWishlist: toggleWishlist, wishlist, onAuthOpen: () => setAuthModalOpen(true) };

  return (
    // FIX 2: Wrap entire app in ErrorBoundary so any render crash shows a message instead of blank page
    <ErrorBoundary>
      <ThemeCtx.Provider value={{ T, toggleTheme }}>
        <AuthCtx.Provider value={authValue}>
          <GlobalStyle T={T} />
          {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
          <Router>
            <Navbar cartCount={cart.length} wishlistCount={wishlist.length} onAuthOpen={() => setAuthModalOpen(true)} />
            <Routes>
              <Route path="/"         element={<Home {...commonProps} />} />
              <Route path="/devices"  element={<Armory {...commonProps} />} />
              <Route path="/deals"    element={<DealsPage {...commonProps} />} />
              <Route path="/wishlist" element={<WishlistPage wishlist={wishlist} onAdd={addToCart} onWishlist={toggleWishlist} onAuthOpen={() => setAuthModalOpen(true)} />} />
              <Route path="/library"  element={<LibraryPage {...commonProps} />} />
              <Route path="/blog"     element={<BlogPage />} />
              <Route path="/cart"     element={<Cart cart={cart} setCart={setCart} />} />
              <Route path="/about"    element={<About />} />
              <Route path="/faq"      element={<FAQ />} />
            </Routes>
          </Router>
        </AuthCtx.Provider>
      </ThemeCtx.Provider>
    </ErrorBoundary>
  );
}
