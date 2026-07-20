const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://oms_dev:Fw5bXQ3L9D1rP0Xw@cluster0.xyj8j.mongodb.net/milky_way_oms?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
client.connect().then(() => {
    console.log("Connected to MongoDB!");
    return client.db().collection('orders').findOne({});
}).then(res => {
    console.log("Found order:", res);
    process.exit(0);
}).catch(err => {
    console.error("Connection failed:", err.message);
    process.exit(1);
});
