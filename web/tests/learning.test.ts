import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentSchema} from '../lib/learning';
test('learning schema accepts old progress alongside role notes and rejects unknown or oversized data',()=>{
 const role={pace:'steady',units:Object.fromEntries(['python','design','pytest','fixtures','cpp','component','mqtt','async','git','docker','ado','trace'].map(id=>[id,{read:false,quiz:true,practice:false,draft:'notes'}])),story:'real experience',answers:Array(12).fill(''),ratings:Array(12).fill(0)};
 assert.equal(documentSchema.safeParse({python0:{draft:'old notes'},role}).success,true);
 assert.equal(documentSchema.safeParse({role:{...role,pace:'tomorrow'}}).success,false);
 assert.equal(documentSchema.safeParse({role:{...role,story:'x'.repeat(6001)}}).success,false);
 assert.equal(documentSchema.safeParse({role:{...role,units:{...role.units,invented:{}}}}).success,false);
 assert.equal(documentSchema.safeParse({role:{...role,ratings:[5]}}).success,false);
 assert.equal(documentSchema.safeParse({python0:{quiz:true}}).success,true);
});
