const http=require('node:http')
const {weeklyFixture}=require('./weekly-fixture')
const {createHttpApp}=require('../server/src/app')
;(async()=>{
 const {db,services,config}=await weeklyFixture()
 const server=http.createServer(createHttpApp(services,config))
 server.listen(8790,'127.0.0.1',()=>console.log('Local weekly preview: http://127.0.0.1:8790/web/#weekly\nFabricated demo only. Counselor T001 / 123456; admin admin / 123456.'))
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
})().catch(e=>{console.error(e);process.exitCode=1})
