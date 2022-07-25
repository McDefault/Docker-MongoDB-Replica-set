# MongoDB Replica set
#### How to deploy a high available mongoDB Replica set (Cluster) on Docker Swarm and Docker Compose. Including authentication

#### Stack:
- `mongoDB 5.0.9`
- `Docker 20.10.12`
- `Docker Compose 3.7`
- Docker Swarm with 3 manager nodes

![replication](https://webimages.mongodb.com/_com_assets/cms/mongodb-replication-pnxoiu53rz.svg?auto=format%2Ccompress)
## Setup

Before using the MongoDB Replicate set, one must first follow initialisation steps:

1. Generate keyfile
2. Initialise first node
3. Add secundary nodes


## Keyfile preperation

### Generate keyfile

First run a container to create a keyfile, fix file ownership and put it in keyfile volume. 
All services/containers will mount to this volume.

All replica's must share the **SAME** keyfile in order to join the same set.

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
I'll be using the `mongo` image,
because it's sufficient to create a keyfile, and so I don't have to download an Image I have to delete later.

`docker run --name mongo1 -v mongo-keyfile:/data/keyfile -d mongo `

Create keyfile dir:

- `docker container exec $(docker ps -qf -qf name=mongo1) bash 'mkdir /data/keyfile' `

>  **TIP**:
>
> You can use `$(docker ps -qf -qf name=mongo1)`,
> instead of a container_id to make the selection based on the container name instead.

Create keyfile itself

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'openssl rand -base64 741 > /data/keyfile/keyfile'`

Fix ownership keyfile

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chmod 400  /data/keyfile/keyfile'  `

- `docker container exec $(docker ps -qf name=mongo1) bash -c 'chown 999 /data/keyfile/keyfile'  `

Alternatively: Or enter the container manually:

- `docker exec -it $(docker ps -qf -qf name=mongo1) bash` to enter the container
- `mkdir /data/keyfile` to make a directory
- `openssl rand -base64 741 > /data/keyfile` to generate a keyfile
- `chmod 400 /data/keyfile` to configure the keyfile permissions
- `chmod 999 /data/keyfile` to configure the keyfile permissions

After generating the keyfile. Stop and remove the container

### Keyfile Security

- Todo implement x.509 certificates

> _Keyfiles are bare-minimum forms of security and are best suited for testing or development
> environments. For production environments we recommend using x.509 certificates.
> [Source](https://www.mongodb.com/docs/v5.0/tutorial/deploy-replica-set-with-keyfile-access-control/#keyfile-security)_

You dont have to worry too much when using a correct Docker Swarm setup with networks and firewalls. It is still worth noting.
> _All swarm service management traffic is encrypted by default, using the AES algorithm in GCM mode. Manager nodes in the swarm rotate the key used to encrypt gossip data every 12 hours.
[Source](https://docs.docker.com/network/overlay/#operations-for-all-overlay-networks)_


## Development

### Docker Compose for development


Create file `.env` from template `.env.example` and fill in the following environment variables.

- MONGO_INITDB_ROOT_USERNAME=admin
- MONGO_INITDB_ROOT_PASSWORD=admin
- MONGO_INITDB_DATABASE=admin
- MONGO_DATABASE=maxminded
- MONGO_DB_ADMIN_USERNAME=adminDB
- MONGO_DB_ADMIN_PASSWORD=admin
- MONGO_REPLICA_ADMIN_USERNAME=adminReplica
- MONGO_REPLICA_ADMIN_PASSWORD=admin
- MONGO_USER_USERNAME=user
- MONGO_USER_PASSWORD=admin


### 1. Initialise first node.

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

### 2. Add secondary nodes

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

- `echo -n 'admin' |  docker secret create MONGO_INITDB_ROOT_PASSWORD_FILE -` 

Make sure to change the variable `admin` to your personal secret value 
and change `MONGO_INITDB_ROOT_PASSWORD_FILE` accordingly for each secret.

- Repeat for all other wanted secrets
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



### Run and create Swarm stack file
You can create a new config yaml file that combines base file and production file or you can combine the base and production file at the stack deploy commando

#### Run stack file

`docker stack deploy --compose-file docker-compose.yaml -c docker-compose.prod.yaml maxminded-database --with-registry-auth --prune`

#### Create Swarm stack Config file

Run `docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config` to combine base and production compose file.

Suffix with ` > prod.yaml` to output it in a file.

`docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml config > prod.yaml`

Copy this `prod.yaml` file to your production machine to run your stack on production.


#### Run config file

Run `docker stack up -c prod.yaml app --with-registry-auth` to run the stack.

### Setup Replica Set

After creating a keyfile (see first part) and starting the stack, initiate the rs (same as in development). 

#### Initiate Replica Set

- `docker container exec -it $(docker ps -qf name=mongo1) bash`
- `mongo -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD`
- `rs.initiate({_id: "rs1", members: [{ _id: 0, host: 'mongo1:27017'}]});`

Check status (without exiting the screen):
- `rs.status()`

#### Add secundary nodes
Add the secondary services to the replica set (without exiting the screen)

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

Use `mongodb://user:admin@mongo1:27017,mongo2:27017,mongo3:27017/maxminded?replicaSet=rs1` as connection string.
- `user`: username
- `admin`: password
- `mongo1:27017,mongo2:27017,mongo3:27017`: hosts from the set
- `maxminded`: specified database  to connect to
- `replicaSet=rs1`: replica Set name
### Example app stack file
Here's a basic example for an app that connects to you replica set:
- It reuses the secret created from this project and assigns it to its own variable.
  - `MONGO_RS_USERNAME_FILE: /run/secrets/MONGO_USER_USERNAME_FILE`
  - `MONGO_RS_PASSWORD_FILE: /run/secrets/MONGO_USER_PASSWORD_FILE`
- It assigns the connecting string in its environments like:
  - `MONGO_RS_URL: mongo1:27017,mongo2:27017,mongo3:27017/maxminded?replicaSet=rs1`
- It also assigns `maxminded-ntw-swarm` to its networks so that it can connect to it.


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
## More reading
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