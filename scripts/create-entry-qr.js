const QRCode=require('qrcode');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const url=new URL(process.argv[2]);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('请提供不包含凭据的校园HTTP/HTTPS网址');
  const output=path.resolve(process.argv[3]||'artifacts/campus-entry.png');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  await QRCode.toFile(output,url.href,{width:640,margin:4,errorCorrectionLevel:'M',color:{dark:'#173f3b',light:'#ffffff'}});
  console.log('二维码已生成：'+output+'\n入口：'+url.href+'\n请连接学校Wi-Fi；发布前核对该网址上的版本。');
})().catch(error=>{console.error(error.message);process.exitCode=1});
