import test from 'node:test';
import assert from 'node:assert/strict';

const { recordEvent, readEvents, summarise, timed, EVENT_KINDS, OUTCOMES, __resetForTests } =
  await import('../lib/event-log.js');

test('records an event and reads it back newest first', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK, durationMs: 12, detail: 'products' });
  recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.FAIL, durationMs: 3, detail: 'bad signature' });

  const events = readEvents({ limit: 10 });
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, EVENT_KINDS.WEBHOOK, 'newest first');
  assert.equal(events[1].detail, 'products');
  assert.ok(events[0].ts, 'every event is timestamped');
});

test('filters by kind and outcome', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK });

  assert.equal(readEvents({ kind: EVENT_KINDS.GEOCODE }).length, 2);
  assert.equal(readEvents({ outcome: OUTCOMES.FAIL }).length, 1);
});

test('is capped so it cannot grow without bound', () => {
  __resetForTests();
  for (let i = 0; i < 2500; i++) {
    recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK, detail: `call-${i}` });
  }
  const events = readEvents({ limit: 5000 });
  assert.ok(events.length <= 2000, `expected cap at 2000, got ${events.length}`);
  assert.equal(events[0].detail, 'call-2499', 'the newest event survives');
});

test('never stores credentials or email addresses', () => {
  __resetForTests();
  recordEvent({
    kind: EVENT_KINDS.WC_CALL,
    outcome: OUTCOMES.FAIL,
    detail: 'failed for chris@5dm.africa with consumer_secret=cs_abc123',
  });
  const [event] = readEvents({});
  assert.ok(!event.detail.includes('chris@5dm.africa'), 'email redacted');
  assert.ok(!event.detail.includes('cs_abc123'), 'secret redacted');
  assert.match(event.detail, /\[redacted\]/);
});

test('summarise reports failure rate per kind', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });

  const s = summarise(readEvents({}));
  assert.equal(s.byKind[EVENT_KINDS.GEOCODE].total, 3);
  assert.equal(s.byKind[EVENT_KINDS.GEOCODE].failed, 2);
  assert.ok(s.lastFailureAt, 'the most recent failure is reported');
});

test('timed records duration and re-throws on failure', async () => {
  __resetForTests();

  const value = await timed(EVENT_KINDS.WC_CALL, async () => 'ok', 'products');
  assert.equal(value, 'ok');
  assert.equal(readEvents({})[0].outcome, OUTCOMES.OK);

  await assert.rejects(
    () => timed(EVENT_KINDS.WC_CALL, async () => { throw new Error('origin down'); }, 'orders'),
    /origin down/
  );
  const [failure] = readEvents({});
  assert.equal(failure.outcome, OUTCOMES.FAIL);
  assert.match(failure.detail, /origin down/);
});
