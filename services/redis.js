const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.get = util.promisify(client.get);

const exec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = async function(){
    console.log('about to run execute');

    // make sure you dont modify the actual query object. this is customized query to get the key value
    // and use redis to store the data
    // const key = Object.assign({}, this.getQuery(), {
    //     collection: this.mongooseCollection.name
    // })
    const key = JSON.stringify({
        ...this.getQuery(),
        collection: this.mongooseCollection.name
    })
    // console.log(key);
    /*
    1. see if we have a value for the key in redis
    2. if we do, return that
    3. if we don't, run the query, store the result in redis and return it
    
    */

    const cacheValue = await client.get(key);
    if(cacheValue){
        console.log("cache hit");
        const doc = JSON.parse(cacheValue);
        return Array.isArray(doc) ? doc.map(d => new this.model(d)) : new this.model(doc);
    }
    const result = await exec.apply(this, arguments);
    //changing result to json string
    console.log(typeof result);
    client.set(key, JSON.stringify(result));
    return result;
}