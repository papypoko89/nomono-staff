import React from 'react';
import { TierConfig, RoleConfig, Staff, nextTierExp } from '../lib/types';

export const ini=(n:string)=>n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
export const fD=(s:string)=>new Date(s).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
export const fT=(s:string)=>new Date(s).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

export const IC={
home:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="7" height="8" rx="1.5"/><rect x="11" y="2" width="7" height="5" rx="1.5"/><rect x="2" y="12" width="7" height="6" rx="1.5"/><rect x="11" y="9" width="7" height="9" rx="1.5"/></svg>,
scan:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="2" height="2"/><rect x="16" y="12" width="2" height="2"/><rect x="12" y="16" width="2" height="2"/><rect x="16" y="16" width="2" height="2"/></svg>,
members:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="6" r="3"/><path d="M2 17c0-3.3 2.7-6 5-6s5 2.7 5 6"/><circle cx="14" cy="7" r="2.5"/><path d="M13 11c2 0 4.5 2 4.5 5"/></svg>,
settings:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 2v2m0 12v2M2 10h2m12 0h2M4.93 4.93l1.41 1.41m7.32 7.32l1.41 1.41M15.07 4.93l-1.41 1.41M6.34 13.66l-1.41 1.41"/></svg>,
add:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>,
search:<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><line x1="12" y1="12" x2="16" y2="16"/></svg>,
back:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16" y1="10" x2="4" y2="10"/><polyline points="10 4 4 10 10 16"/></svg>,
clock:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="5.5"/><polyline points="7 3.5 7 7 9.5 8.5"/></svg>,
edit:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M10 2l2 2L4.5 11.5H2.5v-2z"/></svg>,
logout:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 17H4a1 1 0 01-1-1V4a1 1 0 011-1h3"/><polyline points="11 14 16 10 11 6"/><line x1="16" y1="10" x2="7" y2="10"/></svg>,
lock:<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2.5" y="5" width="7" height="5" rx="1"/><path d="M4 5V3.5a2 2 0 014 0V5"/></svg>,
trash:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><polyline points="2 4 12 4"/><path d="M4.5 4V2.5h5V4M3.5 4l.7 8h5.6l.7-8"/></svg>,
chk:<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="2 5.5 4 7.5 8 3"/></svg>,
staff:<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="6" cy="3.5" r="2"/><path d="M2 11c0-2.2 1.8-4 4-4s4 1.8 4 4"/></svg>,
cake:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 10v4h12v-4"/><path d="M2 10c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2"/><path d="M5 8V6M8 8V5M11 8V6"/><circle cx="5" cy="5" r=".8" fill="currentColor" stroke="none"/><circle cx="8" cy="4" r=".8" fill="currentColor" stroke="none"/><circle cx="11" cy="5" r=".8" fill="currentColor" stroke="none"/></svg>,
user:<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="6" r="4"/><path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>,
};

export function Badge({tier,size='sm'}:{tier:TierConfig;size?:'sm'|'md'}){
  const s=size==='sm'?'text-[10px] px-2 py-0.5':'text-xs px-2.5 py-1';
  return <span className={`font-mono font-bold uppercase tracking-widest rounded inline-block ${s}`} style={{background:tier.bg,color:tier.badgeText}}>{tier.name}</span>;
}
export function Av({name,size=40,tier}:{name:string;size?:number;tier?:TierConfig}){
  const c=tier?tier.text:'#003820';
  return <div className="flex items-center justify-center font-mono font-bold rounded-full shrink-0" style={{width:size,height:size,fontSize:size*.35,background:`${c}12`,color:c,border:`2px solid ${c}`}}>{ini(name)}</div>;
}
export function ExpBar({exp,tier}:{exp:number;tier:TierConfig}){
  const nxt=nextTierExp(tier);const pct=nxt?((exp-tier.min_exp)/(nxt-tier.min_exp))*100:100;
  return <div className="w-full"><div className="flex justify-between mb-1"><span className="text-[10px] font-mono" style={{color:'#231F2088'}}>{exp} EXP</span><span className="text-[10px] font-mono" style={{color:'#231F2088'}}>{nxt?`Next: ${nxt}`:'MAX'}</span></div><div className="w-full h-2 rounded-full" style={{background:'#231F2010'}}><div className="h-full rounded-full transition-all duration-500" style={{width:`${Math.min(pct,100)}%`,background:tier.text}}/></div></div>;
}
export function Field({label,value,onChange,type='text',ph=''}:{label:string;value:string;onChange:(v:string)=>void;type?:string;ph?:string}){
  return <div><label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{color:'#231F2088'}}>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={ph} className="w-full px-3 py-2.5 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]" style={{borderColor:'#231F2015',color:'#231F20',background:'#FAFAF7'}}/></div>;
}
export function InfoRow({label,value}:{label:string;value:string}){return <div className="flex justify-between items-center py-2.5 border-b" style={{borderColor:'#231F2010'}}><span className="font-mono text-[10px] uppercase tracking-widest" style={{color:'#231F2088'}}>{label}</span><span className="font-mono text-xs font-medium" style={{color:'#231F20'}}>{value}</span></div>;}
export function Stat({label,value,accent,suf=''}:{label:string;value:string|number;accent:string;suf?:string}){return <div className="p-4 rounded-lg border" style={{borderColor:'#231F2010'}}><div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{color:'#231F2088'}}>{label}</div><div className="font-mono text-2xl font-bold" style={{color:accent}}>{value}{suf}</div></div>;}
export function Toggle({on,onToggle,color='green'}:{on:boolean;onToggle:()=>void;color?:string}){return <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-colors relative ${on?color==='red'?'bg-red-500':'bg-green-500':'bg-gray-300'}`}><div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on?'left-[22px]':'left-0.5'}`}/></button>;}
export function TxAmt({exp,koin,compact=false}:{exp:number;koin:number;compact?:boolean}){
  const p:React.ReactNode[]=[];
  if(exp>0)p.push(<span key="e" className="text-green-600">+{exp} EXP</span>);
  if(koin>0)p.push(<span key="k" className="text-[#C39A4B]">+{koin} Koin</span>);
  if(koin<0)p.push(<span key="s" className="text-red-500">{koin} Koin</span>);
  if(!p.length)return <span className="text-gray-400">—</span>;
  return <div className={`font-mono font-bold ${compact?'text-[10px]':'text-xs'} flex ${compact?'gap-1':'gap-2'} items-center flex-wrap justify-end`}>{p}</div>;
}
export function Checkbox({checked,onChange}:{checked:boolean;onChange:()=>void}){
  return <button type="button" onClick={e=>{e.preventDefault();e.stopPropagation();onChange();}} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked?'bg-[#C39A4B] border-[#C39A4B]':'border-gray-300 bg-white'}`}>{checked&&IC.chk}</button>;
}
export function RolePills({staff,roles,small=false}:{staff:Staff;roles:RoleConfig[];small?:boolean}){
  const names=staff.role_ids.map(rid=>roles.find(r=>r.id===rid)?.name||rid);
  return <div className="flex gap-1 flex-wrap">{names.map(n=><span key={n} className={`font-mono uppercase tracking-widest rounded ${small?'text-[8px] px-1 py-px':'text-[9px] px-1.5 py-0.5'}`} style={{background:'#003820',color:'#E0DBBC'}}>{n}</span>)}</div>;
}
