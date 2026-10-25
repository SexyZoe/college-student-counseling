const http=require('node:http'),{applicationFixture}=require('./application-fixture'),{createHttpApp}=require('../server/src/app')
;(async()=>{const {db,services,config}=await applicationFixture(),server=http.createServer(createHttpApp(services,config));server.listen(8790,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8790/web/#applications\nFabricated demo only: T001, T002, or admin / 123456. Preview database resets on restart.'))
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}))
})().catch(e=>{console.error(e);process.exitCode=1})
