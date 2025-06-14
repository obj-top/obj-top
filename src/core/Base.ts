import {SQL} from "bun";

let sql
let asyncLocalStorage= new (require('async_hooks').AsyncLocalStorage)()
function ctx(k: 'req' | 'session' | 'userId'|'tx'): Request | any {
    if (k == 'req') {
        return asyncLocalStorage.getStore()?.[k] as Request
    }
    return asyncLocalStorage.getStore()?.[k]
}
//声明式事务
export function tx(target: any, methodName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value  =async function (...args: any[]) {
        let rsp=await sql.begin(async tx => {
            // All queries in this function run in a transaction
            let result = null
            await asyncLocalStorage.run({rid: Date.now(),tx:tx}, async () => {
                result =await originalMethod.apply(this,  args);
            })
            return result;
        });
        return rsp
    };
    return descriptor;
}
//懒加载sqlpool，防止vite node构建导入bun的sql报错
//同时返回事务还是sql
export function getsql() {
    if (!sql){
        if (typeof window==undefined){
            return
        }
        const { SQL } = require("bun");
        sql= new SQL({
            // Pool configuration
            url: `postgres://postgres:root@127.0.0.1:5432/postgres`,
            max: 20, // Maximum 20 concurrent connections
            idleTimeout: 30, // Close idle connections after 30s
            maxLifetime: 3600, // Max connection lifetime 1 hour
            connectionTimeout: 10, // Connection timeout 10s
        });
    }
    return ctx('tx')?ctx('tx'):sql
}

export class OdbBase<T> {
    static async migrate() {
        //补充改表名，添加字段，删除字段，修改字段名称和类型，索引，自动迁移
        delete this['meta']['plugin']
        console.log(this['meta'])
        let body = Object.entries(this['meta']).map(([k, v]) => {
            let type = this['meta'][k]
            if (k == 'id') {
                return `id SERIAL PRIMARY KEY`
            } else if (Array.isArray(v)) {
                return `"${k}" integer []`
            } else if (type == 'any') {
                return `"${k}" jsonb`
            } else if (type == 'bigint') {
                return `"${k}" integer`
            } else if (type == 'string') {
                return `"${k}" varchar`
            } else if (type == 'number') {
                return `"${k}" double precision`
            }else if (type == 'Date') {
                return `"${k}" TIMESTAMPTZ`
            }else {//关系类型，建立关系表
                type=type.replaceAll('[]','')
                console.log('11111111111111')
                const sorted = [this.name, type].sort();
                let relation_table=`${sorted[0]}_${sorted[1]}`
                console.log(`relation_table:${relation_table}`)
                console.log(`sorted:${sorted}`)
                let statement=`create table if not exists "${relation_table}"(${sorted[0]}_id integer,${sorted[1]}_id integer)`
                let sql=getsql()
                sql.unsafe(statement).then(res=>{console.log(res)})
                return ''
            }
        })
        console.log(body)
        body=body.filter(x=>{return x!=''})
        let statement=`create table if not exists "${this.name}"(${body})`
        console.log(statement)
        let sql=getsql()
        let rsp = await sql.unsafe(statement)
        console.log(rsp)
    }

    //递归插入所有子元素返回id，插入自己返回自己，关系表关联id
    //若子元素是gets(1)，或者是id,查询存在后插入父元素，关系表关联
    //子元素可以是add，update，get形式，不支持删
    //子有id是改，无id是增，只有id为为查
    async add() {
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        let sql=getsql()
        //@ts-ignore
        const { id, ...rest } = this;
        const [newUser] = await sql`INSERT INTO ${sql(table)} ${sql(rest)} RETURNING *`;
        this['id']=newUser['id']
        return this
    }

