protocols = lmtp
ssl = required
disable_plaintext_auth = yes
auth_mechanisms = plain

mail_uid = vmail
mail_gid = vmail
first_valid_uid = {{VMAIL_UID}}
last_valid_uid = {{VMAIL_UID}}
first_valid_gid = {{VMAIL_GID}}
last_valid_gid = {{VMAIL_GID}}

mail_home = /var/vmail/%Ld/%Ln
mail_location = maildir:/var/vmail/%Ld/%Ln/Maildir

userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/vmail/%Ld/%Ln
}

passdb {
  driver = static
  args = nopassword=y
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
