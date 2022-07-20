# MongoDB Replica set

## Setup

Before using the MongoDB Replicate set, one must first follow initialisation steps:

1. Generate keyfile
2. Initialise first node
3. Add secundary nodes


## Development



### Docker Compose for development


Create file `.env` from template `.env.example` and fill in the following environment variable(s).

- MONGO_INITDB_ROOT_USERNAME=admin
- MONGO_INITDB_ROOT_PASSWORD=admin
- MONGO_INITDB_DATABASE=admin
- MONGO_DB_ADMIN_USERNAME=adminDB
- MONGO_DB_ADMIN_PASSWORD=admin
- MONGO_REPLICA_ADMIN_USERNAME=adminReplica
- MONGO_REPLICA_ADMIN_PASSWORD=admin
- MONGO_USER_USERNAME=user
- MONGO_USER_PASSWORD=admin

### 1. Generate keyfile
First run a container to create a keyfile, fix file ownership and put it in the shared keyfile volume. 


>  **NOTE**:
>
> Generating the keyfile in a volume will make the process simple to add nodes, but this is not required. You can also copy it with `docker cp` if you want to import it externally.

You can run this from a dummy container. As long as you have access to the keyfile volume and openssl 

`docker run --name mongo1 -v mongo-keyfile:/data/keyfile -d mongo `

Create keyfile dir:

- `docker container exec $(docker ps -qf -qf name=mongo1) bash 'mkdir /data/keyfile' `

Create keyfile itself

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'openssl rand -base64 741 > /data/keyfile/keyfile'`

Fix ownership keyfile

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chmod 400  /data/keyfile/keyfile'  `

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chown 999 /data/keyfile/keyfile'  `

Alternatively: Or enter the container manually:

- `docker exec -it <container_id> bash` to enter the container
- `openssl rand -base64 741 > keyfile` to generate a keyfile
- `chmod 400 keyfile` to configure the keyfile permissions
- `chmod 999 keyfile` to configure the keyfile permissions

After generating the keyfile. Stop the container

### 2. Initialise first node.

Set up the primary node:
- `docker-compose up -d mongo1`

This will automatically run the entry script and create a few users

Init the replicaset:
- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.initiate({_id: "rs1", members: [{ _id: 0, host: 'mongo1:27017'}]});`

Check status (without exiting the screen):
- `rs.status()`

### 3. Add secundary nodes

Start the second mongo service:
- `docker-compose up -id mongo2`

- Start the third mongo service:
- `docker-compose up -id mongo3`

After deploying them, add the secundary nodes to the replicaset from mongo1 
- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.add('mongo2:27017')`
- `rs.add('mongo3:27017')`

Check status (without exiting the screen) and see if all members are present and healthy:
- `rs.status()`

## Production
### Create Swarm stack file

Run `docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config` to combine base and production compose file.

Suffix with ` > prod.yaml` to output it in a file.

`docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config > prod.yaml`

Copy this `prod.yaml` file to your production machine to run your stack on production.

### Creating secrets

On the machine you're planning to run your Swarm stack on do:

Make sure to assign all secrets you want to use in the `.env` file from `.env.example`
- `MONGO_INITDB_ROOT_USERNAME_FILE=/run/secrets/MONGO_INITDB_ROOT_USERNAME_FILE`
- `MONGO_INITDB_ROOT_PASSWORD_FILE=/run/secrets/MONGO_INITDB_ROOT_PASSWORD_FILE`
- `MONGO_DB_ADMIN_USERNAME_FILE=/run/secrets/MONGO_DB_ADMIN_USERNAME_FILE`
- `MONGO_DB_ADMIN_PASSWORD_FILE=/run/secrets/MONGO_DB_ADMIN_PASSWORD_FILE`
- `MONGO_REPLICA_ADMIN_USERNAME_FILE=/run/secrets/MONGO_REPLICA_ADMIN_USERNAME_FILE`
- `MONGO_REPLICA_ADMIN_PASSWORD_FILE=/run/secrets/MONGO_REPLICA_ADMIN_PASSWORD_FILE`
- `MONGO_USER_USERNAME_FILE=/run/secrets/MONGO_USER_USERNAME_FILE`
- `MONGO_USER_PASSWORD_FILE=/run/secrets/MONGO_USER_PASSWORD_FILE`

Run `echo <MONGO_INITDB_ROOT_PASSWORD> | docker secret create MONGO_INITDB_ROOT_PASSWORD_FILE -` to create `MONGO_INITDB_ROOT_PASSWORD_FILE` secret.

Make sure to change the variables without `<>` to your personal secret value:

Repeat for all other wanted secrets
>  **NOTE**:
>
> Creating secrets can be done in multiple ways and may differ depending on your OS.
> Make sure to read the [Docker Documentation](https://docs.docker.com/engine/swarm/secrets/)
> to find the best way on creating a secret in your situation.

### Run Swarm stack file

Run `docker stack up -c prod.yaml app --with-registry-auth` to run the stack.
