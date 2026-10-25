const http=require('node:http')
const {committeeFixture}=require('./committee-fixture')
const {createHttpApp}=require('../server/src/app')
;(async()=>{
 const {db,services,config}=await committeeFixture(),server=http.createServer(createHttpApp(services,config))
 server.listen(8790,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8790/web/#committee\nFabricated demo: T001 or admin / 123456'))
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
})().catch(e=>{console.error(e);process.exitCode=1})
