import React, { useState, useCallback } from 'react';
import { Member, Staff, TierConfig, RoleConfig, hasPerm, getLevel } from './lib/types';
import { useSupabaseData, loginStaff, logoutStaff } from './lib/db';
import { IC, RolePills } from './components/ui';
import DashboardPage from './pages/Dashboard';
import ScanPage from './pages/Scan';
import { MembersPage, MemberDetailPage, MemberFormPage } from './pages/Members';
import SettingsPage from './pages/Settings';

type Page='dashboard'|'scan'|'members'|'member-detail'|'member-form'|'add-member'|'settings';

export default function App() {
  const [loggedIn,setLoggedIn]=useState(false);
  const [curStaff,setCurStaff]=useState<Staff|null>(null);
  const [page,setPage]=useState<Page>('dashboard');
  const [selId,setSelId]=useState<string|null>(null);
  const [navStack,setNavStack]=useState<Page[]>(['dashboard']);

  const db = useSupabaseData();

  // Force stop loading after 5 seconds to prevent infinite loading
  const [forceReady, setForceReady] = useState(false);
  React.useEffect(() => { const t = setTimeout(() => setForceReady(true), 5000); return () => clearTimeout(t); }, []);
  const isLoading = db.loading && !forceReady;

  const navTo=useCallback((p:Page)=>{setNavStack(prev=>[...prev,p]);setPage(p);},[]);
  const goBack=useCallback(()=>{setNavStack(prev=>{if(prev.length<=1)return prev;const s=prev.slice(0,-1);setPage(s[s.length-1]);return s;});},[]);
  const navRoot=useCallback((p:Page)=>{setNavStack([p]);setPage(p);},[]);

  const viewMember=(id:string)=>{setSelId(id);navTo('member-detail');};
  const selMember=db.members.find(m=>m.id===selId);

  const saveMember=async(data:Partial<Member>)=>{
    if(selId&&page==='member-form'){
      const existing=db.members.find(m=>m.id===selId);
      if(existing) await db.upsertMember({...existing,...data,id:selId});
      goBack();
    } else {
      await db.upsertMember({full_name:data.full_name||'',email:data.email||'',phone:data.phone as string||null,avatar_url:null,date_of_birth:data.date_of_birth as string||null,is_active:true,total_exp:0,koin_balance:0} as any);
      goBack();
    }
  };

  const updateStaffProfile=(s:Staff)=>{
    setCurStaff(s);
    db.upsertStaff(s);
  };

  const handleLogout=async()=>{
    await logoutStaff();
    setLoggedIn(false);
    setCurStaff(null);
    navRoot('dashboard');
  };

  // Loading state
  if(isLoading) return(
    <div className="min-h-screen flex items-center justify-center" style={{background:'#003820'}}>
      <div className="text-center">
        <div className="font-mono text-2xl font-bold tracking-[0.3em] text-[#E0DBBC] mb-2">NOMONO</div>
        <div className="font-mono text-[10px] tracking-[0.3em] text-[#C39A4B] animate-pulse">Connecting to server...</div>
      </div>
    </div>
  );

  // Login
  if(!loggedIn||!curStaff) return <LoginScreen onLogin={(s)=>{setCurStaff(s);setLoggedIn(true);db.loadAll();}}/>;

  const canScan=hasPerm(curStaff,db.roles,'checkin')||hasPerm(curStaff,db.roles,'assign_activity');
  const canViewMembers=hasPerm(curStaff,db.roles,'view_members');
  const hasAnySettings=getLevel(curStaff,db.roles,'master_presets')!=='none'||getLevel(curStaff,db.roles,'master_tiers')!=='none'||getLevel(curStaff,db.roles,'master_roles')!=='none'||getLevel(curStaff,db.roles,'manage_staff')!=='none';

  const navItems:{key:Page;icon:React.ReactNode;label:string;show:boolean}[]=[
    {key:'dashboard',icon:IC.home,label:'Home',show:true},
    {key:'scan',icon:IC.scan,label:'Scan',show:canScan},
    {key:'members',icon:IC.members,label:'Members',show:canViewMembers},
    {key:'settings',icon:IC.settings,label:'Settings',show:hasAnySettings||true},
  ];

  return(
    <div className="min-h-screen flex flex-col" style={{background:'#FAFAF7'}}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3" style={{background:'#003820'}}>
        <div><div className="font-mono text-sm font-bold tracking-[0.2em] text-[#E0DBBC]">NOMONO</div><div className="font-mono text-[8px] tracking-[0.3em] text-[#C39A4B] uppercase">Staff</div></div>
        <div className="flex items-center gap-2"><RolePills staff={curStaff} roles={db.roles} small/><button onClick={handleLogout} className="text-[#E0DBBC66] hover:text-[#E0DBBC] ml-1">{IC.logout}</button></div>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {page==='dashboard'&&<DashboardPage members={db.members} checkins={db.checkins} transactions={db.transactions} onNav={p=>navTo(p as Page)} staff={curStaff} tiers={db.tiers} roles={db.roles}/>}
        {page==='scan'&&<ScanPage members={db.members} checkins={db.checkins} setCheckins={db.setCheckins} setMembers={db.setMembers} setTransactions={db.setTransactions} presets={db.presets} staff={curStaff} staffList={db.staffList} tiers={db.tiers} roles={db.roles} onViewMember={viewMember}/>}
        {page==='members'&&<MembersPage members={db.members} onView={viewMember} onAdd={()=>{setSelId(null);navTo('add-member');}} tiers={db.tiers}/>}
        {page==='member-detail'&&selMember&&<MemberDetailPage member={selMember} transactions={db.transactions} checkins={db.checkins} onBack={goBack} onEdit={()=>navTo('member-form')} tiers={db.tiers}/>}
        {page==='member-form'&&<MemberFormPage member={selMember} onSave={saveMember} onBack={goBack}/>}
        {page==='add-member'&&<MemberFormPage onSave={saveMember} onBack={goBack}/>}
        {page==='settings'&&<SettingsPage presets={db.presets} setPresets={db.setPresets} staffList={db.staffList} setStaffList={db.setStaffList} tiers={db.tiers} setTiers={db.setTiers} roles={db.roles} setRoles={db.setRoles} staff={curStaff} setStaff={updateStaffProfile}/>}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around py-2 px-2 border-t" style={{background:'#FAFAF7',borderColor:'#231F2010'}}>
        {navItems.filter(i=>i.show).map(item=>{
          const active=page===item.key||(item.key==='members'&&['member-detail','member-form','add-member'].includes(page));
          return <button key={item.key} onClick={()=>navRoot(item.key)} className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg" style={{color:active?'#003820':'#231F2055'}}>{item.icon}<span className={`font-mono text-[9px] uppercase tracking-widest ${active?'font-bold':''}`}>{item.label}</span></button>;
        })}
      </nav>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');*{font-family:'DM Mono',monospace;box-sizing:border-box;margin:0}body{background:#FAFAF7;-webkit-font-smoothing:antialiased}@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}@keyframes scanLine{0%,100%{top:8px}50%{top:calc(100% - 10px)}}::-webkit-scrollbar{width:0}`}</style>
    </div>
  );
}

