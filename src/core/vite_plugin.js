function getAllMethodsDeep(obj) {
    const methods = new Set();
    let currentProto = obj;

    do {
        Reflect.ownKeys(currentProto).forEach(prop  => {
            if (prop !== 'constructor' && typeof currentProto[prop] === 'function') {
                methods.add(prop);
            }
        });
        currentProto = Object.getPrototypeOf(currentProto);
    } while (currentProto && currentProto !== Object.prototype);

    return Array.from(methods);
}
function rpc_proxy(mode) {
    return {
        name: 'proxy',
        async transform(code, id) {
            if (id.includes('/src/api')&&id.includes('.ts')) {
                let clazzNmaes=id.split('/')
                let clazz = Object.values(await import(`../../src/api/${clazzNmaes[clazzNmaes.length-1]}`))[0]
                let obj= new clazz()
                let name=obj.constructor.name
                let attr=Object.keys(obj)
                let fns=getAllMethodsDeep( obj)
                let aa=null
                if (mode=='adm'){
                    aa=fns.map(x=>`async ${x}(...args){
              let rsp=await fetch('http://chenmeijia.top/${name}/${x}',{
                  method: 'POST',
                  body:JSON.stringify({args:args})
              })
              if (rsp?.status!=200){
                  throw await rsp.text()
              }
              return await rsp.json()
              }`)
                }else {
                    aa=fns.map(x=>`async ${x}(...args){
        const response = await uni.request({
            url: 'https://chenmeijia.top/${name}/${x}',
            method: 'POST',
            header:{'Authorization':uni.getStorageSync('token')},
            data: {attr:this,args:args}
        });
        if (response.statusCode  === 500) {
            throw response.data
        }
        return response.data;
              }`)
                }
                //User源代码被替换了
                code = `export class ${name} {
                                ${attr.join(';')}
                                ${aa.join('\n')}
                            }
`
                code=code.replaceAll('_','')
                console.log('code:',code)
                return {
                    code: code,
                    map: null // 不生成sourcemap
                }
            }
        }
    }
}
function switchIndex(mode) {
    return {
        name: 'switchIndex',
        transform(code, id) {
            if (id.includes('main.ts')&&mode=='adm'){
                //是在编译期间修改ast语法树
                //动态切换vue和uniapp
                return {
                    //@ts-ignore
                    code: code.replaceAll(/\bApp\b/g, 'AppAdm'),
                    map: null //  不生成sourcemap
                }
            }
        }
    }
}
export {switchIndex,rpc_proxy}
