import { describe, expect, it } from 'vitest';
import { accountBalance, available, chartSeries, demoState, emptyState, goalProgress, money, parseMoney, pendingAmount, periodFor, pocketBalance, selectedMovements, shiftDate, totals, validDate, validateState } from './domain';
import type { FinanceState, Goal, Movement } from './types';

const period=periodFor('month','2026-10-03');
const timestamp='2026-10-03T12:00:00.000Z';
function fixture():FinanceState {
  const state=emptyState();
  state.accounts=[
    {id:'bank',name:'Banco profesional',area:'clinic',kind:'bank',openingCents:0,openingDate:'2026-01-01',spendable:true,archived:false},
    {id:'cash',name:'Efectivo personal',area:'personal',kind:'cash',openingCents:0,openingDate:'2026-01-01',spendable:true,archived:false},
  ];
  return state;
}
function movement(overrides:Partial<Movement>={}):Movement {
  return {id:'movement',type:'income',amountCents:150_000,date:'2026-10-03',sourceId:'orthomax',accountId:'bank',categoryId:'income-services',note:'',voided:false,createdAt:timestamp,updatedAt:timestamp,...overrides};
}
function goal(overrides:Partial<Goal>={}):Goal{return {id:'goal',title:'Meta',metric:'income',scope:'professional',targetCents:200_000,start:period.start,end:period.end,archived:false,...overrides};}

describe('centavos y fechas locales',()=>{
  it.each([['1,500.00',150000],['$1,500.50 MXN',150050],['1500,50',150050],['1.500,50',150050],['0.01',1],['.50',50],['-100.10',-10010],['1,500',150000]])('convierte %s exactamente',(input,expected)=>expect(parseMoney(input)).toBe(expected));
  it.each(['','NaN','Infinity','1e3','1.005','1.2.3','1,00,00','1,500.001','100000000000000000','--10'])('rechaza importe ambiguo o fuera de precisión %s',input=>expect(()=>parseMoney(input)).toThrow());
  it('mantiene centavos al presentar y sumar',()=>{
    expect(money(150050)).toContain('1,500.50');
    const state=fixture();state.movements=[movement({id:'cent-1',amountCents:10}),movement({id:'cent-2',amountCents:20})];
    expect(totals(state,period,'all').income).toBe(30);
  });
  it('valida fechas reales y cambia fechas sin convertir el día local',()=>{
    expect(validDate('2024-02-29')).toBe(true);expect(validDate('2026-02-29')).toBe(false);expect(validDate('2026-13-01')).toBe(false);
    expect(shiftDate('2026-12-31',1)).toBe('2027-01-01');expect(shiftDate('2024-03-01',-1)).toBe('2024-02-29');
    expect(periodFor('week','2026-11-01')).toMatchObject({start:'2026-10-26',end:'2026-11-01'});
    expect(()=>periodFor('range','2026-10-10','2026-10-01')).toThrow();
  });
});

