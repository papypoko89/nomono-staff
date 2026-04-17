import React, { useState } from 'react';
import {
  Member,
  CheckIn,
  Transaction,
  Staff,
  TxPreset,
  TierConfig,
  RoleConfig,
  CHECK_IN_EXP,
  getTier,
  hasPerm,
  canUsePreset,
  CAT_LABELS
} from '../lib/types';
import { IC, Badge, Av, Checkbox, TxAmt, fT } from '../components/ui';

export default function ScanPage({
  members,
  checkins,
  setCheckins,
  setMembers,
  setTransactions,
  presets,
  staff,
  staffList,
  tiers,
  roles,
  onViewMember,
  updateMemberBalance
}:{
  members:Member[];
  checkins:CheckIn[];
  setCheckins:React.Dispatch<React.SetStateAction<CheckIn[]>>;
  setMembers:React.Dispatch<React.SetStateAction<Member[]>>;
  setTransactions:React.Dispatch<React.SetStateAction<Transaction[]>>;
  presets:TxPreset[];
  staff:Staff;
  staffList:Staff[];
  tiers:TierConfig[];
  roles:RoleConfig[];
  onViewMember:(id:string)=>void;
  updateMemberBalance:(memberId:string, addExp:number, addKoin:number)=>Promise<boolean>;
}) {
  const [q,setQ]=useState('');
  const [scanMode,setScanMode]=useState(false);
  const [target,setTarget]=useState<Member|null>(null);
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  const [flash,setFlash]=useState<string|null>(null);
  const [pinInput,setPinInput]=useState('');
  const [pinStep,setPinStep]=useState(false);

  const canCI=hasPerm(staff,roles,'checkin');
  const canAssign=hasPerm(staff,roles,'assign_activity');
  const ciIds=new Set(checkins.map(c=>c.member_id));

  const results=q.length>=2
    ?members.filter(m=>
      m.is_active&&(
        m.full_name.toLowerCase().includes(q.toLowerCase())||
        m.phone?.includes(q)||
        m.email.toLowerCase().includes(q.toLowerCase())
      )
    )
    :[];

  const myPresets=presets.filter(p=>p.is_active&&canUsePreset(staff,p));

  const pick=(m:Member)=>{
    setTarget(m);
    setQ('');
    setScanMode(false);
    setSelected({});
    setPinStep(false);
    setPinInput('');
  };

  const toggle=(id:string)=>setSelected(p=>{
    const n={...p};
    n[id]=!n[id];
    if(!n[id])delete n[id];
    return n;
  });

  const selPresets=myPresets.filter(p=>selected[p.id]===true);
  const needsPin=selPresets.some(p=>p.requires_pin)&&!hasPerm(staff,roles,'approve_pin');
  const totE=selPresets.reduce((s,p)=>s+p.exp_amount,0);
  const totK=selPresets.reduce((s,p)=>s+p.koin_amount,0);
  const koinOk=!target||(target.koin_balance+totK>=0);

  const doConfirm=async()=>{
    if(!target||!selPresets.length)return;
    if(needsPin&&!pinStep){setPinStep(true);return;}
    if(needsPin&&pinStep&&!staffList.find(s=>hasPerm(s,roles,'approve_pin')&&s.pin===pinInput))return;

    const didCI=canCI&&!ciIds.has(target.id);
    const now=Date.now();

    if(didCI){
      setCheckins(p=>[
        {
          id:`c${now}`,
          member_id:target.id,
          checked_in_by:staff.id,
          staff_name:staff.full_name,
          checked_in_at:new Date().toISOString(),
          exp_earned:CHECK_IN_EXP
        },
        ...p
      ]);

      setTransactions(p=>[
        {
          id:`tx${now}a`,
          member_id:target.id,
          exp_amount:CHECK_IN_EXP,
          koin_amount:0,
          description:'Check-in reward',
          preset_id:null,
          created_by:staff.id,
          staff_name:staff.full_name,
          created_at:new Date().toISOString()
        },
        ...p
      ]);
    }

    const txs:Transaction[]=selPresets.map((pr,i)=>({
      id:`tx${now+i+1}`,
      member_id:target.id,
      exp_amount:pr.exp_amount,
      koin_amount:pr.koin_amount,
      description:pr.description,
      preset_id:pr.id,
      created_by:staff.id,
      staff_name:staff.full_name,
      created_at:new Date(now+i+1).toISOString()
    }));

    setTransactions(p=>[...txs,...p]);

    setMembers(p=>p.map(m=>
      m.id===target.id
        ? {...m,total_exp:m.total_exp+(didCI?CHECK_IN_EXP:0)+totE,koin_balance:m.koin_balance+totK}
        : m
    ));

    await updateMemberBalance(
      target.id,
      (didCI?CHECK_IN_EXP:0)+totE,
      totK
    );

    const pts:string[]=[];
    if(didCI)pts.push('Check-in +25 EXP');
    if(totE>0)pts.push(`+${totE} EXP`);
    if(totK>0)pts.push(`+${totK} Koin`);
    if(totK<0)pts.push(`${totK} Koin`);

    setFlash(`✓ ${target.full_name} — ${pts.join(', ')}`);
    setTarget(null);
    setSelected({});
    setPinStep(false);
    setTimeout(()=>setFlash(null),3000);
  };

  const doSkip=async()=>{
    if(!target)return;

    if(canCI&&!ciIds.has(target.id)){
      const now=Date.now();

      setCheckins(p=>[
        {
          id:`c${now}`,
          member_id:target.id,
          checked_in_by:staff.id,
          staff_name:staff.full_name,
          checked_in_at:new Date().toISOString(),
          exp_earned:CHECK_IN_EXP
        },
        ...p
      ]);

      setTransactions(p=>[
        {
          id:`tx${now}`,
          member_id:target.id,
          exp_amount:CHECK_IN_EXP,
          koin_amount:0,
          description:'Check-in reward',
          preset_id:null,
          created_by:staff.id,
          staff_name:staff.full_name,
          created_at:new Date().toISOString()
        },
        ...p
      ]);

      setMembers(p=>p.map(m=>m.id===target.id?{...m,total_exp:m.total_exp+CHECK_IN_EXP}:m));

      await updateMemberBalance(target.id,CHECK_IN_EXP,0);

      setFlash(`✓ ${target.full_name} — Check-in +25 EXP`);
    }

    setTarget(null);
    setSelected({});
    setTimeout(()=>setFlash(null),3000);
  };

  if(target){
    const tier=getTier(target.total_exp,tiers);
    const notCI=canCI&&!ciIds.has(target.id);

    return(
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={()=>{setTarget(null);setSelected({});setPinStep(false);}} style={{color:'#231F2088'}}>{IC.back}</button>
          <h1 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>Assign Aktivitas</h1>
          <div className="w-5"/>
        </div>

        {flash&&<div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold animate-[fadeIn_0.3s]">{flash}</div>}

        <div className="p-4 rounded-lg border-2 flex items-center gap-3" style={{borderColor:tier.text,background:`${tier.text}08`}}>
          <Av name={target.full_name} size={48} tier={tier}/>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold truncate" style={{color:'#231F20'}}>{target.full_name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tier={tier}/>
              <span className="font-mono text-[10px]" style={{color:'#231F20'}}>{target.total_exp} EXP</span>
              <span className="font-mono text-[10px]" style={{color:'#C39A4B'}}>{target.koin_balance} Koin</span>
            </div>
          </div>
        </div>

        {notCI&&<div className="p-2.5 rounded-lg text-center font-mono text-xs font-medium" style={{background:'#003820',color:'#E0DBBC'}}>Auto check-in +{CHECK_IN_EXP} EXP</div>}

        {canAssign&&
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:'#231F2088'}}>Pilih Aktivitas (bisa &gt; 1)</h3>
            <div className="space-y-1.5">
              {myPresets.map(p=>{
                const isSel=selected[p.id]===true;
                const noK=p.koin_amount<0&&target.koin_balance+totK+(isSel?0:p.koin_amount)<0;

                return(
                  <div
                    key={p.id}
                    onClick={()=>{if(!noK||isSel)toggle(p.id);}}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${noK&&!isSel?'opacity-40 cursor-not-allowed':''}`}
                    style={{borderColor:isSel?'#C39A4B':'#231F2015',background:isSel?'#C39A4B08':'transparent'}}
                  >
                    <Checkbox checked={isSel} onChange={()=>{if(!noK||isSel)toggle(p.id);}}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium" style={{color:'#231F20'}}>{p.label}</span>
                        {p.requires_pin&&<span className="text-[8px] px-1 py-px rounded" style={{background:'#dc262615',color:'#dc2626'}}>PIN</span>}
                      </div>
                      <div className="font-mono text-[9px]" style={{color:'#231F2066'}}>{CAT_LABELS[p.category]}</div>
                    </div>
                    <div className="shrink-0"><TxAmt exp={p.exp_amount} koin={p.koin_amount} compact/></div>
                  </div>
                );
              })}
            </div>
          </div>
        }

        {selPresets.length>0&&
          <div className="p-3 rounded-lg border-2 border-[#003820]" style={{background:'#00382008'}}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{color:'#231F2088'}}>Total{notCI?' (+ check-in)':''}</div>
            <div className="font-mono text-base font-bold flex gap-3">
              {(totE+(notCI?CHECK_IN_EXP:0))>0&&<span className="text-green-600">+{totE+(notCI?CHECK_IN_EXP:0)} EXP</span>}
              {totK>0&&<span className="text-[#C39A4B]">+{totK} Koin</span>}
              {totK<0&&<span className="text-red-500">{totK} Koin</span>}
            </div>
            {!koinOk&&<div className="font-mono text-[10px] text-red-500 mt-1">Koin tidak cukup</div>}
          </div>
        }

        {pinStep&&
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#dc2626'}}>PIN Manager</div>
            <input
              type="password"
              value={pinInput}
              onChange={e=>setPinInput(e.target.value)}
              placeholder="PIN"
              className="w-full px-3 py-2.5 rounded-lg border font-mono text-sm text-center tracking-[0.5em] focus:outline-none"
              style={{borderColor:'#dc262633',color:'#231F20'}}
              autoFocus
            />
          </div>
        }

        <div className="flex gap-2">
          <button onClick={doSkip} className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border" style={{borderColor:'#231F2015',color:'#231F2088'}}>
            {notCI?'Check-in saja':'Batal'}
          </button>
          <button
            onClick={doConfirm}
            disabled={!selPresets.length||!koinOk||(pinStep&&!pinInput)}
            className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
            style={{background:'#003820'}}
          >
            Konfirmasi
          </button>
        </div>
      </div>
    );
  }

  return(
    <div className="space-y-5">
      <h1 className="font-mono text-xl font-bold" style={{color:'#231F20'}}>Scan Member</h1>

      {flash&&<div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold animate-[fadeIn_0.3s]">{flash}</div>}

      <div className="flex gap-2">
        <button
          onClick={()=>setScanMode(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
          style={scanMode?{background:'#003820',color:'#E0DBBC',borderColor:'#003820'}:{borderColor:'#231F2015',color:'#231F2088'}}
        >
          {IC.scan} QR
        </button>
        <button
          onClick={()=>setScanMode(false)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
          style={!scanMode?{background:'#003820',color:'#E0DBBC',borderColor:'#003820'}:{borderColor:'#231F2015',color:'#231F2088'}}
        >
          {IC.search} Manual
        </button>
      </div>

      {scanMode?(
        <div className="rounded-lg border-2 border-dashed border-[#C39A4B] overflow-hidden">
          <div className="aspect-square max-h-[240px] flex flex-col items-center justify-center gap-4" style={{background:'#003820'}}>
            <div className="w-40 h-40 border-2 border-[#C39A4B] rounded-lg relative">
              <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[3px] border-l-[3px] border-[#C39A4B] rounded-tl"/>
              <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-[3px] border-r-[3px] border-[#C39A4B] rounded-tr"/>
              <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-[3px] border-l-[3px] border-[#C39A4B] rounded-bl"/>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[3px] border-r-[3px] border-[#C39A4B] rounded-br"/>
              <div className="absolute inset-x-2 h-0.5 bg-[#C39A4B] opacity-60 animate-[scanLine_2s_ease-in-out_infinite]"/>
            </div>
            <p className="font-mono text-[10px] text-[#E0DBBC88] uppercase tracking-widest">Arahkan ke QR member</p>
          </div>
        </div>
      ):(
        <>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'#231F2066'}}>{IC.search}</div>
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]"
              style={{borderColor:'#231F2015',color:'#231F20'}}
              placeholder="Cari nama, phone, email..."
              autoFocus
            />
          </div>

          {q.length>=2&&
            <div className="space-y-2">
              {results.length===0
                ?<p className="font-mono text-xs text-center py-6" style={{color:'#231F2088'}}>Tidak ditemukan</p>
                :results.map(m=>{
                  const tier=getTier(m.total_exp,tiers);
                  const done=ciIds.has(m.id);
                  return(
                    <button
                      key={m.id}
                      onClick={()=>pick(m)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-[#C39A4B55] text-left"
                      style={{borderColor:'#231F2015'}}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Av name={m.full_name} size={40} tier={tier}/>
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-medium truncate" style={{color:'#231F20'}}>{m.full_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge tier={tier}/>
                            <span className="font-mono text-[10px]" style={{color:'#231F2088'}}>{m.koin_balance} K</span>
                            {done&&canCI&&<span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono">In</span>}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] uppercase tracking-widest font-bold" style={{color:'#C39A4B'}}>Pilih →</div>
                    </button>
                  );
                })}
            </div>
          }
        </>
      )}

      {canCI&&checkins.length>0&&
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{color:'#231F2088'}}>Hari Ini ({checkins.length})</h3>
          <div className="space-y-1.5">
            {checkins.map(ci=>{
              const m=members.find(x=>x.id===ci.member_id);
              if(!m)return null;
              const tier=getTier(m.total_exp,tiers);
              return(
                <div
                  key={ci.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-[#C39A4B55]"
                  style={{borderColor:'#231F2010'}}
                  onClick={()=>onViewMember(m.id)}
                >
                  <div className="flex items-center gap-3">
                    <Av name={m.full_name} size={34} tier={tier}/>
                    <div>
                      <div className="font-mono text-xs font-medium" style={{color:'#231F20'}}>{m.full_name}</div>
                      <Badge tier={tier}/>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5" style={{color:'#231F2066'}}>
                    {IC.clock}
                    <span className="font-mono text-[10px]">{fT(ci.checked_in_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    </div>
  );
}
