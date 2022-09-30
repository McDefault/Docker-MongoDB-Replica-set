mongoRootUser = _getEnv("MONGO_INITDB_ROOT_USERNAME");
mongoRootPassword = _getEnv("MONGO_INITDB_ROOT_PASSWORD");

mongoAdminUser = _getEnv("MONGO_DB_ADMIN_USERNAME");
mongoAdminPassword = _getEnv("MONGO_DB_ADMIN_PASSWORD");

mongoReplicaUser = _getEnv("MONGO_REPLICA_ADMIN_USERNAME");
mongoReplicaPassword = _getEnv("MONGO_REPLICA_ADMIN_PASSWORD");

mongoUser = _getEnv("MONGO_USER_USERNAME");
mongoPassword = _getEnv("MONGO_USER_PASSWORD");

// authenticate with root credentials
db.auth(mongoRootUser, mongoRootPassword);

// select database
db = db.getSiblingDB(_getEnv("MONGO_INITDB_DATABASE"));

// creation of the admin user
db.createUser({user: mongoAdminUser, pwd: mongoAdminPassword, roles: [{role: "userAdminAnyDatabase", db: _getEnv("MONGO_INITDB_DATABASE")}]});
// creation of the replica user
db.createUser({user: mongoReplicaUser, pwd: mongoReplicaPassword, roles: [{role: "clusterAdmin", db: _getEnv("MONGO_INITDB_DATABASE")}]});

// select database
db = db.getSiblingDB(_getEnv("MONGO_DATABASE"));

// creation of the crud user
db.createUser({user: mongoUser, pwd: mongoPassword, roles: [{role: "readWrite", db: _getEnv("MONGO_DATABASE")}]});

// creation of index on snowflake on the guilds collection
db.guilds.createIndex({"snowflake": 1}, {unique: true})

db.guilds.insert( { email: "test1234@test.com", password: "$2a$12$h2piBfR3bgKDCGJURWS4NOg03p3q6XipLRDAj4mb4kBXx4YfYSZ5u", username: "test", role: "Admin"  } )
