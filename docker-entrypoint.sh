#!/bin/sh

# Set default values
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}

echo "Starting GSCTracker with:"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  UMASK: $UMASK"
echo "  TZ: ${TZ:-UTC}"

# Set timezone if specified
if [ -n "$TZ" ]; then
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime
    echo $TZ > /etc/timezone
fi

# Update nginx user/group IDs if different from defaults
CURRENT_UID=$(id -u nginx)
CURRENT_GID=$(id -g nginx)

if [ "$CURRENT_GID" != "$PGID" ]; then
    echo "Updating nginx group ID to $PGID"
    groupmod -o -g "$PGID" nginx
fi

if [ "$CURRENT_UID" != "$PUID" ]; then
    echo "Updating nginx user ID to $PUID"
    usermod -o -u "$PUID" nginx
fi

# Set umask
umask $UMASK

# Fix permissions for nginx directories
chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
chown -R nginx:nginx /usr/share/nginx/html

# Execute the main command
exec "$@"
