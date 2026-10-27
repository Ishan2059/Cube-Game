// Export shop art from the same factories used in gameplay; no separate concept thumbnails.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const sharp=require('sharp');const {chromium}=require('playwright');
const bundledWebpack=require('next/dist/compiled/webpack/webpack');bundledWebpack.init();
const root=path.resolve(__dirname,'..'),publicRoot=path.join(root,'public'),output=path.join(root,'.qa/cosmetic-export');
async function main(){
  await fs.mkdir(output,{recursive:true});
  await new Promise((resolve,reject)=>bundledWebpack.webpack({mode:'production',entry:path.join(root,'test/fixtures/cosmetic-export.ts'),output:{path:output,filename:'export.js',library:{name:'CosmeticExport',type:'window'}},optimization:{minimize:false},resolve:{extensions:['.ts','.js'],alias:{'@':root}},module:{rules:[{test:/\.ts$/,use:path.join(root,'scripts/typescript-loader.cjs')}]},devtool:false},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<script src="/export.js"></script>');return;}
    const file=url.pathname==='/export.js'?path.join(output,'export.js'):path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
    if(file!==path.join(output,'export.js')&&!file.startsWith(publicRoot+path.sep)){res.writeHead(403);res.end();return;}
    try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage();page.on('pageerror',e=>{throw e;});
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.CosmeticExport);
    const catalog=await page.evaluate(()=>window.CosmeticExport.catalog);
    const groups=process.argv.slice(2).length?process.argv.slice(2):['skins','trails','creatures'];
    for(const group of groups){
      if(!['skins','trails','creatures'].includes(group))throw new Error('Unknown export group');
      const dest=path.join(publicRoot,'game-art','runtime-'+group);await fs.mkdir(dest,{recursive:true});
      for(const id of catalog[group]){
        const png=await page.evaluate(({group,id})=>window.CosmeticExport[group==='skins'?'skin':group==='trails'?'trail':'creature'](id),{group,id});
        await sharp(Buffer.from(png.split(',')[1],'base64')).resize(512,512).webp({lossless:true}).toFile(path.join(dest,id+'.webp'));
        console.log(`Rendered ${group}/${id}`);
      }
    }
  }finally{await browser?.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
