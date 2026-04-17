import React, { useState } from 'react';
import { Staff, TxPreset, PresetCategory, TierConfig, RoleConfig, TogglePerm, LevelPerm, PermLevel, getLevel, TOGGLE_PERMS, LEVEL_PERMS, CAT_LABELS } from '../lib/types';
import { IC, Field, Toggle, TxAmt, RolePills } from '../components/ui';

export default function SettingsPage({presets,setPresets,staffList,setStaffList,tiers,setTiers,roles,setRoles,staff,setStaff}:{
  presets:TxPreset[];setPresets:React.Dispatch<React.SetStateAction<TxPreset[]>>;staffList:Staff[];setStaffList:React.Dispatch<React.SetStateAction<Staff[]>>;tiers:TierConfig[];setTiers:React.Dispatch<React.SetStateAction<TierConfig[]>>;roles:RoleConfig[];setRoles:React.Dispatch<React.SetStateAction<RoleConfig[]>>;staff:Staff;setStaff:(s:Staff)=>void;
}) {
  const [tab,setTab]=useState<'presets'|'tiers'|'roles'|'staff'|'profile'>('profile');
  const [editP,setEditP]=useState<TxPreset|null>(null);const [editS,setEditS]=useState<Staff|null>(null);const [editT,setEditT]=useState<TierConfig|null>(null);const [editR,setEditR]=useState<RoleConfig|null>(null);
  const [addMode,setAddMode]=useState<string|null>(null);
  const canPresets=getLevel(staff,roles,'master_presets');const canTiers=getLevel(staff,roles,'master_tiers');const canRoles=getLevel(staff,roles,'master_roles');const canStaff=getLevel(staff,roles,'manage_staff');
  const allTabs:[string,string,PermLevel|'always'][]=[];
  if(canPresets!=='none')allTabs.push(['presets','Transaksi',canPresets]);
  if(canTiers!=='none')allTabs.push(['tiers','Tier',canTiers]);
  if(canRoles!=='none')allTabs.push(['roles','Roles',canRoles]);
  if(canStaff!=='none')allTabs.push(['staff','Staff',canStaff]);
  allTabs.push(['profile','Profil','always']);

  const grouped=presets.reduce((a,p)=>{const k=p.koin_amount<0?'redeem':p.exp_amount>0&&p.koin_amount>0?'both':p.exp_amount>0?'exp':'koin';(a[k]=a[k]||[]).push(p);return a;},{} as Record<string,TxPreset[]>);
  const gL:Record<string,string>={both:'EXP + Koin',exp:'EXP Only',koin:'Koin Only',redeem:'Redeem'};

  return(<div className="space-y-5">
    <h1 className="font-mono text-xl font-bold" style={{color:'#231F20'}}>Pengaturan</h1>
    <div className="flex border-b overflow-x-auto" style={{borderColor:'#231F2010'}}>{allTabs.map(([k,l])=><button key={k} onClick={()=>{setTab(k as any);setEditP(null);setEditS(null);setEditT(null);setEditR(null);setAddMode(null);}} className={`shrink-0 font-mono text-[10px] uppercase tracking-widest py-2.5 px-3 border-b-2 ${tab===k?'font-bold':''}`} style={tab===k?{borderColor:'#003820',color:'#003820'}:{borderColor:'transparent',color:'#231F2066'}}>{l}</button>)}</div>

    {/* ═══ MASTER TRANSAKSI ═══ */}
    {tab==='presets'&&!editP&&addMode!=='preset'&&(<div className="space-y-4">
      {canPresets==='modify'&&<button onClick={()=>{setAddMode('preset');setEditP({id:`p${Date.now()}`,label:'',description:'',exp_amount:0,koin_amount:0,category:'court',allowed_role_ids:[roles[1]?.id||''],requires_pin:false,is_active:true,icon_url:null});}} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold border-2 border-dashed border-[#C39A4B] text-[#C39A4B]">+ Tambah Preset</button>}
      {['both','exp','koin','redeem'].map(gk=>{const items=grouped[gk];if(!items?.length)return null;return <div key={gk}>
        <h3 className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:'#231F2088'}}>{gL[gk]}</h3>
        <div className="space-y-1.5">{items.map(p=>(<div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${!p.is_active?'opacity-40':''}`} style={{borderColor:'#231F2010'}}>
          <div className="flex items-center gap-2 min-w-0 flex-1">{p.category==='redeem'&&p.icon_url&&<span className="text-lg">{p.icon_url}</span>}<div className="min-w-0"><div className="font-mono text-xs font-medium flex items-center gap-1.5" style={{color:'#231F20'}}>{p.label}{p.requires_pin&&<span className="text-[8px] px-1 py-px rounded" style={{background:'#dc262615',color:'#dc2626'}}>PIN</span>}</div><div className="font-mono text-[9px]" style={{color:'#231F2066'}}>{CAT_LABELS[p.category]} · {p.allowed_role_ids.map(rid=>roles.find(r=>r.id===rid)?.name||rid).join(', ')}</div></div></div>
          <div className="flex items-center gap-2 shrink-0 ml-2"><TxAmt exp={p.exp_amount} koin={p.koin_amount} compact/>{canPresets==='modify'&&<button onClick={()=>setEditP(p)} style={{color:'#231F2066'}}>{IC.edit}</button>}</div>
        </div>))}</div></div>;})}
    </div>)}
    {tab==='presets'&&editP&&<PresetForm p={editP} roles={roles} isNew={addMode==='preset'} onSave={p=>{if(addMode==='preset')setPresets(prev=>[...prev,p]);else setPresets(prev=>prev.map(x=>x.id===p.id?p:x));setEditP(null);setAddMode(null);}} onDelete={()=>{setPresets(prev=>prev.filter(x=>x.id!==editP.id));setEditP(null);setAddMode(null);}} onBack={()=>{setEditP(null);setAddMode(null);}}/>}

    {/* ═══ MASTER TIER ═══ */}
    {tab==='tiers'&&!editT&&(<div className="space-y-3">
      <p className="font-mono text-[10px]" style={{color:'#231F2088'}}>4 tier (fixed). Edit nama, range EXP, benefits.</p>
      {tiers.map(t=>(<div key={t.id} className="p-4 rounded-lg border" style={{borderColor:'#231F2010'}}>
        <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="w-4 h-4 rounded" style={{background:t.bg}}/><span className="font-mono text-sm font-bold" style={{color:t.text}}>{t.name}</span></div>{canTiers==='modify'&&<button onClick={()=>setEditT(t)} style={{color:'#231F2066'}}>{IC.edit}</button>}</div>
        <div className="font-mono text-[10px]" style={{color:'#231F2088'}}>{t.min_exp} — {t.max_exp??'∞'} EXP</div>
        <div className="font-mono text-[9px] mt-1" style={{color:'#231F2066'}}>{t.benefits.join(' · ')}</div>
      </div>))}
    </div>)}
    {tab==='tiers'&&editT&&<TierForm t={editT} onSave={t=>{setTiers(prev=>prev.map(x=>x.id===t.id?t:x));setEditT(null);}} onBack={()=>setEditT(null)}/>}

    {/* ═══ MASTER ROLES ═══ */}
    {tab==='roles'&&!editR&&addMode!=='role'&&(<div className="space-y-3">
      {canRoles==='modify'&&<button onClick={()=>{const tp:Record<TogglePerm,boolean>={checkin:false,assign_activity:false,view_members:true,edit_members:false,view_transactions:false,approve_pin:false};const lp:Record<LevelPerm,PermLevel>={master_presets:'none',master_tiers:'none',master_roles:'none',manage_staff:'none'};setAddMode('role');setEditR({id:`role_${Date.now()}`,name:'',description:'',togglePerms:tp,levelPerms:lp,is_system:false});}} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold border-2 border-dashed border-[#C39A4B] text-[#C39A4B]">+ Tambah Role</button>}
      {roles.map(r=>(<div key={r.id} className="p-4 rounded-lg border" style={{borderColor:'#231F2010'}}>
        <div className="flex items-center justify-between mb-1"><span className="font-mono text-sm font-bold" style={{color:'#231F20'}}>{r.name}{r.is_system&&<span className="ml-2 font-mono text-[8px] px-1.5 py-0.5 rounded" style={{background:'#231F2010',color:'#231F2088'}}>System</span>}</span>{canRoles==='modify'&&<button onClick={()=>setEditR(r)} style={{color:'#231F2066'}}>{IC.edit}</button>}</div>
        <div className="font-mono text-[9px]" style={{color:'#231F2066'}}>{r.description}</div>
        <div className="mt-2 flex flex-wrap gap-1">{TOGGLE_PERMS.filter(p=>r.togglePerms[p.key]).map(p=><span key={p.key} className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{background:'#4A674115',color:'#4A6741'}}>{p.label}</span>)}{LEVEL_PERMS.filter(p=>r.levelPerms[p.key]!=='none').map(p=><span key={p.key} className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{background:r.levelPerms[p.key]==='modify'?'#C39A4B22':'#231F2008',color:r.levelPerms[p.key]==='modify'?'#C39A4B':'#231F2088'}}>{p.label} ({r.levelPerms[p.key]})</span>)}</div>
      </div>))}
    </div>)}
    {tab==='roles'&&editR&&<RoleForm r={editR} isNew={addMode==='role'} onSave={r=>{if(addMode==='role')setRoles(prev=>[...prev,r]);else setRoles(prev=>prev.map(x=>x.id===r.id?r:x));setEditR(null);setAddMode(null);}} onDelete={()=>{setRoles(prev=>prev.filter(x=>x.id!==editR.id));setEditR(null);setAddMode(null);}} onBack={()=>{setEditR(null);setAddMode(null);}}/>}

    {/* ═══ KELOLA STAFF ═══ */}
    {tab==='staff'&&!editS&&addMode!=='staff'&&(<div className="space-y-3">
      {canStaff==='modify'&&<button onClick={()=>{setAddMode('staff');setEditS({id:`s${Date.now()}`,full_name:'',email:'',role_ids:[roles[1]?.id||''],is_active:true});}} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold border-2 border-dashed border-[#C39A4B] text-[#C39A4B]">+ Tambah Staff</button>}
      {staffList.map(s=>(<div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border ${!s.is_active?'opacity-40':''}`} style={{borderColor:'#231F2010'}}><div className="min-w-0"><div className="font-mono text-xs font-medium" style={{color:'#231F20'}}>{s.full_name}</div><div className="font-mono text-[9px] mb-1" style={{color:'#231F2066'}}>{s.email}</div><RolePills staff={s} roles={roles}/></div>{canStaff==='modify'&&<button onClick={()=>setEditS(s)} className="shrink-0" style={{color:'#231F2066'}}>{IC.edit}</button>}</div>))}
    </div>)}
    {tab==='staff'&&editS&&<StaffForm d={editS} roles={roles} isNew={addMode==='staff'} onSave={s=>{if(addMode==='staff')setStaffList(prev=>[...prev,s]);else setStaffList(prev=>prev.map(x=>x.id===s.id?s:x));setEditS(null);setAddMode(null);}} onBack={()=>{setEditS(null);setAddMode(null);}}/>}

    {/* ═══ PROFIL ═══ */}
    {tab==='profile'&&<ProfileForm staff={staff} roles={roles} onSave={setStaff}/>}
  </div>);
}

/* ── Preset Form ── */
function PresetForm({p,roles,isNew,onSave,onDelete,onBack}:{p:TxPreset;roles:RoleConfig[];isNew:boolean;onSave:(p:TxPreset)=>void;onDelete:()=>void;onBack:()=>void}) {
  const [f,setF]=useState({...p});const u=(k:string,v:any)=>setF(x=>({...x,[k]:v}));
  const tR=(rid:string)=>setF(x=>({...x,allowed_role_ids:x.allowed_role_ids.includes(rid)?x.allowed_role_ids.filter(r=>r!==rid):[...x.allowed_role_ids,rid]}));
  return(<div className="space-y-4">
    <div className="flex items-center justify-between"><button onClick={onBack} style={{color:'#231F2088'}}>{IC.back}</button><h3 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>{isNew?'Tambah':'Edit'} Preset</h3><div className="w-5"/></div>
    <Field label="Label" value={f.label} onChange={v=>u('label',v)} ph="Court 1 Jam"/>
    <Field label="Deskripsi" value={f.description} onChange={v=>u('description',v)} ph="Court booking — 1 jam"/>
    <div className="grid grid-cols-2 gap-3"><Field label="EXP" value={String(f.exp_amount||'')} onChange={v=>u('exp_amount',parseInt(v)||0)} type="number" ph="100"/><Field label="Koin" value={String(f.koin_amount||'')} onChange={v=>u('koin_amount',parseInt(v)||0)} type="number" ph="50"/></div>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>Kategori</label><div className="flex flex-wrap gap-1.5">{(['court','fnb','merchandise','event','bonus','redeem'] as PresetCategory[]).map(c=><button key={c} onClick={()=>u('category',c)} className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full" style={f.category===c?{background:'#003820',color:'#E0DBBC'}:{border:'1px solid #231F2020',color:'#231F2066'}}>{CAT_LABELS[c]}</button>)}</div></div>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>Role</label><div className="flex flex-wrap gap-1.5">{roles.map(r=><button key={r.id} onClick={()=>tR(r.id)} className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1" style={f.allowed_role_ids.includes(r.id)?{background:'#003820',color:'#E0DBBC'}:{border:'1px solid #231F2020',color:'#231F2066'}}>{f.allowed_role_ids.includes(r.id)&&IC.chk}{r.name}</button>)}</div></div>
    {(f.koin_amount<0||f.category==='redeem')&&<div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>Icon (Emoji)</label><input value={f.icon_url||''} onChange={e=>u('icon_url',e.target.value)} placeholder="🥤" className="w-full px-3 py-2.5 rounded-lg border font-mono text-sm focus:outline-none" style={{borderColor:'#231F2015',color:'#231F20'}}/>{f.icon_url&&<div className="mt-1 text-2xl">{f.icon_url}</div>}</div>}
    <div className="flex items-center justify-between py-3 border-t" style={{borderColor:'#231F2010'}}><span className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#231F2088'}}>Butuh PIN</span><Toggle on={f.requires_pin} onToggle={()=>u('requires_pin',!f.requires_pin)} color="red"/></div>
    <div className="flex items-center justify-between py-3 border-t" style={{borderColor:'#231F2010'}}><span className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#231F2088'}}>Active</span><Toggle on={f.is_active} onToggle={()=>u('is_active',!f.is_active)}/></div>
    <button onClick={()=>onSave(f)} className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest text-white hover:brightness-110" style={{background:'#003820'}}>Simpan</button>
    {!isNew&&<button onClick={onDelete} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-red-500 border border-red-200 hover:bg-red-50 flex items-center justify-center gap-1.5">{IC.trash} Hapus</button>}
  </div>);
}

/* ── Tier Form ── */
function TierForm({t,onSave,onBack}:{t:TierConfig;onSave:(t:TierConfig)=>void;onBack:()=>void}) {
  const [f,setF]=useState({...t,bStr:t.benefits.join('\n')});const u=(k:string,v:any)=>setF(p=>({...p,[k]:v}));
  return(<div className="space-y-4">
    <div className="flex items-center justify-between"><button onClick={onBack} style={{color:'#231F2088'}}>{IC.back}</button><h3 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>Edit Tier</h3><div className="w-5"/></div>
    <div className="flex items-center gap-3 p-3 rounded-lg" style={{background:f.bg}}><span className="font-mono text-lg font-bold" style={{color:f.badgeText}}>{f.name}</span></div>
    <Field label="Nama Tier" value={f.name} onChange={v=>u('name',v)} ph="Rookie"/>
    <div className="grid grid-cols-2 gap-3"><Field label="Min EXP" value={String(f.min_exp)} onChange={v=>u('min_exp',parseInt(v)||0)} type="number"/><Field label="Max EXP (kosong=∞)" value={f.max_exp!==null?String(f.max_exp):''} onChange={v=>u('max_exp',v?parseInt(v)||0:null)} type="number" ph="∞"/></div>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>Benefits (1 per baris)</label><textarea value={f.bStr} onChange={e=>u('bStr',e.target.value)} rows={4} className="w-full px-3 py-2.5 rounded-lg border font-mono text-xs focus:outline-none resize-none" style={{borderColor:'#231F2015',color:'#231F20'}}/></div>
    <button onClick={()=>onSave({...f,benefits:f.bStr.split('\n').map(s=>s.trim()).filter(Boolean)})} className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest text-white hover:brightness-110" style={{background:'#003820'}}>Simpan</button>
  </div>);
}

/* ── Role Form (dynamic RBAC) ── */
function RoleForm({r,isNew,onSave,onDelete,onBack}:{r:RoleConfig;isNew:boolean;onSave:(r:RoleConfig)=>void;onDelete:()=>void;onBack:()=>void}) {
  const [f,setF]=useState({...r,togglePerms:{...r.togglePerms},levelPerms:{...r.levelPerms}});
  const u=(k:string,v:any)=>setF(p=>({...p,[k]:v}));
  const tT=(k:TogglePerm)=>setF(p=>({...p,togglePerms:{...p.togglePerms,[k]:!p.togglePerms[k]}}));
  const cL=(k:LevelPerm,v:PermLevel)=>setF(p=>({...p,levelPerms:{...p.levelPerms,[k]:v}}));
  return(<div className="space-y-4">
    <div className="flex items-center justify-between"><button onClick={onBack} style={{color:'#231F2088'}}>{IC.back}</button><h3 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>{isNew?'Tambah':'Edit'} Role</h3><div className="w-5"/></div>
    <Field label="Nama Role" value={f.name} onChange={v=>u('name',v)} ph="Supervisor"/>
    <Field label="Deskripsi" value={f.description} onChange={v=>u('description',v)} ph="Deskripsi singkat"/>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:'#231F2088'}}>Permission (On/Off)</label>
      <div className="space-y-2">{TOGGLE_PERMS.map(p=>(<div key={p.key} className="flex items-center justify-between py-2 border-b" style={{borderColor:'#231F2008'}}><span className="font-mono text-xs" style={{color:'#231F20'}}>{p.label}</span><Toggle on={f.togglePerms[p.key]} onToggle={()=>tT(p.key)}/></div>))}</div>
    </div>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:'#231F2088'}}>Permission (None / View / Modify)</label>
      <div className="space-y-3">{LEVEL_PERMS.map(p=>(<div key={p.key}>
        <div className="font-mono text-xs mb-1.5" style={{color:'#231F20'}}>{p.label}</div>
        <div className="flex gap-1.5">{(['none','view','modify'] as PermLevel[]).map(lv=><button key={lv} onClick={()=>cL(p.key,lv)} className="flex-1 font-mono text-[10px] uppercase tracking-widest py-1.5 rounded-lg" style={f.levelPerms[p.key]===lv?{background:lv==='modify'?'#003820':lv==='view'?'#C39A4B':'#231F2020',color:lv==='none'?'#231F20':'#fff'}:{border:'1px solid #231F2020',color:'#231F2066'}}>{lv}</button>)}</div>
      </div>))}</div>
    </div>
    <button onClick={()=>f.name&&onSave(f)} disabled={!f.name} className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest text-white hover:brightness-110 disabled:opacity-40" style={{background:'#003820'}}>Simpan</button>
    {!isNew&&!f.is_system&&<button onClick={onDelete} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-red-500 border border-red-200 flex items-center justify-center gap-1.5">{IC.trash} Hapus Role</button>}
  </div>);
}

