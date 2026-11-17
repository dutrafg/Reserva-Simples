/* Perfis locais do Reserva Simples: sem servidor e sem sincronização de identidade. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ReservaAccounts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const INDEX='reserva.accounts.index.v1';
  const ACTIVE='reserva.accounts.active.v1';
  const ID=/^[a-f0-9-]{36}$/i;
  const b64=bytes=>btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
  const un64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  const toBytes=x=>new Uint8Array(x);
  function list(storage){
    try{
      const value=JSON.parse(storage.getItem(INDEX)||'[]');
      if(!Array.isArray(value))return [];
      return value.filter(x=>x&&ID.test(x.id)&&typeof x.label==='string'&&x.label.length<=40).slice(0,30);
    }catch{return []}
  }
  function active(storage){
    const accounts=list(storage);
    return accounts.find(x=>x.id===storage.getItem(ACTIVE))||accounts[0]||null;
  }
  function storeKey(id){if(!ID.test(id))throw Error('Identificador inválido');return 'reserva-simples-account-'+id}
  function add(storage,id){
    const accounts=list(storage);if(!ID.test(id)||accounts.some(x=>x.id===id)||accounts.length>=30)throw Error('Limite de perfis locais');
    const item={id,label:'Usuário '+(accounts.length+1),createdAt:new Date().toISOString()};
    storage.setItem(INDEX,JSON.stringify([...accounts,item]));
    storage.setItem(ACTIVE,id);
    return item;
  }
  function select(storage,id){
    if(!list(storage).some(x=>x.id===id))throw Error('Perfil não cadastrado');
    storage.setItem(ACTIVE,id);
  }
  function photoValid(photo){
    return typeof photo==='string'&&photo.length<=200000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo);
  }
  function profile(input,id){
    const name=String(input.name||'').trim().replace(/\s+/g,' ');
    const email=String(input.email||'').trim().toLowerCase();
    const phone=String(input.phone||'').trim();
    const avatar=Number(input.avatar);
    if(!ID.test(id)||name.length<2||name.length>80)throw Error('Informe um nome de 2 a 80 caracteres.');
    if(email.length>120||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('Informe um e-mail válido.');
    if(phone.length>24||(phone&&!/^[+()\d\s.-]{7,24}$/.test(phone)))throw Error('Telefone inválido.');
    if(input.photo&&!photoValid(input.photo))throw Error('A foto precisa ser JPEG, PNG ou WebP com até 150 KB.');
    return {id,name,email,phone,avatar:Number.isInteger(avatar)&&avatar>=0&&avatar<5?avatar:0,photo:input.photo||''};
  }
  const shapes=[
    '<path d="M21 45h8m45 0h8M38 54v7m26-7v7M32 38c-3-14 20-22 39-9l8-5v15c3 5 3 12 0 17-8 15-34 17-46 3-11-12-6-24-1-25z" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/><circle cx="66" cy="37" r="3" fill="white"/>',
    '<path d="M24 72V31M24 72h61M32 60l16-16 13 7 20-25M70 26h11v11" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '<ellipse cx="52" cy="34" rx="25" ry="10" fill="none" stroke="white" stroke-width="5"/><path d="M27 34v17c0 6 12 10 25 10s25-4 25-10V34M27 50v17c0 6 12 10 25 10s25-4 25-10V50" fill="none" stroke="white" stroke-width="5"/><path d="M52 27v14m-6-11h12" stroke="white" stroke-width="4"/>',
    '<rect x="24" y="24" width="56" height="56" rx="9" fill="none" stroke="white" stroke-width="5"/><circle cx="52" cy="52" r="13" fill="none" stroke="white" stroke-width="5"/><path d="M52 38v28M38 52h28M34 80v6m36-6v6" stroke="white" stroke-width="4"/>',
    '<path d="M20 35h66v42H20zM20 35v-8c0-5 4-9 9-9h48v17M62 50h27v17H62a8 8 0 0 1 0-17z" fill="none" stroke="white" stroke-width="5" stroke-linejoin="round"/><circle cx="72" cy="58" r="3" fill="white"/>'
  ];
  const colors=[['#2268ce','#5db8ff'],['#087f82','#4fd6c7'],['#9b6b24','#f5ba53'],['#5b53bc','#a4a7f5'],['#235d85','#6daccd']];
  function avatar(index){
    const i=Number.isInteger(Number(index))&&Number(index)>=0&&Number(index)<5?Number(index):0;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="'+colors[i][0]+'"/><stop offset="1" stop-color="'+colors[i][1]+'"/></linearGradient></defs><rect width="104" height="104" rx="32" fill="url(#a)"/>'+shapes[i]+'</svg>';
    return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
  }
  function biometricKey(id){return 'reserva.biometric.prf.'+id}
  function biometricConfigured(storage,id){return !!(id&&storage.getItem(biometricKey(id)))}
  function supported(){return !!(globalThis.isSecureContext&&globalThis.PublicKeyCredential&&globalThis.crypto?.subtle&&globalThis.navigator?.credentials?.create&&globalThis.navigator?.credentials?.get)}
  async function prfSecret(credentialId,salt){
    const assertion=await navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),timeout:60000,
      allowCredentials:[{type:'public-key',id:un64(credentialId)}],
      userVerification:'required',extensions:{prf:{eval:{first:un64(salt)}}}
    }});
    if(!assertion||b64(toBytes(assertion.rawId))!==credentialId)throw Error('Credencial inesperada');
    const value=assertion.getClientExtensionResults()?.prf?.results?.first;
    if(!value||toBytes(value).length!==32)throw Error('Este autenticador não oferece a extensão PRF necessária para criptografia.');
    return toBytes(value);
  }
  async function secretKey(raw){
    return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
  }
  async function enroll(storage,id,password){
    if(!supported()||!ID.test(id))throw Error('Biometria criptográfica indisponível neste navegador.');
    if(typeof password!=='string'||password.length<12)throw Error('Senha do cofre inválida.');
    const salt=b64(crypto.getRandomValues(new Uint8Array(32)));
    const credential=await navigator.credentials.create({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rp:{name:'Reserva Simples'},
      user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'reserva-'+id,displayName:'Reserva Simples'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},
      timeout:60000,attestation:'none',extensions:{prf:{eval:{first:un64(salt)}}}
    }});
    if(!credential?.rawId)throw Error('Cadastro biométrico cancelado.');
    const credentialId=b64(toBytes(credential.rawId));
    const prf=credential.getClientExtensionResults()?.prf;
    if(prf?.enabled===false)throw Error('A extensão PRF não foi habilitada.');
    const raw=prf?.results?.first?toBytes(prf.results.first):await prfSecret(credentialId,salt);
    if(raw.length!==32)throw Error('PRF não compatível.');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const format='reserva-biometric-prf-v2',additionalData=new TextEncoder().encode(JSON.stringify([format,id,credentialId]));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},await secretKey(raw),new TextEncoder().encode(password));
    const record={format,credentialId,salt,iv:b64(iv),data:b64(toBytes(encrypted))};
    storage.setItem(biometricKey(id),JSON.stringify(record));
    return true;
  }
  async function unlock(storage,id){
    if(!supported()||!ID.test(id))throw Error('Biometria indisponível neste navegador.');
    let record;try{record=JSON.parse(storage.getItem(biometricKey(id))||'null')}catch{throw Error('O cadastro biométrico está corrompido. Entre com sua senha e cadastre a biometria novamente.');}
    if(!['reserva-biometric-prf-v1','reserva-biometric-prf-v2'].includes(record?.format))throw Error('Nenhuma credencial biométrica cadastrada neste perfil.');
    const raw=await prfSecret(record.credentialId,record.salt);
    const key=await secretKey(raw),algorithm={name:'AES-GCM',iv:un64(record.iv)};
    if(record.format==='reserva-biometric-prf-v2')algorithm.additionalData=new TextEncoder().encode(JSON.stringify([record.format,id,record.credentialId]));
    const bytes=await crypto.subtle.decrypt(algorithm,key,un64(record.data));
    if(record.format==='reserva-biometric-prf-v1'){
      const format='reserva-biometric-prf-v2',iv=crypto.getRandomValues(new Uint8Array(12)),additionalData=new TextEncoder().encode(JSON.stringify([format,id,record.credentialId]));
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},key,bytes);
      try{storage.setItem(biometricKey(id),JSON.stringify({...record,format,iv:b64(iv),data:b64(toBytes(encrypted))}))}catch{/* A senha válida permite entrar mesmo se a migração não puder ser salva. */}
    }
    return new TextDecoder().decode(bytes);
  }
  function disableBiometric(storage,id){storage.removeItem(biometricKey(id))}
  return {list,active,storeKey,add,select,profile,avatar,photoValid,biometricConfigured,supported,enroll,unlock,disableBiometric};
});
