import test from 'node:test';
import assert from 'node:assert/strict';
import { periodsOnDate, weekPeriods } from '../lib/calendar-periods.ts';
const project = (id, start_date, due_date) => ({id, title:id, start_date, due_date});
test('period includes both ends and excludes missing or reversed bounds', () => {
  const projects = [project('valid','2026-11-17','2026-11-20'), project('missing',null,'2026-11-20'), project('bad','2026-11-20','2026-11-17')];
  assert.deepEqual(periodsOnDate(projects,'2026-11-17').map(p=>p.id), ['valid']);
  assert.equal(periodsOnDate(projects,'2026-11-20').length,1);
  assert.equal(periodsOnDate(projects,'2026-11-21').length,0);
});
test('cross-month periods are clipped to actual day columns and retain continuation', () => {
  const segments = weekPeriods([project('range','2026-10-29','2026-12-02')], [null,null,'2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05']);
  assert.equal(segments[0].first,3); assert.equal(segments[0].last,7);
  assert.equal(segments[0].continuesBefore,true); assert.equal(segments[0].continuesAfter,true);
});
test('single-day, overlapping and leap-day periods occupy their inclusive columns', () => {
  const dates = ['2028-02-27','2028-02-28','2028-02-29','2028-03-01',null,null,null];
  const segments = weekPeriods([project('one','2028-02-29','2028-02-29'),project('long','2028-02-28','2028-03-01')], dates);
  assert.deepEqual(segments.map(s=>[s.first,s.last,s.continuesBefore,s.continuesAfter]), [[3,3,false,false],[2,4,false,false]]);
});
