user = readbox_postfix
password = {{POSTFIX_DB_PASSWORD}}
hosts = {{POSTFIX_DB_HOST}}:{{POSTFIX_DB_PORT}}
dbname = {{PG_DB_NAME}}
query = SELECT name FROM mailserver.postfix_virtual_domains WHERE name = LOWER('%s')