/* ── Staff Form ── */
function StaffForm({d,roles,isNew,onSave,onBack}:{d:Staff;roles:RoleConfig[];isNew:boolean;onSave:(s:Staff)=>void;onBack:()=>void}) {
  const [f,setF]=useState({...d});const u=(k:string,v:any)=>setF(p=>({...p,[k]:v}));
  const tR=(rid:string)=>setF(p=>({...p,role_ids:p.role_ids.includes(rid)?p.role_ids.filter(x=>x!==rid):[...p.role_ids,rid]}));
  return(<div className="space-y-4">
    <div className="flex items-center justify-between"><button onClick={onBack} style={{color:'#231F2088'}}>{IC.back}</button><h3 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>{isNew?'Tambah':'Edit'} Staff</h3><div className="w-5"/></div>
    <Field label="Nama" value={f.full_name} onChange={v=>u('full_name',v)} ph="Nama"/>
    <Field label="Email" value={f.email} onChange={v=>u('email',v)} type="email" ph="staff@nomono.id"/>
    <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>Role (bisa &gt; 1)</label><div className="flex flex-wrap gap-1.5">{roles.map(r=><button key={r.id} onClick={()=>tR(r.id)} className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1" style={f.role_ids.includes(r.id)?{background:'#003820',color:'#E0DBBC'}:{border:'1px solid #231F2020',color:'#231F2066'}}>{f.role_ids.includes(r.id)&&IC.chk}{r.name}</button>)}</div></div>
    <div className="flex items-center justify-between py-3 border-t" style={{borderColor:'#231F2010'}}><span className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#231F2088'}}>Active</span><Toggle on={f.is_active} onToggle={()=>u('is_active',!f.is_active)}/></div>
    <button onClick={()=>f.full_name&&f.role_ids.length>0&&onSave(f)} disabled={!f.full_name||!f.role_ids.length} className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest text-white hover:brightness-110 disabled:opacity-40" style={{background:'#003820'}}>Simpan</button>
  </div>);
}

/* ── Profile ── */
function ProfileForm({staff,roles,onSave}:{staff:Staff;roles:RoleConfig[];onSave:(s:Staff)=>void}) {
  const [f,setF]=useState({full_name:staff.full_name,email:staff.email,pin:staff.pin||'',newPass:''});const [saved,setSaved]=useState(false);
  const save=()=>{onSave({...staff,full_name:f.full_name,email:f.email,pin:f.pin||undefined});setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const ini=f.full_name?f.full_name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2):'?';
  return(<div className="space-y-4">
    <div className="flex justify-center"><div className="w-20 h-20 rounded-full flex items-center justify-center font-mono text-2xl font-bold" style={{background:'#00382015',color:'#003820',border:'3px solid #003820'}}>{ini}</div></div>
    <div className="text-center"><RolePills staff={staff} roles={roles}/></div>
    {saved&&<div className="p-2 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold">Tersimpan ✓</div>}
    <Field label="Nama" value={f.full_name} onChange={v=>setF(p=>({...p,full_name:v}))} ph="Nama"/>
    <Field label="Email" value={f.email} onChange={v=>setF(p=>({...p,email:v}))} type="email"/>
    <Field label="PIN (opsional)" value={f.pin} onChange={v=>setF(p=>({...p,pin:v.slice(0,4)}))} ph="1234"/>
    <Field label="Password Baru" value={f.newPass} onChange={v=>setF(p=>({...p,newPass:v}))} type="password" ph="Kosongkan jika tidak ganti"/>
    <button onClick={save} className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest text-white hover:brightness-110" style={{background:'#003820'}}>Simpan Profil</button>
  </div>);
}
