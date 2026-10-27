import test from 'node:test';
import assert from 'node:assert/strict';
import { statistics, parseValues, parseCsv, csvColumn, compareDatasets, datasetCsv, emptyDesign, reviewResearch, protocolSignature } from '../lib/research.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const protocol = { purpose: '진자 길이와 주기 측정', steps: [{id:'s1',title:'측정',materials:'추',equipment:'초시계 s',conditions:'길이 0.5 m',notes:'중심 기준'}] };
const dataset = (overrides = {}) => ({id:'d1',project_id:'p1',name:'A',quantity:'주기',unit:'s',values:[1,2,3],exclusions:{},resolution:0.1,coverage_factor:2,conditions:'길이 0.5 m',notes:'',run_date:'2026-10-27',protocol_snapshot:protocol,archived_at:null,...overrides});
test('sample deviation and uncertainty use n-1, standard error, and RSS', () => {
  const result = statistics([1,2,3],{},0.1,2);
  near(result.mean,2);near(result.sd,1);near(result.sem,1/Math.sqrt(3));near(result.typeB,0.1/Math.sqrt(12));near(result.combined,Math.sqrt(1/3+0.01/12));near(result.expanded,result.combined*2);
});
test('one measurement does not fabricate a zero standard deviation', () => {
  const result=statistics([3],{},0.1,2);assert.equal(result.mean,3);assert.equal(result.sd,null);assert.equal(result.sem,null);assert.equal(result.combined,null);
});
test('empty and all-excluded datasets have no mean', () => {
  assert.equal(statistics([]).mean,null);assert.equal(statistics([1],{'0':'장비 오류'}).mean,null);
});
test('excluding a value preserves raw count and changes the calculation', () => {
  const result=statistics([1,2,100],{'2':'기록 오류'});assert.equal(result.total,3);assert.equal(result.n,2);assert.equal(result.excluded,1);near(result.mean,1.5);near(result.sd,Math.sqrt(0.5));
});
test('constant and negative measurements are handled', () => {
  near(statistics([-2,-2,-2]).sd,0);near(statistics([-1,0,1]).mean,0);
});
test('raw parser supports scientific notation and rejects invalid input without dropping rows', () => {
  assert.deepEqual(parseValues('-1.2e-3\n.5, 2;3'),[-0.0012,0.5,2,3]);assert.throws(()=>parseValues('1 bad 3'));assert.throws(()=>parseValues('Infinity'));assert.throws(()=>parseValues('1e101'));assert.throws(()=>parseValues(Array(10001).fill('1').join('\n')));
});
test('CSV parser preserves quoted commas, escaped quotes, newlines and BOM', () => {
  const rows=parseCsv('\ufeffname,value\r\n"a,b",1.2\r\n"a""b",-3\r\n"a\nb",4');assert.deepEqual(rows,[['name','value'],['a,b','1.2'],['a"b','-3'],['a\nb','4']]);assert.deepEqual(csvColumn(rows,1,true),[1.2,-3,4]);
});
test('TSV and missing CSV values are explicit', () => {
  assert.deepEqual(csvColumn(parseCsv('trial\tvalue\n1\t2\n2\t3'),1,true),[2,3]);assert.throws(()=>csvColumn([['x','y'],['1','']],1,true));assert.throws(()=>parseCsv('"unterminated'));
});
test('comparison refuses mismatched units or measured quantities', () => {
  assert.throws(()=>compareDatasets(dataset(),dataset({id:'d2',unit:'ms'})));assert.throws(()=>compareDatasets(dataset(),dataset({id:'d2',quantity:'길이'})));assert.throws(()=>compareDatasets(dataset({unit:'m'}),dataset({id:'d2',unit:'M'})));
});
test('mean difference has correct sign and independent difference uncertainty', () => {
  const result=compareDatasets(dataset(),dataset({id:'d2',values:[2,3,4]}));near(result.difference,1);near(result.relativePercent,50);near(result.differenceUncertainty,Math.hypot(result.a.combined,result.b.combined));assert.equal(compareDatasets(dataset({values:[-1,0,1]}),dataset({values:[0,1,2]})).relativePercent,null);
});
test('reproducibility review reports missing records and simulation provenance', () => {
  const findings=reviewResearch({...emptyDesign,research_type:'simulation'},{purpose:'',steps:[]},[]);assert.equal(findings.find((item)=>item.id==='question').passed,false);assert.equal(findings.find((item)=>item.id==='version').passed,false);assert.equal(findings.find((item)=>item.id==='seed').passed,false);
});
test('snapshot comparison survives JSON key order and detects procedural changes', () => {
  assert.equal(protocolSignature(protocol),protocolSignature({steps:protocol.steps,purpose:protocol.purpose}));const changed={...protocol,purpose:'다른 목적'};assert.notEqual(protocolSignature(changed),protocolSignature(protocol));const findings=reviewResearch({...emptyDesign},changed,[dataset()]);assert.equal(findings.find((item)=>item.id==='snapshot').passed,false);
});
test('archives are omitted from current review and excluded points retain reasons in CSV', () => {
  const findings=reviewResearch({...emptyDesign},protocol,[dataset({archived_at:'2026-10-27'})]);assert.equal(findings.find((item)=>item.id==='data').passed,false);const csv=datasetCsv(dataset({quantity:'=HYPERLINK("x")',exclusions:{'1':'센서 오류'}}));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('센서 오류'));assert.ok(csv.includes('아니오'));assert.equal(csv.split('\r\n').length,4);
});
