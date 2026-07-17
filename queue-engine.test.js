const assert = require("assert");
const { createQueueEngine } = require("./queue-engine");

const engine = createQueueEngine();

assert.strictEqual(engine.getMode(), "party");

const firstRequest = engine.handleGuestRequest();
assert.deepStrictEqual(firstRequest, {
  firstGuestRequest: true,
  enqueue: "replace"
});
assert.strictEqual(engine.getMode(), "guest");

const secondRequest = engine.handleGuestRequest();
assert.deepStrictEqual(secondRequest, {
  firstGuestRequest: false,
  enqueue: "add"
});
assert.strictEqual(engine.getMode(), "guest");

assert.strictEqual(engine.completeGuestSession(), true);
assert.strictEqual(engine.getMode(), "party");

assert.strictEqual(engine.completeGuestSession(), false);

console.log("Queue engine tests passed.");