describe('reglas de caja y alcance',()=>{
  it('inicia realmente vacío; demostración aislada es válida',()=>{
    const state=validateState(emptyState());expect(state.accounts).toEqual([]);expect(state.movements).toEqual([]);expect(state.goals).toEqual([]);
    expect(state.sources).toHaveLength(7);expect(demoState().movements.length).toBeGreaterThan(0);expect(state.movements).toEqual([]);
  });
  it('suma ingresos a la fuente, Profesional y General sin crear ingreso Personal',()=>{
    const state=fixture();state.movements=[movement()];
    for(const scope of ['orthomax','clinic','professional','all'])expect(totals(state,period,scope).income).toBe(150000);
    expect(totals(state,period,'personal').income).toBe(0);expect(goalProgress(state,goal()).actual).toBe(150000);
  });
  it('distingue resultado operativo, flujo y saldo anterior',()=>{
    const state=fixture();state.accounts[0].openingCents=800000;
    state.movements=[movement({id:'income',amountCents:3000000}),movement({id:'expense',type:'expense',categoryId:'expense-materials',amountCents:1200000}),movement({id:'equipment',type:'investment',categoryId:'investment-equipment',amountCents:500000})];
    expect(totals(validateState(state),period,'all')).toMatchObject({income:3000000,expense:1200000,investment:500000,operating:1800000,flow:1300000});
    expect(accountBalance(state,'bank','2026-10-31')).toBe(2100000);
  });
  it('transfiere en una sola operación sin duplicar ingresos, metas ni saldo General',()=>{
    const state=fixture();state.accounts[0].openingCents=500000;
    state.movements=[movement({type:'transfer',amountCents:100000,toAccountId:'cash',categoryId:''})];validateState(state);
    expect(accountBalance(state,'bank','2026-10-31')).toBe(400000);expect(accountBalance(state,'cash','2026-10-31')).toBe(100000);
    expect(available(state,'all','2026-10-31')).toEqual({balance:500000,reserved:0,free:500000});
    expect(totals(state,period,'all')).toMatchObject({income:0,expense:0,flow:0,transfersIn:0,transfersOut:0});
    expect(totals(state,period,'personal').transfersIn).toBe(100000);expect(totals(state,period,'professional').transfersOut).toBe(100000);
    expect(selectedMovements(state,period,'personal')).toHaveLength(1);expect(selectedMovements(state,period,'professional')).toHaveLength(1);
    expect(goalProgress(state,goal()).actual).toBe(0);
    state.movements[0].voided=true;expect(accountBalance(state,'bank','2026-10-31')).toBe(500000);expect(accountBalance(state,'cash','2026-10-31')).toBe(0);
  });
  it('respeta corte: históricos aportan reportes pero no se cuentan dos veces en saldo',()=>{
    const state=fixture();state.accounts[0].openingCents=500000;state.accounts[0].openingDate='2026-10-02';
    state.movements=[movement({id:'before',date:'2026-10-01',amountCents:100000}),movement({id:'cutoff',date:'2026-10-02',amountCents:200000}),movement({id:'after',date:'2026-10-03',amountCents:300000})];
    expect(totals(state,period,'all').income).toBe(600000);expect(accountBalance(state,'bank','2026-10-02')).toBe(700000);expect(accountBalance(state,'bank','2026-10-31')).toBe(1000000);
    expect(()=>accountBalance(state,'bank','2026-10-01')).toThrow(/anterior/);
  });
  it('cuentas mixtas solo aparecen en General y fuentes individuales no heredan saldo',()=>{
    const state=fixture();state.accounts[0].area='mixed';state.accounts[0].openingCents=900000;
    expect(available(state,'all','2026-10-03').balance).toBe(900000);expect(available(state,'professional','2026-10-03').balance).toBe(0);expect(available(state,'personal','2026-10-03').balance).toBe(0);expect(available(state,'orthomax','2026-10-03').balance).toBe(0);
  });
  it('reclasificar o archivar fuente no destruye historia',()=>{
    const state=fixture();state.movements=[movement({sourceId:'secom'})];state.movements[0].sourceId='gaxiola';state.sources.find(s=>s.id==='gaxiola')!.archived=true;validateState(state);
    expect(totals(state,period,'secom').income).toBe(0);expect(totals(state,period,'gaxiola').income).toBe(150000);expect(totals(state,period,'all').income).toBe(150000);
  });
  it('gasto profesional compartido concilia el total sin atribuirlo a Orthomax',()=>{
    const state=fixture();state.movements=[movement({sourceId:'shared-professional',type:'expense',categoryId:'expense-other'})];
    expect(totals(state,period,'professional').expense).toBe(150000);expect(totals(state,period,'orthomax').expense).toBe(0);
  });
});

describe('pendientes y ahorro',()=>{
  it('vincula pagos parciales, recalcula anulación y rechaza sobrecobro o ID repetido',()=>{
    const state=fixture();state.receivables=[{id:'pending',sourceId:'orthomax',title:'Honorarios',totalCents:500000,date:'2026-10-01',dueDate:'',archived:false}];
    state.movements=[movement({receivableId:'pending',amountCents:200000})];validateState(state);
    expect(pendingAmount(state,'pending')).toBe(300000);expect(totals(state,period,'all').income).toBe(200000);
    state.movements.push({...state.movements[0]});expect(()=>validateState(state)).toThrow(/duplicado/);state.movements.pop();
    state.movements[0].amountCents=500001;expect(()=>validateState(state)).toThrow(/superan/);
    state.movements[0].amountCents=200000;state.movements[0].voided=true;validateState(state);expect(pendingAmount(state,'pending')).toBe(500000);expect(totals(state,period,'all').income).toBe(0);
  });
  it('ahorro reduce dinero libre, no saldo, flujo o ingresos',()=>{
    const state=fixture();state.accounts[1].openingCents=600000;state.pockets=[{id:'pocket',accountId:'cash',name:'Fondo',archived:false}];state.savingEvents=[{id:'event',pocketId:'pocket',date:'2026-10-01',amountCents:200000,note:''}];validateState(state);
    expect(available(state,'personal','2026-10-03')).toEqual({balance:600000,reserved:200000,free:400000});expect(totals(state,period,'personal').flow).toBe(0);
    state.accounts[1].spendable=false;expect(available(state,'personal','2026-10-03')).toEqual({balance:0,reserved:0,free:0});expect(pocketBalance(state,'pocket','2026-10-03')).toBe(200000);
  });
  it('meta ahorro cuenta aportaciones netas del periodo sin reciclar saldo anterior',()=>{
    const state=fixture();state.accounts[1].openingCents=600000;state.pockets=[{id:'pocket',accountId:'cash',name:'Fondo',archived:false}];
    state.savingEvents=[{id:'old',pocketId:'pocket',date:'2026-09-01',amountCents:200000,note:''},{id:'add',pocketId:'pocket',date:'2026-10-01',amountCents:50000,note:''},{id:'release',pocketId:'pocket',date:'2026-10-02',amountCents:-10000,note:''}];validateState(state);
    expect(goalProgress(state,goal({metric:'savings',scope:'personal'})).actual).toBe(40000);expect(pocketBalance(state,'pocket','2026-10-03')).toBe(240000);
  });
  it('rechaza exceso de apartados y gastos posteriores que consuman dinero reservado',()=>{
    const state=fixture();state.accounts[1].openingCents=600000;state.pockets=[{id:'pocket',accountId:'cash',name:'Fondo',archived:false}];state.savingEvents=[{id:'event',pocketId:'pocket',date:'2026-10-01',amountCents:600001,note:''}];
    expect(()=>validateState(state)).toThrow(/no alcanza/);state.savingEvents[0].amountCents=200000;
    state.movements=[movement({type:'expense',sourceId:'personal',accountId:'cash',categoryId:'expense-food',amountCents:500000})];expect(()=>validateState(state)).toThrow(/no alcanza/);
    state.movements=[];state.savingEvents.push({id:'release',pocketId:'pocket',date:'2026-10-03',amountCents:-200001,note:''});expect(()=>validateState(state)).toThrow(/liberar/);
  });
});

