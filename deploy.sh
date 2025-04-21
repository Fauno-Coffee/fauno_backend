APP_NAME="fauno_backend"

if pm2 describe $APP_NAME > /dev/null; then
    echo "Stopping existing process..."
    pm2 stop $APP_NAME
    pm2 delete $APP_NAME
fi

echo "Starting new $APP_NAME process"
pm2 start index.js --name $APP_NAME --watch

pm2 save
