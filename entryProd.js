mongoRootUser = cat(_getEnv("MONGO_INITDB_ROOT_USERNAME_FILE"));
mongoRootPassword = cat(_getEnv("MONGO_INITDB_ROOT_PASSWORD_FILE"));

mongoAdminUser = cat(_getEnv("MONGO_DB_ADMIN_USERNAME_FILE"));
mongoAdminPassword = cat(_getEnv("MONGO_DB_ADMIN_PASSWORD_FILE"));

mongoReplicaUser = cat(_getEnv("MONGO_REPLICA_ADMIN_USERNAME_FILE"));
mongoReplicaPassword = cat(_getEnv("MONGO_REPLICA_ADMIN_PASSWORD_FILE"));

mongoUser = cat(_getEnv("MONGO_USER_USERNAME_FILE"));
mongoPassword = cat(_getEnv("MONGO_USER_PASSWORD_FILE"));

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
