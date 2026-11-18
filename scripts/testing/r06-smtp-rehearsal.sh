#!/usr/bin/env bash
# R-06 scoped, CI-only wrapper around the UNMODIFIED R-03 SMTP/LMTP smoke.
# It injects a bounded Postfix greeting readiness probe into a disposable
# temporary script; the tracked R-03 mailserver implementation is untouched.
set -Eeuo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${GITHUB_REPOSITORY:-}" != "JILLU-Games/ReadBox" ]]; then
  echo "R06: SMTP smoke is limited to the isolated source CI runner." >&2
  exit 2
fi
temp="$(mktemp /tmp/r06-r03-smoke.XXXXXX.sh)"
cleanup(){ rm -f -- "$temp"; }
trap cleanup EXIT
python3 - deployment/mailserver/tests/r03-smoke.sh "$temp" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).read_text(encoding="utf-8")
marker = 'echo "R03_TEST: SMTP STARTTLS, valid recipient, invalid local recipient, nonlocal relay"'
if source.count(marker) != 1:
    raise SystemExit("R06: original SMTP smoke marker mismatch; cannot alter smoke semantics.")
readiness = r'''
# The fresh Postfix container may be 'running' before SMTP greet is served.
# One bounded startup probe, NOT a substitute for the original SMTP tests.
python3 - <<'PYSMTP'
import smtplib
import time
for attempt in range(15):
    try:
        with smtplib.SMTP("127.0.0.1", 2525, timeout=3) as smtp:
            assert smtp.ehlo()[0] == 250
        print("R06_DISPOSABLE_SMTP_GREETING_READY", flush=True)
        break
    except (OSError, smtplib.SMTPException, AssertionError):
        time.sleep(1)
else:
    raise SystemExit("R06: isolated Postfix did not become SMTP-ready within bounded startup.")
PYSMTP
'''
Path(sys.argv[2]).write_text(source.replace(marker, readiness + "\n" + marker), encoding="utf-8")
PY
bash "$temp"
echo R06_ORIGINAL_R03_FULL_SMTP_LMTP_NEGATIVES_PASS
