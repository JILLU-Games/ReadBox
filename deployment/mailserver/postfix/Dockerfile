FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    postfix postfix-pgsql ca-certificates openssl python3-minimal \
    && rm -rf /var/lib/apt/lists/*
COPY deployment/mailserver/postfix/main.cf.tpl /usr/local/share/readbox/main.cf.tpl
COPY deployment/mailserver/postfix/master.cf /etc/postfix/master.cf
COPY deployment/templates/postfix/pgsql-virtual-domains.cf.tpl /usr/local/share/readbox/pgsql-virtual-domains.cf.tpl
COPY deployment/templates/postfix/pgsql-virtual-mailboxes.cf.tpl /usr/local/share/readbox/pgsql-virtual-mailboxes.cf.tpl
COPY deployment/templates/postfix/pgsql-virtual-aliases.cf.tpl /usr/local/share/readbox/pgsql-virtual-aliases.cf.tpl
COPY deployment/mailserver/postfix/entrypoint.sh /usr/local/sbin/readbox-postfix
RUN chmod 0755 /usr/local/sbin/readbox-postfix
EXPOSE 25
HEALTHCHECK --interval=15s --timeout=8s --start-period=15s --retries=8 CMD postfix status >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/usr/local/sbin/readbox-postfix"]
