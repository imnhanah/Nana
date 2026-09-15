import test from 'node:test';
import assert from 'node:assert/strict';
import {timeParts,storedTime,displayTime} from './timePickerModel.js';
test('12-hour time round-trips every hour, including noon and midnight',()=>{
  for(let hour=0;hour<24;hour++){
    const value=String(hour).padStart(2,'0')+':37';
    const parts=timeParts(value);
    assert.equal(storedTime(parts.hour,parts.minute,parts.period),value);
  }
  assert.equal(displayTime('00:00'),'12:00 AM');
  assert.equal(displayTime('12:00'),'12:00 PM');
  assert.equal(displayTime('23:59'),'11:59 PM');
  assert.equal(displayTime(''),'--:--');
  assert.equal(storedTime('12','05','AM'),'00:05');
  assert.equal(storedTime('12','05','PM'),'12:05');
});
