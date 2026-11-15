[Unit]
Description=ReadBox Next.js Web Application
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service
RequiresMountsFor=/opt/vibmail/app /var/vmail /var/lib/readbox /run/vibmail

[Service]
Type=simple
User=vmail
Group=vmail
WorkingDirectory=/opt/vibmail/app
EnvironmentFile=/etc/vibmail/vibmail.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=2
UMask=0077
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/vmail /var/lib/readbox /var/lock /run/vibmail /tmp
NoNewPrivileges=true
LockPersonality=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
