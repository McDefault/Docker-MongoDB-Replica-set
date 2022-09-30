# MongoDB Replica set
### How to deploy a high available mongoDB Repica set (Cluster) on Docker Swarm and Docker Compose. Including authentication.

#### Stack:
- `mongoDB 5.0.9`
- `Docker 20.10.12`
- `Docker Compose 3.7`
- Docker Swarm with 3 manager nodes

![replication](https://webimages.mongodb.com/_com_assets/cms/mongodb-replication-pnxoiu53rz.svg?auto=format%2Ccompress)
# Setup

With this stack, building is **not** needed.

Before using the MongoDB Replicate set, one must first follow initialisation steps:

1. Generate keyfile
2. Initialise first node
3. Add secundary nodes
4. Open ports on production servers

## Keyfile preperation

If you're planning on running a replicaset, make sure to prepare your keyfile.

### Generate keyfile

First run a container to create a keyfile, fix file ownership and put it in keyfile volume. 
All services/containers will mount to this volume.

All replica's must share the **SAME** keyfile in order to join the same set.

>  **NOTE**:
>
> Your keyfile has to be installed on all nodes (seperately) you're planning on using for your cluster.

>  **NOTE**:
>
> Generating the keyfile in a volume will make the process simple to add nodes,
> but this is not required.
>
> 
> You can also copy it with `docker cp` if you want to import from an external source (host computer).
> 
> If you're not on windows you can probably run `openssl` from your host computer. 
> However, for compatibility reasons, 
> I'll be using docker for 100% to assure it will work for everybody no matter what host machine is beeing used.

You can run this from a dummy container. As long as you have access to the keyfile volume and `openssl`.
I'll be using the `mongo:5.0.9` image,
because it's sufficient to create a keyfile, and so I don't have to download an Image I have to delete later.

- `docker run --name mongo1 -v mongo-keyfile:/data/keyfile -d mongo:5.0.9 `

Create keyfile dir (optional):

- `docker container exec $(docker ps-qf name=mongo1) bash 'mkdir /data/keyfile' `

>  **TIP**:
>
> You can use `$(docker ps -qf name=mongo1)`,
> instead of a container_id to make the selection based on the container name instead.

Create keyfile itself

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'openssl rand -base64 741 > /data/keyfile/keyfile'`

Fix ownership keyfile

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chmod 400  /data/keyfile/keyfile'  `

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chown 999 /data/keyfile/keyfile'  `

Stop and remove the container
- `docker container stop $(docker ps -qf name=mongo1)`
- `docker container rm mongo1`

Alternatively: Or enter the container manually:

- `docker exec -it $(docker ps -qf name=mongo1) bash` 
- to enter the container
- `mkdir /data/keyfile` 
- to make a directory (optional)
- `openssl rand -base64 741 > /data/keyfile` 
- to generate a keyfile
- `chmod 400 /data/keyfile`
- `chown 999 /data/keyfile` 
- to configure the keyfile permissions

After generating the keyfile. Stop and remove the container
- `docker container stop $(docker ps -qf name=mongo1)`
- `docker container rm mongo1`


### Keyfile Security

- Todo implement x.509 certificates

> _Keyfiles are bare-minimum forms of security and are best suited for testing or development
> environments. For production environments we recommend using x.509 certificates.
> [Source](https://www.mongodb.com/docs/v5.0/tutorial/deploy-replica-set-with-keyfile-access-control/#keyfile-security)_

You dont have to worry too much when using a correct Docker Swarm setup with networks and firewalls. It is still worth noting.
> _All swarm service management traffic is encrypted by default, using the AES algorithm in GCM mode. Manager nodes in the swarm rotate the key used to encrypt gossip data every 12 hours.
[Source](https://docs.docker.com/network/overlay/#operations-for-all-overlay-networks)_

# Deploy 

## Development

Docker Compose for development

### Environment variables

Create file `.env` from template `.env.example` and fill in the following environment variables.

- `MONGO_INITDB_DATABASE=admin`
- `MONGO_DATABASE=maxminded`
- `MONGO_INITDB_ROOT_USERNAME=admin`
- `MONGO_INITDB_ROOT_PASSWORD=admin`
- `MONGO_DB_ADMIN_USERNAME=adminDB`
- `MONGO_DB_ADMIN_PASSWORD=admin`
- `MONGO_REPLICA_ADMIN_USERNAME=adminReplica`
- `MONGO_REPLICA_ADMIN_PASSWORD=admin`
- `MONGO_USER_USERNAME=user`
- `MONGO_USER_PASSWORD=admin`
### Setup normal MongoDB instance

If you want you can just use a normal mongodb instance for development. There's no need to create a keyfile for this.

Run to run a mongodb instance

- `docker compose up mongo1`

### Setup replicaset

If you want to use a replicaset using compose, make sure to create a keyfile first.

First, comment out this part from your `docker-compose.override.yaml` file so that it matches mongo2 and mongo3. It will now create a replicaset instead of a normal instance.

    services
      mongo1:
      <<: *mongodb
      container_name: mongo1
    #      command:
    #        - mongod

#### 1. Initialise first node.

Set up the primary node:
- `docker-compose up -d mongo1`

This will automatically run the `entry.js` script and create a few users (only on first run)

Initiate the replicaset from `mongo1`:
- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.initiate({_id: "rs1", members: [{ _id: 0, host: 'mongo1:27017'}]});`

>  **TIP**:
>
> Docker's internal DNS will automatically take care of the hostnames for you.
> There's no need to change `'mongo1:27017'` to another value.
> `mongo1` refers to the name of the first service that's specified in the compose file.

Check status (without exiting the screen):
- `rs.status()`

#### 2. Add secondary nodes

Start the second and third mongo service:
- `docker-compose up -d mongo2`
- `docker-compose up -d mongo3`

After deploying them, add the secondary nodes to the replicaset from `mongo1` 
- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.add('mongo2:27017')`
- `rs.add('mongo3:27017')`

Check status (without exiting the screen) and see if all members are present and healthy:
- `rs.status()`

## Production

### Create labels

Add labels to each node:
- `docker node ls`
- `docker node update --label-add mongo.replica=1 <node>`
- `docker node update --label-add mongo.replica=2 <node>`
- `docker node update --label-add mongo.replica=3 <node>`

### Creating secrets

Create all secrets on the machine you're planning to run your Swarm stack on.

The following environment variables are already assigned in the stack file. 
- `MONGO_INITDB_ROOT_USERNAME_FILE=/run/secrets/MONGO_INITDB_ROOT_USERNAME_FILE`
- `MONGO_INITDB_ROOT_PASSWORD_FILE=/run/secrets/MONGO_INITDB_ROOT_PASSWORD_FILE`
- `MONGO_DB_ADMIN_USERNAME_FILE=/run/secrets/MONGO_DB_ADMIN_USERNAME_FILE`
- `MONGO_DB_ADMIN_PASSWORD_FILE=/run/secrets/MONGO_DB_ADMIN_PASSWORD_FILE`
- `MONGO_REPLICA_ADMIN_USERNAME_FILE=/run/secrets/MONGO_REPLICA_ADMIN_USERNAME_FILE`
- `MONGO_REPLICA_ADMIN_PASSWORD_FILE=/run/secrets/MONGO_REPLICA_ADMIN_PASSWORD_FILE`
- `MONGO_USER_USERNAME_FILE=/run/secrets/MONGO_USER_USERNAME_FILE`
- `MONGO_USER_PASSWORD_FILE=/run/secrets/MONGO_USER_PASSWORD_FILE`

Make sure to create a secret on the host machine for each one. 

- `echo -n 'admin' |  docker secret create MONGO_INITDB_ROOT_USERNAME_FILE -` 
- `echo -n 'admin' |  docker secret create MONGO_INITDB_ROOT_PASSWORD_FILE -` 
- `echo -n 'adminDB' |  docker secret create MONGO_DB_ADMIN_USERNAME_FILE -` 
- `echo -n 'admin' |  docker secret create MONGO_DB_ADMIN_PASSWORD_FILE -` 
- `echo -n 'adminReplica' |  docker secret create MONGO_REPLICA_ADMIN_USERNAME_FILE -` 
- `echo -n 'admin' |  docker secret create MONGO_REPLICA_ADMIN_PASSWORD_FILE -` 
- `echo -n 'user' |  docker secret create MONGO_USER_USERNAME_FILE -` 
- `echo -n 'admin' |  docker secret create MONGO_USER_PASSWORD_FILE -` 

Make sure to change the password variables `admin` to your personal secret value.

>  **NOTE**:
> 
> Prevent `U_STRINGPREP_PROHIBITED_ERROR` errors:
> 
> Watch out for invisible newline characters in your secret if you're on Windows.
> Best way to create secrets is from `Git Bash` using the cmd above.
> 
> Make sure to read [Getting U_STRINGPREP_PROHIBITED_ERROR when trying to deploy MongoDB](https://stackoverflow.com/questions/67998926/getting-u-stringprep-prohibited-error-when-trying-to-deploy-mongodb-on-kubernete)
> if you do get this error.

>  **NOTE**:
>
> Creating secrets can be done in multiple ways and may differ depending on your OS.
> Make sure to read the [Docker Documentation](https://docs.docker.com/engine/swarm/secrets/)
> to find the best way on creating a secret in your situation.



### Deploy

You can create a new config yaml file that combines base file and production file or you can combine the base and production file at the stack deploy commando.

#### Run stack file
Quickly run your stack file for testing.

- `docker stack deploy --compose-file docker-compose.yaml -c docker-compose.prod.yaml maxminded-database --with-registry-auth --prune`

#### Create Swarm stack file

Run `docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config` to combine base and production compose file.

Suffix with ` > db-stack.yml` to output it in a file.

- `docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config > db-stack.yml`

Change volume `entryProd.js` for `mongo1` to `./entryProd.js:/docker-entrypoint-initdb.d/entry.js:rw` value

Copy this `db-stack.yml` file to your production machine to run your stack on production.

Copy the `entryProd.js` file to your production machine too. It only has to be present where you first setup your mongo1. This file ensures all users are created.

Set node labels on each node and change node ids accordingly

- `docker node ls`

- `docker node update --label-add mongo.replica=1 <node>`
- `docker node update --label-add volume=True <node>`

- `docker node update --label-add mongo.replica=2 <node>`
- `docker node update --label-add volume=True <node>`

- `docker node update --label-add mongo.replica=3 <node>`
- `docker node update --label-add volume=True <node>`


#### Run config file

To run the stack.

`docker stack up -c db-stack.yml maxminded-database --with-registry-auth --prune` 


### Setup Replica Set

After creating a keyfile (see first part) and starting the stack, initiate the rs (same as in development). 

#### Initiate Replica Set

- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.initiate({_id: "rs1", members: [{ _id: 0, host: 'mongo1:27017'}]});`

Check status (without exiting the screen):
- `rs.status()`

#### Ensure entrypoint file was run

Exit and run entryfile to ensure proper accounts are created.
- `exit`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD /docker-entrypoint-initdb.d/entry.js`

See if users are succesfully added or already added.

#### Add secundary nodes
Add the secondary services to the replica set (without exiting the screen)

- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.add('mongo2:27017')`
- `rs.add('mongo3:27017')`

Check status (without exiting the screen) and see if all members are present and healthy:
- `rs.status()`

## Connecting to your replica set.
To connect to your replica set make sure keep this in mind.

### Checking status
It never hurts checking the database status before connecting to it.

Run `docker service ps <service_ID>` to inspect the service and see the `STATE`

Run `docker service logs -if <service_ID>` to inspect service logs to see if there's any undesired errors

Check `rs.status()` from within container to see if all replicas are healthy.
- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.status()`

### Share network OR open ports
You have to share a network or open `271017` ports to be able to connect your replica set. 
In this stack there's `maxminded-ntw-compose` for your development environment and 
`maxminded-ntw-swarm` for your production environment already created. 
Make sure to add these networks to your other apps or create your own. 

### Database & Credentials

Ideally you only want to connect to a new database (not admin) with a `readWrite` user account from your apps.

These credentials are stored in the `MONGO_USER_USERNAME` and `MONGO_USER_PASSWORD` 
environment variables (development)

and `MONGO_USER_USERNAME_FILE` and 
`MONGO_USER_PASSWORD_FILE` secrets (production)

### Connecting String

Use `mongodb://${MONGO_USER_USERNAME}:${MONGO_USER_PASSWORD}@mongo1:27017,mongo2:27017,mongo3:27017/${MONGO_DATABASE}?replicaSet=rs1` as connection string.
- `${MONGO_USER_USERNAME}`: username
- `${MONGO_USER_PASSWORD}`: password
- `mongo1:27017,mongo2:27017,mongo3:27017`: hosts from the set. Service name become their DNS.
- `${MONGO_DATABASE}`: specified database to connect to
- `replicaSet=rs1`: replica Set name
### Example app stack file
Here's a basic example for an app that connects to you replica set:
- It reuses the secret created from this project and assigns it to its own variable.
  - `MONGO_RS_USERNAME_FILE: /run/secrets/MONGO_USER_USERNAME_FILE`
  - `MONGO_RS_PASSWORD_FILE: /run/secrets/MONGO_USER_PASSWORD_FILE`
- It assigns the connecting string in its environments like:
  - `MONGO_RS_URL: mongo1:27017,mongo2:27017,mongo3:27017/maxminded?replicaSet=rs1`
- It also assigns `maxminded-ntw-swarm` to its networks so that it can connect to it.

```
services:
  maxminded-api:
    image: some-api
    secrets:
      - MONGO_USER_USERNAME_FILE
      - MONGO_USER_PASSWORD_FILE
    environment:
      MONGO_RS_URL: mongo1:27017,mongo2:27017,mongo3:27017/maxminded?replicaSet=rs1
      MONGO_RS_USERNAME_FILE: /run/secrets/MONGO_USER_USERNAME_FILE
      MONGO_RS_PASSWORD_FILE: /run/secrets/MONGO_USER_PASSWORD_FILE 
    deploy:
      replicas: 1
    networks:
      - maxminded-application
      - maxminded-ntw-swarm

#List of secrets for Docker Swarm
secrets:
  MONGO_USER_USERNAME_FILE:
    external: true
  MONGO_USER_PASSWORD_FILE:
    external: true

#List of networks for Docker Swarm
networks:
  maxminded-ntw-swarm:
    external:
      name: maxminded-ntw-swarm
  maxminded-application:
    external:
      name: maxminded-application
```

# More reading
- https://university.mongodb.com/
- https://www.mongodb.com/docs/v5.0/administration/security-checklist/
- https://www.mongodb.com/blog/post/how-to-avoid-a-malicious-attack-that-ransoms-your-data
- https://www.mongodb.com/docs/v5.0/tutorial/deploy-replica-set/
- https://www.mongodb.com/docs/v5.0/tutorial/deploy-replica-set-with-keyfile-access-control/
- https://www.mongodb.com/docs/v5.0/core/security-internal-authentication/
- https://www.mongodb.com/docs/v5.0/tutorial/upgrade-keyfile-to-x509/
- https://www.mongodb.com/docs/v5.0/reference/built-in-roles/#database-user-roles
- https://www.mongodb.com/docs/v5.0/tutorial/expand-replica-set/#add-a-member-to-an-existing-replica-set
- https://www.mongodb.com/docs/v5.0/reference/connection-string/#dns-seed-list-connection-format
- https://docs.docker.com/engine/reference/run/
- https://docs.docker.com/engine/swarm/
- https://docs.docker.com/engine/swarm/swarm-tutorial/
- https://docs.docker.com/engine/reference/commandline/stack_deploy/
- https://hub.docker.com/_/mongo?tab=description
- https://www.percona.com/blog/mongodb-converting-replica-set-to-standalone/
- https://docs.docker.com/engine/install/linux-postinstall/#configure-docker-to-start-on-boot