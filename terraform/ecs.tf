resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
  tags = { Name = "${var.project_name}-cluster" }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = 7
}

locals {
  # settings.py が CloudFront ドメインを見る箇所（ALLOWED_HOSTS / CSRF / CORS / S3 配信ドメイン）
  cloudfront_domain = aws_cloudfront_distribution.main.domain_name
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  # 開発機（Apple Silicon）でクロスビルドせずに済むよう、Fargate側もARM64（Graviton）にする。
  # イメージは `docker buildx build --platform linux/arm64` で push すること。
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name         = "backend"
      image        = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential    = true
      portMappings = [{ containerPort = 8000, protocol = "tcp" }]

      # backend/config/settings.py が読む環境変数
      environment = [
        { name = "DJANGO_DEBUG", value = "false" },
        { name = "DJANGO_ALLOWED_HOSTS", value = local.cloudfront_domain },
        { name = "CSRF_TRUSTED_ORIGINS", value = "https://${local.cloudfront_domain}" },
        { name = "CORS_ALLOWED_ORIGIN_REGEXES", value = "^https://.*\\.cloudfront\\.net$" },
        { name = "DB_HOST", value = aws_db_instance.main.address },
        { name = "DB_PORT", value = "3306" },
        { name = "DB_NAME", value = var.db_name },
        { name = "DB_USER", value = var.db_username },
        # 画像用S3：非公開バケット。配信は CloudFront /media/* 経由（location=media）。
        # 認証情報は渡さず、ECSタスクロール（iam.tf）を boto3 の既定チェーンで使う。
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.media.bucket },
        { name = "AWS_S3_REGION_NAME", value = var.aws_region },
        { name = "AWS_S3_ADDRESSING_STYLE", value = "virtual" },
        { name = "AWS_S3_LOCATION", value = "media" },
        { name = "AWS_S3_CUSTOM_DOMAIN", value = local.cloudfront_domain },
        { name = "AUTH_COOKIE_SECURE", value = "true" },
        { name = "LOG_FORMAT", value = "json" },
      ]

      secrets = [
        { name = "DB_PASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn },
        { name = "DJANGO_SECRET_KEY", valueFrom = aws_secretsmanager_secret.django_secret_key.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])

  tags = { Name = "${var.project_name}-backend" }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_task.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  # 起動時に migrate → gunicorn 起動まで数十秒かかるため、ALBのヘルスチェックが
  # 追いつく前にタスクを不健全と誤判定して入れ替え続けないよう猶予期間を設ける
  health_check_grace_period_seconds = 120

  depends_on = [
    aws_lb_listener.http,
    aws_secretsmanager_secret_version.db_password,
    aws_secretsmanager_secret_version.django_secret_key,
  ]

  tags = { Name = "${var.project_name}-backend-service" }
}
