import { Member, CheckIn, Transaction, Staff, TxPreset } from './types';
const td=new Date(),tds=td.toISOString().split('T')[0],mm=(n:number)=>String(n).padStart(2,'0');
const todayBday=`1992-${mm(td.getMonth()+1)}-${mm(td.getDate())}`;
const tmr=new Date();tmr.setDate(tmr.getDate()+1);
const tmrBday=`1995-${mm(tmr.getMonth()+1)}-${mm(tmr.getDate())}`;

export const DEFAULT_PRESETS: TxPreset[] = [
  {id:'p1',label:'Court 1 Jam',description:'Court booking — 1 jam',exp_amount:100,koin_amount:50,category:'court',allowed_role_ids:['role_fd'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p2',label:'Court 2 Jam',description:'Court booking — 2 jam',exp_amount:200,koin_amount:100,category:'court',allowed_role_ids:['role_fd'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p3',label:'Coaching Session',description:'Private coaching',exp_amount:150,koin_amount:75,category:'event',allowed_role_ids:['role_fd'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p4',label:'Tournament',description:'Tournament participation',exp_amount:200,koin_amount:100,category:'event',allowed_role_ids:['role_fd'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p5',label:'Beli F&B',description:'F&B purchase',exp_amount:50,koin_amount:25,category:'fnb',allowed_role_ids:['role_fnb'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p6',label:'Beli Merchandise',description:'Merchandise purchase',exp_amount:75,koin_amount:30,category:'merchandise',allowed_role_ids:['role_merchant'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p7',label:'Referral Bonus',description:'Referral — ajak teman',exp_amount:0,koin_amount:150,category:'bonus',allowed_role_ids:['role_manager'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p8',label:'Review Google',description:'Review Google Maps',exp_amount:0,koin_amount:30,category:'bonus',allowed_role_ids:['role_manager'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p9',label:'Birthday Bonus',description:'Birthday bonus koin',exp_amount:0,koin_amount:100,category:'bonus',allowed_role_ids:['role_manager'],requires_pin:false,is_active:true,icon_url:null},
  {id:'p10',label:'Free Drink',description:'Redeem: Free drink',exp_amount:0,koin_amount:-100,category:'redeem',allowed_role_ids:['role_fnb'],requires_pin:false,is_active:true,icon_url:'🥤'},
  {id:'p11',label:'Free Court 1 Jam',description:'Redeem: Free court',exp_amount:0,koin_amount:-500,category:'redeem',allowed_role_ids:['role_fd'],requires_pin:true,is_active:true,icon_url:'🏸'},
  {id:'p12',label:'Merch Discount',description:'Redeem: Merch disc.',exp_amount:0,koin_amount:-200,category:'redeem',allowed_role_ids:['role_merchant'],requires_pin:true,is_active:true,icon_url:'👕'},
  {id:'p13',label:'F&B 50% Off',description:'Redeem: F&B 50%',exp_amount:0,koin_amount:-150,category:'redeem',allowed_role_ids:['role_fnb'],requires_pin:false,is_active:true,icon_url:'🍔'},
];

export const MEMBERS: Member[] = [
  {id:'m1',full_name:'Andi Pratama',email:'andi@mail.com',phone:'08123456789',avatar_url:null,date_of_birth:todayBday,joined_at:'2025-01-10T08:00:00Z',is_active:true,total_exp:4250,koin_balance:1320},
  {id:'m2',full_name:'Bella Sari',email:'bella@mail.com',phone:'08198765432',avatar_url:null,date_of_birth:tmrBday,joined_at:'2025-02-14T10:00:00Z',is_active:true,total_exp:1850,koin_balance:740},
  {id:'m3',full_name:'Charlie Wijaya',email:'charlie@mail.com',phone:'08112233445',avatar_url:null,date_of_birth:'1988-11-08',joined_at:'2025-03-01T09:00:00Z',is_active:true,total_exp:820,koin_balance:350},
  {id:'m4',full_name:'Diana Putri',email:'diana@mail.com',phone:'08155667788',avatar_url:null,date_of_birth:'1992-05-30',joined_at:'2025-04-20T11:00:00Z',is_active:true,total_exp:150,koin_balance:80},
  {id:'m5',full_name:'Erik Setiawan',email:'erik@mail.com',phone:'08177889900',avatar_url:null,date_of_birth:'1993-09-12',joined_at:'2025-01-28T14:00:00Z',is_active:true,total_exp:3200,koin_balance:960},
  {id:'m6',full_name:'Fiona Anggraini',email:'fiona@mail.com',phone:'08133221100',avatar_url:null,date_of_birth:'1997-01-25',joined_at:'2025-05-05T08:30:00Z',is_active:true,total_exp:60,koin_balance:30},
  {id:'m7',full_name:'Gerry Hartono',email:'gerry@mail.com',phone:'08144556677',avatar_url:null,date_of_birth:'1985-12-03',joined_at:'2025-02-10T16:00:00Z',is_active:false,total_exp:520,koin_balance:100},
  {id:'m8',full_name:'Hana Kusuma',email:'hana@mail.com',phone:'08166778899',avatar_url:null,date_of_birth:'1991-08-18',joined_at:'2025-03-15T12:00:00Z',is_active:true,total_exp:4800,koin_balance:2100},
  {id:'m9',full_name:'Ivan Nugraha',email:'ivan@mail.com',phone:'08188990011',avatar_url:null,date_of_birth:'1994-04-07',joined_at:'2025-06-01T09:00:00Z',is_active:true,total_exp:280,koin_balance:140},
  {id:'m10',full_name:'Jessica Tan',email:'jessica@mail.com',phone:'08199001122',avatar_url:null,date_of_birth:'1996-10-20',joined_at:'2025-04-08T10:30:00Z',is_active:true,total_exp:1100,koin_balance:520},
];

export const ALL_STAFF: Staff[] = [
  {id:'s1',full_name:'Admin Nomono',email:'admin@nomono.id',role_ids:['role_manager'],is_active:true,pin:'1234'},
  {id:'s2',full_name:'Rina Kasir',email:'rina@nomono.id',role_ids:['role_fd','role_fnb'],is_active:true},
  {id:'s3',full_name:'Budi Barista',email:'budi@nomono.id',role_ids:['role_fnb'],is_active:true},
  {id:'s4',full_name:'Sari Toko',email:'sari@nomono.id',role_ids:['role_merchant','role_fnb'],is_active:true},
  {id:'s5',full_name:'Dedi Front',email:'dedi@nomono.id',role_ids:['role_fd'],is_active:true},
];

export const CHECKINS: CheckIn[]=[
  {id:'c1',member_id:'m1',checked_in_by:'s2',staff_name:'Rina Kasir',checked_in_at:`${tds}T08:15:00Z`,exp_earned:25},
  {id:'c2',member_id:'m2',checked_in_by:'s2',staff_name:'Rina Kasir',checked_in_at:`${tds}T09:30:00Z`,exp_earned:25},
  {id:'c3',member_id:'m5',checked_in_by:'s5',staff_name:'Dedi Front',checked_in_at:`${tds}T10:00:00Z`,exp_earned:25},
];
export const TRANSACTIONS: Transaction[]=[
  {id:'tx1',member_id:'m1',exp_amount:25,koin_amount:0,description:'Check-in reward',preset_id:null,created_by:'s2',staff_name:'Rina Kasir',created_at:`${tds}T08:15:00Z`},
  {id:'tx2',member_id:'m1',exp_amount:100,koin_amount:50,description:'Court booking — 1 jam',preset_id:'p1',created_by:'s2',staff_name:'Rina Kasir',created_at:`${tds}T08:16:00Z`},
  {id:'tx3',member_id:'m2',exp_amount:25,koin_amount:0,description:'Check-in reward',preset_id:null,created_by:'s2',staff_name:'Rina Kasir',created_at:`${tds}T09:30:00Z`},
  {id:'tx4',member_id:'m5',exp_amount:200,koin_amount:100,description:'Tournament',preset_id:'p4',created_by:'s5',staff_name:'Dedi Front',created_at:`${tds}T10:15:00Z`},
];
