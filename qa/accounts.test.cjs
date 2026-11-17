const {test}=require('node:test');
const assert=require('node:assert/strict');
const Accounts=require('../accounts.js');

function storage(){
 const state=new Map();
 return {getItem:key=>state.has(key)?state.get(key):null,
   setItem:(key,val)=>state.set(key,String(val)),
   removeItem:key=>state.delete(key),
   keys:()=>[...state.keys()]};
}
const uid1='00000000-0000-4000-8000-000000000001';
const uid2='00000000-0000-4000-8000-000000000002';

test('cada perfil possui chave de armazenamento exclusiva',()=>{
 const db=storage();
 Accounts.add(db,uid1);
 Accounts.add(db,uid2);
 assert.equal(Accounts.list(db).length,2);
 assert.equal(Accounts.active(db).id,uid2);
 assert.notEqual(Accounts.storeKey(uid1),Accounts.storeKey(uid2));
 db.setItem(Accounts.storeKey(uid1),'usuario-1');
 db.setItem(Accounts.storeKey(uid2),'usuario-2');
 Accounts.select(db,uid1);
 assert.equal(Accounts.active(db).id,uid1);
 assert.equal(db.getItem(Accounts.storeKey(uid1)),'usuario-1');
 assert.equal(db.getItem(Accounts.storeKey(uid2)),'usuario-2');
 assert.throws(()=>Accounts.select(db,'perfil-ausente'));
});

test('cadastro valida nome, telefone, email e foto sem persistir campos no índice',()=>{
 const p=Accounts.profile({name:'  Teste  de  perfil ',phone:'(41) 99999-9999',email:'TESTE@EXEMPLO.COM',avatar:4,photo:''},uid1);
 assert.equal(p.name,'Teste de perfil');
 assert.equal(p.email,'teste@exemplo.com');
 assert.equal(p.avatar,4);
 assert.throws(()=>Accounts.profile({name:'A',email:'a@b.com'},uid1));
 assert.throws(()=>Accounts.profile({name:'Validado',email:'invalido'},uid1));
 assert.throws(()=>Accounts.profile({name:'Validado',phone:'abc'},uid1));
 assert.throws(()=>Accounts.profile({name:'Validado',photo:'javascript:alert(1)'},uid1));
 const db=storage();
 Accounts.add(db,uid1);
 assert.ok(!JSON.stringify(Accounts.list(db)).includes('TESTE@EXEMPLO.COM'));
});

test('avatares disponíveis em cinco variações financeiras distintas',()=>{
 const images=Array.from({length:5},(_,i)=>Accounts.avatar(i));
 assert.equal(new Set(images).size,5);
 assert.ok(images.every(x=>x.startsWith('data:image/svg+xml;charset=UTF-8,')));
});

test('biometria exige WebAuthn PRF, sem fallback falso de autenticação',async()=>{
 const db=storage();
 assert.equal(Accounts.supported(),false);
 assert.equal(Accounts.biometricConfigured(db,uid1),false);
 await assert.rejects(()=>Accounts.enroll(db,uid1,'senha-mais-de-doze'));
 await assert.rejects(()=>Accounts.unlock(db,uid1));
 db.setItem('reserva.biometric.prf.'+uid1,'teste');
 assert.equal(Accounts.biometricConfigured(db,uid1),true);
 Accounts.disableBiometric(db,uid1);
 assert.equal(Accounts.biometricConfigured(db,uid1),false);
});

test('biometria corrompida oferece recuperação por senha sem SyntaxError bruto',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const context={isSecureContext:true,PublicKeyCredential:function(){},crypto:require('node:crypto').webcrypto,navigator:{credentials:{create(){},get(){}}},module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../accounts.js'),'utf8'),context);const db=storage();db.setItem('reserva.biometric.prf.'+uid1,'{quebrado');await assert.rejects(()=>context.module.exports.unlock(db,uid1),/corrompido.*senha/);
});

test('biometria migra registro antigo após PRF válido e vincula novos registros ao perfil',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto').webcrypto;
 const raw=crypto.getRandomValues(new Uint8Array(32)),credential=new Uint8Array([1,2,3,4]);
 const response={rawId:credential,getClientExtensionResults:()=>({prf:{enabled:true,results:{first:raw}}})};
 const context={isSecureContext:true,PublicKeyCredential:function(){},crypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,btoa,atob,navigator:{credentials:{create:async()=>response,get:async()=>response}},module:{exports:{}}};vm.runInNewContext(fs.readFileSync(require.resolve('../accounts.js'),'utf8'),context);
 const api=context.module.exports,db=storage(),salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 const b64=x=>Buffer.from(x).toString('base64'),password='senha protegida biometria',cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(password));
 db.setItem('reserva.biometric.prf.'+uid1,JSON.stringify({format:'reserva-biometric-prf-v1',credentialId:b64(credential),salt:b64(salt),iv:b64(iv),data:b64(cipher)}));assert.equal(await api.unlock(db,uid1),password);
 const upgraded=db.getItem('reserva.biometric.prf.'+uid1);assert.equal(JSON.parse(upgraded).format,'reserva-biometric-prf-v2');assert.equal(await api.unlock(db,uid1),password);
 db.setItem('reserva.biometric.prf.'+uid2,upgraded);await assert.rejects(()=>api.unlock(db,uid2));
 await api.enroll(db,uid1,password);assert.equal(JSON.parse(db.getItem('reserva.biometric.prf.'+uid1)).format,'reserva-biometric-prf-v2');assert.equal(await api.unlock(db,uid1),password);
});
