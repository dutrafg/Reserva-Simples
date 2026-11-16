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
