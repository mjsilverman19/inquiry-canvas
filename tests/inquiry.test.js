import test from 'node:test';
import assert from 'node:assert/strict';
import { ancestors, contextFor, EXAMPLE, layout, parseResult, validateSession } from '../src/inquiry.js';
test('a branch sees ancestors, not sibling answers', () => {
  assert.deepEqual(ancestors(EXAMPLE.nodes, 'a3').map(n => n.id), ['q1','a1','q3','a3']);
  const context = contextFor(EXAMPLE.nodes, 'a3');
  assert.match(context, /Adding homes/);
  assert.doesNotMatch(context, /Current residents have knowledge/);
});
test('branching graph separates siblings and connects every node', () => {
  const { points } = layout(EXAMPLE.nodes);
  assert.equal(points.size, EXAMPLE.nodes.length);
  assert.notEqual(points.get('q2').x, points.get('q3').x);
  for (const n of EXAMPLE.nodes.filter(n=>n.parentId)) assert.ok(points.get(n.id).y > points.get(n.parentId).y);
});
test('exports round-trip and malformed graphs are rejected', () => {
  assert.deepEqual(validateSession(JSON.parse(JSON.stringify(EXAMPLE))), EXAMPLE);
  assert.throws(()=>validateSession({...EXAMPLE,nodes:[{...EXAMPLE.nodes[0],parentId:'q1'}]}));
  assert.throws(()=>validateSession({...EXAMPLE,nodes:[{...EXAMPLE.nodes[0],framings:[{title:8}]}]}));
});
test('model output accepts fences and reasoning, rejects incomplete JSON', () => {
  assert.deepEqual(parseResult('<think>plan</think>```json\n{"title":"Answer"}\n```'), {title:'Answer'});
  assert.throws(()=>parseResult('{"title":'));
});
