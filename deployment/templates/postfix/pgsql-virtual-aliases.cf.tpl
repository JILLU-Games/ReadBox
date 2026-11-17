user = readbox_postfix
password = {{POSTFIX_DB_PASSWORD}}
hosts = {{POSTFIX_DB_HOST}}:{{POSTFIX_DB_PORT}}
dbname = {{PG_DB_NAME}}
query = SELECT destination FROM mailserver.postfix_virtual_aliases WHERE source = LOWER('%s')
