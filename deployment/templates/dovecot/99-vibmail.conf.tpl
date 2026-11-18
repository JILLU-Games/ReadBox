# ReadBox: private-only LMTP; no IMAP/POP3/SMTP submission or external LMTP port.
protocols = lmtp
listen = *
ssl = no
disable_plaintext_auth = yes
auth_mechanisms = plain

mail_uid = {{VMAIL_UID}}
mail_gid = {{VMAIL_GID}}
first_valid_uid = {{VMAIL_UID}}
last_valid_uid = {{VMAIL_UID}}
first_valid_gid = {{VMAIL_GID}}
last_valid_gid = {{VMAIL_GID}}

mail_home = /var/vmail/%Ld/%Ln
mail_location = maildir:/var/vmail/%Ld/%Ln/Maildir

userdb {
  driver = static
  args = uid={{VMAIL_UID}} gid={{VMAIL_GID}} home=/var/vmail/%Ld/%Ln
}

passdb {
  driver = static
  args = nopassword=y
}

service lmtp {
  inet_listener lmtp {
    address = 0.0.0.0
    port = 24
  }
}

protocol lmtp {
  postmaster_address = postmaster@{{MAIL_DOMAIN}}
}
