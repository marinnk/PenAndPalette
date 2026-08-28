# RDSのパスワード制約に抵触する文字（/, @, ", スペース）を除いた記号のみ使う
resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

# Django の SECRET_KEY（JWT HS256 の署名鍵も兼ねる）。32バイト以上を確保する
resource "random_password" "django_secret_key" {
  length  = 50
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}/db-password"
  # 検証後にdestroy→再作成する運用のため、削除猶予期間を置かず即時削除にする
  # （置いたままだと同名シークレットの再作成時に「削除予定」エラーになる）
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "django_secret_key" {
  name                    = "${var.project_name}/django-secret-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "django_secret_key" {
  secret_id     = aws_secretsmanager_secret.django_secret_key.id
  secret_string = random_password.django_secret_key.result
}
