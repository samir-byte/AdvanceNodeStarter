const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}){
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');
    return this;
}

mongoose.Query.prototype.exec = async function(){

    // make sure you dont modify the actual query object. this is customized query to get the key value
    // and use redis to store the data
    // const key = Object.assign({}, this.getQuery(), {
    //     collection: this.mongooseCollection.name
    // })

    if(!this.useCache){
        return exec.apply(this, arguments);
    }

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

    const cacheValue = await client.hget(this.hashKey, key);
    if(cacheValue){
        console.log("SERVING DATA FROM REDIS");
        const doc = JSON.parse(cacheValue);
        return Array.isArray(doc) ? doc.map(d => new this.model(d)) : new this.model(doc);
    }
    const result = await exec.apply(this, arguments);
    //changing result to json string
    client.hset(this.hashKey,key, JSON.stringify(result), 'EX', 10);
    return result;
}

module.exports = {
    clearHash(hashKey){
        client.del(JSON.stringify(hashKey));
    }
}