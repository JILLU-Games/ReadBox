[Unit]
Description=ReadBox Privileged Root Update Worker
After=network-online.target
Wants=network-online.target
RequiresMountsFor=/opt/readbox/app /run/readbox

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/readbox/app
ExecStart=/usr/bin/python3 /opt/readbox/app/scripts/updater/update_worker.py
Restart=on-failure
RestartSec=2
PrivateTmp=false
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/run/readbox /tmp /opt/readbox /opt/readbox-upgrades /etc/readbox /var/backups/readbox /var/lib/readbox
NoNewPrivileges=true
LockPersonality=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
