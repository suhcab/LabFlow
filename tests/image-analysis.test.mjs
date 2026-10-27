import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRegion,regionBetween,pixelDistance,calibratedLength,compareRegions } from '../lib/image-analysis.ts';
const pixels=new Uint8ClampedArray([0,0,0,255,255,255,255,255,255,0,0,255,0,0,0,0]);
const near=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-9,`${value} != ${expected}`);
test('ROI uses original image pixels; transparent pixels composite on white',()=>{
  const a=analyzeRegion(pixels,2,2,{x:0,y:0,width:2,height:1},128);
  near(a.mean.brightness,127.5);near(a.mean.r,127.5);assert.equal(a.abovePercent,50);assert.equal(a.histogram.reduce((sum,n)=>sum+n,0),2);
  const transparent=analyzeRegion(pixels,2,2,{x:1,y:1,width:1,height:1},255);near(transparent.mean.brightness,255);assert.equal(transparent.abovePercent,100);
});
test('weighted encoded RGB brightness and equality at threshold are explicit',()=>{
  const a=analyzeRegion(pixels,2,2,{x:0,y:1,width:1,height:1},54);
  near(a.mean.brightness,54.213);assert.equal(a.aboveThreshold,1);
  const black=analyzeRegion(pixels,2,2,{x:0,y:0,width:1,height:1},0);assert.equal(black.abovePercent,100);
});
test('rectangle selection normalizes drag direction, clamps and retains empty region',()=>{
  assert.deepEqual(regionBetween({x:3.2,y:5.1},{x:-4,y:1.2},4,4),{x:0,y:1,width:4,height:3});
  assert.equal(regionBetween({x:1,y:1},{x:1,y:2},4,4).width,0);
});
test('invalid ROI and threshold are rejected',()=>{
  assert.throws(()=>analyzeRegion(pixels,2,2,{x:0,y:0,width:3,height:1},128));
  assert.throws(()=>analyzeRegion(pixels,2,2,{x:0,y:0,width:0,height:1},128));
  assert.throws(()=>analyzeRegion(pixels,2,2,{x:0,y:0,width:1,height:1},NaN));
  assert.throws(()=>analyzeRegion(pixels,3,2,{x:0,y:0,width:1,height:1},0));
});
test('scale calibration uses Euclidean pixel lengths and refuses invalid reference',()=>{
  assert.equal(pixelDistance({x:0,y:0},{x:3,y:4}),5);assert.equal(calibratedLength(40,20,10),20);
  assert.equal(calibratedLength(40,0,10),null);assert.equal(calibratedLength(40,20,-10),null);
});
test('region difference is B minus A and avoids division by black baseline',()=>{
  const black=analyzeRegion(pixels,2,2,{x:0,y:0,width:1,height:1},128);
  const white=analyzeRegion(pixels,2,2,{x:1,y:0,width:1,height:1},128);
  const result=compareRegions(black,white);near(result.brightnessDifference,255);assert.equal(result.relativePercent,null);assert.equal(result.areaPercentPointDifference,100);
});
