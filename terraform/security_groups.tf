# CloudFrontのエッジからのリクエストだけが持つ送信元IPレンジ（AWS管理のプレフィックスリスト）。
# 注意：これは「自分のCloudFrontディストリビューション限定」ではなく「AWS上の全CloudFrontエッジ」
# からの到達を許すものであり、第三者が別のディストリビューションでこのALBをオリジンに指定すれば
# 到達できてしまう限界がある。恒久対応はCloudFrontのカスタムヘッダー共有シークレット＋ALB
# リスナールールでの検証（docs/infrastructure-design.md参照、今回はスコープ外）
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name = "${var.project_name}-alb-sg"
  # AWSのSecurity Group descriptionはASCII文字のみ許可されるため英語表記にする
  description = "Allow port 80 only from CloudFront origin-facing IP ranges"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from CloudFront edge locations"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-alb-sg" }
}

resource "aws_security_group" "ecs_task" {
  name        = "${var.project_name}-ecs-task-sg"
  description = "Allow the app port only from the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "App port from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    # ECR pull・Secrets Manager・S3・CloudWatch Logs等、NAT Gateway経由のアウトバウンド
    # 通信をまとめて許可する（送信先ごとの個別許可は非現実的なため）
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ecs-task-sg" }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow port 3306 only from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from ECS tasks"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_task.id]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}
