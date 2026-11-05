import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {scanPage} from '../scanner.js';
test('scanner finds and deduplicates media across DOM, shadow roots and resource history',()=>{
 const dom=new JSDOM(`<title>Test</title><a href='/song.mp3'>A track</a><audio src='/song.mp3'></audio><video><source src='/movie.mp4'></video><audio src='blob:https://example.com/id'></audio><a href='/stream.m3u8'>Live</a><a href='javascript:alert(1)'>No</a><a href='/download' type='audio/mpeg'>Endpoint</a><meta property='og:audio' content='/open.ogg'><div id='shadow'></div><iframe src='https://embed.example/video'></iframe>`,{url:'https://example.com/page',runScripts:'outside-only'});
 dom.window.document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<audio src="/shadow.wav"></audio>';
 dom.window.performance.getEntriesByType=()=>[{name:'https://example.com/movie.mp4'},{name:'https://cdn.example/video.webm'},{name:'https://example.com/image.png'}];
 const r=dom.window.eval('('+scanPage.toString()+')()');
 assert.equal(r.items.length,8);assert.equal(r.embedded,1);
 assert.equal(r.items.find(i=>i.url.endsWith('movie.mp4')).type,'video');
 assert.equal(r.items.find(i=>i.url.startsWith('blob:')).type,'stream');
 assert.equal(r.items.find(i=>i.url.endsWith('/download')).type,'mp3');
 assert.equal(r.items.find(i=>i.url.endsWith('video.webm')).type,'video');
 dom.window.close();
});
test('scanner flags encrypted-media use and caps untrusted pages',()=>{
 const dom=new JSDOM('<video></video>'+Array.from({length:500},(_,i)=>`<a href="/${i}.mp3">track</a>`).join(''),{url:'https://example.com',runScripts:'outside-only'});
 Object.defineProperty(dom.window.document.querySelector('video'),'mediaKeys',{value:{}});dom.window.performance.getEntriesByType=()=>[];
 const r=dom.window.eval('('+scanPage.toString()+')()');assert.equal(r.protectedMedia,true);assert.equal(r.items.length,300);dom.window.close();
});
