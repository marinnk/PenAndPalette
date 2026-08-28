data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- タスク実行ロール：ECRからのイメージpull・CloudWatch Logsへの書き込み・
# Secrets Managerからのシークレット読み取りに使う（コンテナ起動を"実行"するAWS側の権限） ---

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.project_name}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_task_execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.db_password.arn,
      aws_secretsmanager_secret.django_secret_key.arn,
    ]
  }
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name   = "${var.project_name}-ecs-task-execution-secrets"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.ecs_task_execution_secrets.json
}

# --- タスクロール：コンテナの中で動くアプリ自身が使うAWS権限。
# RaiseTechSNS はバックエンド実装が静的アクセスキー固定だったためIAMユーザーを別途用意したが、
# PenAndPalette は django-storages / boto3 の既定認証チェーンがこのタスクロールを自動的に拾う。
# そのため静的アクセスキーは発行せず、画像用S3バケットへの権限をこのロールに直接付与する。 ---

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

data "aws_iam_policy_document" "ecs_task_s3" {
  statement {
    # 投稿・コメント・アイコン画像のアップロード／削除。読み取り（GetObject）はブラウザが
    # CloudFront経由で行うためSDKでは呼ばないが、django-storages が存在確認等で使うため含める。
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
  }
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name   = "${var.project_name}-ecs-task-s3"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task_s3.json
}