describe('analítica y respaldo estricto',()=>{
  it('barras del mes incluyen tramo parcial y cuadran con los ingresos',()=>{
    const state=fixture();state.movements=[movement({id:'start',date:'2026-10-01'}),movement({id:'middle',date:'2026-10-08'}),movement({id:'end',date:'2026-10-31'})];
    const series=chartSeries(state,period,'all');expect(series).toHaveLength(5);expect(series.at(-1)).toMatchObject({start:'2026-10-29',end:'2026-10-31',label:'29–31'});expect(series.reduce((s,b)=>s+b.value,0)).toBe(totals(state,period,'all').income);
  });
  it('semana cruzada, año bisiesto y filtros no omiten ni duplican días',()=>{
    const state=fixture();state.movements=[movement({id:'oct',date:'2026-10-31'}),movement({id:'nov',date:'2026-11-01'})];
    const week=periodFor('week','2026-11-01');expect(chartSeries(state,week,'all')).toHaveLength(7);expect(selectedMovements(state,week,'all')).toHaveLength(2);expect(chartSeries(state,week,'all').reduce((s,b)=>s+b.value,0)).toBe(300000);
    expect(chartSeries(state,periodFor('month','2024-02-10'),'all').at(-1)?.end).toBe('2024-02-29');expect(chartSeries(state,periodFor('year','2026-01-01'),'all')).toHaveLength(12);
  });
  it('permite metas superadas y evita división por cero al vencer',()=>{
    const state=fixture();state.movements=[movement()];const progress=goalProgress(state,goal({targetCents:100000}));expect(progress.actual).toBe(150000);expect(progress.percent).toBe(150);expect(progress.remaining).toBe(0);
    const expired=goalProgress(state,goal({start:'2020-01-01',end:'2020-01-31'}));expect(expired.daysLeft).toBe(0);expect(expired.daily).toBe(0);expect(Number.isFinite(expired.percent)).toBe(true);
  });
  it('rechaza versión, centavos fraccionarios, referencias y categorías incorrectas sin mutar el original',()=>{
    const state=fixture();state.movements=[movement()];const original=JSON.stringify(state);const valid=validateState(state);valid.movements[0].amountCents=1;expect(JSON.stringify(state)).toBe(original);
    expect(()=>validateState({...state,schemaVersion:2})).toThrow();expect(()=>validateState({...state,movements:[movement({amountCents:1.2})]})).toThrow();expect(()=>validateState({...state,movements:[movement({accountId:'missing'})]})).toThrow(/cuenta/);expect(()=>validateState({...state,movements:[movement({categoryId:'expense-food'})]})).toThrow(/categoría/);
    expect(()=>validateState({...state,movements:[movement({type:'transfer',toAccountId:'bank',categoryId:''})]})).toThrow(/diferentes/);
  });
  it('conserva borradores incompletos fuera de todos los totales',()=>{
    const state=emptyState();state.draft={id:'draft-id',type:'income',amountCents:500000,date:'',sourceId:'',accountId:'',categoryId:'',note:'Pendiente completar'};
    expect(validateState(state).draft?.amountCents).toBe(500000);expect(totals(state,period,'all').income).toBe(0);
  });
});
