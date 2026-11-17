// Executado apenas durante refatorações: preserva ordem e precedência da cascata.
const fs=require('node:fs'),cssom=require('rrweb-cssom');
process.chdir(require('node:path').resolve(__dirname,'..'));
const html=fs.readFileSync('index.html','utf8');
const source=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
const sheet=cssom.parse(source),seen=new Map();let removed=0;
function prune(rules,context='root'){
 for(let index=rules.length-1;index>=0;index--){const rule=rules[index];
  if(rule.type===1){const key=context+'\n'+rule.selectorText;let props=seen.get(key);if(!props)seen.set(key,props=new Map());const style=rule.style;
   for(let i=style.length-1;i>=0;i--){const property=style[i],priority=style.getPropertyPriority(property),last=props.get(property)||{};
    if(priority==='important'?last.important:last.normal||last.important){style.removeProperty(property);removed++;}else{props.set(property,{...last,[priority==='important'?'important':'normal']:true})}
   }
   if(!style.length)rules.splice(index,1);
  }else if(rule.type===4||rule.type===12){prune(rule.cssRules,context+'|'+rule.cssText.slice(0,rule.cssText.indexOf('{')).trim());if(!rule.cssRules.length)rules.splice(index,1)}
 }
}
prune(sheet.cssRules);
const css='/* Estilos consolidados do Reserva Simples. Ordem da cascata preservada. */\n'+sheet.cssRules.map(r=>r.cssText).join('\n')+'\n';
fs.writeFileSync('src/styles/app.css',css);
let target=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');target=target.replace('</head>','<style id="reserva-app-styles">\n'+css+'</style>\n</head>');fs.writeFileSync('index.html',target);
console.log(JSON.stringify({beforeBytes:source.length,afterBytes:css.length,removedDeclarations:removed,beforeImportant:(source.match(/!important/g)||[]).length,afterImportant:(css.match(/!important/g)||[]).length,styleBlocks:1}));
