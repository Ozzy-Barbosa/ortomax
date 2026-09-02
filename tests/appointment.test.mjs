import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedHours, clinicNow, whatsappUrl, appointmentMessage } from '../appointment.js';
const now = new Date('2026-09-01T19:30:00Z'); // 12:30 in La Paz.
test('uses the clinic timezone rather than the visitor timezone',()=>{
  assert.deepEqual(clinicNow(now),{date:'2026-09-01',minutes:750});
  assert.equal(clinicNow(new Date('2026-09-02T02:00:00Z')).date,'2026-09-01');
});
test('rejects past dates, Sunday, invalid dates and elapsed hours',()=>{
  for(const date of ['2026-08-31','2026-09-06','','2026-02-30','2026-13-01']) assert.deepEqual(allowedHours(date,now),[]);
  assert.deepEqual(allowedHours('2026-09-01',now),[13,14,15,16,17,18]);
});
test('Saturday closes at 14:00; weekdays at 19:00',()=>{
  assert.deepEqual(allowedHours('2026-09-05',now),[9,10,11,12,13]);
  assert.deepEqual(allowedHours('2026-09-02',now),[9,10,11,12,13,14,15,16,17,18]);
});
test('a just-expired slot cannot be submitted',()=>{
  assert.ok(!allowedHours('2026-09-01',new Date('2026-09-01T20:00:00Z')).includes(13));
  assert.deepEqual(allowedHours('2026-09-01',new Date('2026-09-02T01:00:00Z')),[]);
});
test('WhatsApp safely encodes names and does not promise a confirmed booking',()=>{
  const message=appointmentMessage(' María & José ','Ortodoncia estética','2026-09-05','10:00 am');
  assert.match(message,/sábado/);
  assert.match(message,/sujeta a confirmación/);
  const url=new URL(whatsappUrl(message));
  assert.equal(url.hostname,'wa.me');
  assert.equal(url.pathname,'/526121429561');
  assert.equal(url.searchParams.get('text'),message);
});
