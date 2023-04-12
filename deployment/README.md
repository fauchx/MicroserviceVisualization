
## Docker compose deployment
1. Go to deployment folder
2. Set up environment
   1. Set up build environment
      - create .env file at the deployment folder, the same folder where docker-compose.yml is located
      - add required variables to .env file like the example below:
      ```
      DATABASE_NAME=ebpm
      DATABASE_USER=ebpm
      DATABASE_PASSWORD=ebpm
      DATABASE_HOST=db
      DATABASE_PORT=5432
      ```
   2. Set React environment   
      - create react.env file at the deployment folder, the same folder where docker-compose.yml is located
      - add required variables to react.env file like the example below:
      ```
      REACT_APP_API_HOST="http://localhost/backend"
      ```

3. Build docker compose
   ```
   docker-compose --env-file ./.env build --no-cache
   ```
4. Start docker compose
   ```
   docker-compose --env-file ./.env up
   ```
