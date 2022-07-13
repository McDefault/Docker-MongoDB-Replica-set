db.auth('admin', 'admin')

db = db.getSiblingDB('donuts')

db.createUser({ user: "user_donuts", pwd: "pAsw0Rd", roles: [ { role: "readWrite", db: "donuts"} ]});

db.guilds.createIndex( { "snowflake": 1 }, { unique: true } )