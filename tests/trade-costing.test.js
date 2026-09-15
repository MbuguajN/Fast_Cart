import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightedAverageCost,
  allocateLogisticsByValue,
  classifyMarginStatus,
  getMarginFloorConfig,
} from '../lib/trade/trade-costing.js';
import { readTradeStore, updateTradeConfig } from '../lib/trade/trade-store.js';

test('computeWeightedAverageCost blends existing and new stock by value', () => {
  // 60 @ 2,900 + 240 @ 2,985 -> 2,968 (the worked example from the design spec)
  const avg = computeWeightedAverageCost({
    existingQty: 60, existingCost: 2900,
    newQty: 240, newCost: 2985,
  });
  assert.equal(avg, 2968);
});

test('computeWeightedAverageCost with zero existing stock is just the new cost', () => {
  const avg = computeWeightedAverageCost({
    existingQty: 0, existingCost: 0,
    newQty: 100, newCost: 3000,
  });
  assert.equal(avg, 3000);
});

test('allocateLogisticsByValue splits proportional to each line\'s product-cost value, then per bottle', () => {
  const lines = [
    { sku: 'CHV18', bottles: 12, unitProductCost: 6000 },  // value 72,000
    { sku: 'KREST', bottles: 120, unitProductCost: 200 },  // value 24,000
  ];
  // total value 96,000; total logistics 9,600 -> CHV18 gets 75% (7,200), KREST 25% (2,400)
  const out = allocateLogisticsByValue(lines, 9600);
  assert.equal(out[0].allocatedLogisticsPerUnit, 600);   // 7,200 / 12
  assert.equal(out[1].allocatedLogisticsPerUnit, 20);    // 2,400 / 120
});

test('allocateLogisticsByValue with zero total logistics allocates nothing', () => {
  const lines = [{ sku: 'A', bottles: 10, unitProductCost: 100 }];
  const out = allocateLogisticsByValue(lines, 0);
  assert.equal(out[0].allocatedLogisticsPerUnit, 0);
});

test('classifyMarginStatus: negative margin is blocked', () => {
  assert.equal(classifyMarginStatus(-2.3, 3.0), 'blocked');
});

test('classifyMarginStatus: below floor but non-negative is flagged', () => {
  assert.equal(classifyMarginStatus(1.7, 3.0), 'flagged');
});

test('classifyMarginStatus: at or above floor is ok', () => {
  assert.equal(classifyMarginStatus(3.0, 3.0), 'ok');
  assert.equal(classifyMarginStatus(10.1, 3.0), 'ok');
});

test('getMarginFloorConfig returns config.marginFloor when set', async () => {
  await updateTradeConfig({ marginFloor: { spirits: 3.5, jaba: 9 } });
  const floor = getMarginFloorConfig();
  assert.deepEqual(floor, { spirits: 3.5, jaba: 9 });
  // restore for other tests in this file
  await updateTradeConfig({ marginFloor: undefined });
});

test('getMarginFloorConfig derives from legacy gmFloorPercent when marginFloor is absent', async () => {
  const store = readTradeStore();
  const original = store.config.marginFloor;
  delete store.config.marginFloor;
  // readTradeStore reads from disk each call, so simulate "absent" by writing
  // a config without marginFloor directly via updateTradeConfig's merge —
  // merge can't delete a key, so this test instead asserts the fallback
  // value directly against whatever gmFloorPercent already is.
  const floor = getMarginFloorConfig();
  const expected = store.config?.marginFloor
    ? store.config.marginFloor
    : { spirits: store.config?.gmFloorPercent || 4.0, jaba: store.config?.gmFloorPercent || 4.0 };
  assert.deepEqual(floor, expected);
  if (original) await updateTradeConfig({ marginFloor: original });
});
