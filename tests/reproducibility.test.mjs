import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReproduction } from '../lib/reproducibility.ts';
const a={id:'a',name:'A',quantity:'주기',unit:'s',n:5,mean:1,sd:.01,conditions:'같은 길이',protocol:'snapshot',exclusionsValid:true};
const b={...a,id:'b',name:'B',mean:1.02};
const plan={baselineId:'a',repeatId:'b',tolerance:.05,minRepeats:3,maxCvPercent:2,procedure:'독립 측정',savedAt:'2026-10-29'};
test('confirmed compatible repeated data meet the chosen criteria',()=>assert.equal(assessReproduction(a,b,plan,true).verdict,'입력 기준 충족'));
test('mean difference outside criterion fails, rather than claiming general reproducibility',()=>assert.equal(assessReproduction(a,{...b,mean:1.1},plan,true).verdict,'입력 기준 미충족'));
test('missing independence confirmation or protocol blocks a verdict',()=>{
  assert.equal(assessReproduction(a,b,plan,false).verdict,'판정 보류');
  assert.equal(assessReproduction(a,{...b,protocol:'changed'},plan,true).verdict,'판정 보류');
});
test('same dataset, mismatched units and insufficient repeats block a verdict',()=>{
  for(const update of [{id:'a'},{unit:'ms'},{n:1},{exclusionsValid:false},{conditions:''}])assert.equal(assessReproduction(a,{...b,...update},plan,true).verdict,'판정 보류');
});
test('zero mean does not fabricate CV and optional CV can be omitted',()=>{
  const x={...a,mean:0},y={...b,mean:0};
  assert.equal(assessReproduction(x,y,plan,true).verdict,'판정 보류');
  assert.equal(assessReproduction(x,y,{...plan,maxCvPercent:null},true).verdict,'입력 기준 충족');
});
test('negative means use absolute baseline for CV; invalid criteria are rejected',()=>{
  assert.equal(assessReproduction({...a,mean:-1},{...b,mean:-1},plan,true).cvA,1);
  for(const update of [{tolerance:NaN},{tolerance:-1},{minRepeats:1},{minRepeats:2.5},{maxCvPercent:-1}])assert.throws(()=>assessReproduction(a,b,{...plan,...update},true));
});