// ── Real Login (Supabase Auth) ──
function LoginScreen({onLogin}:{onLogin:(s:Staff)=>void}) {
  const [email,setEmail]=useState('');
  const [pass,setPass]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);

  const go=async()=>{
    if(!email||!pass){setErr('Masukkan email & password');return;}
    setLoading(true);setErr('');
    const result=await loginStaff(email,pass);
    setLoading(false);
    if(result.error){setErr(result.error);return;}
    if(result.staff)onLogin(result.staff);
  };

  return(
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{background:'#003820'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8"><div className="font-mono text-3xl font-bold tracking-[0.3em] text-[#E0DBBC] mb-1">NOMONO</div><div className="font-mono text-[10px] tracking-[0.5em] text-[#C39A4B] uppercase">Padel Club · Staff</div></div>
        <div className="space-y-4">
          <div><label className="block text-[10px] font-mono text-[#C39A4B] uppercase tracking-widest mb-2">Email</label><input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr('');}} className="w-full bg-transparent border border-[#C39A4B44] rounded px-4 py-3 text-[#E0DBBC] font-mono text-sm focus:outline-none focus:border-[#C39A4B] placeholder:text-[#E0DBBC33]" placeholder="staff@nomono.id"/></div>
          <div><label className="block text-[10px] font-mono text-[#C39A4B] uppercase tracking-widest mb-2">Password</label><input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr('');}} className="w-full bg-transparent border border-[#C39A4B44] rounded px-4 py-3 text-[#E0DBBC] font-mono text-sm focus:outline-none focus:border-[#C39A4B] placeholder:text-[#E0DBBC33]" placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&go()}/></div>
          {err&&<p className="text-red-400 text-xs font-mono">{err}</p>}
          <button onClick={go} disabled={loading} className="w-full py-3 rounded font-mono text-sm font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{background:'#C39A4B',color:'#003820'}}>{loading?'Loading...':'Masuk'}</button>
          <p className="text-center text-[10px] font-mono text-[#E0DBBC44] mt-4">Login: admin@nomono.id / nomono2025</p>
        </div>
      </div>
    </div>
  );
}
