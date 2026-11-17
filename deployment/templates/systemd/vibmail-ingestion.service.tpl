[Unit]
Description=ReadBox Maildir Ingestion Worker
After=network-online.target postgresql.service dovecot.service
Wants=network-online.target
Requires=postgresql.service
RequiresMountsFor=/opt/readbox/app /var/vmail /var/lib/readbox

[Service]
Type=simple
User=vmail
Group=vmail
WorkingDirectory=/opt/readbox/app
EnvironmentFile=/etc/readbox/readbox.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run mail:ingest -- --watch
Restart=on-failure
RestartSec=3
UMask=0077
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/vmail /var/lib/readbox /var/lock /tmp
NoNewPrivileges=true
LockPersonality=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
