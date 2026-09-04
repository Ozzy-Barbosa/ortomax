export const PHONE = '526121429561';
export const whatsappUrl = message => `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
export function clinicNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone:'America/Mazatlan', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now).map(p => [p.type,p.value]));
  return { date:`${parts.year}-${parts.month}-${parts.day}`, minutes:Number(parts.hour)*60+Number(parts.minute) };
}
export function allowedHours(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const current = clinicNow(now);
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date < current.date || parsed.getUTCDay() === 0) return [];
  const closing = parsed.getUTCDay() === 6 ? 14 : 19;
  return Array.from({length:closing-9},(_,i)=>i+9).filter(hour => date !== current.date || hour*60 > current.minutes);
}
export function nextAppointmentDate(now = new Date()) {
  const day = new Date(`${clinicNow(now).date}T12:00:00Z`);
  while (!allowedHours(day.toISOString().slice(0,10),now).length) day.setUTCDate(day.getUTCDate()+1);
  return day.toISOString().slice(0,10);
}
export function appointmentMessage(name,treatment,date,hour,comments = '') {
  const pretty = new Intl.DateTimeFormat('es-MX',{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
  const note = comments.trim().slice(0,400);
  return `Hola Orthomax, soy ${name.trim()}. Me gustaría solicitar una cita.\n\nTratamiento de interés: ${treatment}.\nFecha preferida: ${pretty}.\nHora preferida: ${hour}.${note ? `\n\nComentarios: ${note}` : ''}\n\nEntiendo que la cita está sujeta a confirmación. Quedo atento(a) a su respuesta.`;
}
