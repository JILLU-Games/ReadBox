user = readbox_postfix
password = {{POSTFIX_DB_PASSWORD}}
hosts = {{POSTFIX_DB_HOST}}:{{POSTFIX_DB_PORT}}
dbname = {{PG_DB_NAME}}
query = SELECT maildir FROM mailserver.postfix_virtual_mailboxes WHERE email = LOWER('%s')
