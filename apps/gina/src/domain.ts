import { z } from 'zod';
import type { Account, FinanceState, Goal, Movement, MovementType, Period, Scope } from './types';

export const MAX_CENTS = 100_000_000_000;
const DAY = 86_400_000;
const areas = ['clinic', 'collaborations', 'personal'] as const;
const integer = z.number().int().safe().min(-MAX_CENTS).max(MAX_CENTS);
const positive = integer.positive();
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(160);
const note = z.string().max(4000);
const dateSchema = z.string().refine(validDate, 'Fecha inválida');
const timestamp = z.string().datetime({ offset: true });
const optionalTimestamp = z.union([z.literal(''), timestamp]);
const kind = z.enum(['income', 'expense', 'investment', 'transfer']);
const array = <T extends z.ZodType>(item:T) => z.array(item).max(100_000);

export function uid():string { return crypto.randomUUID(); }
export function today():string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Mazatlan', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split('-').map(Number);
  return y>=1900&&y<=2199&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
}
function dateNumber(value:string):number {
  if(!validDate(value)) throw new Error('La fecha no es válida.');
  return Date.parse(`${value}T12:00:00Z`);
}
function fromNumber(value:number):string { return new Date(value).toISOString().slice(0,10); }
export function shiftDate(date:string,days:number):string {
  if(!Number.isInteger(days)) throw new Error('El desplazamiento debe ser de días completos.');
  const result=fromNumber(dateNumber(date)+days*DAY);
  if(!validDate(result)) throw new Error('La fecha está fuera del rango admitido.');
  return result;
}
function sum(values:number[]):number {
  const result=values.reduce((a,b)=>a+b,0);
  if(!Number.isSafeInteger(result)) throw new Error('El total supera el límite de precisión permitido.');
  return result;
}
export function money(cents:number):string {
  if(!Number.isSafeInteger(cents)) throw new Error('El importe debe expresarse en centavos enteros.');
  return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
}
export function parseMoney(raw:string):number {
  let value=raw.trim().replace(/^(?:MXN\s*)?\$\s*/i,'').replace(/\s*MXN$/i,'').trim();
  if(!value||!/^[+-]?[\d.,]+$/.test(value)) throw new Error('Escribe un importe válido, por ejemplo 1,500.00.');
  const negative=value[0]==='-'; value=value.replace(/^[+-]/,'');
  let whole=value, fraction='';
  const commas=(value.match(/,/g)||[]).length, dots=(value.match(/\./g)||[]).length;
  if(commas&&dots){
    const decimal=value.lastIndexOf(',')>value.lastIndexOf('.')?',':'.';
    const grouping=decimal===','?'.':',';
    const parts=value.split(decimal);
    if(parts.length!==2||!/^\d{1,2}$/.test(parts[1])) throw new Error('Usa como máximo dos decimales.');
    const escaped=grouping==='.'?'\\.':',';
    if(!new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`).test(parts[0])) throw new Error('Los separadores del importe no son válidos.');
    whole=parts[0].split(grouping).join(''); fraction=parts[1];
  } else if(dots){
    const parts=value.split('.');
    if(parts.length!==2||!/^\d{1,2}$/.test(parts[1])) throw new Error('Usa como máximo dos decimales y coma para miles.');
    whole=parts[0]||'0';fraction=parts[1];
  } else if(commas){
    if(/^\d{1,3}(?:,\d{3})+$/.test(value)) whole=value.replace(/,/g,'');
    else if(commas===1&&/^\d*,\d{1,2}$/.test(value)) [whole,fraction]=value.split(',');
    else throw new Error('Los separadores del importe no son válidos.');
  }
  if(!/^\d+$/.test(whole||'0')) throw new Error('Escribe un importe válido.');
  const result=(Number(whole||'0')*100+Number(fraction.padEnd(2,'0')))*(negative?-1:1);
  if(!Number.isSafeInteger(result)||Math.abs(result)>MAX_CENTS) throw new Error('El importe supera el límite permitido.');
  return result===0?0:result;
}

export function periodFor(mode:'week'|'month'|'year'|'range',anchor:string,customEnd?:string):Period {
  dateNumber(anchor); const [year,month]=anchor.split('-').map(Number);
  let start:string,end:string,label:string;
  const formatter=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'});
  if(mode==='week') {
    const weekday=new Date(dateNumber(anchor)).getUTCDay();
    start=shiftDate(anchor,-((weekday+6)%7));end=shiftDate(start,6);label=`${start} — ${end}`;
  } else if(mode==='month') {
    start=`${year}-${String(month).padStart(2,'0')}-01`;end=fromNumber(Date.UTC(year,month,0,12));label=formatter.format(new Date(dateNumber(start)));
  } else if(mode==='year') { start=`${year}-01-01`;end=`${year}-12-31`;label=String(year); }
  else {start=anchor;end=customEnd||anchor;dateNumber(end);if(end<start)throw new Error('La fecha final debe ser igual o posterior al inicio.');label=`${start} — ${end}`;}
  return {start,end,label};
}
function sourceIdFromScope(scope:Scope):string { return scope.startsWith('source:')?scope.slice(7):scope; }
export function scopeMatches(state:FinanceState,movement:Movement,scope:Scope):boolean {
  if(scope==='all') return true;
  if(movement.type==='transfer'&&['professional',...areas].includes(scope)){
    return state.accounts.some(account=>(account.id===movement.accountId||account.id===movement.toAccountId)&&accountMatches(account,scope));
  }
  const source=state.sources.find(s=>s.id===movement.sourceId);
  if(!source) return false;
  if(scope==='professional') return source.area!=='personal';
  if(areas.includes(scope as typeof areas[number])) return source.area===scope;
  return source.id===sourceIdFromScope(scope);
}
function checkPeriod(period:Period):void {
  if(!validDate(period.start)||!validDate(period.end)||period.start>period.end)throw new Error('El periodo no es válido.');
}
export function selectedMovements(state:FinanceState,period:Period,scope:Scope):Movement[] {
  checkPeriod(period);
  return state.movements.filter(m=>!m.voided&&m.date>=period.start&&m.date<=period.end&&scopeMatches(state,m,scope)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
}
function accountMatches(account:Account,scope:Scope):boolean {
  if(scope==='all') return true;
  if(scope==='professional') return account.area==='clinic'||account.area==='collaborations';
  return account.area!=='mixed'&&account.area===scope;
}
export function totals(state:FinanceState,period:Period,scope:Scope){
  const movements=selectedMovements(state,period,scope);
  const count=(type:MovementType)=>sum(movements.filter(m=>m.type===type).map(m=>m.amountCents));
  const income=count('income'),expense=count('expense'),investment=count('investment');
  let transfersIn=0,transfersOut=0;
  if(scope!=='all'){
    state.movements.filter(m=>!m.voided&&m.type==='transfer'&&m.date>=period.start&&m.date<=period.end).forEach(m=>{
      const origin=state.accounts.find(a=>a.id===m.accountId),destination=state.accounts.find(a=>a.id===m.toAccountId);
      const from=!!origin&&accountMatches(origin,scope),to=!!destination&&accountMatches(destination,scope);
      if(to&&!from) transfersIn+=m.amountCents;
      if(from&&!to) transfersOut+=m.amountCents;
    });
  }
  return {income,expense,investment,flow:sum([income,-expense,-investment]),operating:sum([income,-expense]),transfersIn,transfersOut};
}
export function accountBalance(state:FinanceState,accountId:string,atDate=today()):number {
  dateNumber(atDate);
  const account=state.accounts.find(a=>a.id===accountId);
  if(!account)throw new Error('No se encontró la cuenta.');
  if(atDate<account.openingDate)throw new Error(`No hay información de saldo de ${account.name} anterior a su fecha de corte.`);
  const deltas=state.movements.filter(m=>!m.voided&&m.date>=account.openingDate&&m.date<=atDate).map(m=>{
    if(m.type==='transfer') return m.accountId===accountId?-m.amountCents:m.toAccountId===accountId?m.amountCents:0;
    return m.accountId===accountId?(m.type==='income'?m.amountCents:-m.amountCents):0;
  });
  return sum([account.openingCents,...deltas]);
}
export function pocketBalance(state:FinanceState,pocketId:string,atDate=today()):number {
  dateNumber(atDate);
  if(!state.pockets.some(p=>p.id===pocketId))throw new Error('No se encontró el apartado.');
  return sum(state.savingEvents.filter(e=>e.pocketId===pocketId&&e.date<=atDate).map(e=>e.amountCents));
}
export function available(state:FinanceState,scope:Scope='all',atDate=today()) {
  dateNumber(atDate);
  // Account archiving hides it from entry forms; it never erases its historical money.
  const accounts=state.accounts.filter(a=>a.spendable&&accountMatches(a,scope));
  const balance=sum(accounts.map(a=>accountBalance(state,a.id,atDate)));
  const ids=new Set(accounts.map(a=>a.id));
  const reserved=sum(state.pockets.filter(p=>ids.has(p.accountId)).map(p=>pocketBalance(state,p.id,atDate)));
  return {balance,reserved,free:sum([balance,-reserved])};
}
export function pendingAmount(state:FinanceState,receivableId:string):number {
  const receivable=state.receivables.find(r=>r.id===receivableId);
  if(!receivable)throw new Error('No se encontró el cobro pendiente.');
  return receivable.totalCents-sum(state.movements.filter(m=>!m.voided&&m.type==='income'&&m.receivableId===receivableId).map(m=>m.amountCents));
}
export function goalProgress(state:FinanceState,goal:Goal){
  let actual=0;
  if(goal.metric==='income') actual=totals(state,{start:goal.start,end:goal.end,label:''},goal.scope).income;
  else {
    const accounts=new Set(state.accounts.filter(a=>accountMatches(a,goal.scope)).map(a=>a.id));
    const pockets=new Set(state.pockets.filter(p=>accounts.has(p.accountId)).map(p=>p.id));
    actual=sum(state.savingEvents.filter(e=>pockets.has(e.pocketId)&&e.date>=goal.start&&e.date<=goal.end).map(e=>e.amountCents));
  }
  const remaining=Math.max(0,goal.targetCents-actual),start=today()>goal.start?today():goal.start;
  let daysLeft=0;
  for(let date=start;date<=goal.end;date=shiftDate(date,1)){
    if(state.profile.workDays.includes(new Date(dateNumber(date)).getUTCDay()))daysLeft++;
    if(date===goal.end)break;
  }
  return {actual,percent:goal.targetCents>0?actual/goal.targetCents*100:0,remaining,daily:daysLeft?Math.ceil(remaining/daysLeft):0,daysLeft};
}
export function chartSeries(state:FinanceState,period:Period,scope:Scope,type:'income'|'expense'|'investment'='income'):{label:string;value:number;start:string;end:string}[]{
  checkPeriod(period);const buckets:{label:string;start:string;end:string}[]=[];
  const span=Math.round((dateNumber(period.end)-dateNumber(period.start))/DAY)+1;
  const month=periodFor('month',period.start),isMonth=month.start===period.start&&month.end===period.end;
  if(isMonth){
    for(let day=1;day<=Number(period.end.slice(8));day+=7){
      const start=`${period.start.slice(0,8)}${String(day).padStart(2,'0')}`;
      const end=shiftDate(start,6)>period.end?period.end:shiftDate(start,6);
      buckets.push({label:`${day}–${Number(end.slice(8))}`,start,end});
    }
  }else if(span>31){
    let cursor=period.start;
    while(cursor<=period.end){const p=periodFor('month',cursor);const end=p.end<period.end?p.end:period.end;buckets.push({label:new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'}).format(new Date(dateNumber(cursor))),start:cursor,end});if(end===period.end)break;cursor=shiftDate(end,1);}
  }else{
    for(let date=period.start;date<=period.end;date=shiftDate(date,1)){
      const label=span<=7?new Intl.DateTimeFormat('es-MX',{weekday:'short',timeZone:'UTC'}).format(new Date(dateNumber(date))):String(Number(date.slice(8)));
      buckets.push({label,start:date,end:date});if(date===period.end)break;
    }
  }
  const selected=selectedMovements(state,period,scope).filter(m=>m.type===type);
  return buckets.map(b=>({...b,value:sum(selected.filter(m=>m.date>=b.start&&m.date<=b.end).map(m=>m.amountCents))}));
}

const movementSchema=z.object({id,type:kind,amountCents:positive,date:dateSchema,sourceId:id,accountId:id,toAccountId:id.optional(),categoryId:z.string().max(100),note,receivableId:id.optional(),voided:z.boolean(),createdAt:timestamp,updatedAt:timestamp}).strict();
const favoriteSchema=z.object({id,title:text,type:kind,sourceId:id,accountId:id,toAccountId:id.optional(),categoryId:z.string().max(100),note,amountCents:integer.nonnegative()}).strict();
const stateSchema=z.object({
  schemaVersion:z.literal(1),profile:z.object({name:text,orthomaxMode:z.enum(['clinic','fees']),workDays:z.array(z.number().int().min(0).max(6)).min(1).max(7)}).strict(),
  sources:array(z.object({id,name:text,area:z.enum(areas),archived:z.boolean(),color:z.string().regex(/^#[\da-fA-F]{6}$/)}).strict()),
  accounts:array(z.object({id,name:text,area:z.enum([...areas,'mixed']),kind:z.enum(['cash','bank','savings','investment']),openingCents:integer,openingDate:dateSchema,spendable:z.boolean(),archived:z.boolean()}).strict()),
  categories:array(z.object({id,name:text,type:z.enum(['income','expense','investment']),archived:z.boolean()}).strict()),
  movements:array(movementSchema),
  receivables:array(z.object({id,sourceId:id,title:text,totalCents:positive,date:dateSchema,dueDate:z.union([z.literal(''),dateSchema]),archived:z.boolean()}).strict()),
  goals:array(z.object({id,title:text,metric:z.enum(['income','savings']),scope:z.string().min(1).max(120),targetCents:positive,start:dateSchema,end:dateSchema,archived:z.boolean()}).strict()),
  pockets:array(z.object({id,accountId:id,name:text,archived:z.boolean()}).strict()),
  savingEvents:array(z.object({id,pocketId:id,amountCents:integer.refine(n=>n!==0,'El importe debe ser diferente de cero'),date:dateSchema,note}).strict()),
  budgets:array(z.object({id,categoryId:id,month:z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),limitCents:positive}).strict()),
  favorites:array(favoriteSchema),recurring:array(favoriteSchema.extend({nextDate:dateSchema,frequency:z.literal('monthly'),archived:z.boolean()})),
  audit:array(z.object({id,at:timestamp,action:text,entityId:z.string().max(120)}).strict()),
  monthReviews:array(z.object({month:z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),reviewedAt:timestamp,incomeCents:integer.nonnegative(),expenseCents:integer.nonnegative(),investmentCents:integer.nonnegative(),fingerprint:z.string().min(1).max(300)}).strict()),
  draft:movementSchema.partial().extend({amountCents:integer.nonnegative().optional(),date:z.union([z.literal(''),dateSchema]).optional(),sourceId:z.string().max(100).optional(),accountId:z.string().max(100).optional(),toAccountId:z.string().max(100).optional()}).strict().nullable(),
  lastExportAt:optionalTimestamp,
}).strict();

/** Parse into a fresh, validated value. Corruption is never replaced with a blank ledger. */
export function validateState(value:unknown):FinanceState {
  const parsed=stateSchema.safeParse(value);
  if(!parsed.success){const first=parsed.error.issues[0];throw new Error(`Datos inválidos en ${first.path.join('.')||'archivo'}: ${first.message}`);}
  const state=parsed.data as FinanceState;
  const fail=(message:string):never=>{throw new Error(message);};
  const ids=new Set<string>();
  for(const entries of [state.sources,state.accounts,state.categories,state.movements,state.receivables,state.goals,state.pockets,state.savingEvents,state.budgets,state.favorites,state.recurring,state.audit]){
    for(const entry of entries){if(ids.has(entry.id))fail(`Identificador duplicado: ${entry.id}.`);ids.add(entry.id);}
  }
  if(new Set(state.profile.workDays).size!==state.profile.workDays.length)fail('Los días de trabajo no pueden repetirse.');
  const sources=new Map(state.sources.map(s=>[s.id,s]));const accounts=new Map(state.accounts.map(a=>[a.id,a]));const categories=new Map(state.categories.map(c=>[c.id,c]));const receivables=new Map(state.receivables.map(r=>[r.id,r]));const pockets=new Map(state.pockets.map(p=>[p.id,p]));
  // Bound accumulated arithmetic as well as each individual amount.
  sum([...state.movements.map(m=>m.amountCents),...state.accounts.map(a=>Math.abs(a.openingCents)),...state.savingEvents.map(e=>Math.abs(e.amountCents))]);
  for(const item of [...state.movements,...state.favorites,...state.recurring]){
    if(!sources.has(item.sourceId))fail('El movimiento hace referencia a una actividad que no existe.');
    if(!accounts.has(item.accountId))fail('El movimiento hace referencia a una cuenta que no existe.');
    if(item.type==='transfer'){
      if(!item.toAccountId||!accounts.has(item.toAccountId))fail('Selecciona una cuenta de destino válida.');
      if(item.accountId===item.toAccountId)fail('La transferencia requiere dos cuentas diferentes.');
      if(item.categoryId)fail('Una transferencia no debe tener categoría de ingreso o gasto.');
    }else{
      if(item.toAccountId)fail('Solo las transferencias tienen cuenta de destino.');
      if(categories.get(item.categoryId)?.type!==item.type)fail('La categoría no coincide con el tipo de movimiento.');
    }
  }
  const paidByReceivable=new Map<string,number>();
  for(const m of state.movements){
    if(m.receivableId){const receivable=receivables.get(m.receivableId);if(!receivable||m.type!=='income'||receivable.sourceId!==m.sourceId)fail('El cobro enlazado no corresponde a ese pendiente y actividad.');}
    if(m.receivableId&&!m.voided)paidByReceivable.set(m.receivableId,sum([paidByReceivable.get(m.receivableId)||0,m.amountCents]));
  }
  for(const r of state.receivables){
    if(!sources.has(r.sourceId))fail('La actividad del pendiente no existe.');
    if(r.dueDate&&r.dueDate<r.date)fail('El vencimiento no puede ser anterior a la fecha del pendiente.');
    if((paidByReceivable.get(r.id)||0)>r.totalCents)fail(`Los cobros de «${r.title}» superan su total pendiente.`);
  }
  const knownScope=(scope:Scope)=>['all','professional',...areas].includes(scope)||sources.has(sourceIdFromScope(scope));
  for(const goal of state.goals){
    if(goal.end<goal.start)fail('La fecha final de la meta es anterior al inicio.');
    if(!knownScope(goal.scope))fail('El alcance de la meta no existe.');
    if(goal.metric==='savings'&&!['all','professional',...areas].includes(goal.scope))fail('Las metas de ahorro necesitan un área o el total general, ya que las cuentas no se reparten por clínica.');
  }
  for(const p of state.pockets)if(!accounts.has(p.accountId))fail('La cuenta del apartado no existe.');
  const pocketTotals=new Map<string,number>();
  for(const event of [...state.savingEvents].sort((a,b)=>a.date.localeCompare(b.date))){
    const pocket=pockets.get(event.pocketId);if(!pocket)fail('El apartado del ahorro no existe.');
    const account=accounts.get(pocket!.accountId)!;
    if(event.date<account.openingDate)fail('El ahorro no puede ser anterior a la fecha de corte de su cuenta.');
    pocketTotals.set(event.pocketId,sum([pocketTotals.get(event.pocketId)||0,event.amountCents]));
    if(pocketTotals.get(event.pocketId)!<0)fail('No puedes liberar más dinero del que tiene el apartado.');
  }
  for(const p of state.pockets)if(p.archived&&(pocketTotals.get(p.id)||0)!==0)fail('Libera el saldo del apartado antes de archivarlo.');
  // Reconcile by date in O(n log n), so a large imported history cannot trigger
  // quadratic account-by-movement scans. Money within a date is settled together.
  const timelines=new Map<string,Map<string,{cash:number;reserved:number}>>();
  for(const pocket of state.pockets)if(!timelines.has(pocket.accountId))timelines.set(pocket.accountId,new Map());
  const addTimeline=(accountId:string,date:string,cash:number,reserved:number)=>{
    const timeline=timelines.get(accountId),account=accounts.get(accountId);
    if(!timeline||!account||date<account.openingDate)return;
    const existing=timeline.get(date)||{cash:0,reserved:0};
    timeline.set(date,{cash:sum([existing.cash,cash]),reserved:sum([existing.reserved,reserved])});
  };
  for(const event of state.savingEvents)addTimeline(pockets.get(event.pocketId)!.accountId,event.date,0,event.amountCents);
  for(const movement of state.movements){
    if(movement.voided)continue;
    addTimeline(movement.accountId,movement.date,movement.type==='income'?movement.amountCents:-movement.amountCents,0);
    if(movement.type==='transfer')addTimeline(movement.toAccountId!,movement.date,movement.amountCents,0);
  }
  for(const [accountId,timeline] of timelines){
    const account=accounts.get(accountId)!;let balance=account.openingCents,reserved=0;
    for(const [,change] of [...timeline].sort(([a],[b])=>a.localeCompare(b))){
      balance=sum([balance,change.cash]);reserved=sum([reserved,change.reserved]);
      if(reserved>Math.max(0,balance))fail(`El saldo de ${account.name} no alcanza para sus apartados. Libera ahorro o ajusta la operación.`);
    }
  }
  const budgetKeys=new Set<string>();for(const budget of state.budgets){if(categories.get(budget.categoryId)?.type!=='expense')fail('El presupuesto requiere una categoría de gasto.');const key=`${budget.month}:${budget.categoryId}`;if(budgetKeys.has(key))fail('Ya existe un presupuesto para esta categoría y mes.');budgetKeys.add(key);}
  const reviewKeys=new Set<string>();for(const review of state.monthReviews){if(reviewKeys.has(review.month))fail('El cierre mensual está duplicado.');reviewKeys.add(review.month);}
  return state;
}

export function emptyState():FinanceState {
  return {schemaVersion:1,profile:{name:'Dra. Gina',orthomaxMode:'clinic',workDays:[1,2,3,4,5]},
    sources:[
      {id:'orthomax',name:'Orthomax Consultorio propio',area:'clinic',archived:false,color:'#087f83'},
      {id:'secom',name:'Secom',area:'collaborations',archived:false,color:'#4489a8'},
      {id:'gaxiola',name:'Dr. Gaxiola',area:'collaborations',archived:false,color:'#8a75b6'},
      {id:'anel',name:'Dr. Anel',area:'collaborations',archived:false,color:'#c18958'},
      {id:'iliana',name:'Dr. Iliana',area:'collaborations',archived:false,color:'#c37289'},
      {id:'personal',name:'Personal',area:'personal',archived:false,color:'#769653'},
      {id:'shared-professional',name:'Gastos profesionales compartidos',area:'collaborations',archived:false,color:'#72878c'},
    ],accounts:[],categories:[
      {id:'income-services',name:'Cobro de servicios',type:'income',archived:false},
      {id:'income-personal',name:'Ingreso personal externo',type:'income',archived:false},
      {id:'expense-materials',name:'Materiales',type:'expense',archived:false},
      {id:'expense-rent',name:'Renta',type:'expense',archived:false},
      {id:'expense-gasoline',name:'Gasolina',type:'expense',archived:false},
      {id:'expense-food',name:'Comida',type:'expense',archived:false},
      {id:'expense-services',name:'Servicios',type:'expense',archived:false},
      {id:'expense-fun',name:'Diversión',type:'expense',archived:false},
      {id:'expense-other',name:'Extras',type:'expense',archived:false},
      {id:'investment-equipment',name:'Equipo y mejoras',type:'investment',archived:false},
    ],movements:[],receivables:[],goals:[],pockets:[],savingEvents:[],budgets:[],favorites:[],recurring:[],audit:[],monthReviews:[],draft:null,lastExportAt:''};
}
export function demoState():FinanceState {
  const state=emptyState(),date=today(),period=periodFor('month',date),timestamp=new Date().toISOString();
  state.accounts=[{id:'demo-clinic-bank',name:'Banco profesional · ejemplo',area:'clinic',kind:'bank',openingCents:500_000,openingDate:period.start,spendable:true,archived:false},{id:'demo-personal',name:'Personal · ejemplo',area:'personal',kind:'cash',openingCents:600_000,openingDate:period.start,spendable:true,archived:false}];
  const sources=['orthomax','secom','gaxiola','anel','iliana'];
  for(let index=0;index<10;index++){
    const day=Math.min(Number(date.slice(8)),1+index*3),effective=`${date.slice(0,8)}${String(day).padStart(2,'0')}`;
    state.movements.push({id:`demo-income-${index}`,type:'income',amountCents:[150_000,200_000,120_000,250_000,180_000][index%5],date:effective,sourceId:sources[index%5],accountId:'demo-clinic-bank',categoryId:'income-services',note:'Dato ficticio de demostración',voided:false,createdAt:timestamp,updatedAt:timestamp});
  }
  state.movements.push({id:'demo-expense',type:'expense',amountCents:320_000,date,sourceId:'orthomax',accountId:'demo-clinic-bank',categoryId:'expense-materials',note:'Ejemplo de materiales',voided:false,createdAt:timestamp,updatedAt:timestamp});
  state.movements.push({id:'demo-investment',type:'investment',amountCents:250_000,date,sourceId:'orthomax',accountId:'demo-clinic-bank',categoryId:'investment-equipment',note:'Equipo de ejemplo',voided:false,createdAt:timestamp,updatedAt:timestamp});
  state.movements.push({id:'demo-food',type:'expense',amountCents:95_000,date,sourceId:'personal',accountId:'demo-personal',categoryId:'expense-food',note:'Solo demostración',voided:false,createdAt:timestamp,updatedAt:timestamp});
  state.goals=[{id:'demo-month-goal',title:'Mi meta del mes',metric:'income',scope:'professional',targetCents:2_400_000,start:period.start,end:period.end,archived:false}];
  state.receivables=[{id:'demo-receivable',sourceId:'secom',title:'Honorarios pendientes · ejemplo',totalCents:400_000,date,dueDate:shiftDate(date,7),archived:false}];
  state.pockets=[{id:'demo-pocket',accountId:'demo-personal',name:'Fondo personal · ejemplo',archived:false}];state.savingEvents=[{id:'demo-saving',pocketId:'demo-pocket',amountCents:200_000,date,note:'Ahorro ficticio'}];
  return validateState(state);
}