    async addOne(obj) {
        const table = obj.constructor.name; // 动态获取表名（如 'User'）
        let sql=getsql()
        //@ts-ignore
        const { id, ...rest } = obj;
        const [newUser] = await sql`INSERT INTO ${sql(table)} ${sql(rest)} RETURNING *`;
        obj['id']=newUser['id']
        return obj
    }
    static async add(data) {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        //@ts-ignore
        let rest=data.map(x=>{
            let {id,...rest}=x
            return rest
        })
        await sql`INSERT INTO ${sql(table)} ${sql(rest)} RETURNING *`;
    }
    //防止sql注入
    async get(strings, ...values) {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        const cols = sql`*`; // 默认查询列
        // 动态生成 WHERE 条件（自动处理用户模板）
        const where = values.length > 0 ? sql`where ${sql(strings, ...values)}` : sql``;
        // 组合完整 SQL 并执行
        let [one]=await sql`SELECT ${cols} FROM ${sql(table)} ${where}`
        return one
    }
    async gets(strings, ...values) {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        const cols = sql`*`; // 默认查询列
        // 动态生成 WHERE 条件（自动处理用户模板）
        const where = values.length > 0 ? sql`where ${sql(strings, ...values)}` : sql``;
        // 组合完整 SQL 并执行
        return await sql`SELECT ${cols} FROM ${sql(table)} ${where} order by id desc`;
    }
    async getById(id=0) {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        const cols = sql`*`; // 默认查询列
        // 动态生成 WHERE 条件（自动处理用户模板）
        // 组合完整 SQL 并执行
        id=id||this['id']
        let [one]=await sql`SELECT ${cols} FROM ${sql(table)} where id=${id}`
        return one;
    }
    async getAnd() {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        const cols = sql`id, name`; // 默认查询列
        //@ts-ignore
        const where = Object.keys(this).filter(x=>this[x]!=undefined).reduce((acc,  current, index) => {
            let wherecurrent=sql`${sql(current)}=${this[current]}`
            if (index === 0) {
                return wherecurrent
            }
            return sql`${acc} and ${wherecurrent}`;
        }, null);
        // 组合完整 SQL 并执行
        return await sql`SELECT ${cols} FROM ${sql(table)} where ${where}`;
    }
    async getOr() {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        const cols = sql`id, name`; // 默认查询列
        //@ts-ignore
        const where = Object.keys(this).filter(x=>this[x]!=undefined).reduce((acc,  current, index) => {
            let wherecurrent=sql`${sql(current)}=${this[current]}`
            if (index === 0) {
                return wherecurrent
            }
            return sql`${acc} or ${wherecurrent}`;
        }, null);
        // 组合完整 SQL 并执行
        return await sql`SELECT ${cols} FROM ${sql(table)} where ${where}`;
    }
    test(strings, ...values){
        console.log(strings,values)
        return sql(strings, ...values)
    }
    async  del(ks,...vs) {
        let sql=getsql()
        let conn=ctx('tx')?ctx('tx'):sql
        let table = this.constructor.name
        let cols = sql`id,name`
        const where = vs.length > 0 ? sql`where ${sql(ks, ...vs)}` : sql``;
        return await conn`delete from ${sql(table)} ${where}`
    }
    async delById(id=0) {
        let sql=getsql()
        const table = this.constructor.name; // 动态获取表名（如 'User'）
        id=id||this['id']
        return await sql`delete from ${sql(table)} where id=${id}`;
    }
    //改所有子元素，然后改父元素，
    //子元素有增(无id),删(-id)，改(对象有id),查(id查出对象)
    //
    async  update(ks,...vs) {
        let sql=getsql()
        let table = this.constructor.name
        console.log('this:',this)
        //undefined才是未赋值，null，0，空字符串都是有值，0也可以是一种状态
        let cols=Object.keys(this).filter((k) =>this[k]!=undefined)
        console.log('cols:',cols)
        const where = vs.length > 0 ? sql`where ${sql(ks, ...vs)}` : sql``;
        console.log('where:',where)
        //@ts-ignore
        return await sql`update ${sql(table)} set ${sql(this,...cols)} ${where} RETURNING *`
    }
    async  updateById(id=0) {
        let sql=getsql()
        let table = this.constructor.name
        let cols=Object.keys(this).filter((k) =>this[k]!=undefined)
        console.log(cols)
        id=id||this['id']
        const [obj] =await sql`update ${sql(table)} set ${sql(this,...cols)} where id=${id} RETURNING *`
        //@ts-ignore
        return obj
    }
}

//执行自己，向下递归，可以传入父id，可返回子id
async function addr(data) {
    //根元素是add，子元素可以是add，get，update方式返回成功对象，然后关联到关系表
    let p=null//增改查，三种，返回对象
    //若有pid，关联pid
    //若子节点为对象或数组，递归(son，pid，pname)
    for (let key in data) {
        if (Array.isArray(data[key])){
            let sids=data[key].forEach(item  => addr(item));
            const sorted = [data.constructor.name, data[key]].sort();
            let relation_table=`${sorted[0]}_${sorted[1]}`
            const [newUser] = await sql`INSERT INTO ${sql(relation_table)} ${sql(data)} RETURNING *`;

        }else if (typeof data[key]=='object')  {
            let sid=await addr(data[key]);    // 递归处理嵌套属性
            //父id，子id关联到关系表
            const sorted = [data.constructor.name, data[key]].sort();
            let relation_table=`${sorted[0]}_${sorted[1]}`
        }
    }
    return p.id
}
async function updater(data) {
    //根元素是修改，集合对应+-，每个子元素可以是增删改查
    let p=null//增改查，三种，返回对象
    //若有pid，关联pid
    //若子节点为对象或数组，递归(son，pid，pname)
    //新增，和修改才执行循环
    for (let key in data) {
        if (Array.isArray(data[key])){
            let sids=data[key].forEach(item  => updater(item));
            const sorted = [data.constructor.name, data[key]].sort();
            let relation_table=`${sorted[0]}_${sorted[1]}`
            const [newUser] = await sql`INSERT INTO ${sql(relation_table)} ${sql(data)} RETURNING *`;

        }else if (typeof data[key]=='object')  {
            let sid=await updater(data[key]);    // 递归处理嵌套属性
            //父id，子id关联到关系表
            const sorted = [data.constructor.name, data[key]].sort();
            let relation_table=`${sorted[0]}_${sorted[1]}`
        }
    }
    return p.id
}
