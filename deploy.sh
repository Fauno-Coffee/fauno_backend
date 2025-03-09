#!/bin/bash

cd /clycon/docly-server
git pull origin main
sudo docker compose down
sudo docker compose up --build -d 
echo "Deployment completed!"