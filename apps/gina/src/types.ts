export type Area = 'clinic' | 'collaborations' | 'personal';
export type Scope = 'all' | 'professional' | Area | string;
export type MovementType = 'income' | 'expense' | 'investment' | 'transfer';
export interface Source { id:string; name:string; area:Area; archived:boolean; color:string }
export interface Account { id:string; name:string; area:Area|'mixed'; kind:'cash'|'bank'|'savings'|'investment'; openingCents:number; openingDate:string; spendable:boolean; archived:boolean }
export interface Category { id:string; name:string; type:Exclude<MovementType,'transfer'>; archived:boolean }
export interface Movement { id:string; type:MovementType; amountCents:number; date:string; sourceId:string; accountId:string; toAccountId?:string; categoryId:string; note:string; receivableId?:string; voided:boolean; createdAt:string; updatedAt:string }
export interface Receivable { id:string; sourceId:string; title:string; totalCents:number; date:string; dueDate:string; archived:boolean }
export interface Goal { id:string; title:string; metric:'income'|'savings'; scope:Scope; targetCents:number; start:string; end:string; archived:boolean }
export interface Pocket { id:string; accountId:string; name:string; archived:boolean }
export interface SavingEvent { id:string; pocketId:string; amountCents:number; date:string; note:string }
export interface Budget { id:string; categoryId:string; month:string; limitCents:number }
export interface Favorite { id:string; title:string; type:MovementType; sourceId:string; accountId:string; toAccountId?:string; categoryId:string; note:string; amountCents:number }
export interface Recurring extends Favorite { nextDate:string; frequency:'monthly'; archived:boolean }
export interface AuditEntry { id:string; at:string; action:string; entityId:string }
export interface MonthReview { month:string; reviewedAt:string; incomeCents:number; expenseCents:number; investmentCents:number; fingerprint:string }
export interface FinanceState {
  schemaVersion:1; profile:{name:string; orthomaxMode:'clinic'|'fees'; workDays:number[]};
  sources:Source[]; accounts:Account[]; categories:Category[]; movements:Movement[]; receivables:Receivable[]; goals:Goal[];
  pockets:Pocket[]; savingEvents:SavingEvent[]; budgets:Budget[]; favorites:Favorite[]; recurring:Recurring[];
  audit:AuditEntry[]; monthReviews:MonthReview[]; draft:Partial<Movement>|null; lastExportAt:string;
}
export interface Period { start:string; end:string; label:string }
