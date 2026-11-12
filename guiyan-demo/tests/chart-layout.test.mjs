import test from "node:test";
import assert from "node:assert/strict";
import {amountScale, chartBounds, tickIndices, tickLines} from "../src/chart-layout.mjs";

test("金额轴使用整齐上限，保留小额金额和零成交的独立刻度", () => {
  assert.deepEqual(amountScale([1969900]).ticks,[0,500000,1000000,1500000,2000000]);
  assert.deepEqual(amountScale([4174400]).ticks,[0,1000000,2000000,3000000,4000000,5000000]);
  for (const values of [[],[0],[1],[19],[1999],[999999]]) {
    const scale = amountScale(values);
    assert.ok(scale.max > 0 && values.every(v => v <= scale.max));
    assert.equal(new Set(scale.ticks.map(n => (n/100).toFixed(2))).size,scale.ticks.length);
  }
});

test("日期刻度包含首尾且不重复，跨年周区间分行展示", () => {
  for (const length of [0,1,2,8,30,121]) {
    const indices = tickIndices(length,"week");
    assert.equal(new Set(indices).size,indices.length);
    if (length) {assert.equal(indices[0],0);assert.equal(indices.at(-1),length-1);}
    assert.ok(indices.length<=6);
  }
  assert.deepEqual(tickLines({date:"2026-12-28"},"week"),["12/28","至 01/03"]);
  assert.ok(chartBounds.width-chartBounds.right>=30);
  const narrow = tickIndices(8,"week",5,2);
  assert.equal(narrow[0],0); assert.equal(narrow.at(-1),7);
  assert.ok(narrow.every((n,i) => i===0 || n-narrow[i-1]>=2));
});
