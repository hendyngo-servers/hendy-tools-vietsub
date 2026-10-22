const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/subtitles.js');

test('legacy parser smoke-test path now uses the extracted parser module', () => {
  const cases = [
    ['00:00:01,250', 1250],
    ['00:01:02.500', 62500],
    ['01:02:03,004', 3723004]
  ];
  for (const [input, expected] of cases) assert.equal(Core.parseTimestamp(input), expected);
});
