FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    dovecot-core dovecot-lmtpd netcat-openbsd ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY deployment/templates/dovecot/99-vibmail.conf.tpl /usr/local/share/readbox/dovecot.conf.tpl
COPY deployment/mailserver/dovecot/entrypoint.sh /usr/local/sbin/readbox-dovecot
RUN chmod 0755 /usr/local/sbin/readbox-dovecot
EXPOSE 24
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=8 CMD nc -z 127.0.0.1 24
ENTRYPOINT ["/usr/local/sbin/readbox-dovecot"]
