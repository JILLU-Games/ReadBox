[Unit]
Description=ReadBox Next.js Web Application
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service
RequiresMountsFor=/opt/readbox/app /var/vmail /var/lib/readbox /run/readbox

[Service]
Type=simple
User=vmail
Group=vmail
WorkingDirectory=/opt/readbox/app
EnvironmentFile=/etc/readbox/readbox.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=2
UMask=0077
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/vmail /var/lib/readbox /var/lock /run/readbox /tmp
NoNewPrivileges=true
LockPersonality=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
