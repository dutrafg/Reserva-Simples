const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'src/styles/app.css'),'utf8'),target=path.join(root,'index.html'),html=fs.readFileSync(target,'utf8');
const updated=html.replace(/<style id="reserva-app-styles">[\s\S]*?<\/style>/,()=>'<style id="reserva-app-styles">\n'+css+'</style>');
if(process.argv.includes('--check')){if(updated!==html)throw Error('CSS incorporado desatualizado')}else fs.writeFileSync(target,updated);
