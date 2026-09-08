import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRulesPrompt } from './prompt.ts';
import { validateWholeRulebookReply } from './rulebookPrompt.ts';

const input = {
  mode: 'rulebook', gameName: 'Moonlit Market', userPrompt: 'Two traders buy cards and race to 15 prestige.',
  targetChapters: [{ id: 'setup', title: 'Setup' }, { id: 'turn', title: 'Taking a Turn' }],
  chapters: [{ id: 'setup', title: 'Setup', body: '' }],
  components: [{ name: 'Market deck', rows: [{ title: 'Amber Tea', cost: '2', copies: 4, customFields: { points: '2' } }] }],
};
test('whole-rulebook mode asks for one consistent structured proposal grounded in component data', () => {
  const prompt = buildRulesPrompt(input);
  assert.equal(prompt.mode, 'rulebook');
  assert.equal(prompt.chapterCount, 2);
  assert.match(prompt.systemPrompt, /every requested ID exactly once/);
  assert.match(prompt.userMessage, /Amber Tea/);
  assert.match(prompt.userMessage, /Two traders/);
  assert.match(prompt.userMessage, /"id":"setup"/);
  assert.throws(() => buildRulesPrompt({ ...input, targetChapters: [input.targetChapters[0], input.targetChapters[0]] }), /unique/);
  assert.throws(() => buildRulesPrompt({ ...input, userPrompt: '' }), /Describe/);
});
test('whole-rulebook responses must cover the exact requested chapters with nonempty bounded prose', () => {
  const chapters = [{ id: 'setup', body: 'Shuffle the cards.' }, { id: 'turn', body: 'Take two actions.' }];
  assert.doesNotThrow(() => validateWholeRulebookReply(JSON.stringify({ chapters }), input));
  for (const bad of [[chapters[0]], [chapters[0], chapters[0]], [chapters[0], { id: 'extra', body: 'Invented' }], [chapters[0], { id: 'turn', body: ' ' }]]) {
    assert.throws(() => validateWholeRulebookReply(JSON.stringify({ chapters: bad }), input));
  }
  assert.throws(() => validateWholeRulebookReply('not JSON', input), /unreadable/);
});
