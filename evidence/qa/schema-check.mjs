import assert from 'node:assert/strict';
import { instantSchema, eventTimeSchema } from '../../dist/server/shared/contracts.js';
for (const value of ['+010000-01-01T00:00:00.000Z','-000001-01-01T00:00:00.000Z','2026-02-30T00:00:00.000Z','2026-10-23T12:00:00Z','2026-10-23T12:00:00.000+00:00']) {
  const accepted=instantSchema.safeParse(value).success;
  console.log(JSON.stringify({value,accepted})); assert.equal(accepted,false);
}
assert.equal(instantSchema.safeParse('2026-10-23T12:00:00.000Z').success,true);
assert.equal(eventTimeSchema.safeParse({kind:'timed',start:'2026-10-23T12:00:00.000Z',end:'2026-10-23T13:00:00.000Z'}).success,true);
console.log('PASS: exact four-digit-year canonical instants only');
