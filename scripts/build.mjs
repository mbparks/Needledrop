import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const copy=async(from,to)=>{await fs.mkdir(path.dirname(to),{recursive:true});await fs.copyFile(from,to);};
for(const [pkg,folder] of [['ffmpeg','ffmpeg'],['core','core']]){
 const source=path.join(root,'node_modules/@ffmpeg',pkg,'dist/esm');
 for(const name of await fs.readdir(source))if(name.endsWith('.js')||name.endsWith('.wasm'))await copy(path.join(source,name),path.join(root,'vendor',folder,name));
}
console.log('Bundled encoder refreshed. Load the NEEDLEDROP root directory in Chrome.');
