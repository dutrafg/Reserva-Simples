const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<link\b[^>]*rel="manifest"[^>]*>/gi,'').replace(/<link\b[^>]*rel="icon"[^>]*>/gi,'');
html=html.replace('<head>','<head>\n<meta name="reserva-distribution" content="standalone">');
for(const file of ['engines.js','accounts.js','diagnostics.js','app.js']){
 const source=fs.readFileSync(path.join(root,file),'utf8').replace(/<\/script/gi,'<\\/script');
 html=html.replace(`<script src="./${file}"></script>`,()=>`<script>\n${source}\n</script>`);
}
const target=process.argv[2];if(!target)throw Error('Informe o caminho do HTML');fs.mkdirSync(path.dirname(path.resolve(target)),{recursive:true});fs.writeFileSync(target,html);console.log(target);
