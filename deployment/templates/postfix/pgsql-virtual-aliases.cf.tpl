user = {{POSTFIX_DB_USER}}
password = {{POSTFIX_DB_PASSWORD}}
hosts = 127.0.0.1
dbname = {{PG_DB_NAME}}
query = SELECT destination FROM mailserver.postfix_virtual_aliases WHERE source = LOWER('%s')
