import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, DEFAULT_MODEL } from '../backend/server/inquiry.js';
const code = 'test-only-long-access-code';
const env = { INQUIRY_ACCESS_CODE: code, INQUIRY_RATE_LIMIT_ID: 'test-rule' };
const payload = { kind: 'answer', context: 'Question: Root\nAnswer: Prior claim', question: 'What follows?', framing: 'Institutional view' };
function request(body=payload, options={}) { return new Request('https://backend.test/api/inquiry', { method: options.method || 'POST', headers: { Origin: options.origin || 'https://mjsilverman19.github.io', Authorization: `Bearer ${options.code || code}`, 'Content-Type': 'application/json' }, ...(options.method === 'GET' || options.method === 'OPTIONS' ? {} : { body: options.raw ?? JSON.stringify(body) }) }); }
const defaults = { env, credential: async()=> 'server-only-credential', rateLimit: async()=>({rateLimited:false}), fetchAI: async()=>Response.json({choices:[{message:{content:JSON.stringify({title:'A claim',paragraphs:['An answer.'],concepts:['Scale'],tensions:[],suggestions:['What changes?']})}}]}) };
test('rejects other origins and never calls upstream', async()=> {
 let called=false; const handle=createHandler({...defaults,fetchAI:async()=>{called=true;}});
 assert.equal((await handle(request(payload,{origin:'https://other.test'}))).status,403);
 assert.equal(called,false);
});
test('supports Pages preflight and keeps secrets off the wire',async()=>{
 const handle=createHandler(defaults); const pre=await handle(request(null,{method:'OPTIONS'}));
 assert.equal(pre.status,204); assert.equal(pre.headers.get('access-control-allow-origin'),'https://mjsilverman19.github.io');
 const result=await handle(request()); const text=await result.text();
 assert.equal(result.status,200); assert.ok(!text.includes(code)); assert.ok(!text.includes('server-only-credential')); assert.match(text,/scale/);
});
test('requires owner configuration and valid access code',async()=>{
 assert.equal((await createHandler({...defaults,env:{}})(request())).status,503);
 assert.equal((await createHandler(defaults)(request(payload,{code:'wrong-code'}))).status,401);
});
test('rate limits fail closed before credentials or model are used',async()=>{
 let calls=0;const deps={...defaults,credential:async()=>{calls++;return 'secret';},fetchAI:async()=>{calls++;}};
 assert.equal((await createHandler({...deps,rateLimit:async()=>({rateLimited:true})})(request())).status,429);
 assert.equal((await createHandler({...deps,rateLimit:async()=>({rateLimited:false,error:'not-found'})})(request())).status,503);
 assert.equal((await createHandler({...deps,rateLimit:async()=>{throw new Error('offline');}})(request())).status,503);
 assert.equal(calls,0);
});
test('connection checks do not purchase inference',async()=>{
 let calls=0;const result=await createHandler({...defaults,fetchAI:async()=>{calls++;}})(request({kind:'connect'}));
 assert.equal(result.status,200);assert.equal((await result.json()).model,DEFAULT_MODEL);assert.equal(calls,0);
});
test('bounds requests and refuses unsupported operations',async()=>{
 const handle=createHandler(defaults);
 assert.equal((await handle(request({...payload,question:'x'.repeat(20001)}))).status,400);
 assert.equal((await handle(request({...payload,question:'x'.repeat(49000)}))).status,413);
 assert.equal((await handle(request({kind:'arbitrary-fetch'}))).status,400);
 assert.equal((await handle(request(null,{raw:'invalid'}))).status,400);
});
test('owner controls the model, output cap and provider endpoint',async()=>{
 let sent;
 const result=await createHandler({...defaults,fetchAI:async(url,options)=>{sent={url,...JSON.parse(options.body),authorization:options.headers.Authorization};return defaults.fetchAI();}})(request({...payload,model:'expensive-model',max_tokens:100000,url:'https://malicious.test'}));
 assert.equal(result.status,200);assert.equal(sent.model,DEFAULT_MODEL);assert.equal(sent.max_tokens,2500);assert.equal(sent.url,'https://ai-gateway.vercel.sh/v1/chat/completions');assert.equal(sent.authorization,'Bearer server-only-credential');
 assert.match(sent.messages[1].content,/Prior claim/);
});
test('upstream failures and invalid model output never expose upstream text',async()=>{
 const bad=await createHandler({...defaults,fetchAI:async()=>new Response('secret provider details',{status:401})})(request());
 assert.equal(bad.status,502);assert.ok(!(await bad.text()).includes('secret provider details'));
 const malformed=await createHandler({...defaults,fetchAI:async()=>Response.json({choices:[{message:{content:'{"bad":'}}]})})(request());assert.equal(malformed.status,502);
});
