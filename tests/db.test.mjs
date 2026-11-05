import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {put,get,remove,assetList} from '../db.js';
test('audio shelf persists blobs, lists metadata and removes only selected item',async()=>{
 await put('assets',{id:'one',blob:new Blob(['audio']),created:1,filename:'one.mp3'});
 await put('assets',{id:'two',blob:new Blob(['new']),created:2,filename:'two.mp3'});
 const list=await assetList();assert.equal(list[0].id,'two');assert.equal(list[0].blob,undefined);assert.equal(await (await get('assets','one')).blob.text(),'audio');
 await remove('assets','one');assert.equal(await get('assets','one'),undefined);assert.ok(await get('assets','two'));
});
